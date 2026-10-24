(() => {
  'use strict';
  const siteRoot = new URL('../', document.currentScript.src);
  // Keep previously shared section links working after the move to separate pages.
  if (location.pathname === siteRoot.pathname || location.pathname === siteRoot.pathname + 'index.html') {
    const legacyPages = {'#research': 'research/', '#publications': 'research/#publications', '#background': 'background/'};
    if (legacyPages[location.hash]) {
      location.replace(new URL(legacyPages[location.hash], siteRoot));
      return;
    }
  }
  const profileToggle = document.querySelector('.profile-toggle');
  profileToggle.hidden = false;
  const closeProfile = () => profileToggle.setAttribute('aria-expanded', 'false');
  profileToggle.addEventListener('click', () => {
    profileToggle.setAttribute('aria-expanded', String(profileToggle.getAttribute('aria-expanded') !== 'true'));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.profile-contact')) closeProfile();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && profileToggle.getAttribute('aria-expanded') === 'true') {
      closeProfile();
      profileToggle.focus();
    }
  });
  const dialog = document.querySelector('#game-dialog');
  const container = document.querySelector('.game-frame-container');
  const titles = {fruit: 'Fruit for Thought · 水果运筹学', canteen: 'Panda Night Stall · 熊猫夜宵摊', bandits: 'Fruit Bandits · 第一版', triple: 'Fruit Bandits · 猫咪水果机'};
  const paths = {fruit: 'games/fruit.html', canteen: 'games/panda-night-stall/', bandits: 'games/fruit-bandits.html', triple: 'games/fruit-bandits-triple.html?v=20261025-cat-arcade'};
  let trigger = null;
  let frame = null;
  let closing = false;
  document.querySelectorAll('[data-game]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      const game = button.dataset.game;
      if (!paths[game] || dialog.open) return;
      trigger = button;
      frame = document.createElement('iframe');
      frame.title = titles[game];
      frame.src = new URL(paths[game], siteRoot).href;
      document.querySelector('#game-dialog-title').textContent = titles[game];
      dialog.classList.toggle('wide-game', game === 'triple' || game === 'bandits' || game === 'canteen');
      container.replaceChildren(frame);
      document.body.classList.add('game-open');
      dialog.showModal();
      dialog.querySelector('button').focus();
    });
  });
  function closeGame() {
    if (!dialog.open || closing) return;
    closing = true;
    // Give the active game a moment to pause and save before removing its frame.
    frame?.contentWindow.postMessage({type: 'homepage:pause'}, location.origin);
    setTimeout(() => {dialog.close(); closing = false;}, 60);
  }
  dialog.querySelector('.close-dialog').addEventListener('click', closeGame);
  dialog.addEventListener('cancel', event => {event.preventDefault(); closeGame();});
  dialog.addEventListener('click', event => {if (event.target === dialog) {const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeGame();}});
  dialog.addEventListener('close', () => {container.replaceChildren(); frame = null; document.body.classList.remove('game-open'); trigger?.focus({preventScroll:true});});
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
    if (event.data?.type === 'homepage:close') closeGame();
  });
})();
