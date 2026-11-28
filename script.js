const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

/* Header and menu -------------------------------------------------------- */

const header = document.querySelector(".site-header");
const menuButton = header.querySelector(".menu-btn");
const narrow = matchMedia("(max-width: 860px)");

function setMenu(open) {
  header.dataset.menu = open ? "open" : "";
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.textContent = open ? "Close" : "Menu";
}

menuButton.addEventListener("click", () => setMenu(header.dataset.menu !== "open"));
header.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && header.dataset.menu === "open") {
    setMenu(false);
    menuButton.focus();
  }
});
narrow.addEventListener("change", () => setMenu(false));

// On the cover the header stays hidden until the page moves, and hides again
// back at the very top (see .site-header[data-hidden]).
const cover = document.querySelector(".cover");
const onScroll = () => {
  header.toggleAttribute("data-scrolled", scrollY > 8);
  header.toggleAttribute("data-hidden", !!cover && scrollY <= 2 && header.dataset.menu !== "open");
};
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll, { passive: true });
onScroll();

// Mark the nav link for the section in view.
const navLinks = new Map(
  [...header.querySelectorAll(".nav-links a")].map((a) => [a.getAttribute("href").slice(1), a])
);
const sectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      navLinks.forEach((a, id) => {
        if (id === entry.target.id) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      });
    }
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
navLinks.forEach((_, id) => {
  const el = document.getElementById(id);
  if (el) sectionObserver.observe(el);
});

/* Scroll-in -------------------------------------------------------------- */
// Each block below the cover rises into place when it comes on screen, and
// again every time it returns after leaving the screen entirely. The reset
// happens while it's off screen, so nothing visibly disappears. Blocks on
// screen at load are left as they are. The cover replays its own entrance
// the same way (see .cover[data-away] in style.css).

const revealBlocks = document.querySelectorAll(
  [
    ".section .sidehead > *", ".about-body > :not(.prose)", ".section .prose > *",
    ".runs-head", ".run",
    ".section-head", ".result-head", ".result-rows > li", ".stage",
    ".shots > li",
    ".contact .wrap > *",
  ].join(", ")
);

// Fully off screen: get ready to play again.
const leaveObserver = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    if (isIntersecting) continue;
    if (target === cover) cover.setAttribute("data-away", "");
    else target.dataset.reveal = "out";
  }
});

// Back on screen (a tenth of it in view below the header): play. Blocks that
// arrive together follow each other, with the gaps shrinking down the list.
const enterObserver = new IntersectionObserver(
  (entries) => {
    const arriving = entries
      .filter(({ target, intersectionRatio }) =>
        intersectionRatio >= 0.1 && (target === cover ? cover.hasAttribute("data-away") : target.dataset.reveal === "out")
      )
      .map((e) => e.target)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    arriving.forEach((el, i) => {
      if (el === cover) {
        cover.removeAttribute("data-away");
        return;
      }
      el.style.setProperty("--reveal-delay", `${Math.round(300 * (1 - 0.78 ** i))}ms`);
      el.dataset.reveal = "in";
    });
  },
  { rootMargin: "-64px 0px 0px 0px", threshold: 0.1 }
);

const settle = (e) => {
  if (e.animationName === "rise" && e.target.dataset?.reveal === "in") e.target.dataset.reveal = "done";
};
document.addEventListener("animationend", settle);
document.addEventListener("animationcancel", settle);

[cover, ...revealBlocks].forEach((el) => {
  if (!el) return;
  leaveObserver.observe(el);
  enterObserver.observe(el);
});

/* Projects: hover preview ------------------------------------------------ */

const rows = [...document.querySelectorAll(".row[data-project]")];
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

if (rows.length) {
  const preview = document.createElement("div");
  preview.className = "preview";
  preview.setAttribute("aria-hidden", "true");
  const previewImg = document.createElement("img");
  previewImg.alt = "";
  previewImg.width = 288;
  previewImg.height = 216;
  preview.append(previewImg);
  document.body.append(preview);

  // Warm the cache so swapping rows doesn't flash an empty frame.
  const warm = () => rows.forEach((r) => (new Image().src = r.dataset.preview));
  document.querySelector(".result-set")?.addEventListener("pointerenter", warm, { once: true });

  let x = 0, y = 0, tx = 0, ty = 0, raf = 0, active = false;
  const W = 288, H = 216, OFFSET = 28;

  const place = () => {
    // Sit right of the cursor, flipping left near the edge.
    const right = tx + OFFSET + W < innerWidth - 16;
    const goalX = right ? tx + OFFSET : tx - OFFSET - W;
    const goalY = Math.max(16, Math.min(innerHeight - H - 16, ty - H / 2));
    const f = reduceMotion.matches ? 1 : 0.2;
    x += (goalX - x) * f;
    y += (goalY - y) * f;
    preview.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    if (active && (Math.abs(goalX - x) > 0.3 || Math.abs(goalY - y) > 0.3)) raf = requestAnimationFrame(place);
    else raf = 0;
  };

  const show = (row, e) => {
    if (!finePointer.matches || e.pointerType !== "mouse") return;
    if (previewImg.getAttribute("src") !== row.dataset.preview) previewImg.src = row.dataset.preview;
    if (!active) {
      // Start at the cursor so the first frame doesn't slide in from afar.
      tx = e.clientX;
      ty = e.clientY;
      x = tx + OFFSET;
      y = ty - H / 2;
    }
    active = true;
    preview.classList.add("is-on");
    if (!raf) raf = requestAnimationFrame(place);
  };

  rows.forEach((row) => {
    row.addEventListener("pointerenter", (e) => show(row, e));
    row.addEventListener("pointermove", (e) => {
      // Scrolling hides the preview; the next move over a row brings it back.
      if (!active) return show(row, e);
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(place);
    });
  });

  document.querySelector(".result-rows")?.addEventListener("pointerleave", () => {
    active = false;
    preview.classList.remove("is-on");
  });
  addEventListener("scroll", () => {
    if (!active) return;
    active = false;
    preview.classList.remove("is-on");
  }, { passive: true });
}

/* Projects: detail panel ------------------------------------------------- */

const panel = document.querySelector("dialog.panel");
const panelMeta = panel?.querySelector('[data-slot="meta"]');
const panelBody = panel?.querySelector('[data-slot="body"]');
const sheet = panel?.querySelector(".sheet");
const closeButton = panel?.querySelector("[data-close]");
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
let opener = null;
let closing = false;

// Keep Tab inside an open dialog: wrap from the last control to the first
// and back, instead of stepping out to the browser's own toolbar.
function keepTabInside(dialog) {
  const controls = () => [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !dialog.open) return;
    const items = controls();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = dialog.contains(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  });
}

function openProject(slug, from) {
  const tpl = document.getElementById(`project-${slug}`);
  if (!panel || !tpl) return false;
  opener = from ?? rows.find((r) => r.dataset.project === slug) ?? null;
  panelMeta.textContent = tpl.dataset.meta ?? "";
  panelBody.replaceChildren(tpl.content.cloneNode(true));
  sheet.scrollTop = 0;
  rows.forEach((r) => r.classList.toggle("is-active", r === opener));
  if (!panel.open) panel.showModal();
  // Browsers differ on where showModal() puts focus, and swapping the body
  // while open drops it, so always start on Close.
  closeButton.focus({ preventScroll: true });
  // Next frame, so the sheet transitions in from off screen.
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("is-open")));
  history.replaceState(null, "", `#project-${slug}`);
  return true;
}

function closeProject() {
  if (!panel?.open || closing) return;
  closing = true;
  panel.classList.remove("is-open");
  const done = () => {
    closing = false;
    panel.close();
    rows.forEach((r) => r.classList.remove("is-active"));
    history.replaceState(null, "", "#projects");
    opener?.focus({ preventScroll: true });
  };
  if (reduceMotion.matches) done();
  else {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      sheet.removeEventListener("transitionend", onEnd);
      done();
    };
    // Only the sheet's own slide counts; transitions inside it bubble up too.
    const onEnd = (e) => {
      if (e.target === sheet) finish();
    };
    sheet.addEventListener("transitionend", onEnd);
    setTimeout(finish, 420);
  }
}

if (panel) {
  rows.forEach((row) => row.addEventListener("click", () => openProject(row.dataset.project, row)));
  panel.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeProject();
  });
  panel.addEventListener("click", (e) => {
    if (e.target === panel || e.target.closest("[data-close]")) closeProject();
  });

  keepTabInside(panel);

  // Deep links: #project-<slug> opens that project.
  const fromHash = () => {
    const m = location.hash.match(/^#project-([\w-]+)$/);
    if (m) {
      document.getElementById("projects")?.scrollIntoView({ behavior: "instant" });
      openProject(m[1]);
    }
  };
  addEventListener("hashchange", fromHash);
  fromHash();
}

/* Gallery: photos open as posts ------------------------------------------ */
// Each photo opens as a post: the photo beside its place, caption and date.
// The arrows, ← → keys or a swipe move between photos (wrapping around);
// Esc, the × or a click outside closes it. #photo-<n> opens photo n.

const shots = [...document.querySelectorAll(".shot")];
const postDialog = document.querySelector("dialog.post-dialog");

if (shots.length && postDialog) {
  const post = postDialog.querySelector(".post");
  const slot = (name) => postDialog.querySelector(`[data-slot="${name}"]`);
  const pad = (n) => String(n).padStart(2, "0");
  let current = 0;
  let postClosing = false;

  const count = document.querySelector(".shot-count");
  if (count) count.textContent = shots.length;

  // Hover preview on each tile: place and date, then the caption's first words.
  shots.forEach((shot) => {
    const caption = shot.querySelector(".shot-caption")?.textContent.trim().replace(/\s+/g, " ") ?? "";
    const words = caption.split(" ");
    const peek = document.createElement("span");
    peek.className = "peek";
    peek.setAttribute("aria-hidden", "true");
    peek.append([shot.dataset.place, shot.dataset.date].filter(Boolean).join(", "));
    if (caption) {
      const small = document.createElement("small");
      small.textContent = words.length > 7 ? `${words.slice(0, 7).join(" ")}…` : caption;
      peek.append(small);
    }
    shot.querySelector(".tile").append(peek);
  });

  function show(i) {
    current = (i + shots.length) % shots.length;
    const shot = shots[current];
    const img = shot.querySelector(".tile img");
    let media;
    if (img) {
      media = img.cloneNode();
      media.loading = "eager";
      media.sizes = "(max-width: 900px) 100vw, 640px";
    } else {
      media = shot.querySelector(".ph").cloneNode(true);
    }
    slot("media").replaceChildren(media);
    slot("place").textContent = shot.dataset.place ?? "";
    slot("date").textContent = shot.dataset.date ?? "";
    slot("caption").replaceChildren(...(shot.querySelector(".shot-caption")?.cloneNode(true).childNodes ?? []));
    slot("count").textContent = `${pad(current + 1)} / ${pad(shots.length)}`;
    postDialog.setAttribute("aria-label", `Photo ${current + 1} of ${shots.length}`);
    history.replaceState(null, "", `#photo-${current + 1}`);
  }

  function openPost(i) {
    show(i);
    if (!postDialog.open) postDialog.showModal();
    // Start on whichever Close button this layout shows.
    [...postDialog.querySelectorAll("[data-close]")].find((b) => b.getClientRects().length)?.focus({ preventScroll: true });
    requestAnimationFrame(() => requestAnimationFrame(() => postDialog.classList.add("is-open")));
  }

  function closePost() {
    if (!postDialog.open || postClosing) return;
    postClosing = true;
    postDialog.classList.remove("is-open");
    const done = () => {
      postClosing = false;
      postDialog.close();
      history.replaceState(null, "", "#gallery");
      // Back on the photo that was showing, scrolled into view if needed.
      const tile = shots[current].querySelector(".tile");
      tile.focus({ preventScroll: true });
      tile.scrollIntoView({ block: "nearest" });
    };
    if (reduceMotion.matches) return done();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      post.removeEventListener("transitionend", onEnd);
      done();
    };
    const onEnd = (e) => {
      if (e.target === post) finish();
    };
    post.addEventListener("transitionend", onEnd);
    setTimeout(finish, 320);
  }

  shots.forEach((shot, i) => shot.querySelector(".tile").addEventListener("click", () => openPost(i)));
  postDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closePost();
  });
  postDialog.addEventListener("click", (e) => {
    const step = e.target.closest("[data-step]");
    if (step) show(current + Number(step.dataset.step));
    else if (e.target === postDialog || e.target.closest("[data-close]")) closePost();
  });
  postDialog.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    show(current + (e.key === "ArrowRight" ? 1 : -1));
  });

  // Swipe sideways on the photo (touch and pen) to move between photos.
  const media = slot("media");
  let start = null;
  media.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") start = { x: e.clientX, y: e.clientY };
  });
  media.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
  });
  media.addEventListener("pointercancel", () => (start = null));

  keepTabInside(postDialog);

  const fromHash = () => {
    const m = location.hash.match(/^#photo-(\d+)$/);
    if (m && shots[m[1] - 1]) {
      document.getElementById("gallery")?.scrollIntoView({ behavior: "instant" });
      openPost(m[1] - 1);
    }
  };
  addEventListener("hashchange", fromHash);
  fromHash();
}

/* Contact: copy the address ---------------------------------------------- */
// The address is a plain mailto: link; the button beside it copies it. The
// button only appears where the browser allows copying.

const copyButton = document.querySelector(".copy-email");
const toast = document.querySelector(".contact .toast");
let toastTimer = 0;

if (copyButton && navigator.clipboard?.writeText) {
  copyButton.hidden = false;
  copyButton.addEventListener("click", async () => {
    let message = "Copied";
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copy);
    } catch {
      message = "Couldn't copy";
    }
    toast.textContent = message;
    toast.toggleAttribute("data-error", message !== "Copied");
    requestAnimationFrame(() => toast.classList.add("is-on"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-on");
      setTimeout(() => {
        if (!toast.classList.contains("is-on")) toast.textContent = "";
      }, 300);
    }, 1800);
  });
}

/* Cover: pause the moving name -------------------------------------------- */

const tickerPause = document.querySelector(".ticker-pause");
tickerPause?.addEventListener("click", () => {
  const paused = tickerPause.getAttribute("aria-pressed") !== "true";
  tickerPause.setAttribute("aria-pressed", String(paused));
  tickerPause.setAttribute("aria-label", paused ? "Play the moving name" : "Pause the moving name");
  cover.toggleAttribute("data-ticker-paused", paused);
});

/* Cover: the song --------------------------------------------------------- */
// Without JavaScript the link opens the song on Spotify. With it, the first
// press swaps in Spotify's compact player in the same place and starts it,
// and the header's now-playing pill pauses or resumes it from anywhere.
// Nothing from Spotify loads until a visitor points at, focuses or presses
// the link.

const song = document.querySelector(".song[data-spotify-uri]");
const songSlot = document.querySelector(".song-slot");
const songHint = document.querySelector(".song-hint");
const nowPlaying = document.querySelector(".now-playing");
const nowToggle = nowPlaying?.querySelector(".now-toggle");
const SONG = "Take Me for a Ride";
let spotify = null;
let player = null;

function loadSpotify() {
  spotify ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.onerror = reject;
    document.head.append(script);
  });
  return spotify;
}

// Spotify didn't load (offline, or blocked): say so and leave the link to
// open the song on Spotify.
function songFallback() {
  song.dataset.fallback = "";
  const open = document.createElement("a");
  open.className = "text-link";
  open.href = song.href;
  open.target = "_blank";
  open.rel = "noopener";
  open.textContent = "open it on Spotify";
  songHint.replaceChildren("The player didn't load here; ", open, ".");
}

if (song && songSlot && songHint && nowPlaying && nowToggle) {
  const warm = () => loadSpotify().catch(() => {});
  song.addEventListener("pointerenter", warm, { once: true });
  song.addEventListener("focus", warm, { once: true });

  song.addEventListener("click", async (e) => {
    if ("fallback" in song.dataset) return; // let the link open Spotify
    e.preventDefault();
    songHint.textContent = "Loading the player…";
    let api;
    try {
      api = await Promise.race([loadSpotify(), new Promise((_, reject) => setTimeout(reject, 8000))]);
    } catch {
      songFallback();
      return;
    }

    const host = document.createElement("div");
    songSlot.replaceChildren(host);
    api.createController(host, { uri: song.dataset.spotifyUri, width: "100%", height: 80 }, (controller) => {
      player = controller;
      nowPlaying.hidden = false;
      // Keep keyboard focus where the link was: on the player that replaced it.
      songSlot.querySelector("iframe")?.focus({ preventScroll: true });

      let started = false;
      controller.addListener("ready", () => {
        controller.play();
        // Some browsers (iOS Safari) only start it from the player's own button.
        setTimeout(() => {
          if (!started) songHint.textContent = "Press play in the player to start it.";
        }, 2500);
      });
      controller.addListener("playback_update", ({ data }) => {
        const playing = !data.isPaused;
        if (playing && !started) {
          started = true;
          songHint.textContent = "Now scroll. It keeps playing while you look around.";
        }
        nowPlaying.toggleAttribute("data-playing", playing);
        nowToggle.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${SONG}`);
      });
    });
  });

  nowToggle.addEventListener("click", () => player?.togglePlay());
}
