# Yujie Liu — academic website

Personal academic website: https://yujieliu-01.github.io/

A small, build-free website served by GitHub Pages from `main` at the repository root.

## Editing

- `index.html`: About Me and email.
- `research/index.html`: research interests, papers, and work in progress.
- `background/index.html`: appointments and education.
- `assets/site.css`: responsive layout and visual design.
- `assets/site.js`: mobile contact menu, compatibility with old section links, and on-demand game dialogs.
- `games/`: self-contained games. No game is loaded until its small icon is selected.
- `assets/`: portrait and public documents.

To preview locally, run `python -m http.server 8747 --bind 127.0.0.1` here and open http://127.0.0.1:8747/.

The original games save progress only in the visitor's browser; Fruit Bandits rounds reset when their game frame is closed. They do not send gameplay data anywhere. Closing a game pauses it and removes its frame. No build system, analytics, external fonts, or third-party scripts are required.

The white, gray, and cyan visual design and shared author sidebar follow https://linfanf.github.io/. Navigation uses ordinary page links, so each page can be opened directly or refreshed and browser Back/Forward works without JavaScript. The shared header and profile markup is repeated in the three HTML files; update all three when editing those details. On small screens, Follow expands the contact links. With JavaScript disabled, those links remain visible.

## Fruit Bandits

The animated cat beside the LinUCB paper on the Research page opens the three-reel game (`games/fruit-bandits-triple.html`). The sidebar on all three academic pages is reserved for profile and contact information. Fruit for Thought and Fruit Bandits Classic remain available at their existing game URLs.

The three-reel game is a warm, illustrated cat arcade using the same orange cat, coral-red cabinet, fruit symbols, lever and fish-eating animation as its paper icon. The three canvases share the original artwork preparation, but each retains its own actual reel outcomes. A matching triple earns one dried fish (one win). The interface shows the 100-coin budget and total fish; each machine has its own counts and expandable recent history. Single spins, five-spin batches, 1/2/3 shortcuts, optional sound and reduced-motion rendering are supported. Escape closes an open help/restart dialog first, then returns from the embedded game to the paper page.

The rules remain a 100-coin budget and shuffled 40% / 50% / 60% probabilities, hidden until the round ends. Its UCB comparison is calibrated with `node games/bandits-triple/calibrate-ucb.cjs`; the JSON file records training and independent validation results. Run `node games/bandits-triple/engine.test.cjs`, `node games/bandits-triple/ucb.test.cjs` and `node games/bandits-triple/renderer.test.cjs` to verify the game, benchmark and artwork synchronization. Use `node games/bandits-triple/build-preview.cjs` to rebuild a self-contained offline HTML preview, including all image and animation assets. The online game has no new external dependency.

## Panda Night Stall

The animated panda stall icon beside the finite-time queueing paper on the Research page opens `games/panda-night-stall/` in a wide dialog. The panda, bamboo stall, lantern, knot and visitors use the approved artwork on a fully transparent background, so the icon blends into the white academic page. One orange cat collects a can and leaves, then one corgi collects bone soup and leaves. A transparent static representative frame is used when the visitor prefers reduced motion.

The game uses the reviewed v2 artwork and continuous FIFO animation, with a 60-second round, 2.5-second batches, a backlog chart, and matched-traffic strategy comparisons. The old `games/canteen.html` remains available at its existing URL. Run `npm test --prefix games/panda-night-stall` for layout, rules, and motion regression checks. Closing the homepage dialog pauses and unloads the game.

The paper icon is a pre-rendered 320×256 WebP displayed at 80×64, with an approximately 11.6-second loop. It adds no animation script to the academic page. To regenerate it from the scene layers, run `node tools/render-panda-icon.cjs`; this optional artwork tool needs `@napi-rs/canvas`, `sharp`, and FFmpeg with `libwebp_anim`. The tool writes the animated image, reduced-motion still, and a contact sheet to `assets/`; only the two WebP files are used by the page. These tools are not needed to serve the website.

Inside the embedded panda game, Escape returns to the paper page; when the game's own help or results dialog is open, Escape closes that dialog first.
