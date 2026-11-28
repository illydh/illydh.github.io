# Illy Hoang · portfolio

The source for [illydh.github.io](https://illydh.github.io/), my portfolio as an aspiring data engineer.

## About me

I'm a computer science master's student at USC, working toward data engineering.

**Now**

- Data Platform SWE Intern, The Aerospace Corporation
- M.S. Computer Science, University of Southern California
- Graduate Research Assistant, FORTIS Lab
- Computer Vision Lead, USC Advanced Robotic Combat

**Before**

- Software Engineer Intern, Savant Systems
- Undergraduate Teaching Assistant, UConn School of Computing
- InStep Intern (AI research), Infosys
- Web Developer, UConn University Communications
- Database Intern, Easy Event Planning

**Skills**, grouped the way the site groups them:

| Stage | Tools |
|---|---|
| Ingest | Python, Node.js, Playwright |
| Store | PostgreSQL, MongoDB, AWS |
| Transform | SQL, pandas, Polars, NumPy |
| Orchestrate | Docker, Git, Jenkins |
| Serve | FastAPI, Flask, Tableau |

Languages: Python, SQL, Java, C++, TypeScript, Bash.

**Projects**

- [Tiến Lên AI](https://github.com/illydh/tien-len-ai): AI players for a Vietnamese card game ([demo](https://tien-len-ai.vercel.app/))
- [GhostFormer](https://github.com/illydh/2025-nfl-bdb): predicting a hidden NFL player's motion
- [AQ-10 screening model](https://github.com/illydh/aq10-analysis): autism screening from ten questionnaire answers
- [FashionForward](https://github.com/CSE-SDP-Group-11): outfit compatibility and recommendations
- [Attention in NMT](https://github.com/illydh/nmt-model): how much attention matters in translation
- [Calories burned](https://github.com/illydh/calories-burnt-predictor): estimating calories from a workout's vitals

**Contact:** [illyd.hoang@gmail.com](mailto:illyd.hoang@gmail.com) · [LinkedIn](https://www.linkedin.com/in/illydh/) · [GitHub](https://github.com/illydh)

## The site

One page, plain HTML, CSS and JavaScript modules, with no framework and no build step. GitHub Pages serves the files as they are.

From the top:

1. **Cover**: my photo across the full width with my name running over it, and a song to play while you scroll (Spotify). The header stays hidden until the page scrolls.
2. **Introduction**: a short intro, résumé and email buttons, and a live pipeline graph you can hover.
3. **About**, **Experience**, **Projects** (each opens a detail panel; `#project-<slug>` links straight to one) and **Skills**.
4. **Footer**: "Let's connect" with LinkedIn and GitHub, the email (with a copy button), the résumé, and "Back to top", which returns to the cover.

Each block rises into place as it comes on screen, and plays again whenever it comes back after you've scrolled away; the cover replays its entrance the same way. With reduced motion turned on, or the pipeline's pause button pressed, nothing moves.

The site has one theme, dark. `404.html` is shown for unknown addresses and sends old links such as `/about.html` to the matching section.

```
index.html     the page
style.css      all styles; colours are tokens at the top
script.js      menu, cover header, scroll-in, project preview and panel, copy-the-email
pipeline.js    the hero pipeline graph (canvas)
404.html       not-found page and old-link redirects
assets/        cover photo, portrait, icons, résumé, project images and reports
```

## Working on it

Preview with any static server from the repo root (module scripts need one):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

**Cover.** The photo is `assets/cover-2304.webp`, with `cover-1600.webp` and `cover-960.webp` for smaller screens, all exported from the original photo. The name runs across the lower part of the photo so it stays clear of the face: `--name-lift` on `.cover` sets how high it sits, and `object-position` on `.cover-photo img` moves the subject. To swap the photo, export the three widths with `sips --resampleWidth <w> original.jpg --out tmp.jpg && cwebp -q 72 tmp.jpg -o assets/cover-<w>.webp`. The song is the `.song` link in the cover section of `index.html`: to change it, update its `href`, `data-spotify-uri` (`spotify:track:<id>` from the track's Share link), title and artist, and the title in the header's `.now-playing` pill and in `script.js` (`SONG`). Visitors who aren't logged in to Spotify hear a 30-second preview.

**Projects.** Each project's write-up is a `<template id="project-<slug>">` near the end of `index.html`. Its images go in `assets/section-projects/preview/` and `assets/section-projects/thumb/` as WebP.
