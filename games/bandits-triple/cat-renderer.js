/* Playable version of the homepage's original illustrated cat and slot machine.
 * One shared artwork preparation; each mounted scene owns its displayed outcome.
 * No random numbers or game decisions are made by this rendering layer.
 */
(function (root) {
  'use strict';

  const VIEWPORT = Object.freeze({x: 55, y: 110, width: 1120, height: 1000});
  const scriptURL = typeof document !== 'undefined' && document.currentScript
    ? document.currentScript.src : '';
  let sharedPromise;

  function validateReels(reels) {
    if (!Array.isArray(reels) || reels.length !== 3 ||
      reels.some(fruit => !Number.isInteger(fruit) || fruit < 0 || fruit > 2)) {
      throw new TypeError('A slot result must contain three fruit indices.');
    }
    return reels.slice();
  }

  function timing(win, fast, reducedMotion) {
    return {
      duration: reducedMotion ? 150 : win ? (fast ? 1680 : 3800) : (fast ? 1160 : 2750),
      sourceEnd: win ? 5.3 : 3.6,
      sourceOffset: win ? 3.6 : 0,
      reelsStop: 3.3
    };
  }

  function frameFor(event, elapsed) {
    const t = timing(event.win, event.fast, event.reducedMotion);
    const progress = Math.max(0, Math.min(1, elapsed / t.duration));
    const roundTime = Math.min(t.sourceEnd - 0.000001, progress * t.sourceEnd);
    return {
      seconds: event.reducedMotion ? 1.6 : t.sourceOffset + roundTime,
      pose: {
        previousReels: event.previous,
        eventReels: event.reels,
        staticReels: event.reducedMotion
      },
      stopped: event.reducedMotion || roundTime >= t.reelsStop,
      finished: progress >= 1
    };
  }

  function idleFrame(reels, now, index, reducedMotion) {
    const t = now / 1000 + index * 1.63;
    const blinkPhase = t % 5.4;
    const blink = !reducedMotion && blinkPhase > 4.95 && blinkPhase < 5.17
      ? Math.sin((blinkPhase - 4.95) / 0.22 * Math.PI) ** 2 : 0;
    return {
      seconds: 1.6,
      pose: {
        previousReels: reels,
        eventReels: reels,
        staticReels: true,
        blinkAmount: blink,
        headAngle: reducedMotion ? 0 : Math.sin(t * 0.8) * 0.0025,
        tailWag: reducedMotion ? 0 : Math.sin(t * 1.25) * 0.12
      }
    };
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url.href;
      script.onload = resolve;
      script.onerror = () => reject(new Error('The cat illustration could not be loaded.'));
      document.head.append(script);
    });
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The cat illustration could not be loaded.'));
      image.src = url;
    });
  }

  async function prepare() {
    if (typeof document === 'undefined') throw new Error('A browser canvas is required.');
    const base = new URL('art/', scriptURL || new URL('bandits-triple/cat-renderer.js', location.href));
    // The offline preview can preload these modules and supply embedded URLs.
    // Ordinary hosted pages use the same relative art directory as before.
    const preloaded = root.SlotCatPoseV3 && root.SlotCatEffects &&
      root.SlotCatCharacterMotion && root.SlotCatAnimation;
    if (!preloaded) {
      await Promise.all(['pose-v3.js', 'effects-v3.js', 'character-motion.js']
        .map(file => loadScript(new URL(file, base))));
      await loadScript(new URL('animate-v3.js', base));
    }
    const assetURLs = root.CatSlotAssetURLs;
    const sources = ['original.webp', 'cat-base.webp', 'cat-ground.webp', 'machine.webp']
      .map(file => {
        if (assetURLs && typeof assetURLs[file] !== 'string') {
          throw new Error('The embedded cat illustration is incomplete.');
        }
        return assetURLs ? assetURLs[file] : new URL(file, base).href;
      });
    const createCanvas = (width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    };
    const artwork = await root.SlotCatAnimation.create(
      {createCanvas, loadImage},
      ...sources
    );

    return {
      aspectRatio: VIEWPORT.width / VIEWPORT.height,
      mount(canvas, options) {
        if (!canvas || typeof canvas.getContext !== 'function') {
          throw new TypeError('Mount the cat illustration on a canvas.');
        }
        options = options || {};
        const index = Number.isFinite(options.index) ? options.index : 0;
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        let lastReels = [0, 1, 2];
        let active = null, alive = true, raf = 0, lastPaint = -Infinity;
        let inView = true, hiddenAt = document.hidden ? performance.now() : null;

        function paint(frame) {
          artwork.render(canvas, frame.seconds, {viewport: VIEWPORT, pose: frame.pose});
        }

        function settle(cancelled, error) {
          if (!active) return;
          const current = active;
          active = null;
          if (!cancelled && !error) lastReels = current.reels.slice();
          canvas.dataset.phase = 'idle';
          canvas.dataset.reels = lastReels.join(',');
          if (error) current.reject(error);
          else current.resolve({cancelled: !!cancelled});
        }

        function draw(now) {
          if (!alive) return;
          if (active) {
            const frame = frameFor(active, now - active.start);
            paint(frame);
            canvas.dataset.phase = frame.stopped ? (active.win ? 'reward' : 'result') : 'spinning';
            if (frame.stopped && !active.notified) {
              active.notified = true;
              canvas.dataset.reels = active.reels.join(',');
              if (active.onReelsStopped) active.onReelsStopped();
            }
            if (frame.finished) {
              settle(false);
              paint(idleFrame(lastReels, now, index, motion.matches));
            }
          } else {
            paint(idleFrame(lastReels, now, index, motion.matches));
          }
        }

        function tick(now) {
          raf = 0;
          if (!alive || document.hidden) return;
          const interval = active ? 1000 / 30 : 1000 / 12;
          if ((active || inView) && now - lastPaint >= interval) {
            try { draw(now); }
            catch (error) { settle(true, error); }
            lastPaint = now;
          }
          if (active || (!motion.matches && inView)) raf = requestAnimationFrame(tick);
        }

        function schedule() {
          if (alive && !document.hidden && !raf) raf = requestAnimationFrame(tick);
        }

        function resize() {
          if (!alive) return;
          const rect = canvas.getBoundingClientRect();
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const width = Math.max(1, Math.round((rect.width || 320) * dpr));
          const height = Math.max(1, Math.round((rect.height || 320 / 1.12) * dpr));
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          draw(performance.now());
        }

        function visibilityChanged() {
          const now = performance.now();
          if (document.hidden) {
            hiddenAt = now;
            cancelAnimationFrame(raf);
            raf = 0;
          } else {
            if (active && hiddenAt !== null) active.start += now - hiddenAt;
            hiddenAt = null;
            lastPaint = -Infinity;
            schedule();
          }
        }

        function motionChanged() {
          if (active && motion.matches) {
            active.reducedMotion = true;
            active.start = performance.now() - 150;
          }
          draw(performance.now());
          schedule();
        }

        const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
        const intersectionObserver = typeof IntersectionObserver === 'function'
          ? new IntersectionObserver(entries => {
            inView = entries.some(entry => entry.isIntersecting);
            if (inView) { lastPaint = -Infinity; schedule(); }
          }, {rootMargin: '40px'}) : null;
        resizeObserver?.observe(canvas);
        intersectionObserver?.observe(canvas);
        if (!resizeObserver) window.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', visibilityChanged);
        motion.addEventListener?.('change', motionChanged);
        resize();
        canvas.dataset.phase = 'idle';
        canvas.dataset.reels = lastReels.join(',');
        schedule();

        return {
          idle(reels = [0, 1, 2]) {
            const valid = validateReels(reels);
            settle(true);
            lastReels = valid;
            canvas.dataset.phase = 'idle';
            canvas.dataset.reels = valid.join(',');
            draw(performance.now());
            schedule();
          },
          play(event) {
            if (!alive) return Promise.resolve({cancelled: true});
            if (active) return Promise.reject(new Error('This cat is already playing.'));
            const reels = validateReels(event.reels);
            const matches = reels[0] === reels[1] && reels[1] === reels[2];
            if (matches !== !!event.win) return Promise.reject(new Error('The reels must agree with the game result.'));
            return new Promise((resolve, reject) => {
              active = {
                reels, previous: lastReels.slice(), win: !!event.win, fast: !!event.fast,
                reducedMotion: !!event.reducedMotion || motion.matches,
                onReelsStopped: event.onReelsStopped,
                notified: false, start: performance.now(), resolve, reject
              };
              canvas.dataset.phase = 'spinning';
              lastPaint = -Infinity;
              schedule();
            });
          },
          destroy() {
            if (!alive) return;
            alive = false;
            settle(true);
            cancelAnimationFrame(raf);
            resizeObserver?.disconnect();
            intersectionObserver?.disconnect();
            if (!resizeObserver) window.removeEventListener('resize', resize);
            document.removeEventListener('visibilitychange', visibilityChanged);
            motion.removeEventListener?.('change', motionChanged);
          }
        };
      }
    };
  }

  const api = {
    create() {
      if (!sharedPromise) {
        sharedPromise = prepare().catch(error => { sharedPromise = null; throw error; });
      }
      return sharedPromise;
    }
  };
  root.CatSlotRenderer = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {timing, frameFor, idleFrame, validateReels, viewport: VIEWPORT};
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
