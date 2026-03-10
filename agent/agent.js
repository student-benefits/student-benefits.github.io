const TOOLS = {
  get_issue:             { actor: 'github', label: 'GitHub',        explain: 'Reads the GitHub issue to extract the submitted benefit name and any optional details.' },
  get_file_contents:     { actor: 'github', label: 'GitHub',        explain: 'Downloads <code>benefits.json</code> from the repo to check whether this benefit is already listed.' },
  create_or_update_file: { actor: 'github', label: 'GitHub',        explain: 'Writes or updates a file in the repository via the GitHub API.' },
  create_pull_request:   { actor: 'github', label: 'GitHub',        explain: 'Creates a GitHub pull request with the change for human review before it goes live.' },
  add_comment:           { actor: 'github', label: 'GitHub',        explain: 'Posts a status comment on the original issue to close the loop with the submitter.' },
  close_issue:           { actor: 'github', label: 'GitHub',        explain: null },
  create_issue:          { actor: 'github', label: 'GitHub',        explain: 'Opens a new GitHub issue for a discovered student program, queuing it for the add-benefit workflow to process.' },
  tavily_search:         { actor: 'tavily', label: 'Tavily Search', explain: 'Runs a live web search via Tavily to verify the student program exists and find the official signup URL.' },
  search:                { actor: 'tavily', label: 'Tavily Search', explain: 'Runs a live web search via Tavily to verify the student program exists and find the official signup URL.' }, // alias — MCP tool name varies by server version
  web_fetch:             { actor: 'web',    label: 'Web',           explain: 'Opens the most relevant search result to confirm the student program details and extract the correct URL.' },
  edit:                  { actor: 'grant',  label: 'Grant',         explain: 'Appends the new benefit entry to <code>benefits.json</code> in the repository.' },
};

function toggleDisclosure(panelId, triggerId, allPanelsSelector, allTriggersSelector) {
  const panel   = document.getElementById(panelId);
  const trigger = document.getElementById(triggerId);
  const isOpen  = !panel.hidden;

  document.querySelectorAll(allPanelsSelector).forEach(function (p) { p.hidden = true; });
  document.querySelectorAll(allTriggersSelector).forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });

  if (!isOpen) {
    panel.hidden = false;
    panel.style.animation = 'none';
    panel.offsetHeight; // force reflow to restart CSS animation
    panel.style.animation = '';
    trigger.setAttribute('aria-expanded', 'true');
  }
}

function toggleProp(id) {
  toggleDisclosure('ppanel-' + id, 'pchip-' + id, '[id^="ppanel-"]', '.prop-chip');
}

function togglePanel(id) {
  toggleDisclosure('panel-' + id, 'node-' + id, '.node-panel', '.arch-node');
}


function fmtDetail(tool) {
  if (tool.query) return 'query: ' + tool.query;
  if (tool.url)   return tool.url.replace(/^https?:\/\//, '');
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

const OUTCOME_LABELS = {
  accepted:  '✓ Accepted',
  rejected:  '✗ Rejected',
  duplicate: '⚠ Duplicate'
};

function outcomeLabel(outcome) {
  return OUTCOME_LABELS[outcome] || outcome;
}

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

  html += `</div></div>`;

  // Trace
  html += `<div class="trace">`;

  for (const tool of (data.tools || [])) {
    const info = TOOLS[tool.name] || { actor: 'grant', label: tool.name, explain: null };
    const badge = 'badge-' + info.actor;
    const stepClass = 'actor-' + info.actor;
    const explain = info.explain || '';
    const detail = fmtDetail(tool);

    html += `
      <div class="trace-step ${escapeHtml(stepClass)}">
        <div class="trace-gutter">
          <div class="trace-dot"></div>
          <div class="trace-line"></div>
        </div>
        <div class="trace-card">
          <div class="trace-head">
            <span class="actor-badge ${escapeHtml(badge)}">${escapeHtml(info.label)}</span>
            <span class="trace-head-label">${escapeHtml(tool.name.replace(/_/g, '_\u200b'))}</span><!-- allow line-break after underscores in long tool names -->
            ${detail ? `<span class="trace-head-detail">${escapeHtml(detail)}</span>` : ''}
          </div>
          <div class="trace-body">
            ${tool.summary ? `<p class="trace-primary">${escapeHtml(tool.summary)}</p>` : ''}
            ${explain ? `<p class="trace-annotation">${explain}</p>` : ''}
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
  renderOrbitDots(data.tools || []);
}

function applyPacketRates(tools, outcome) {
  // conn-search and conn-validate: speed encodes call frequency
  const counts = { tavily: 0, web: 0, github: 0 };
  for (const t of tools) {
    const actor = (TOOLS[t.name] || {}).actor || 'grant';
    if (actor === 'tavily') counts.tavily++;
    else if (actor === 'web') counts.web++;
    else if (actor === 'github') counts.github++;
  }
  setPacketRate('conn-search',   counts.tavily + counts.web);
  setPacketRate('conn-validate', counts.github);
  // conn-pr: binary — PR either went to reviewer or it didn't
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

const ACTOR_COLOR = {
  grant:  'var(--grant-color)',
  github: 'var(--github-color)',
  tavily: 'var(--tavily-color)',
  web:    'var(--web-color)',
};

// Replaces static orbit dots with one dot per tool step (capped at 8).
// Dot color = actor type; distribution encodes the composition of the last run.
function renderOrbitDots(tools) {
  const center = document.querySelector('.prop-radial-center');
  if (!center) return;
  center.querySelectorAll('.orbit-dot').forEach(d => d.remove());
  const steps = tools.slice(0, 8);
  if (!steps.length) return;
  const period = 10; // seconds per orbit
  const nameEl = center.querySelector('.prop-radial-center-name');
  steps.forEach((tool, i) => {
    const actor = (TOOLS[tool.name] || {}).actor || 'grant';
    const dot = document.createElement('span');
    dot.className = 'orbit-dot';
    dot.style.background = ACTOR_COLOR[actor] || ACTOR_COLOR.grant;
    dot.style.animationDelay = (-period * i / steps.length).toFixed(2) + 's';
    dot.title = actor + ': ' + tool.name;
    center.insertBefore(dot, nameEl);
  });
}

// Simulation
const SIM_STEPS = [
  {
    stepClass: 'actor-github', badge: 'badge-github', badgeLabel: 'GitHub',
    headLabel: 'get_issue', detail: 'issue #67',
    primary: 'User submitted: <em>"Adobe Creative Cloud is discounted for students"</em>',
    annotation: 'Reads the issue body to extract the benefit name and any optional link provided by the submitter.'
  },
  {
    stepClass: 'actor-github', badge: 'badge-github', badgeLabel: 'GitHub',
    headLabel: 'get_file_contents', detail: 'benefits.json',
    primary: '… existing benefits loaded. Checking for name and hostname matches…',
    annotation: 'Scans all existing entries before doing any web research to avoid duplicates.'
  },
  {
    stepClass: 'actor-grant', badge: 'badge-grant', badgeLabel: 'Grant',
    headLabel: 'no duplicate found', detail: null,
    primary: '<code>adobe.com</code> not in existing entries. Proceeding to verify.',
    annotation: null
  },
  {
    stepClass: 'actor-tavily', badge: 'badge-tavily', badgeLabel: 'Tavily',
    headLabel: 'search', detail: 'Adobe Creative Cloud student discount education',
    primary: '5 results found. Top result: <code>adobe.com/creativecloud/plans/student-and-teacher.html</code>',
    annotation: 'Searches the live web to confirm the program is real and currently active. Not just from training data.'
  },
  {
    stepClass: 'actor-web', badge: 'badge-web', badgeLabel: 'Web',
    headLabel: 'web_fetch', detail: 'adobe.com/creativecloud/plans/student-and-teacher.html',
    primary: 'Confirmed: ~65% discount on Creative Cloud All Apps for verified students.',
    annotation: 'Opens the actual signup page to extract exact terms and the correct URL.'
  },
  {
    stepClass: 'actor-grant', badge: 'badge-grant', badgeLabel: 'Grant',
    headLabel: 'edit', detail: 'benefits.json',
    primary: 'Added <strong>Adobe Creative Cloud</strong> · Design',
    code: `<span class="c-dim">{</span>
  <span class="c-hl">"id"</span>: <span class="c-grn">"adobe-creative-cloud"</span>,
  <span class="c-hl">"name"</span>: <span class="c-grn">"Adobe Creative Cloud"</span>,
  <span class="c-hl">"category"</span>: <span class="c-grn">"Design"</span>,
  <span class="c-hl">"description"</span>: <span class="c-grn">"~65% discount on All Apps plan for students..."</span>,
  <span class="c-hl">"popularity"</span>: <span class="c-blue">5</span>
<span class="c-dim">}</span>`,
    annotation: 'Appends the validated benefit with all required fields to benefits.json.'
  },
  {
    stepClass: 'actor-github', badge: 'badge-github', badgeLabel: 'GitHub',
    headLabel: 'create_pull_request', detail: 'PR #68',
    primary: 'Opened PR #68: <em>"Add benefit: Adobe Creative Cloud"</em>',
    annotation: 'Creates a pull request for human review. The benefit goes live only after it\'s merged.'
  },
  {
    stepClass: 'actor-github', badge: 'badge-github', badgeLabel: 'GitHub',
    headLabel: 'add_comment', detail: 'issue #67',
    primary: 'Commented on issue #67 with the PR link.',
    annotation: 'Closes the loop. The submitter gets notified their suggestion was processed.'
  }
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
    trace.innerHTML = '';
    simStep = 0;
    btn.dataset.state = '';
    btn.innerHTML = SVG_PLAY + ' Start';
    hint.textContent = '';
    return;
  }

  if (simStep >= SIM_STEPS.length) return;

  addSimStep(SIM_STEPS[simStep], trace, btn);
  simStep++;
  hint.textContent = `${simStep} / ${SIM_STEPS.length}`;

  if (simStep === SIM_STEPS.length) {
    btn.dataset.state = 'replay';
    btn.innerHTML = SVG_REPLAY + ' Replay';
  } else {
    btn.innerHTML = SVG_NEXT + ' Next step';
  }
}

// SIM_STEPS fields: badge, badgeLabel, headLabel, detail are plain text — escaped below.
// primary, code, annotation are authored HTML in the SIM_STEPS constant — injected raw intentionally.
function addSimStep(step, trace, btn) {
  const codeHtml = step.code
    ? `<div class="sim-code"><pre>${step.code}</pre></div>`
    : '';
  const el = document.createElement('div');
  el.className = `trace-step ${step.stepClass} sim-hidden`;
  el.innerHTML = `
    <div class="trace-gutter">
      <div class="trace-dot"></div>
      <div class="trace-line"></div>
    </div>
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
    el.classList.remove('sim-hidden');
    el.classList.add('sim-visible');
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }));
}

document.querySelector('.arch-nodes').addEventListener('click', function (e) {
  const btn = e.target.closest('.arch-node');
  if (!btn) return;
  togglePanel(btn.id.replace('node-', ''));
});

document.querySelector('.prop-radial').addEventListener('click', function (e) {
  const chip = e.target.closest('.prop-chip');
  if (!chip) return;
  toggleProp(chip.id.replace('pchip-', ''));
});

document.getElementById('sim-btn').addEventListener('click', simNext);

fetch('../benefits.json')
  .then(function (r) { return r.ok ? r.json() : []; })
  .then(function (data) {
    SIM_STEPS[1].primary = data.length + ' existing benefits loaded. Checking for name and hostname matches\u2026';
  });

fetch('last-run.json')
  .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(function (data) {
    renderRun(data);
    const meta = document.getElementById('run-summary-meta');
    if (meta) {
      meta.innerHTML =
        `<span class="run-outcome ${escapeHtml(data.outcome)}">${outcomeLabel(data.outcome)}</span>` +
        `<span class="run-summary-issue">Issue #${escapeHtml(String(data.issue))} — ${escapeHtml(data.title)}</span>`;
    }
  })
  .catch(function () {
    document.getElementById('run-output').innerHTML =
      '<div class="state-error">No run data yet. Grant hasn\'t processed a submission yet.</div>';
  });
