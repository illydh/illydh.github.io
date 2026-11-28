# Live pipeline graph (set aside)

A small animated data pipeline drawn on a canvas: sources feed transforms,
which feed a warehouse and its consumers, with records flowing along the
edges. Hovering or tapping a step lights its upstream and downstream lineage
and shows a rows/s readout. It used to sit in the introduction band under the
cover and was taken off the page when the About card was merged. Nothing here
is loaded by the site, and GitHub Pages doesn't publish folders whose names
start with `_`.

## Files

- `pipeline.js`: the graph (`mountPipeline`). Unchanged from when it was live.
- `pipeline.css`: its styles, as a bordered panel with a dot grid.

Its colours come from tokens that are still in `style.css`: `--edge`,
`--record`, `--node`, `--node-line`, `--glyph`, `--ink`, `--lit`, `--accent`
and `--accent-ink`.

## Bringing it back

1. Move `pipeline.js` back to the site root and add the rules in
   `pipeline.css` to `style.css` (or link the file).
2. Put this where it should appear, for example at the end of the About
   section inside a `<div class="wrap">`:

   ```html
   <p class="meta"><span>pipeline</span> live · hover a step to trace where its data comes from and goes</p>
   <div class="pipeline">
     <canvas aria-hidden="true"></canvas>
     <p class="sr-only">
       Animated diagram of a data pipeline. Records from api, s3 and events sources pass through
       parse, dedupe, orders and sessions steps into a warehouse, which feeds a dashboard, and into
       a features step that feeds a model.
     </p>
     <button class="icon-btn pipeline-pause" type="button" aria-pressed="false" aria-label="Pause animation">
       <svg class="icon-pause" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
         <path d="M4.5 2.5v9M9.5 2.5v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
       </svg>
       <svg class="icon-play" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
         <path d="M4 2.5l7 4.5-7 4.5z" fill="currentColor" />
       </svg>
     </button>
   </div>
   ```

3. Mount it from `script.js`:

   ```js
   import { mountPipeline } from "./pipeline.js";

   const canvas = document.querySelector(".pipeline canvas");
   if (canvas) mountPipeline(canvas, { pauseButton: document.querySelector(".pipeline-pause") });
   ```

4. Its pause button sets `html[data-motion-paused]`. The last rule in
   `pipeline.css` makes that pause the page's other looping animations too.
   The scroll-in reveal in `script.js` should then skip its rise while
   paused (show blocks as `done` instead of `in`), or blocks that arrive
   while paused stay invisible.

The graph stops itself when it's off screen, when the tab is hidden, when
the visitor pauses it, and under reduced motion.
