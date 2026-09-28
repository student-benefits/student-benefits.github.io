let categories = [];
let events = [];
let activeCategory = 'All';
let remoteOnly = false;

const categoryTooltips = {
  'All': 'Show all events',
  'conference': 'Industry conferences, keynotes, and talks',
  'fellowship': 'Structured cohort programs with mentors and curriculum',
  'grant': 'Individual funding for self-directed projects',
  'hackathon': 'Time-limited coding competitions and building sprints',
  'summit': 'Multi-day gatherings focused on specific topics or communities',
  'workshop': 'Hands-on training sessions and skill-building'
};

const filterBar = document.getElementById('filter-bar');
const content = document.getElementById('content');
const countEl = document.getElementById('count');
const countLabel = document.getElementById('count-label');
const remoteToggle = document.getElementById('remote-toggle');

const DATE_RANGE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const DAY_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const capitalize = function (c) { return c.charAt(0).toUpperCase() + c.slice(1); };

function fmtDate(date, dateEnd) {
  const start = new Date(date + 'T12:00:00');
  if (!dateEnd || dateEnd === date) return DATE_RANGE_FMT.format(start);
  return DATE_RANGE_FMT.formatRange(start, new Date(dateEnd + 'T12:00:00'));
}

function daysUntil(ymd) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((new Date(ymd + 'T00:00:00') - now) / 86400000);
}

// An application deadline, when known, outranks the event date: a student
// reading "45 days away" about a program that stopped accepting applications
// last month has been told the wrong thing. Colour follows the site rule:
// amber = closes within 14 days, red = closed. Nothing else is coloured.
function applyState(e) {
  if (!e.deadline) return null;
  const days = daysUntil(e.deadline);
  const on = ' (' + DAY_FMT.format(new Date(e.deadline + 'T12:00:00')) + ')';
  if (days < 0) return { closed: true, text: 'Applications closed' + on, cls: 'st--closed' };
  if (days === 0) return { text: 'Applications close today', cls: 'st--soon' };
  if (days === 1) return { text: 'Applications close tomorrow', cls: 'st--soon' };
  if (days <= 14) return { text: 'Applications close in ' + days + ' days' + on, cls: 'st--soon' };
  return { text: 'Apply by ' + DATE_RANGE_FMT.format(new Date(e.deadline + 'T12:00:00')), cls: '' };
}

// Without a stated deadline the status is timing only, never coloured.
function timing(e) {
  const days = daysUntil(e.date);
  if (days < 0) {
    const end = e.expires || e.date_end;
    if (end) {
      const left = daysUntil(end);
      if (left === 0) return 'Ends today';
      if (left === 1) return 'Ends tomorrow';
      if (left <= 14) return 'Ends in ' + left + ' days';
    }
    return 'Ongoing';
  }
  if (days === 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  return 'Starts in ' + days + ' days';
}

function isExpired(e) {
  // Only `expires` is authoritative: the discover-events schema always sets it.
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
  const applied = applyState(e);
  const status = applied || { text: timing(e), cls: '' };
  const where = e.remote ? 'Remote' : (e.location || '');
  return `<article class="card">
    <div class="card-top">
      <span class="cat"><span class="dot" style="--c:${catVar(e.category)}" aria-hidden="true"></span>${escapeHtml(capitalize(e.category))}</span>
      ${where ? `<span class="where">${escapeHtml(where)}</span>` : ''}
    </div>
    <h2 class="card-name"><a href="${escapeHtml(e.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(e.name)}</a></h2>
    <p class="when">${escapeHtml(fmtDate(e.date, e.date_end))}</p>
    <p class="st ${status.cls}">${escapeHtml(status.text)}</p>
    <p class="card-desc">${escapeHtml(e.why)}</p>
    <dl class="facts">
      <dt>Organizer</dt><dd>${escapeHtml(e.organizer)}</dd>
      <dt>Eligibility</dt><dd>${escapeHtml(e.eligibility)}</dd>
    </dl>
    ${applied && applied.closed ? '' : '<span class="apply" aria-hidden="true">Apply or register →</span>'}
  </article>`;
}

function visibleCategories() {
  const used = new Set(events.filter(function (e) { return !isExpired(e); }).map(function (e) { return e.category; }));
  return categories.filter(function (c) { return used.has(c); });
}

function renderFilters(animate) {
  withFocusPreserved(filterBar, function () {
    renderChips(filterBar, ['All'].concat(visibleCategories()), activeCategory, {
      label: function (c) { return c === 'All' ? 'All' : capitalize(c); },
      tooltip: function (c) { return categoryTooltips[c] || ''; },
      hue: function (c) { return catVar(c); },
      animate: animate
    });
  });
}

function renderGrid(filtered) {
  if (filtered.length > 0) {
    content.innerHTML = `<div class="grid">${filtered.map(renderCard).join('')}</div>`;
  } else {
    renderEmptyState(content, 'Nothing upcoming', 'New events are added when they clear the quality bar.');
  }
}

function render(animate) {
  const filtered = getFiltered();
  setCount(countEl, filtered.length);
  countLabel.textContent = 'upcoming ' + (filtered.length === 1 ? 'event' : 'events');
  remoteToggle.setAttribute('aria-pressed', String(remoteOnly));
  if (animate) swapList(content, function () { renderGrid(filtered); });
  else renderGrid(filtered);
}

filterBar.addEventListener('click', function (e) {
  const chip = e.target.closest('.chip');
  if (!chip || chip.dataset.cat === activeCategory) return;
  activeCategory = chip.dataset.cat;
  renderFilters(true);
  render(true);
});

remoteToggle.addEventListener('click', function () {
  remoteOnly = !remoteOnly;
  render(true);
});

addEventListener('resize', function () { placeIndicator(filterBar, false); });

Promise.all([
  fetch('/data/events.json').then(function (r) { return r.json(); }),
  fetch('/data/event-categories.json').then(function (r) { return r.json(); })
]).then(function (results) {
  events = results[0];
  categories = results[1];
  renderFilters(false);
  render(false);
  rise(content.querySelectorAll('.card')); // first load only
}).catch(function () {
  renderEmptyState(content, 'Failed to load', 'Could not fetch event data. Please refresh.');
});
