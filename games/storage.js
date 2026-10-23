(() => {
  'use strict';
  const key = 'yujie-research-game-v1:' + document.body.dataset.game;
  let snapshot = null;
  try { snapshot = JSON.parse(localStorage.getItem(key)); } catch (_) { /* Storage is optional. */ }
  window.gameStorage = {
    get snapshot() { return snapshot; },
    setSnapshot(value) {
      snapshot = value;
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* The game still works without storage. */ }
      return Promise.resolve();
    }
  };
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && parent !== window) {
      event.preventDefault();
      parent.postMessage({type:'homepage:close'}, location.origin);
    }
  });
})();
