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
  renderFilterTabs(filterBar, categories, activeCategory);
}

function renderCard(b) {
  const tags = b.tags.slice(0, 3).map(function (t) {
    return `<button class="tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`;
  }).join('');
  const pill = b.offer_type
    ? `<span class="offer-pill offer-${b.offer_type}">${OFFER_LABELS[b.offer_type]}</span>`
    : '';
  return `<article class="card">
    <div class="card-body">
      <a class="card-link" href="${escapeHtml(b.link)}" target="_blank" rel="noopener noreferrer">
        <div class="card-top">
          <span class="badge" data-cat="${escapeHtml(b.category)}">${escapeHtml(b.category)}</span>
          ${pill}
        </div>
        <h3 class="card-name">${escapeHtml(b.name)}</h3>
        <p class="card-desc">${escapeHtml(b.description)}</p>
      </a>
      <div class="tags">${tags}</div>
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
  renderResultsBar(filtered);
  renderGrid(filtered);
}

resultsBar.addEventListener('change', function (e) {
  if (e.target.id === 'sort-select') {
    sortOrder = e.target.value;
    render();
  }
});

resultsBar.addEventListener('click', function (e) {
  if (e.target.closest('#free-toggle')) {
    freeOnly = !freeOnly;
    render();
    return;
  }
  if (e.target.closest('#clear-btn')) {
    searchQuery = '';
    searchInput.value = '';
    render();
  }
});

filterBar.addEventListener('click', function (e) {
  const btn = e.target.closest('.filter-tab');
  if (!btn) return;
  activeCategory = btn.dataset.cat;
  renderFilters();
  render();
});

searchInput.addEventListener('input', function () {
  searchQuery = searchInput.value;
  render();
});

document.addEventListener('keydown', function (e) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
    searchInput.focus();
  }
});

content.addEventListener('click', function (e) {
  const tag = e.target.closest('.tag');
  if (!tag) return;
  searchQuery = tag.dataset.tag;
  searchInput.value = searchQuery;
  render();
});

// Excludes offer-type colors (#a78bfa trial, #60a5fa credits, #fbbf24 discount, #4ade80 free)
// so category badges never share a hue with an offer pill on the same card.
const CAT_PALETTE = ['#c084fc','#22d3ee','#38bdf8','#14b8a6','#f472b6','#e879f9','#fb923c','#f87171','#34d399','#818cf8'];
function catColor(name) { return hashColor(name, CAT_PALETTE); }

Promise.all([
  fetch('benefits.json').then(function (r) { return r.json(); }),
  fetch('categories.json').then(function (r) { return r.json(); })
]).then(function (results) {
  benefits = results[0];
  categories = ['All'].concat(results[1]);
  const sheet = document.createElement('style');
  sheet.textContent = results[1].map(function (cat) {
    return `.badge[data-cat="${cat.replace(/"/g, '\\"')}"] { color: ${catColor(cat)}; }`;
  }).join('\n');
  document.head.appendChild(sheet);
  renderFilters();
  render();
}).catch(function () {
  content.innerHTML = '<div class="empty"><h2>Failed to load</h2><p>Could not fetch benefit data. Please refresh.</p></div>';
});
