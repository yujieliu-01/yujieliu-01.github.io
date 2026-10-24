/* v3: pull, wait on planted paw, win a fish, eat it, resume.
 * Original-image coordinates, radians, +y down. No drawing or image mutation.
 * 3.60s miss + 5.30s win = 8.90s. Browser: SlotCatPoseV3 / SlotCatPose.
 */
(function (root) {
  'use strict';
  const DEG = Math.PI / 180;
  const C = {
    size: 1254, duration: 8.9, roundDuration: 3.6,
    roundDurations: [3.6, 5.3], roundStarts: [0, 3.6], rounds: 2,
    shoulder: [612, 766], elbow: [705, 723], palm: [766, 646],
    restingElbow: [625, 875], restingPalm: [656, 984],
    sourceFingertip: [819, 633], groundContact: [669, 1037],
    leverPivot: [857, 813], knob: [798, 686],
    pullAngle: -18 * DEG, restingHandAngle: 90 * DEG,
    headPivot: [330, 695], mouth: [681, 600],
    pickupPalm: [743, 917], pickupExtension: 0.25,
    fishGripOffset: [32, 20], fishScale: 0.9,
    fishTray: [775, 957], fishSource: [766, 941],
    fishPickupAngle: 0.16, mouthFishAngle: -Math.PI,
    mouthHandAngle: -50 * DEG,
    times: {reach: 0, grip: 0.5, pulled: 0.82, release: 0.82,
      settled: 1.25, reelsStart: 0.9, reelsStop: 3.3, result: 3.3, roundEnd: 3.6},
    rewardTimes: {drop: 3.38, landed: 3.72, reach: 3.62, pickup: 3.98,
      mouth: 4.40, bite1Start: 4.50, bite1End: 4.60,
      bite2Start: 4.77, bite2End: 4.87, return: 5.05, end: 5.30}
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const mix = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angle = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const rotate = (p, pivot, a) => {
    const x = p[0] - pivot[0], y = p[1] - pivot[1];
    return [pivot[0] + x * Math.cos(a) - y * Math.sin(a),
      pivot[1] + x * Math.sin(a) + y * Math.cos(a)];
  };
  const upperLength = distance(C.shoulder, C.elbow);
  const forearmLength = distance(C.elbow, C.palm);
  const restingUpperLength = distance(C.shoulder, C.restingElbow);
  const restingForearmLength = distance(C.restingElbow, C.restingPalm);
  const originalUpperAngle = angle(C.shoulder, C.elbow);
  const originalForearmAngle = angle(C.elbow, C.palm);

  // The fish touches the upper edge of the paw; it can turn around this actual
  // contact while the wrist stays in a comfortable, anatomically coherent pose.
  C.fishGripLocal = rotate([0, -20 / C.fishScale], [0, 0], -C.fishPickupAngle);
  const nose = rotate([41 * C.fishScale, -2 * C.fishScale], [0, 0], C.mouthFishAngle);
  C.mouthFishPosition = [C.mouth[0] - nose[0], C.mouth[1] - nose[1]];
  const fishContact = rotate(C.fishGripLocal.map(x => x * C.fishScale), [0, 0], C.mouthFishAngle);
  const handContact = rotate(C.fishGripOffset, [0, 0], C.mouthHandAngle);
  C.mouthPalm = [C.mouthFishPosition[0] + fishContact[0] - handContact[0],
    C.mouthFishPosition[1] + fishContact[1] - handContact[1]];
  // effects-v3 clips the head side at x = 66 - 113 * biteAmount.
  // Feeding by these distances keeps the new bite edge at the same mouth point.
  C.firstFeed = (41 - (66 - 113 * 0.5)) * C.fishScale;
  C.totalFeed = (41 - (66 - 113)) * C.fishScale;
  C.afterFirstBitePalm = [C.mouthPalm[0] - C.firstFeed, C.mouthPalm[1]];

  function lengthsFor(extension) {
    return [lerp(upperLength, restingUpperLength, extension),
      lerp(forearmLength, restingForearmLength, extension)];
  }
  function elbowFor(target, extension) {
    extension = extension == null ? 0 : clamp(extension, 0, 1);
    const [l1, l2] = lengthsFor(extension);
    const sx = C.shoulder[0], sy = C.shoulder[1];
    const vx = target[0] - sx, vy = target[1] - sy, rawD = Math.hypot(vx, vy);
    const d = clamp(rawD, Math.abs(l1 - l2) + 0.001, l1 + l2 - 0.001);
    const ux = vx / (rawD || 1), uy = vy / (rawD || 1);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return [sx + ux * a - uy * h, sy + uy * a + ux * h];
  }
  function arcBetween(a, b, u) {
    const r = lerp(distance(C.shoulder, a), distance(C.shoulder, b), u);
    const theta = lerp(angle(C.shoulder, a), angle(C.shoulder, b), u);
    return [C.shoulder[0] + r * Math.cos(theta), C.shoulder[1] + r * Math.sin(theta)];
  }
  function pulse(t, center, duration) {
    const u = (t - (center - duration / 2)) / duration;
    return u > 0 && u < 1 ? Math.sin(Math.PI * u) ** 2 : 0;
  }
  function gripPosition(palm, handAngle) {
    const q = rotate(C.fishGripOffset, [0, 0], handAngle);
    return [palm[0] + q[0], palm[1] + q[1]];
  }
  function fishAtGrip(palm, handAngle, fishAngle) {
    const g = gripPosition(palm, handAngle);
    const q = rotate(C.fishGripLocal.map(x => x * C.fishScale), [0, 0], fishAngle);
    return [g[0] - q[0], g[1] - q[1]];
  }

  function sample(seconds) {
    const remainder = (Number.isFinite(seconds) ? seconds : 0) % C.duration;
    const t = remainder < 0 ? remainder + C.duration : remainder;
    const roundIndex = t < C.roundStarts[1] ? 0 : 1;
    const roundTime = t - C.roundStarts[roundIndex];
    const roundDuration = C.roundDurations[roundIndex], isWin = roundIndex === 1;
    const T = C.times, R = C.rewardTimes, rt = roundTime;
    let phase, leverAngle = 0, handAngle = C.restingHandAngle;
    let palm = C.restingPalm.slice(), extension = 1, gripped = false;
    let fishAngle = C.fishPickupAngle, fishPosition = C.fishTray.slice();
    const bite1 = isWin ? smooth((rt - R.bite1Start) / (R.bite1End - R.bite1Start)) : 0;
    const bite2 = isWin ? smooth((rt - R.bite2Start) / (R.bite2End - R.bite2Start)) : 0;
    const biteAmount = 0.5 * (bite1 + bite2);

    // These first three motions and the reel timing are unchanged from v2.
    if (rt < T.grip) {
      phase = 'reach';
      const u = smooth(rt / T.grip);
      palm = arcBetween(C.restingPalm, C.palm, u); extension = 1 - u;
      handAngle = lerp(C.restingHandAngle, 0, u);
    } else if (rt < T.release) {
      phase = 'pull';
      const u = smooth((rt - T.grip) / (T.release - T.grip));
      leverAngle = C.pullAngle * u;
      palm = rotate(C.palm, C.leverPivot, leverAngle);
      handAngle = leverAngle; extension = 0; gripped = true;
    } else if (rt < T.settled) {
      phase = 'release';
      const u = smooth((rt - T.release) / (T.settled - T.release));
      leverAngle = C.pullAngle * (1 - smooth((rt - T.release) / 0.3));
      palm = arcBetween(rotate(C.palm, C.leverPivot, C.pullAngle), C.restingPalm, u);
      handAngle = lerp(C.pullAngle, C.restingHandAngle, u); extension = u;
    } else if (rt < T.reelsStop) phase = 'spin';
    else phase = 'result';

    if (isWin && rt >= R.reach) {
      gripped = false; leverAngle = 0;
      if (rt < R.pickup) {
        phase = 'pickup-reach';
        const u = smooth((rt - R.reach) / (R.pickup - R.reach));
        palm = arcBetween(C.restingPalm, C.pickupPalm, u);
        extension = lerp(1, C.pickupExtension, u);
        handAngle = lerp(C.restingHandAngle, 0, u);
      } else if (rt < R.mouth) {
        phase = 'lift-fish';
        const u = smooth((rt - R.pickup) / (R.mouth - R.pickup));
        palm = arcBetween(C.pickupPalm, C.mouthPalm, u);
        extension = lerp(C.pickupExtension, 0, u);
        handAngle = lerp(0, C.mouthHandAngle, u);
        fishAngle = lerp(C.fishPickupAngle, C.mouthFishAngle, u);
        fishPosition = fishAtGrip(palm, handAngle, fishAngle);
      } else if (rt < R.return) {
        phase = rt < R.bite1Start ? 'present-fish' : (rt < R.bite2End ? 'eat' : 'satisfied');
        palm = [C.mouthPalm[0] - C.firstFeed * bite1, C.mouthPalm[1]];
        extension = 0; handAngle = C.mouthHandAngle; fishAngle = C.mouthFishAngle;
        const feed = C.firstFeed * bite1 + (C.totalFeed - C.firstFeed) * bite2;
        fishPosition = [C.mouthFishPosition[0] - feed, C.mouthFishPosition[1]];
      } else {
        phase = 'return-paw';
        const u = smooth((rt - R.return) / (R.end - R.return));
        palm = arcBetween(C.afterFirstBitePalm, C.restingPalm, u);
        extension = u; handAngle = lerp(C.mouthHandAngle, C.restingHandAngle, u);
        fishAngle = C.mouthFishAngle;
        fishPosition = [C.mouthFishPosition[0] - C.totalFeed, C.mouthFishPosition[1]];
      }
    }

    const fishHeld = isWin && rt >= R.pickup && rt < R.bite2Start;
    const fishInMouth = isWin && rt >= R.bite2Start && rt < R.bite2End;
    const fishVisible = isWin && rt >= R.drop && biteAmount < 0.999;
    const fishGripPosition = gripPosition(palm, handAngle);
    const elbow = elbowFor(palm, extension), lengths = lengthsFor(extension);
    const reelProgress = clamp((rt - T.reelsStart) / (T.reelsStop - T.reelsStart), 0, 1);
    const resultProgress = clamp((rt - T.result) / (roundDuration - T.result), 0, 1);
    const grounded = distance(palm, C.restingPalm) < 0.001;
    let groundBlend = smooth((extension - 0.94) / 0.06);
    if (isWin && rt >= R.reach) {
      // Blend out the planted endpoint while it is still close to the floor.
      // This avoids a sprite swap on the exact first frame of pickup-reach.
      groundBlend = phase === 'pickup-reach' || phase === 'return-paw'
        ? smooth((extension - 0.85) / 0.15) * (1 - smooth(distance(palm, C.restingPalm) / 30))
        : 0;
    }
    const blinkAmount = rt >= T.settled && rt < T.reelsStop
      ? pulse(rt, isWin ? 2.48 : 2.02, 0.2) : 0;
    const notice = isWin ? smooth((rt - 3.32) / 0.15) * (1 - smooth((rt - 3.76) / 0.32)) : 0;
    const headAngle = 2 * DEG * notice;
    const happyAmount = isWin ? smooth((rt - 3.42) / 0.6) * (1 - smooth((rt - R.return) / (R.end - R.return))) : 0;
    const chewAmount = isWin ? Math.max(pulse(rt, 4.55, 0.18), pulse(rt, 4.82, 0.18)) : 0;
    const fishProgress = clamp((rt - R.drop) / (R.landed - R.drop), 0, 1);
    let fishStage = 'hidden';
    if (fishVisible) fishStage = fishInMouth ? 'mouth' : fishHeld ? 'held' : rt < R.landed ? 'drop' : 'tray';
    else if (isWin && rt >= R.bite2End) fishStage = 'eaten';

    return {
      t, phase, roundIndex, roundTime, roundDuration, isWin,
      gripped, grounded, extension, groundBlend, leverAngle, handAngle,
      shoulder: C.shoulder.slice(), elbow, palm,
      knob: rotate(C.knob, C.leverPivot, leverAngle),
      upperAngle: angle(C.shoulder, elbow) - originalUpperAngle,
      forearmAngle: angle(elbow, palm) - originalForearmAngle,
      upperScale: lengths[0] / upperLength, forearmScale: lengths[1] / forearmLength,
      projectedUpperLength: lengths[0], projectedForearmLength: lengths[1],
      fingertip: rigid(C.sourceFingertip, C.palm, palm, handAngle),
      reelsActive: rt >= T.reelsStart && rt < T.reelsStop,
      reelProgress, reelTravel: 1 - Math.pow(1 - reelProgress, 3),
      resultVisible: rt >= T.result, resultProgress,
      blink: blinkAmount, blinkAmount,
      fishVisible, fishHeld, fishInMouth, fishStage, fishProgress,
      fishPosition, fishAngle, fishScale: C.fishScale, fishGripPosition,
      fishBiteSide: 'right', biteProgress: biteAmount, biteAmount, chewAmount,
      happyAmount, headAngle, headNod: headAngle, headOffsetY: 0,
      headPivot: C.headPivot.slice(), mouthPosition: C.mouth.slice(),
      tailWag: happyAmount * Math.sin((rt - 3.3) * Math.PI * 5.2),
      winPulse: isWin && rt >= T.result ? Math.sin(Math.min(1, (rt - T.result) / 0.6) * Math.PI) : 0
    };
  }

  function rigid(p, oldAnchor, newAnchor, a) {
    const q = rotate(p, oldAnchor, a);
    return [q[0] + newAnchor[0] - oldAnchor[0], q[1] + newAnchor[1] - oldAnchor[1]];
  }
  function segmentTransform(p, oldA, oldB, newA, newB) {
    const ox = oldB[0] - oldA[0], oy = oldB[1] - oldA[1];
    const oldLen = Math.hypot(ox, oy);
    const ux = ox / oldLen, uy = oy / oldLen;
    const px = p[0] - oldA[0], py = p[1] - oldA[1];
    const along = px * ux + py * uy, across = -px * uy + py * ux;
    const nx = newB[0] - newA[0], ny = newB[1] - newA[1];
    const newLen = Math.hypot(nx, ny);
    const vx = nx / newLen, vy = ny / newLen;
    // Scale along the projected bone only. Preserve the arm's visible width.
    return [newA[0] + vx * along * newLen / oldLen - vy * across,
      newA[1] + vy * along * newLen / oldLen + vx * across];
  }
  function nearestOnSegment(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const u = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
    const q = [a[0] + dx * u, a[1] + dy * u];
    return { u, distance: distance(p, q) };
  }
  function deformArmPoint(p, pose) {
    const u = nearestOnSegment(p, C.shoulder, C.elbow);
    const f = nearestOnSegment(p, C.elbow, C.palm);
    const arc = u.distance < f.distance ? upperLength * u.u : upperLength + forearmLength * f.u;
    const foreWeight = smooth((arc - (upperLength - 22)) / 44);
    const upper = segmentTransform(p, C.shoulder, C.elbow, C.shoulder, pose.elbow);
    const lower = segmentTransform(p, C.elbow, C.palm, pose.elbow, pose.palm);
    let q = mix(upper, lower, foreWeight);
    const handWeight = smooth((arc - (upperLength + forearmLength - 48)) / 38);
    const hand = rigid(p, C.palm, pose.palm, pose.handAngle);
    q = mix(q, hand, handWeight);
    // Fixed shoulder cap stays beneath the unchanged foreground chest layer.
    const shoulderBlend = smooth((p[0] - 575) / 85);
    return mix(p, q, shoulderBlend);
  }

  const api = { constants: C, sample, rotate, elbowFor, deformArmPoint };
  root.SlotCatPoseV3 = api;
  root.SlotCatPose = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
