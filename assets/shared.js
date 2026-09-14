/* shared.js — utilities used across multiple pages */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// djb2-variant hash: maps a string to a stable index into the given palette array.
// Used to assign consistent colors to categories (index.html) and organizers (events/index.html).
function hashColor(name, palette) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

// Runs `renderFn` (an innerHTML-replacing render), then restores keyboard
// focus to the equivalent new element if the focus was inside `container`
// beforehand — an innerHTML swap destroys the focused node outright, which
// otherwise drops a keyboard user back to the start of the page on every
// filter click, toggle, or sort change.
function withFocusPreserved(container, renderFn) {
  var active = document.activeElement;
  var selector = null;
  if (active && container.contains(active)) {
    if (active.id) {
      selector = '#' + CSS.escape(active.id);
    } else if (active.dataset && active.dataset.cat !== undefined) {
      selector = '[data-cat="' + CSS.escape(active.dataset.cat) + '"]';
    }
  }
  renderFn();
  if (selector) {
    var el = container.querySelector(selector);
    if (el) el.focus();
  }
}

// Renders filter tab buttons into `container`.
// `categories` is an array of category strings.
// `activeCategory` is the currently selected value.
// `labelFn` is an optional function(cat) => string for display text; defaults to identity.
// `tooltipFn` is an optional function(cat) => string for tooltip text.
function renderFilterTabs(container, categories, activeCategory, labelFn, tooltipFn) {
  var label = labelFn || function (c) { return c; };
  container.innerHTML = categories.map(function (cat) {
    var tooltip = tooltipFn ? (' title="' + escapeHtml(tooltipFn(cat)) + '"') : '';
    return '<button class="filter-tab" aria-pressed="' + (cat === activeCategory) + '" data-cat="' + escapeHtml(cat) + '"' + tooltip + '>' + escapeHtml(label(cat)) + '</button>';
  }).join('');
}

// Renders an empty-state block into `container`.
// `message` is the body text shown under the heading.
function renderEmptyState(container, message) {
  container.innerHTML = '<div class="empty"><h2>No results</h2><p>' + escapeHtml(message) + '</p></div>';
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Fades+lifts each element matching `selector` in as it scrolls into view
// (each render() rebuilds the grid, so this re-observes every call — no
// state to track between renders). No-ops under reduced motion or without
// IntersectionObserver, leaving elements at their normal opacity — the
// [data-reveal] attribute this depends on is never set in that case.
function revealOnScroll(container, selector) {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  var els = container.querySelectorAll(selector);
  if (!els.length) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.setAttribute('data-reveal', 'in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
  els.forEach(function (el) {
    el.setAttribute('data-reveal', '');
    io.observe(el);
  });
}

// Cross-fades filter/sort/toggle renders (not keystrokes) via View Transitions;
// falls back to a plain call when unsupported or reduced-motion.
function renderWithTransition(renderFn) {
  if (prefersReducedMotion() || !document.startViewTransition) {
    renderFn();
    return;
  }
  var transition = document.startViewTransition(renderFn);
  // Silences a failed *animation* (renderFn already ran) so it isn't an unhandled rejection.
  transition.ready.catch(function () {});
  transition.finished.catch(function () {});
  transition.updateCallbackDone.catch(function () {});
}
