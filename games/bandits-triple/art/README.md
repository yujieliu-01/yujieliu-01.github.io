# Cat slot artwork

This is the same orange cat, coral cabinet, fruit artwork and articulated motion used by the homepage's cat slot icon. The four source illustrations are stored as lossless WebP files at their original size. The small motion modules retain the original drawing coordinates and are prepared once for all three game stations.

`../cat-renderer.js` adapts the original demonstration loop to the real game: each station retains its previous symbols, receives the engine's actual three-symbol result, and performs the fish pickup only after a win. It never samples or changes a game outcome.

- `original.webp`: the original reaching-paw illustration and calibrated fruit cutouts.
- `cat-base.webp`: the body layer with the moving paw removed.
- `cat-ground.webp`: the resting-paw pose.
- `machine.webp`: the clean cabinet behind the moving head.
- `pose-v3.js`: the existing arm, lever and fish attachment choreography.
- `character-motion.js`: the existing facial and tail motion.
- `effects-v3.js`: reel and reward drawing, adapted to caller-supplied symbols.
- `animate-v3.js`: shared layer preparation and frame composition.

The renderer fits the artwork to a transparent 1.12:1 view without adding a scene backdrop. It supports reduced motion and releases observers and frame callbacks when a scene is destroyed. `node games/bandits-triple/renderer.test.cjs` checks outcomes, cancellation, independent stations and reduced motion without browser or graphics dependencies.

`node games/bandits-triple/build-preview.cjs [output.html]` builds a self-contained offline HTML preview. It preloads the motion modules, embeds the four source images through `window.CatSlotAssetURLs`, and embeds the game's fallback poster. Normal hosted pages continue to load their relative assets. Navigation back to the academic homepage and the optional algorithm reference still use their public web addresses.
