// Excludes #34d399 (remote pill green) and #fbbf24 (countdown amber)
// so organizer color never collides with semantic UI colors in the same card.
const ORG_PALETTE = ['#818cf8','#60a5fa','#c084fc','#e879f9','#f472b6','#fb923c','#a78bfa','#38bdf8'];

let categories = ['All'];
let events = [];
let activeCategory = 'All';
let remoteOnly = false;

function orgColor(name) { return hashColor(name, ORG_PALETTE); }

function fmtDate(date, dateEnd) {
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  const start = new Date(date + 'T12:00:00');
  if (!dateEnd || dateEnd === date) {
    return start.toLocaleDateString('en-US', opts);
  }
  const end = new Date(dateEnd + 'T12:00:00');
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      '–' + end.getDate() + ', ' + end.getFullYear();
  }
  return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' – ' + end.toLocaleDateString('en-US', opts);
}

function countdown(date, expires) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(date + 'T00:00:00');
  const days = Math.round((start - now) / 86400000);
  if (days < 0) {
    // Started — show time remaining if available
    if (expires) {
      const end = new Date(expires + 'T00:00:00');
      const left = Math.round((end - now) / 86400000);
      if (left === 0) return { text: 'Ends today', cls: 'event-countdown--soon' };
      if (left === 1) return { text: 'Ends tomorrow', cls: 'event-countdown--soon' };
      if (left <= 14) return { text: 'Ends in ' + left + ' days', cls: 'event-countdown--soon' };
    }
    return { text: 'Ongoing', cls: 'event-countdown--upcoming' };
  }
  if (days === 0) return { text: 'Today', cls: 'event-countdown--soon' };
  if (days === 1) return { text: 'Tomorrow', cls: 'event-countdown--soon' };
  if (days <= 14) return { text: days + ' days away', cls: 'event-countdown--soon' };
  return { text: days + ' days away', cls: 'event-countdown--upcoming' };
}

function isExpired(e) {
  // Only `expires` is authoritative — the discover-events schema always sets it.
  // Entries without `expires` are treated as not expired.
  if (!e.expires) return false;
  return new Date(e.expires + 'T23:59:59') < new Date();
}

function getFiltered() {
  return events
    .filter(function (e) { return !isExpired(e); })
    .filter(function (e) { return activeCategory === 'All' || e.category === activeCategory; })
    .filter(function (e) { return !remoteOnly || e.remote; })
    .sort(function (a, b) { return a.date.localeCompare(b.date); });
}

function renderCard(e) {
  const color = orgColor(e.organizer);
  const cd = countdown(e.date, e.expires || e.date_end);
  const locationPill = e.remote
    ? `<span class="event-location-pill event-location-pill--remote">Remote</span>`
    : `<span class="event-location-pill event-location-pill--in-person">${escapeHtml(e.location)}</span>`;

  return `<article class="event-card">
    <a class="event-card-link" href="${escapeHtml(e.link)}" target="_blank" rel="noopener noreferrer">
      <div class="event-card-top">
        <span class="event-organizer" style="color:${color}">${escapeHtml(e.organizer)}</span>
        <span class="event-cat">${escapeHtml(e.category)}</span>
        ${locationPill}
      </div>
      <h3 class="event-name">${escapeHtml(e.name)}</h3>
      <div class="event-meta">
        <span class="event-meta-line">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          ${escapeHtml(fmtDate(e.date, e.date_end))}
        </span>
        <span class="event-meta-line">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          ${escapeHtml(e.eligibility)}
        </span>
      </div>
      <p class="event-why">${escapeHtml(e.why)}</p>
    </a>
    <div class="event-footer">
      <span class="event-countdown ${escapeHtml(cd.cls)}">${escapeHtml(cd.text)}</span>
      <a class="event-apply" href="${escapeHtml(e.link)}" target="_blank" rel="noopener noreferrer">
        Apply
        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
      </a>
    </div>
  </article>`;
}

function renderFilters() {
  const filterBar = document.getElementById('filter-bar');
  const usedCats = new Set(events.filter(function(e) { return !isExpired(e); }).map(function(e) { return e.category; }));
  const visibleCategories = categories.filter(function(c) { return c === 'All' || usedCats.has(c); });
  renderFilterTabs(filterBar, visibleCategories, activeCategory, function(c) {
    return c === 'All' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1);
  });
}

function render() {
  const filtered = getFiltered();
  const resultsBar = document.getElementById('results-bar');
  const content = document.getElementById('content');
  const label = filtered.length === 1 ? 'event' : 'events';
  resultsBar.innerHTML = `<span class="results-count"><strong>${filtered.length}</strong> upcoming ${label}</span>` +
    `<button class="remote-toggle" aria-pressed="${remoteOnly}">Remote only</button>`;

  if (filtered.length > 0) {
    content.innerHTML = `<div class="grid">${filtered.map(renderCard).join('')}</div>`;
  } else {
    content.innerHTML = `<div class="empty"><h2>Nothing upcoming</h2><p>Check back soon — new events get added when they clear the bar.</p></div>`;
  }
}

document.getElementById('filter-bar').addEventListener('click', function(e) {
  const tab = e.target.closest('.filter-tab');
  if (tab) { activeCategory = tab.dataset.cat; renderFilters(); render(); }
});

document.getElementById('results-bar').addEventListener('click', function(e) {
  if (e.target.closest('.remote-toggle')) { remoteOnly = !remoteOnly; render(); }
});

Promise.all([
  fetch('../events.json').then(function(r) { return r.json(); }),
  fetch('../event-categories.json').then(function(r) { return r.json(); })
]).then(function(results) {
  events = results[0];
  categories = ['All'].concat(results[1]);
  renderFilters();
  render();
}).catch(function() {
  document.getElementById('content').innerHTML =
    '<div class="empty"><h2>Failed to load</h2><p>Could not fetch event data. Please refresh.</p></div>';
});
