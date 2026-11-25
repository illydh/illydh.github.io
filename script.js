import { mountPipeline } from "./pipeline.js";

const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

/* Theme ------------------------------------------------------------------ */
// Dark is the default (see the inline script in <head>); the toggle stores
// the visitor's choice.

const themeButtons = document.querySelectorAll("[data-theme-toggle]");
const themeMeta = document.querySelector('meta[name="theme-color"]');

function syncThemeUI() {
  const dark = root.dataset.theme !== "light";
  themeButtons.forEach((b) => b.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme"));
  themeMeta?.setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim());
}

function setTheme(theme) {
  const apply = () => {
    root.dataset.theme = theme;
    syncThemeUI();
    document.dispatchEvent(new CustomEvent("themechange"));
  };
  try {
    localStorage.setItem("theme", theme);
  } catch {}
  if (document.startViewTransition && !reduceMotion.matches) document.startViewTransition(apply);
  else apply();
}

themeButtons.forEach((b) =>
  b.addEventListener("click", () => setTheme(root.dataset.theme === "light" ? "dark" : "light"))
);
syncThemeUI();

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

const onScroll = () => header.toggleAttribute("data-scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
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

/* Hero pipeline ---------------------------------------------------------- */

const pipelineCanvas = document.querySelector(".pipeline canvas");
if (pipelineCanvas) {
  mountPipeline(pipelineCanvas, { pauseButton: document.querySelector(".pipeline-pause") });
}

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

// Visible, focusable controls inside the panel, in tab order.
const panelControls = () => [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);

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

  // Keep Tab inside the open panel: wrap from the last control to the first
  // and back, instead of stepping out to the browser's own toolbar.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !panel.open) return;
    const items = panelControls();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = panel.contains(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  });

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

/* Contact: copy the address ---------------------------------------------- */

const email = document.querySelector(".email[data-copy]");
const toast = document.querySelector(".contact .toast");
let toastTimer = 0;

email?.addEventListener("click", async (e) => {
  if (!navigator.clipboard?.writeText) return; // fall back to mailto:
  e.preventDefault();
  try {
    await navigator.clipboard.writeText(email.dataset.copy);
    toast.textContent = "Copied";
    requestAnimationFrame(() => toast.classList.add("is-on"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-on");
      setTimeout(() => {
        if (!toast.classList.contains("is-on")) toast.textContent = "";
      }, 300);
    }, 1800);
  } catch {
    location.href = email.href;
  }
});
