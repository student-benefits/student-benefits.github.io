/* shared.js — helpers for /benefits/, /events/ and /how-it-works/. */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Each category's hue, keyed by name so reordering a categories file repaints nothing. Benefits avoid
// the accent, green (Free) and red; events avoid the accent, red and amber (deadlines). A category
// missing here shows a muted dot until it is added.
var CATEGORY_HUE = {
  'AI Tools': 'orchid', 'Dev Tools': 'cyan', 'Cloud & Hosting': 'copper', 'Learning': 'blue',
  'Design': 'pink', 'Productivity': 'olive', 'Security': 'navy', 'Hardware': 'ochre',
  conference: 'blue', grant: 'olive', hackathon: 'orchid', fellowship: 'teal', summit: 'pink', workshop: 'cyan'
};
function catVar(cat) {
  var hue = CATEGORY_HUE[cat];
  return hue ? 'var(--hue-' + hue + ')' : 'var(--muted)';
}

// Runs an innerHTML-replacing render, then puts keyboard focus back on the equivalent new element:
// the swap destroys the focused node, which otherwise drops a keyboard user to the top of the page.
function withFocusPreserved(container, renderFn) {
  var active = document.activeElement;
  var selector = null;
  if (active && container.contains(active)) {
    if (active.id) selector = '#' + CSS.escape(active.id);
    else if (active.dataset && active.dataset.cat !== undefined) selector = '[data-cat="' + CSS.escape(active.dataset.cat) + '"]';
  }
  renderFn();
  if (selector) {
    var el = container.querySelector(selector);
    if (el) el.focus();
  }
}

/* ── motion ─────────────────────────────────────────────────
   Every animation moves between two states the page already has, on the springs shared.css defines.
   Reduced motion skips the travel and lands on the end state. */
var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

function springOf(name) {
  var s = getComputedStyle(document.documentElement);
  return {
    easing: s.getPropertyValue('--' + name).trim() || 'ease-out',
    duration: parseFloat(s.getPropertyValue('--' + name + '-t')) || 250
  };
}

function play(el, frames, opts) {
  if (reduceMotion.matches || !el || !el.animate) return Promise.resolve();
  var o = Object.assign(springOf('snappy'), opts || {});
  return el.animate(frames, o).finished.catch(function () {});
}

// Content arriving on its own rises in, a few items apart. Used on first load only.
function rise(els) {
  Array.prototype.slice.call(els, 0, 9).forEach(function (el, k) {
    play(el, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      Object.assign(springOf('soft'), { delay: k * 30, fill: 'backwards' }));
  });
}

// A number that changed swaps with a short blur, so the eye catches that it moved.
function setCount(el, n) {
  if (!el || el.textContent === String(n)) return;
  el.textContent = n;
  play(el, [{ opacity: 0, filter: 'blur(2px)', transform: 'translateY(-3px)' }, { opacity: 1, filter: 'none', transform: 'none' }]);
}

// Swaps a result list after a filter click: the old list leaves in one ease-in keyframe (90 ms), the
// new one settles on the spring. A newer swap started mid-swap wins; the older one never paints.
var swapSeq = 0;
function swapList(container, renderFn) {
  var id = ++swapSeq;
  var current = container.firstElementChild;
  var exit = current
    ? play(current, [{ opacity: 0, filter: 'blur(4px)' }], { duration: 90, easing: 'ease-in', fill: 'forwards' })
    : Promise.resolve();
  return exit.then(function () {
    if (id !== swapSeq) return;
    renderFn();
    play(container.firstElementChild, [{ opacity: 0, filter: 'blur(4px)', transform: 'translateY(4px)' },
      { opacity: 1, filter: 'none', transform: 'none' }]);
  });
}

// Filter chips with one sliding indicator. The chips are rebuilt only when the set changes; a
// selection change only flips aria-pressed and moves the indicator, so it can travel.
function renderChips(container, cats, active, opts) {
  opts = opts || {};
  var label = opts.label || function (c) { return c; };
  var tip = opts.tooltip;
  var key = cats.join('\u0000');
  if (container.dataset.key !== key) {
    container.dataset.key = key;
    container.innerHTML = cats.map(function (cat) {
      var dot = opts.hue && cat !== 'All' ? '<span class="dot" style="--c:' + opts.hue(cat) + '" aria-hidden="true"></span>' : '';
      var title = tip && tip(cat) ? ' title="' + escapeHtml(tip(cat)) + '"' : '';
      return '<button type="button" class="chip" data-cat="' + escapeHtml(cat) + '"' + title + '>' + dot + escapeHtml(label(cat)) + '</button>';
    }).join('') + '<span class="chip-ind" aria-hidden="true"></span>';
  }
  container.querySelectorAll('.chip').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.cat === active));
  });
  placeIndicator(container, !!opts.animate);
}

// Leading edge on the snappy spring, trailing edge on the soft one, so the indicator stretches
// toward where it is going and catches up. Placed without travel on first paint and on resize.
function placeIndicator(container, animate) {
  var on = container.querySelector('.chip[aria-pressed="true"]');
  var bar = container.querySelector('.chip-ind');
  if (!on || !bar) return;
  var L = on.offsetLeft, R = on.offsetLeft + on.offsetWidth;
  var pl = parseFloat(bar.style.getPropertyValue('--l')), pr = parseFloat(bar.style.getPropertyValue('--r'));
  var forward = L + R > pl + pr;
  var lead = 'var(--snappy-t) var(--snappy)', trail = 'var(--soft-t) var(--soft)';
  var sameRow = Math.abs(on.offsetTop - parseFloat(bar.style.top || '0')) < 1;
  bar.style.transition = animate && sameRow && !reduceMotion.matches && !isNaN(pl)
    ? '--l ' + (forward ? trail : lead) + ', --r ' + (forward ? lead : trail)
    : 'none';
  bar.style.top = on.offsetTop + 'px';
  bar.style.height = on.offsetHeight + 'px';
  bar.style.setProperty('--l', L + 'px');
  bar.style.setProperty('--r', R + 'px');
  if (animate) on.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}

function renderEmptyState(container, title, message) {
  container.innerHTML = '<div class="empty"><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(message) + '</p></div>';
}
