/* agent.js — drives the /agent/ explainer:
   (1) architecture node disclosures, (2) the simulated submission, (3) the live last-run trace. */

const TOOLS = {
  get_issue:             { actor: 'github', label: 'GitHub',     explain: 'Reads the GitHub issue to extract the submitted benefit name and any optional details.' },
  get_file_contents:     { actor: 'github', label: 'GitHub',     explain: 'Downloads <code>data/benefits.json</code> from the repo to check whether this benefit is already listed.' },
  create_or_update_file: { actor: 'github', label: 'GitHub',     explain: 'Writes or updates a file in the repository via the GitHub API.' },
  create_pull_request:   { actor: 'github', label: 'GitHub',     explain: 'Creates a GitHub pull request with the change for human review before it goes live.' },
  add_comment:           { actor: 'github', label: 'GitHub',     explain: 'Posts a status comment on the original issue to close the loop with the submitter.' },
  close_issue:           { actor: 'github', label: 'GitHub',     explain: null },
  create_issue:          { actor: 'github', label: 'GitHub',     explain: 'Opens a new GitHub issue for a discovered student program, queuing it for the add-benefit workflow.' },
  'github-issue_read':   { actor: 'github', label: 'GitHub',     explain: 'Reads the GitHub issue to extract the submitted benefit name and any optional details.' },
  websearch:             { actor: 'web',    label: 'Web Search', explain: 'Runs a live web search (Claude’s built-in WebSearch) to verify the student program exists and find the official signup URL.' },
  web_fetch:             { actor: 'web',    label: 'Web Fetch',  explain: 'Opens the most relevant result (Claude’s built-in WebFetch) to confirm the program details and extract the correct URL.' },
  webfetch:              { actor: 'web',    label: 'Web Fetch',  explain: 'Opens the most relevant result (Claude’s built-in WebFetch) to confirm the program details and extract the correct URL.' },
  validate_data:         { actor: 'gate',   label: 'Gate',       explain: 'Runs <code>validate_data.py</code> — the deterministic gate. Exit 0/1 is the loop’s pass/fail signal.' },
  edit:                  { actor: 'grant',  label: 'Grant',      explain: 'Writes the new benefit entry into <code>data/benefits.json</code> in sorted position.' },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ── architecture node disclosures ────────────────────── */
function togglePanel(id) {
  const panel = document.getElementById('panel-' + id);
  const trigger = document.getElementById('node-' + id);
  const open = !panel.hidden;
  document.querySelectorAll('.node-panel').forEach(p => { p.hidden = true; });
  document.querySelectorAll('.arch-node').forEach(t => t.setAttribute('aria-expanded', 'false'));
  if (!open) {
    panel.hidden = false;
    panel.style.animation = 'none'; panel.offsetHeight; panel.style.animation = '';
    trigger.setAttribute('aria-expanded', 'true');
  }
}

document.querySelector('.arch-nodes').addEventListener('click', e => {
  const btn = e.target.closest('.arch-node');
  if (btn) togglePanel(btn.id.replace('node-', ''));
});

/* ── live run trace ───────────────────────────────────── */
function fmtDetail(tool) {
  if (tool.query)   return 'query: ' + tool.query;
  if (tool.url)     return tool.url.replace(/^https?:\/\//, '');
  if (tool.summary) return tool.summary;
  return '';
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  } catch { return iso; }
}

const OUTCOME_LABELS = { accepted: '✓ Accepted', rejected: '✗ Rejected', duplicate: '⚠ Duplicate' };
function outcomeLabel(o) { return OUTCOME_LABELS[o] || o; }

function renderRun(data) {
  const issueUrl = `https://github.com/student-benefits/student-benefits.github.io/issues/${data.issue}`;

  let html = `
    <div class="run-meta">
      <div class="run-meta-head">
        <span class="run-meta-issue">
          <a href="${escapeHtml(issueUrl)}" target="_blank" rel="noopener noreferrer">Issue #${escapeHtml(String(data.issue))}</a>
          — ${escapeHtml(data.title)}
        </span>
        <span class="run-meta-time">${escapeHtml(fmtTime(data.timestamp))}</span>
      </div>
      <div class="run-meta-body">
        <span class="run-outcome ${escapeHtml(data.outcome)}">${outcomeLabel(data.outcome)}</span>`;

  if (data.benefit) {
    html += `<span class="benefit-pill"><strong>${escapeHtml(data.benefit.name)}</strong> · ${escapeHtml(data.benefit.category)}</span>`;
  }
  if (data.run_url) {
    html += `<a class="run-link" href="${escapeHtml(data.run_url)}" target="_blank" rel="noopener noreferrer">View run →</a>`;
  }
  html += `</div></div><div class="trace">`;

  for (const tool of (data.tools || [])) {
    const info   = TOOLS[tool.name] || { actor: 'grant', label: tool.name, explain: null };
    const detail = fmtDetail(tool);
    html += `
      <div class="trace-step actor-${escapeHtml(info.actor)}">
        <div class="trace-gutter"><div class="trace-dot"></div><div class="trace-line"></div></div>
        <div class="trace-card">
          <div class="trace-head">
            <span class="actor-badge badge-${escapeHtml(info.actor)}">${escapeHtml(info.label)}</span>
            <span class="trace-head-label">${escapeHtml(tool.name.replace(/_/g, '_​'))}</span>
            ${detail ? `<span class="trace-head-detail">${escapeHtml(detail)}</span>` : ''}
          </div>
          <div class="trace-body">
            ${tool.summary ? `<p class="trace-primary">${escapeHtml(tool.summary)}</p>` : ''}
            ${info.explain ? `<p class="trace-annotation">${info.explain}</p>` : ''}
          </div>
        </div>
      </div>`;
  }
  html += `</div>`;

  if (data.benefit && data.outcome === 'accepted') {
    html += `
      <div class="added-banner">
        <p class="added-banner-label">Added to directory</p>
        <p class="added-banner-name">${escapeHtml(data.benefit.name)} <span>· ${escapeHtml(data.benefit.category)}</span></p>
        <p class="added-banner-desc">${escapeHtml(data.benefit.description)}</p>
      </div>`;
  }

  document.getElementById('run-output').innerHTML = html;
  applyPacketRates(data.tools || [], data.outcome);
}

/* packet speed encodes how often each connector was used in the last run */
function applyPacketRates(tools, outcome) {
  const counts = { web: 0, github: 0 };
  for (const t of tools) {
    const actor = (TOOLS[t.name] || {}).actor || 'grant';
    if (actor === 'web') counts.web++;
    else if (actor === 'github') counts.github++;
  }
  setPacketRate('conn-search',   counts.web);
  setPacketRate('conn-validate', counts.github);
  setPacketRate('conn-pr', outcome === 'accepted' ? 1 : 0);
}

function setPacketRate(id, count) {
  const conn = document.getElementById(id);
  if (!conn) return;
  const packets = conn.querySelectorAll('.packet');
  if (count === 0) {
    packets.forEach(p => { p.style.animation = 'none'; });
  } else {
    const dur = Math.max(0.8, 2.4 / count).toFixed(2) + 's';
    packets.forEach(p => { p.style.animationDuration = dur; });
  }
}

/* ── simulated submission ─────────────────────────────── */
const SIM_STEPS = [
  { stepClass: 'actor-github', badge: 'badge-github', badgeLabel: 'GitHub', headLabel: 'get_issue', detail: 'issue #67',
    primary: 'User submitted: <em>"Adobe Creative Cloud is discounted for students"</em>',
    annotation: 'Reads the issue body to extract the benefit name and any optional link.' },
  { stepClass: 'actor-github', badge: 'badge-github', badgeLabel: 'GitHub', headLabel: 'get_file_contents', detail: 'data/benefits.json',
    primary: '… existing benefits loaded. Checking for name and hostname matches…',
    annotation: 'Scans existing entries before any web research, to avoid duplicates.' },
  { stepClass: 'actor-grant', badge: 'badge-grant', badgeLabel: 'Grant', headLabel: 'no duplicate found', detail: null,
    primary: '<code>adobe.com</code> not in existing entries. Proceeding to verify.', annotation: null },
  { stepClass: 'actor-web', badge: 'badge-web', badgeLabel: 'Web', headLabel: 'websearch', detail: 'Adobe Creative Cloud student discount',
    primary: '5 results. Top: <code>adobe.com/creativecloud/plans/student-and-teacher.html</code>',
    annotation: 'Searches the live web to confirm the program is real and active — not just from training data.' },
  { stepClass: 'actor-web', badge: 'badge-web', badgeLabel: 'Web', headLabel: 'web_fetch', detail: 'adobe.com/…/student-and-teacher.html',
    primary: 'Confirmed: ~65% discount on Creative Cloud All Apps for verified students.',
    annotation: 'Opens the actual signup page to extract exact terms and the correct URL.' },
  { stepClass: 'actor-grant', badge: 'badge-grant', badgeLabel: 'Grant', headLabel: 'edit', detail: 'data/benefits.json',
    primary: 'Wrote <strong>Adobe Creative Cloud</strong> · Design',
    code: `<span class="c-dim">{</span>
  <span class="c-hl">"id"</span>: <span class="c-grn">"adobe-creative-cloud"</span>,
  <span class="c-hl">"name"</span>: <span class="c-grn">"Adobe Creative Cloud"</span>,
  <span class="c-hl">"category"</span>: <span class="c-grn">"Design"</span>,
  <span class="c-hl">"offer_type"</span>: <span class="c-grn">"discount"</span>,
  <span class="c-hl">"popularity"</span>: <span class="c-blue">5</span>
<span class="c-dim">}</span>`,
    annotation: 'Writes the entry into data/benefits.json in sorted position.' },
  { stepClass: 'actor-gate', badge: 'badge-gate', badgeLabel: 'Gate', headLabel: 'validate_data.py', detail: 'exit 0',
    primary: 'Schema, link shape, and sort order all <strong>pass</strong>.',
    annotation: 'The deterministic gate runs before any PR. On a fail, Grant fixes the entry and re-runs — that is the loop.' },
  { stepClass: 'actor-github', badge: 'badge-github', badgeLabel: 'GitHub', headLabel: 'create_pull_request', detail: 'PR #68',
    primary: 'Opened PR #68: <em>"Add benefit: Adobe Creative Cloud"</em>',
    annotation: 'Creates a pull request for human review. The benefit goes live only after a person merges.' },
  { stepClass: 'actor-github', badge: 'badge-github', badgeLabel: 'GitHub', headLabel: 'add_comment', detail: 'issue #67',
    primary: 'Commented on issue #67 with the PR link.',
    annotation: 'Closes the loop with the submitter.' }
];

let simStep = 0;
const SVG_PLAY   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
const SVG_NEXT   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`;
const SVG_REPLAY = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;

function simNext() {
  const btn   = document.getElementById('sim-btn');
  const hint  = document.getElementById('sim-hint');
  const trace = document.getElementById('sim-trace');

  if (btn.dataset.state === 'replay') {
    trace.innerHTML = ''; simStep = 0; btn.dataset.state = '';
    btn.innerHTML = SVG_PLAY + ' Start'; hint.textContent = '';
    return;
  }
  if (simStep >= SIM_STEPS.length) return;

  addSimStep(SIM_STEPS[simStep], trace, btn);
  simStep++;
  hint.textContent = `${simStep} / ${SIM_STEPS.length}`;

  if (simStep === SIM_STEPS.length) {
    btn.dataset.state = 'replay'; btn.innerHTML = SVG_REPLAY + ' Replay';
  } else {
    btn.innerHTML = SVG_NEXT + ' Next step';
  }
}

// headLabel/detail/badge are escaped; primary/code/annotation are authored HTML, injected raw on purpose.
function addSimStep(step, trace, btn) {
  const codeHtml = step.code ? `<div class="sim-code"><pre>${step.code}</pre></div>` : '';
  const el = document.createElement('div');
  el.className = `trace-step ${step.stepClass} sim-hidden`;
  el.innerHTML = `
    <div class="trace-gutter"><div class="trace-dot"></div><div class="trace-line"></div></div>
    <div class="trace-card">
      <div class="trace-head">
        <span class="actor-badge ${escapeHtml(step.badge)}">${escapeHtml(step.badgeLabel)}</span>
        <span class="trace-head-label">${escapeHtml(step.headLabel)}</span>
        ${step.detail ? `<span class="trace-head-detail">${escapeHtml(step.detail)}</span>` : ''}
      </div>
      <div class="trace-body">
        <p class="trace-primary">${step.primary}</p>
        ${codeHtml}
        ${step.annotation ? `<p class="trace-annotation">${step.annotation}</p>` : ''}
      </div>
    </div>`;
  trace.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.remove('sim-hidden'); el.classList.add('sim-visible');
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }));
}

document.getElementById('sim-btn').addEventListener('click', simNext);

fetch('../data/benefits.json')
  .then(r => r.ok ? r.json() : [])
  .then(data => { SIM_STEPS[1].primary = data.length + ' existing benefits loaded. Checking for name and hostname matches…'; })
  .catch(() => {});

fetch('state/last-run.json')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(data => {
    renderRun(data);
    const meta = document.getElementById('run-summary-meta');
    if (meta) {
      meta.innerHTML =
        `<span class="run-outcome ${escapeHtml(data.outcome)}">${outcomeLabel(data.outcome)}</span>` +
        `<span class="run-summary-issue">Issue #${escapeHtml(String(data.issue))} — ${escapeHtml(data.title)}</span>`;
    }
  })
  .catch(() => {
    document.getElementById('run-output').innerHTML =
      '<div class="state-error">No run recorded yet.</div>';
  });
