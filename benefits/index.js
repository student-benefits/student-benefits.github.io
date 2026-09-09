let categories = ['All'];
let benefits = [];
let activeCategory = 'All';
let searchQuery = '';
let sortOrder = 'popularity';
let freeOnly = false;

const OFFER_LABELS = { free: 'Free', discount: 'Discount', credits: 'Credits', trial: 'Trial' };

const searchInput = document.getElementById('search');
const filterBar = document.getElementById('filter-bar');
const resultsBar = document.getElementById('results-bar');
const content = document.getElementById('content');
const copyStatus = document.getElementById('copy-status');

// Filter state lives in the URL so a filtered view can be linked, not just reached.
// replaceState (not pushState) keeps the back button pointing at wherever the
// visitor came from rather than at their own filter clicks.
function readUrlState() {
  const p = new URLSearchParams(location.search);
  const q = p.get('q');
  if (q) { searchQuery = q; searchInput.value = q; }
  const cat = p.get('cat');
  if (cat) activeCategory = cat;
  if (p.get('free') === '1') freeOnly = true;
  const sort = p.get('sort');
  if (sort === 'alpha' || sort === 'popularity') sortOrder = sort;
}

// keepHash is for the two writes that happen while a permalink is still being
// resolved — dropping #id there would erase the anchor the visitor arrived on
// before revealHashCard ever reads it. A filter the visitor changes themselves
// does drop it, because the anchored card may no longer be on screen.
function writeUrlState(keepHash) {
  const p = new URLSearchParams();
  if (activeCategory !== 'All') p.set('cat', activeCategory);
  if (searchQuery) p.set('q', searchQuery);
  if (freeOnly) p.set('free', '1');
  if (sortOrder !== 'popularity') p.set('sort', sortOrder);
  const qs = p.toString();
  const hash = keepHash ? location.hash : '';
  history.replaceState(null, '', (qs ? '?' + qs : location.pathname) + hash);
}

function getFilteredAndSorted() {
  const q = searchQuery.toLowerCase();
  return benefits
    .filter(function (b) {
      const catMatch = activeCategory === 'All' || b.category === activeCategory;
      const searchMatch = b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.tags.some(function (t) { return t.toLowerCase().includes(q); });
      return catMatch && searchMatch && (!freeOnly || b.offer_type === 'free');
    })
    .sort(function (x, y) {
      if (sortOrder === 'alpha') return x.name.localeCompare(y.name);
      return y.popularity - x.popularity;
    });
}

function renderFilters() {
  withFocusPreserved(filterBar, function () {
    renderFilterTabs(filterBar, categories, activeCategory);
  });
}

function renderCard(b) {
  const tags = b.tags.slice(0, 3).map(function (t) {
    return `<button class="tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`;
  }).join('');
  const pill = b.offer_type
    ? `<span class="offer-pill offer-${b.offer_type}">${OFFER_LABELS[b.offer_type]}</span>`
    : '';
  const repoLink = b.repo
    ? `<a class="repo-link" href="https://github.com/${escapeHtml(b.repo)}" target="_blank" rel="noopener noreferrer" title="Open source: ${escapeHtml(b.repo)}">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      </a>`
    : '';
  const share = `<a class="card-share" href="#${escapeHtml(b.id)}" data-id="${escapeHtml(b.id)}" aria-label="Copy link to ${escapeHtml(b.name)}" title="Copy link to this benefit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
      </a>`;
  return `<article class="card" id="${escapeHtml(b.id)}">
    <div class="card-body">
      <a class="card-link" href="${escapeHtml(b.link)}" target="_blank" rel="noopener noreferrer">
        <div class="card-top">
          <span class="badge" style="color:${catColor(b.category)}">${escapeHtml(b.category)}</span>
          ${pill}
        </div>
        <h2 class="card-name">${escapeHtml(b.name)}</h2>
        <p class="card-desc">${escapeHtml(b.description)}</p>
      </a>
      <div class="card-footer">
        <div class="tags">${tags}</div>
        <div class="card-actions">${repoLink}${share}</div>
      </div>
    </div>
  </article>`;
}

function renderResultsBar(filtered) {
  const count = filtered.length;
  const label = count === 1 ? 'resource' : 'resources';
  let bar = `<span class="results-count">Found <strong>${count}</strong> ${label}</span>`;
  bar += `<div class="bar-right">`;
  bar += `<button id="free-toggle" class="free-toggle" aria-pressed="${freeOnly}">Free only</button>`;
  bar += `<select class="sort-select" id="sort-select" aria-label="Sort order">
    <option value="popularity"${sortOrder === 'popularity' ? ' selected' : ''}>Popular</option>
    <option value="alpha"${sortOrder === 'alpha' ? ' selected' : ''}>A-Z</option>
  </select>`;
  if (searchQuery) {
    bar += `<button class="clear-btn" id="clear-btn">
      <span>Clear</span>
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>`;
  }
  bar += `</div>`;
  resultsBar.innerHTML = bar;
}

function renderGrid(filtered) {
  if (filtered.length > 0) {
    content.innerHTML = `<div class="grid">${filtered.map(renderCard).join('')}</div>`;
  } else {
    renderEmptyState(content, 'Try a different search or category.');
  }
}

function render() {
  const filtered = getFilteredAndSorted();
  withFocusPreserved(resultsBar, function () { renderResultsBar(filtered); });
  renderGrid(filtered);
}

resultsBar.addEventListener('change', function (e) {
  if (e.target.id === 'sort-select') {
    sortOrder = e.target.value;
    writeUrlState();
    render();
  }
});

resultsBar.addEventListener('click', function (e) {
  if (e.target.closest('#free-toggle')) {
    freeOnly = !freeOnly;
    writeUrlState();
    render();
    return;
  }
  if (e.target.closest('#clear-btn')) {
    searchQuery = '';
    searchInput.value = '';
    writeUrlState();
    render();
    searchInput.focus(); // the clear button itself no longer exists post-render
  }
});

filterBar.addEventListener('click', function (e) {
  const btn = e.target.closest('.filter-tab');
  if (!btn) return;
  activeCategory = btn.dataset.cat;
  writeUrlState();
  renderFilters();
  render();
});

searchInput.addEventListener('input', function () {
  searchQuery = searchInput.value;
  writeUrlState();
  render();
});

document.addEventListener('keydown', function (e) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
    searchInput.focus();
  }
});

content.addEventListener('click', function (e) {
  const share = e.target.closest('.card-share');
  if (share) {
    e.preventDefault();
    copyPermalink(share);
    return;
  }
  const tag = e.target.closest('.tag');
  if (!tag) return;
  searchQuery = tag.dataset.tag;
  searchInput.value = searchQuery;
  writeUrlState();
  render();
  searchInput.focus(); // the clicked tag itself no longer exists post-render
});

// The href is a real link, so right-click -> Copy Link Address still works if the
// clipboard API is unavailable or the user denies it.
function copyPermalink(el) {
  const url = location.origin + location.pathname + '#' + el.dataset.id;
  const done = function (msg) {
    if (copyStatus) copyStatus.textContent = msg;
    el.classList.add('card-share--copied');
    setTimeout(function () { el.classList.remove('card-share--copied'); }, 1400);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(
      function () { done('Link copied'); },
      function () { done('Copy failed — right-click the icon to copy the link'); }
    );
  } else {
    done('Copy failed — right-click the icon to copy the link');
  }
}

// A permalink must win over a filter it would otherwise be hidden behind,
// or a shared card link silently lands on an empty grid.
function revealHashCard() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  if (!benefits.some(function (b) { return b.id === id; })) return;
  if (!document.getElementById(id)) {
    activeCategory = 'All';
    searchQuery = '';
    searchInput.value = '';
    freeOnly = false;
    writeUrlState(true);
    renderFilters();
    render();
  }
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.add('card--targeted');
}

// Excludes offer-type colors (#a78bfa trial, #60a5fa credits, #fbbf24 discount, #4ade80 free)
// so category badges never share a hue with an offer pill on the same card.
const CAT_PALETTE = ['#c084fc','#22d3ee','#38bdf8','#14b8a6','#f472b6','#e879f9','#fb923c','#f87171','#34d399','#818cf8'];
function catColor(name) { return hashColor(name, CAT_PALETTE); }

readUrlState();

Promise.all([
  fetch('/data/benefits.json').then(function (r) { return r.json(); }),
  fetch('/data/categories.json').then(function (r) { return r.json(); })
]).then(function (results) {
  benefits = results[0];
  categories = ['All'].concat(results[1]);
  // A ?cat= naming a category that no longer exists would filter everything out.
  if (categories.indexOf(activeCategory) === -1) activeCategory = 'All';
  writeUrlState(true);
  renderFilters();
  render();
  revealHashCard();
}).catch(function () {
  content.innerHTML = '<div class="empty"><h2>Failed to load</h2><p>Could not fetch benefit data. Please refresh.</p></div>';
});
