/** Bounded queue animation for the panda night stall. No DOM dependencies.
 * x/y are the center-bottom (foot) anchor of the WHOLE sprite; size is height.
 * getActors() returns stable, read-only-by-convention actor objects.
 * All timing is in seconds and driven by update(dt), never by browser timers.
 */
export const WORLD = Object.freeze({ width: 1800, height: 1000 });
export const MAX_QUEUE_COUNT = 80;
export const ZONES = Object.freeze({
  cat: Object.freeze({ x: 95, y: 345, w: 1050, h: 260 }),
  corgi: Object.freeze({ x: 95, y: 650, w: 1050, h: 275 }),
});
export const PRESETS = Object.freeze({
  quiet: Object.freeze({ cat: 6, corgi: 5 }),
  busy: Object.freeze({ cat: 18, corgi: 16 }),
  peak: Object.freeze({ cat: 45, corgi: 40 }),
});
const SPECIES = ['cat', 'corgi'];
const TAU = Math.PI * 2;
const DEFAULT_ASPECT = { cat: 1.10, corgi: 1.34 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const countValue = v => {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : clamp(Math.trunc(n), 0, MAX_QUEUE_COUNT);
};
function speciesKey(value) {
  const s = String(value).toLowerCase();
  if (s === 'cat' || s === 'cats') return 'cat';
  if (s === 'dog' || s === 'dogs' || s === 'corgi' || s === 'corgis') return 'corgi';
  throw new TypeError(`Unknown queue species: ${value}`);
}

/** Perspective serpentine. Index 0 is the large, near service head.
 * Each rear row is smaller, slightly narrower and farther left. Slots carry
 * their own size/width; row heights reserve the ENTIRE body above a foot anchor.
 */
export function layoutQueue(count, zone, options = {}) {
  const n = countValue(count);
  const z = { x: finite(zone?.x, 95), y: finite(zone?.y, 345),
    w: Math.max(1, finite(zone?.w, 1050)), h: Math.max(1, finite(zone?.h, 260)) };
  const aspect = clamp(finite(options.aspect, 1.1), 0.45, 2.5);
  const pad = clamp(finite(options.padding, 12), 0, Math.min(z.w, z.h) / 6);
  const maxHeight = Math.max(12, finite(options.maxHeight, 194));
  const frontGapRatio = clamp(finite(options.gapXRatio, 0.12), 0.04, 0.7);
  const usableW = z.w - pad * 2, usableH = z.h - pad * 2;
  const factors = [1, 0.43, 0.27, 0.17, 0.11, 0.075, 0.05, 0.035];
  const rowGaps = [5, 3, 2, 2, 1.5, 1.5, 1.5];
  const candidates = [];
  function plan(rows, frontSize) {
    const frontWidth = frontSize * aspect;
    const headX = z.x + z.w - pad - frontWidth / 2;
    let footY = z.y + z.h - pad;
    const bands = [];
    for (let row = 0; row < rows; row += 1) {
      const size = frontSize * factors[row], width = size * aspect;
      const gapRatio = row === 0 ? frontGapRatio : Math.max(0.06, 0.105 - row * 0.015);
      const gapX = Math.max(1.5, size * gapRatio);
      const right = headX - row * 18;
      const availableW = Math.min(usableW * Math.pow(0.97, row), right + width / 2 - (z.x + pad));
      const capacity = Math.max(1, Math.min(row === 0 ? 7 : MAX_QUEUE_COUNT,
        Math.floor((availableW + gapX + 1e-6) / (width + gapX))));
      const left = right - (capacity - 1) * (width + gapX);
      bands.push({ row, size, width, gapX, gapY: rowGaps[row] || 0,
        capacity, right, left, y: footY, face: row % 2 === 0 ? 1 : -1 });
      footY -= size + (rowGaps[row] || 0);
    }
    return { frontSize, bands, capacity: bands.reduce((sum, band) => sum + band.capacity, 0) };
  }
  if (n <= 7) {
    const columns = Math.max(1, n);
    const size = Math.min(maxHeight, usableH,
      usableW / (columns * aspect + (columns - 1) * frontGapRatio));
    const single = plan(1, size);
    single.bands[0].capacity = columns;
    single.bands[0].left = single.bands[0].right - (columns - 1) * (single.bands[0].width + single.bands[0].gapX);
    candidates.push(single);
  } else {
    for (let rows = 2; rows <= factors.length; rows += 1) {
      const verticalGaps = rowGaps.slice(0, rows - 1).reduce((sum, gap) => sum + gap, 0);
      const ratioSum = factors.slice(0, rows).reduce((sum, ratio) => sum + ratio, 0);
      const frontSize = Math.min(maxHeight, 170, (usableH - verticalGaps) / ratioSum);
      if (frontSize <= 0) continue;
      const candidate = plan(rows, frontSize);
      if (candidate.capacity >= n) candidates.push(candidate);
    }
  }
  // Tiny custom zones or extreme sprite ratios still produce a valid layout.
  if (!candidates.length) {
    let frontSize = Math.min(maxHeight, usableH / 2.2);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidate = plan(factors.length, frontSize);
      if (candidate.capacity >= n) { candidates.push(candidate); break; }
      frontSize *= 0.92;
    }
  }
  let best = candidates.reduce((a, b) => b.frontSize > a.frontSize ? b : a);
  const previous = candidates.find(c => c.bands.length === options.previousRows);
  if (previous && previous.frontSize >= best.frontSize * 0.92) best = previous;
  const slots = [], bands = [];
  for (const band of best.bands) {
    const amount = Math.min(n - slots.length, band.capacity);
    if (amount <= 0) break;
    bands.push({ ...band, count: amount, startIndex: slots.length });
    for (let column = 0; column < amount; column += 1) {
      slots.push({ index: slots.length, row: band.row, column,
        face: band.face, size: band.size, width: band.width,
        x: band.face === 1 ? band.right - column * (band.width + band.gapX)
          : band.left + column * (band.width + band.gapX), y: band.y });
    }
  }
  const first = best.bands[0];
  return { count: n, zone: z, aspect, padding: pad,
    size: first.size, width: first.width, gapX: first.gapX, gapY: first.gapY,
    rows: bands.length, columns: bands.length ? Math.max(...bands.map(b => b.capacity)) : 0,
    rowPlans: bands, rowHeights: bands.map(b => b.size), perspective: true, slots,
    head: slots[0] || null, tail: slots[n - 1] || null,
    path: slots.map(({ x, y, size, width, row }) => ({ x, y, size, width, row })) };
}
export const createQueueLayout = layoutQueue;

export class QueueScene {
  constructor(options = {}) {
    this.world = { ...WORLD };
    this.zones = { cat: { ...ZONES.cat }, corgi: { ...ZONES.corgi } };
    this.aspect = {
      cat: clamp(finite(options.aspects?.cat ?? options.catAspect, DEFAULT_ASPECT.cat), 0.45, 2.5),
      corgi: clamp(finite(options.aspects?.corgi ?? options.dogAspect, DEFAULT_ASPECT.corgi), 0.45, 2.5),
    };
    this.maxHeight = { cat: finite(options.maxHeights?.cat, 194), corgi: finite(options.maxHeights?.corgi, 190) };
    this.queues = { cat: [], corgi: [] };
    this.layouts = {};
    this.outgoing = [];
    this.events = [];
    this.time = 0;
    this.serial = 0;
    this.servedCount = 0;
    this.servedBySpecies = { cat: 0, corgi: 0 };
    this.auto = options.auto !== false;
    this.paused = Boolean(options.paused);
    this.autoArrivals = options.autoArrivals !== false;
    this.autoInterval = clamp(finite(options.autoInterval, 4.5), 2.5, 30);
    this.autoClock = 0;
    this.autoStep = 0;
    this.autoJobs = [];
    this.holdUntil = { cat: 0, corgi: 0 };
    this.maxOutgoing = 160;
    this.autoTargets = {
      cat: countValue(options.catCount ?? options.cats ?? 6),
      corgi: countValue(options.dogCount ?? options.corgis ?? options.dogs ?? 5),
    };
    for (const species of SPECIES) {
      this.layouts[species] = this._layout(species, this.autoTargets[species]);
      for (const slot of this.layouts[species].slots) this.queues[species].push(this._makeActor(species, slot, false));
    }
  }

  _layout(species, count) {
    return layoutQueue(count, this.zones[species], { aspect: this.aspect[species],
      maxHeight: this.maxHeight[species], previousRows: this.layouts[species]?.rows });
  }

  _makeActor(species, slot, arriving) {
    const serial = ++this.serial;
    const z = this.zones[species];
    // A bounded short entrance from the left of its slot. Bulk presets do not
    // pile dozens of sprites onto one off-screen spawn point.
    const minX = z.x + 12 + slot.width / 2;
    const entryX = Math.max(minX, slot.x - Math.min(72, slot.width * 0.58));
    const actor = {
      id: `${species}-${serial}`, species,
      x: arriving ? entryX : slot.x, y: slot.y,
      targetX: slot.x, targetY: slot.y,
      size: arriving ? slot.size * 0.9 : slot.size,
      targetSize: slot.size, aspect: this.aspect[species],
      width: slot.width, face: arriving ? 1 : slot.face, targetFace: slot.face,
      row: slot.row, column: slot.column, queueIndex: slot.index,
      state: arriving ? 'arriving' : 'waiting', status: arriving ? 'arriving' : 'waiting',
      moving: arriving, walkPhase: (serial * 2.399963) % TAU,
      idlePhase: (serial * 1.618034) % TAU, bob: 0, happy: 0,
      alpha: arriving ? 0 : 1,
      _new: arriving, _age: 0, _path: [], _pathIndex: 0,
      _queuePath: [], _queuePathIndex: 0, _queueSegment: null, _segmentFrom: null,
      _dwell: 0, _served: false, _exitFade: 0,
    };
    actor.width = actor.size * actor.aspect;
    return actor;
  }

  _status(actor, state) { actor.state = state; actor.status = state; }
  _emit(type, actor, extra = {}) {
    this.events.push({ type, species: actor.species, id: actor.id, x: actor.x, y: actor.y, time: this.time, ...extra });
    // A bounded notification buffer protects sessions that never drain it.
    if (this.events.length > 2048) this.events.splice(0, this.events.length - 2048);
  }

  _retarget(species) {
    const previous = this.layouts[species];
    const layout = this._layout(species, this.queues[species].length);
    this.layouts[species] = layout;
    this.queues[species].forEach((actor, index) => {
      const slot = layout.slots[index];
      const oldIndex = actor.queueIndex;
      const changed = oldIndex !== index || Math.abs(actor.targetX - slot.x) > 0.001 ||
        Math.abs(actor.targetY - slot.y) > 0.001 || Math.abs(actor.targetSize - slot.size) > 0.001;
      if (changed) {
        const route = [];
        if (!actor._new && oldIndex > index && previous) {
          for (let k = oldIndex - 1; k >= index; k -= 1) {
            const oldSlot = previous.slots[k];
            if (oldSlot) route.push({ x: oldSlot.x, y: oldSlot.y, size: oldSlot.size });
          }
        }
        const last = route[route.length - 1];
        if (!last || distance(last, slot) > 0.001 || Math.abs(last.size - slot.size) > 0.001)
          route.push({ x: slot.x, y: slot.y, size: slot.size });
        actor._queuePath = route; actor._queuePathIndex = 0;
        actor._queueSegment = { x: actor.x, y: actor.y, size: actor.size };
      }
      actor.targetX = slot.x; actor.targetY = slot.y; actor.targetSize = slot.size;
      actor.targetFace = slot.face; actor.row = slot.row;
      actor.column = slot.column; actor.queueIndex = index;
      if (!actor._new) this._status(actor, 'advancing');
    });
  }

  setCounts(catCount, dogCount) {
    if (catCount && typeof catCount === 'object') {
      const values = catCount;
      catCount = values.cat ?? values.cats ?? values.catCount ?? this.queues.cat.length;
      dogCount = values.corgi ?? values.corgis ?? values.dog ?? values.dogs ?? values.dogCount ?? this.queues.corgi.length;
    }
    const desired = { cat: countValue(catCount), corgi: countValue(dogCount) };
    this.autoJobs.length = 0;
    this.autoTargets = { ...desired };
    for (const species of SPECIES) {
      const queue = this.queues[species];
      while (queue.length > desired[species]) {
        const actor = queue.pop();
        this._emit('depart', actor, { reason: 'count-adjustment', served: false });
      }
      const nextLayout = this._layout(species, desired[species]);
      while (queue.length < desired[species]) queue.push(this._makeActor(species, nextLayout.slots[queue.length], true));
      this._retarget(species);
      this.holdUntil[species] = Math.min(this.holdUntil[species], this.time + 0.35);
    }
    return this.getState();
  }

  _add(species, amount, changeAutoTarget) {
    const current = this.queues[species].length;
    const added = Math.min(countValue(amount), MAX_QUEUE_COUNT - current);
    if (!added) return 0;
    const nextLayout = this._layout(species, current + added);
    for (let i = 0; i < added; i += 1) this.queues[species].push(this._makeActor(species, nextLayout.slots[current + i], true));
    this._retarget(species);
    if (changeAutoTarget) this.autoTargets[species] = Math.min(MAX_QUEUE_COUNT, this.autoTargets[species] + added);
    return added;
  }
  add(species, amount = 1) { return this._add(speciesKey(species), amount, true); }

  serve(catNumber = 0, dogNumber = 0) {
    if (catNumber && typeof catNumber === 'object') {
      const v = catNumber;
      catNumber = v.cat ?? v.cats ?? 0;
      dogNumber = v.corgi ?? v.corgis ?? v.dog ?? v.dogs ?? 0;
    }
    const result = { cat: 0, corgi: 0, dog: 0, total: 0 };
    for (const [species, request] of [['cat', catNumber], ['corgi', dogNumber]]) {
      const queue = this.queues[species], n = Math.min(queue.length, countValue(request));
      if (!n) continue;
      const former = queue.map(a => ({ x: a.x, y: a.y, size: a.size }));
      const serviceSize = Math.min(this.maxHeight[species], Math.max(120, this.layouts[species].size));
      const selected = queue.splice(0, n);
      let longestQueueRoute = 0;
      selected.forEach((actor, index) => {
        const points = [];
        // Follow predecessors through the existing serpentine rather than
        // cutting diagonally through every row when a batch is served.
        for (let i = index - 1; i >= 0; i -= 1) points.push({ ...former[i] });
        // Cats collect at the left edge of the cart. Their feet must not
        // travel across the countertop on the way to the lower exit lane.
        const gate = { x: species === 'cat' ? 1160 : 1243, y: former[0].y, size: serviceSize };
        points.push(gate);
        const pickup = species === 'cat' ? { x: 1160, y: 690, size: serviceSize } : { x: 1255, y: 914, size: serviceSize };
        points.push(pickup);
        actor._path = points; actor._pathIndex = 0;
        actor._segmentFrom = { x: actor.x, y: actor.y, size: actor.size };
        actor._speed = 190 + actor.size * 0.34;
        actor._new = false; actor._served = false; actor.alpha = 1;
        actor.targetX = pickup.x; actor.targetY = pickup.y;
        actor.targetSize = serviceSize; actor.queueIndex = -1;
        actor.moving = true; actor.happy = 0;
        this._status(actor, 'serving');
        let route = 0, from = actor;
        for (const point of points.slice(0, -1)) { route += distance(from, point); from = point; }
        longestQueueRoute = Math.max(longestQueueRoute, route / actor._speed);
        this.outgoing.push(actor);
      });
      // Clear the selected convoy before the resized queue advances into its
      // old slots. This also avoids a suddenly enlarged head covering a batch.
      this.holdUntil[species] = Math.max(this.holdUntil[species], this.time + Math.min(longestQueueRoute + 0.12, 8));
      this._retarget(species);
      result[species] = n; result.total += n;
    }
    result.dog = result.corgi;
    // Only old departure effects can be retired; every waiting animal is kept.
    while (this.outgoing.length > this.maxOutgoing) {
      const actor = this.outgoing.shift();
      if (!actor._served) this._completeService(actor);
      this._emit('depart', actor, { reason: 'departure-cap', served: true });
    }
    return result;
  }

  _completeService(actor) {
    if (actor._served) return;
    actor._served = true;
    this.servedCount += 1; this.servedBySpecies[actor.species] += 1;
    this._emit('serve', actor);
  }

  _moveToward(actor, point, dt, speed, easing = false) {
    const dx = point.x - actor.x, dy = point.y - actor.y, d = Math.hypot(dx, dy);
    if (d < 0.45) { actor.x = point.x; actor.y = point.y; return true; }
    const step = Math.min(d, speed * dt, easing ? d * (1 - Math.exp(-7.5 * dt)) : Infinity);
    if (Math.abs(dx) > 0.4) actor.face = dx > 0 ? 1 : -1;
    actor.x += dx / d * step; actor.y += dy / d * step;
    actor.moving = step > 0.01;
    return step >= d - 0.001;
  }

  _sizeAlong(actor, point, position, segment, dt) {
    const start = segment || actor, target = finite(point.size, actor.targetSize);
    const dx = point.x - start.x, dy = point.y - start.y, square = dx * dx + dy * dy;
    if (square < 0.2) return actor.size + (target - actor.size) * (1 - Math.exp(-6.5 * dt));
    const progress = clamp(((position.x - start.x) * dx + (position.y - start.y) * dy) / square, 0, 1);
    return start.size + (target - start.size) * progress;
  }

  _updateQueue(species, dt) {
    const held = this.time < this.holdUntil[species] || this._queueBlockedByService(species);
    for (const actor of this.queues[species]) {
      actor._age += dt; actor.idlePhase += dt * 1.7; actor.moving = false;
      actor.alpha = Math.min(1, actor.alpha + dt * 4.5);
      if (!held) {
        const route = actor._queuePath;
        const point = route[actor._queuePathIndex] || { x: actor.targetX, y: actor.targetY, size: actor.targetSize };
        if (!actor._queueSegment) actor._queueSegment = { x: actor.x, y: actor.y, size: actor.size };
        const finalSegment = !route.length || actor._queuePathIndex >= route.length - 1;
        const reached = this._moveToward(actor, point, dt, 240 + actor.size * 0.5, finalSegment);
        actor.size = this._sizeAlong(actor, point, actor, actor._queueSegment, dt);
        if (Math.abs(actor.size - point.size) < 0.025) actor.size = point.size;
        actor.width = actor.size * actor.aspect;
        const sizeReady = Math.abs(actor.size - point.size) < 0.03;
        if (reached && sizeReady && !finalSegment) {
          actor._queuePathIndex += 1;
          actor._queueSegment = { x: actor.x, y: actor.y, size: actor.size };
        } else if (reached && sizeReady) {
          actor.x = actor.targetX; actor.y = actor.targetY; actor.face = actor.targetFace;
          actor.moving = false;
          actor._queuePath = []; actor._queuePathIndex = 0; actor._queueSegment = null;
          if (actor._new) { actor._new = false; this._emit('arrive', actor); }
          this._status(actor, 'waiting');
        } else this._status(actor, actor._new ? 'arriving' : 'advancing');
      }
      actor.walkPhase = (actor.walkPhase + (actor.moving ? 11 : 0) * dt) % TAU;
      actor.bob = actor.moving ? Math.sin(actor.walkPhase) * actor.size * 0.025 : Math.sin(actor.idlePhase) * actor.size * 0.006;
      // The body envelope stays inside the zone during density transitions,
      // including temporary growth before a new row target has been reached.
      const z = this.zones[species], half = actor.width / 2;
      actor.x = clamp(actor.x, z.x + 3 + half, z.x + z.w - 3 - half);
      actor.y = clamp(actor.y, z.y + 3 + actor.size, z.y + z.h - 3);
    }
  }

  _queueBlockedByService(species) {
    const z = this.zones[species], gap = 7;
    return this.outgoing.some(a => a.species === species && a.alpha > 0.15 &&
      a.x - a.width / 2 < z.x + z.w + gap && a.x + a.width / 2 > z.x - gap &&
      a.y - a.size < z.y + z.h + gap && a.y > z.y - gap);
  }

  _updateOutgoing(dt) {
    for (let i = this.outgoing.length - 1; i >= 0; i -= 1) {
      const actor = this.outgoing[i];
      if (actor.state === 'called') continue;
      actor._age += dt; actor.moving = false;
      if (actor.state === 'happy') {
        actor._dwell -= dt; actor.happy = 1;
        if (actor._dwell <= 0) {
          actor.happy = 0.6;
          const exit = { x: this.world.width - 18 - actor.width / 2, y: this.world.height - 18, size: actor.size };
          actor._path = [actor.species === 'cat'
            ? { x: 1160, y: 950, size: actor.size }
            : { x: Math.max(1360, actor.x + 90), y: 952, size: actor.size }, exit];
          actor._pathIndex = 0; actor.targetX = exit.x; actor.targetY = exit.y;
          actor._segmentFrom = { x: actor.x, y: actor.y, size: actor.size };
          this._status(actor, 'exiting');
        }
      } else if (actor.state === 'departing') {
        actor._exitFade += dt;
        actor.alpha = Math.max(0, 1 - actor._exitFade / 0.32);
        if (actor.alpha <= 0) {
          this._emit('depart', actor, { served: true });
          this.outgoing.splice(i, 1); continue;
        }
      } else {
        const point = actor._path[actor._pathIndex];
        actor._speed = 190 + actor.size * 0.34;
        let blocked = false;
        if (point && actor.state === 'serving') {
          // The preceding customer owns the approach space while collecting
          // food and until their whole body clears it. Merely delaying the
          // next serve event would still let the two sprites pile together.
          let predecessor = null;
          for (let j = i - 1; j >= 0; j -= 1) {
            if (this.outgoing[j].species === actor.species) {
              predecessor = this.outgoing[j]; break;
            }
          }
          if (predecessor && predecessor.alpha > 0.15) {
            const dx = point.x - actor.x, dy = point.y - actor.y;
            const d = Math.hypot(dx, dy), step = Math.min(d, actor._speed * dt);
            const proposed = d > 0 ? { x: actor.x + dx / d * step, y: actor.y + dy / d * step } : { x: actor.x, y: actor.y };
            proposed.size = this._sizeAlong(actor, point, proposed, actor._segmentFrom, dt);
            proposed.width = proposed.size * actor.aspect;
            const gap = Math.max(7, Math.min(actor.size, predecessor.size) * 0.07);
            const risk = p => {
              const ox = Math.max(0, ((p.width ?? actor.width) + predecessor.width) / 2 + gap - Math.abs(p.x - predecessor.x));
              const oy = Math.max(0, Math.min(p.y, predecessor.y) + gap - Math.max(p.y - (p.size ?? actor.size), predecessor.y - predecessor.size));
              return ox * oy;
            };
            const nextRisk = risk(proposed), currentRisk = risk(actor);
            // If a density change has already put bodies close, allow only
            // motion that separates them; otherwise retain the safety gap.
            blocked = nextRisk > 0.001 && nextRisk >= currentRisk - 0.001;
          }
        }
        if (point && !blocked) {
          const reached = this._moveToward(actor, point, dt, actor.state === 'exiting' ? actor._speed * 1.25 : actor._speed);
          actor.size = this._sizeAlong(actor, point, actor, actor._segmentFrom, dt);
          if (Math.abs(actor.size - point.size) < 0.025) actor.size = point.size;
          actor.width = actor.size * actor.aspect;
          if (reached && Math.abs(actor.size - point.size) < 0.03) {
            actor._pathIndex += 1;
            actor._segmentFrom = { x: actor.x, y: actor.y, size: actor.size };
          }
          if (actor._pathIndex >= actor._path.length) {
            actor.moving = false;
            if (actor.state === 'serving') {
              this._completeService(actor);
              actor._dwell = 0.6;
              actor.happy = 1; actor.face = 1;
              this._status(actor, 'happy');
            } else { actor._exitFade = 0; this._status(actor, 'departing'); }
          }
        }
      }
      actor.walkPhase = (actor.walkPhase + (actor.moving ? 12 : 0) * dt) % TAU;
      actor.bob = actor.moving ? Math.sin(actor.walkPhase) * actor.size * 0.025 : 0;
      actor.x = clamp(actor.x, 3 + actor.width / 2, this.world.width - 3 - actor.width / 2);
      actor.y = clamp(actor.y, 3 + actor.size, this.world.height - 3);
    }
  }

  _scheduleRefill(species) {
    if (!this.autoArrivals) return;
    const pending = this.autoJobs.filter(j => j.species === species).reduce((sum, j) => sum + j.count, 0);
    let missing = Math.max(0, this.autoTargets[species] - this.queues[species].length - pending);
    let burst = 0;
    while (missing > 0) {
      const count = Math.min(2, missing);
      this.autoJobs.push({ species, count, due: this.time + 1.6 + burst * 0.65 });
      missing -= count; burst += 1;
    }
  }

  _updateAuto(dt) {
    if (!this.auto) return;
    for (let i = this.autoJobs.length - 1; i >= 0; i -= 1) {
      const job = this.autoJobs[i];
      if (job.due <= this.time) {
        // Do not spawn replacement heads on top of the outgoing convoy.
        if (this._queueBlockedByService(job.species)) continue;
        const room = Math.max(0, this.autoTargets[job.species] - this.queues[job.species].length);
        this._add(job.species, Math.min(room, job.count), false);
        this.autoJobs.splice(i, 1);
      }
    }
    this.autoClock += dt;
    if (this.autoClock >= this.autoInterval) {
      this.autoClock %= this.autoInterval;
      const patterns = [[3, 0], [0, 5], [2, 2]];
      const batch = patterns[this.autoStep++ % patterns.length];
      this.serve(batch[0], batch[1]);
      for (const species of SPECIES) this._scheduleRefill(species);
    }
  }

  update(dt) {
    if (this.paused) return this.getState();
    const step = clamp(finite(dt, 0), 0, 0.25);
    if (!step) return this.getState();
    this.time += step;
    this._updateAuto(step);
    for (const species of SPECIES) this._updateQueue(species, step);
    this._updateOutgoing(step);
    return this.getState();
  }

  setAuto(enabled) {
    this.auto = Boolean(enabled);
    if (!this.auto) this.autoJobs.length = 0;
    else {
      this.autoClock = 0;
      for (const species of SPECIES) this._scheduleRefill(species);
    }
    return this.auto;
  }
  setPaused(paused) { this.paused = Boolean(paused); return this.paused; }
  setAutoArrivals(enabled) {
    this.autoArrivals = Boolean(enabled);
    if (!this.autoArrivals) this.autoJobs.length = 0;
    return this.autoArrivals;
  }
  setSpriteAspects(aspects = {}) {
    for (const species of SPECIES) {
      const value = species === 'corgi' ? aspects.corgi ?? aspects.dog : aspects.cat;
      if (Number.isFinite(Number(value)) && Number(value) > 0) {
        this.aspect[species] = clamp(Number(value), 0.45, 2.5);
        for (const actor of this.queues[species]) actor.aspect = this.aspect[species];
        this._retarget(species);
      }
    }
  }
  getActors() { return [...this.queues.cat, ...this.queues.corgi, ...this.outgoing]; }
  getLayout() { return { cat: this.layouts.cat, corgi: this.layouts.corgi, zones: this.zones, world: this.world }; }
  getState() {
    const catCount = this.queues.cat.length, dogCount = this.queues.corgi.length;
    return { catCount, dogCount, corgiCount: dogCount, total: catCount + dogCount,
      counts: { cat: catCount, corgi: dogCount },
      servedCount: this.servedCount, servedBySpecies: { ...this.servedBySpecies },
      outgoingCount: this.outgoing.length, actorCount: catCount + dogCount + this.outgoing.length,
      auto: this.auto, paused: this.paused, autoArrivals: this.autoArrivals,
      time: this.time, maxCount: MAX_QUEUE_COUNT,
      targetCounts: { ...this.autoTargets } };
  }
  drainEvents() { return this.events.splice(0); }
}

/** The game has continuous arrivals and a faster batch clock than the demo.
 * Keep one physical FIFO, including customers whose food is ready. A new pot
 * marks its customers ready without replacing their routes halfway through a
 * step. All movement follows the supplied perspective path in one direction.
 */
export class GameQueueScene extends QueueScene {
  constructor(options = {}) {
    super({ ...options, auto: false, autoArrivals: false });
    this.lines = { cat: [...this.queues.cat], corgi: [...this.queues.corgi] };
    this.tracks = {}; this.bends = {};
    for (const species of SPECIES) {
      this.tracks[species] = this._layout(species, MAX_QUEUE_COUNT).slots;
      this.lines[species].forEach((actor, index) => { actor._trackPos = index; actor._ready = false; });
      this.bends[species] = [];
      for (let i = 1; i < this.tracks[species].length; i++) {
        if (this.tracks[species][i].row === this.tracks[species][i - 1].row) continue;
        let hold = i + 1;
        while (hold < this.tracks[species].length - 1) {
          const slot = this.tracks[species][hold];
          const sweep = Array.from({ length: 21 }, (_, j) => this._point(species, i - j / 20));
          if (!sweep.some(point => this._overlaps(species, point, slot))) break;
          hold++;
        }
        this.bends[species].push({ start: i, hold });
      }
    }
  }

  _layout(species, count) {
    // Reserve the perspective lanes once. Arrivals no longer shrink/grow or
    // turn around the customers already waiting at the front.
    const full = layoutQueue(MAX_QUEUE_COUNT, this.zones[species], {
      aspect: this.aspect[species], maxHeight: this.maxHeight[species],
    });
    const slots = full.slots.slice(0, count);
    const rowPlans = full.rowPlans.filter(row => row.startIndex < count)
      .map(row => ({ ...row, count: Math.min(row.count, count - row.startIndex) }));
    return { ...full, count, slots, rowPlans, rows: rowPlans.length,
      head: slots[0] || null, tail: slots.at(-1) || null, path: slots };
  }

  _point(species, position) {
    const slots = this.tracks[species], size = slots[0].size;
    const point = index => index >= 0 ? slots[Math.min(index, slots.length - 1)]
      : index === -1 ? { x: species === 'cat' ? 1160 : 1243, y: slots[0].y, size }
        : { x: species === 'cat' ? 1160 : 1255, y: species === 'cat' ? 690 : 914, size };
    const lower = Math.floor(position), a = point(lower), b = point(lower + 1), t = position - lower;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
      size: a.size + (b.size - a.size) * t };
  }

  _overlaps(species, point, other) {
    const gap = Math.min(4, Math.min(point.size, other.size) * .035);
    return Math.abs(point.x - other.x) < (point.size * this.aspect[species] + other.width) / 2 + gap &&
      Math.min(point.y, other.y) - Math.max(point.y - point.size, other.y - other.size) > -gap;
  }

  add(value, amount = 1) {
    const species = speciesKey(value), queue = this.queues[species], line = this.lines[species];
    const n = Math.min(countValue(amount), MAX_QUEUE_COUNT - line.length);
    for (let i = 0; i < n; i++) {
      let position = line.length ? Math.max(0, Math.ceil(line.at(-1)._trackPos) + 1) : 0;
      for (const bend of this.bends[species]) {
        const tail = line.at(-1)?._trackPos;
        if (tail > bend.start - 1 && tail < bend.hold + 1) position = Math.max(position, bend.hold);
      }
      const occupied = this.getActors().filter(actor => actor.species === species);
      while (position < MAX_QUEUE_COUNT - 1 && occupied.some(actor => this._overlaps(species, this._point(species, position), actor))) position += 1;
      const point = this._point(species, position);
      const slot = { ...point, width: point.size * this.aspect[species], index: queue.length,
        face: this.tracks[species][Math.min(Math.floor(position), MAX_QUEUE_COUNT - 1)].face };
      const actor = this._makeActor(species, slot, false);
      actor.alpha = 0; actor._trackPos = position; actor._ready = false; actor._new = true;
      queue.push(actor); line.push(actor);
    }
    this.layouts[species] = this._layout(species, line.length);
    return n;
  }

  serve(catNumber = 0, dogNumber = 0) {
    const result = { cat: 0, corgi: 0, dog: 0, total: 0 };
    for (const [species, request] of [['cat', catNumber], ['corgi', dogNumber]]) {
      const queue = this.queues[species], n = Math.min(queue.length, countValue(request));
      for (const actor of queue.splice(0, n)) {
        actor._ready = true; actor.queueIndex = -1;
        this._status(actor, 'called'); this.outgoing.push(actor);
      }
      queue.forEach((actor, index) => { actor.queueIndex = index; });
      result[species] = n; result.total += n;
    }
    result.dog = result.corgi;
    return result;
  }

  _pickupBusy(species) {
    const pickup = this._point(species, -2);
    return this.outgoing.some(actor => actor.species === species && actor.state !== 'called' && actor.alpha > .15 &&
      Math.abs(actor.x - pickup.x) < (actor.width + pickup.size * this.aspect[species]) / 2 + 8 &&
      Math.min(actor.y, pickup.y) - Math.max(actor.y - actor.size, pickup.y - pickup.size) > -8);
  }

  _moveToward(actor, point, dt, speed, easing = false) {
    // Both species share the last exit lane. Let the customer ahead clear it
    // instead of drawing a cat and a dog on top of one another all the way out.
    if (actor.state === 'exiting' && actor._pathIndex >= 1) {
      const dx = point.x - actor.x, dy = point.y - actor.y, length = Math.hypot(dx, dy);
      const travel = Math.min(length, speed * dt);
      const proposed = { x: actor.x + (length ? dx / length * travel : 0),
        y: actor.y + (length ? dy / length * travel : 0), size: actor.size };
      for (const other of this.outgoing) {
        if (other === actor || other.alpha <= .15 || other.x <= actor.x ||
          !['exiting', 'departing'].includes(other.state)) continue;
        if (this._overlaps(actor.species, proposed, other)) {
          actor.moving = false; return false;
        }
      }
    }
    return super._moveToward(actor, point, dt, speed, easing);
  }

  update(dt) {
    if (this.paused) return this.getState();
    const step = clamp(finite(dt, 0), 0, .25);
    if (!step) return this.getState();
    this.time += step;
    this._updateOutgoing(step);
    for (const species of SPECIES) {
      const line = this.lines[species];
      let predecessor = null;
      const ahead = [];
      for (const actor of [...line]) {
        let stop = actor._ready ? -2 : 0;
        if (predecessor) {
          stop = Math.max(stop, predecessor._trackPos + 1);
          // Leave space before a bend: the leader grows as it comes forward.
          // Holding the follower early avoids a large sprite growing into it.
          for (const bend of this.bends[species]) {
            if (predecessor._trackPos > bend.start - 1 && predecessor._trackPos < bend.hold + 1) stop = Math.max(stop, bend.hold);
          }
        }
        else if (actor._ready && this._pickupBusy(species)) stop = -1;
        const oldX = actor.x, oldY = actor.y, oldPosition = actor._trackPos;
        let remaining = (190 + actor.size * .34) * step;
        while (actor._trackPos > stop + 1e-6 && remaining > 1e-6) {
          const next = Math.max(stop, Math.ceil(actor._trackPos) - 1);
          const from = this._point(species, actor._trackPos), to = this._point(species, next);
          const length = distance(from, to);
          const fraction = length > 1e-6 ? Math.min(1, remaining / length) : 1;
          actor._trackPos += (next - actor._trackPos) * fraction;
          remaining -= length * fraction;
        }
        // On a perspective bend, one slot of distance can be less than a
        // body's clearance. Stop at the safe point, never reverse or jump.
        const blocked = position => {
          const point = this._point(species, position);
          return ahead.some(other => this._overlaps(species, point, other));
        };
        if (actor._trackPos < oldPosition - 1e-8 && blocked(actor._trackPos) && !blocked(oldPosition)) {
          let unsafe = actor._trackPos, safe = oldPosition;
          for (let i = 0; i < 12; i++) {
            const middle = (unsafe + safe) / 2;
            if (blocked(middle)) unsafe = middle; else safe = middle;
          }
          actor._trackPos = safe;
        }
        const point = this._point(species, actor._trackPos);
        actor.x = point.x; actor.y = point.y; actor.size = point.size; actor.width = point.size * actor.aspect;
        actor.targetX = this._point(species, stop).x; actor.targetY = this._point(species, stop).y;
        actor.targetSize = this._point(species, stop).size;
        const travelled = Math.hypot(actor.x - oldX, actor.y - oldY);
        actor.moving = travelled > .01;
        if (Math.abs(actor.x - oldX) > .03) actor.face = actor.x > oldX ? 1 : -1;
        actor._age += step; actor.alpha = Math.min(1, actor.alpha + step * 3);
        actor.idlePhase += step * 1.7;
        actor.walkPhase = (actor.walkPhase + (actor.moving ? 11 : 0) * step) % TAU;
        const bob = actor.moving ? Math.sin(actor.walkPhase) * actor.size * .025 : Math.sin(actor.idlePhase) * actor.size * .006;
        actor.bob += (bob - actor.bob) * (1 - Math.exp(-14 * step));
        if (actor._new && actor.alpha === 1) { actor._new = false; this._emit('arrive', actor); }
        if (!actor._ready) this._status(actor, actor.moving ? 'advancing' : 'waiting');
        if (actor._ready && actor._trackPos <= -2 + 1e-6) {
          line.shift();
          actor.face = 1; actor.moving = false; actor._dwell = .6; actor.happy = 1;
          this._completeService(actor); this._status(actor, 'happy');
          this.layouts[species] = this._layout(species, line.length);
        } else predecessor = actor;
        ahead.push(actor);
      }
    }
    return this.getState();
  }
}

export default QueueScene;
