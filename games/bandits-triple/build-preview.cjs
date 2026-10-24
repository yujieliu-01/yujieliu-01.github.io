'use strict';
const fs = require('node:fs'), path = require('node:path');
const games = path.dirname(__dirname);
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const dataURL = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
const inline = source => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;
let html = fs.readFileSync(path.join(games, 'fruit-bandits-triple.html'), 'utf8');
let styleCount = 0;
html = html.replace(/<link rel="stylesheet" href="bandits-triple\/style\.css(?:\?[^\"]*)?">/g, () => {
  styleCount++;
  return `<style>${read('style.css')}</style>`;
});
const scripts = [];
html = html.replace(/<script\b[^>]*\bsrc="bandits-triple\/([\w.-]+)(?:\?[^\"]*)?"[^>]*><\/script>/g, (_, file) => {
  scripts.push(file);
  return '';
});
if (styleCount !== 1 || !['engine.js', 'ucb-benchmark.js', 'cat-renderer.js', 'game.js']
  .every(file => scripts.includes(file))) {
  throw new Error('The game entry point changed; update the preview asset list.');
}

const assetURLs = Object.fromEntries(['original.webp', 'cat-base.webp', 'cat-ground.webp', 'machine.webp']
  .map(file => [file, dataURL(path.join(__dirname, 'art', file), 'image/webp')]));
const poster = dataURL(path.join(games, '../assets/cat-slot-static.png'), 'image/png');
const blocks = [];
for (const file of scripts) {
  if (file === 'cat-renderer.js') {
    for (const module of ['pose-v3.js', 'effects-v3.js', 'character-motion.js', 'animate-v3.js']) {
      blocks.push(inline(read(`art/${module}`)));
    }
    blocks.push(inline(`window.CatSlotAssetURLs=${JSON.stringify(assetURLs)};`));
  }
  const source = file === 'game.js'
    ? read(file).replaceAll('../assets/cat-slot-static.png', poster) : read(file);
  blocks.push(inline(source));
}
html = html.replace('</body>', () => `${blocks.join('\n')}\n</body>`);
// These are deliberate navigation links, not dependencies needed to play.
html = html.replaceAll('href="../research/"', 'href="https://yujieliu-01.github.io/research/"');
html = html.replaceAll('href="fruit-bandits.html"', 'href="https://yujieliu-01.github.io/games/fruit-bandits.html"');
if (/<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"/.test(html)) {
  throw new Error('The preview still contains an external script or stylesheet.');
}
const destination = path.resolve(process.argv[2] || path.join(games, '../../fruit-bandits-triple-preview.html'));
fs.writeFileSync(destination, html);
console.log('Built ' + destination);
