(() => {
  'use strict';
  const dialog = document.querySelector('#game-dialog');
  const container = document.querySelector('.game-frame-container');
  const titles = {fruit: 'Fruit for Thought · 水果运筹学', canteen: 'Monster Canteen · 小怪兽食堂'};
  const paths = {fruit: 'games/fruit.html', canteen: 'games/canteen.html'};
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
      frame.src = paths[game];
      document.querySelector('#game-dialog-title').textContent = game === 'fruit' ? 'A little exploration.' : 'A little coordination.';
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
  const links = [...document.querySelectorAll('nav a[href^="#"]')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href')));
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top-b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach(link => {if(link.hash === '#'+visible.target.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  }, {rootMargin: '-5% 0px -55% 0px', threshold: 0});
  sections.forEach(section => observer.observe(section));
})();
