# Yujie Liu — academic website

Personal academic website: https://yujieliu-01.github.io/

A small, build-free website served by GitHub Pages from `main` at the repository root.

## Editing

- `index.html`: About Me, CV, and email.
- `research/index.html`: research interests, papers, and work in progress.
- `background/index.html`: appointments and education.
- `assets/site.css`: responsive layout and visual design.
- `assets/site.js`: mobile contact menu, compatibility with old section links, and the two on-demand easter eggs.
- `games/`: self-contained games. No game is loaded until its small icon is selected.
- `assets/`: portrait and public documents. The public CV omits the phone number and postal address.

To preview locally, run `python -m http.server 8747 --bind 127.0.0.1` here and open http://127.0.0.1:8747/.

The games save progress only in the visitor's browser. They do not send gameplay data anywhere. Closing a game pauses it and removes its frame. No build system, analytics, external fonts, or third-party scripts are required.

The white, gray, and cyan visual design and shared author sidebar follow https://linfanf.github.io/. Navigation uses ordinary page links, so each page can be opened directly or refreshed and browser Back/Forward works without JavaScript. The shared header and profile markup is repeated in the three HTML files; update all three when editing those details. On small screens, Follow expands the contact links. With JavaScript disabled, those links remain visible.
