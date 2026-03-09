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
