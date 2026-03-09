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

// Renders filter tab buttons into `container`.
// `categories` is an array of category strings.
// `activeCategory` is the currently selected value.
// `labelFn` is an optional function(cat) => string for display text; defaults to identity.
function renderFilterTabs(container, categories, activeCategory, labelFn) {
  var label = labelFn || function (c) { return c; };
  container.innerHTML = categories.map(function (cat) {
    return '<button class="filter-tab" aria-pressed="' + (cat === activeCategory) + '" data-cat="' + escapeHtml(cat) + '">' + escapeHtml(label(cat)) + '</button>';
  }).join('');
}

// Renders an empty-state block into `container`.
// `message` is the body text shown under the heading.
function renderEmptyState(container, message) {
  container.innerHTML = '<div class="empty"><h2>No results</h2><p>' + escapeHtml(message) + '</p></div>';
}

// Renders `count` skeleton cards into `container` (replaces existing content).
function renderSkeletons(container, count) {
  var cards = '';
  for (var i = 0; i < count; i++) {
    cards += '<div class="skeleton-card"></div>';
  }
  container.innerHTML = '<div class="skeleton">' + cards + '</div>';
}
