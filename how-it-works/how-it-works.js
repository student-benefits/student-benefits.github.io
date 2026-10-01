/* how-it-works.js — drives /how-it-works/:
   (1) architecture node details, (2) live workflow status and PR counts, (3) the simulated
   submission, (4) the last real run and the model byline, read from /agent/state/ (workflows write there). */

const REPO = 'student-benefits/student-benefits.github.io';
const STATE = '/agent/state/';

// Trace actors are categories, so each takes a category hue (a dot beside its name).
const ACTORS = {
  grant:  { label: 'Claude',    hue: 'var(--hue-orange)' },
  github: { label: 'GitHub',    hue: 'var(--hue-violet)' },
  web:    { label: 'Web',       hue: 'var(--hue-cyan)' },
  gate:   { label: 'Validator', hue: 'var(--hue-pink)' },
};

const TOOLS = {
  get_issue:             { actor: 'github', explain: 'Reads the issue to extract the submitted name and any optional details.' },
  get_file_contents:     { actor: 'github', explain: 'Reads <code>data/benefits.json</code> to check whether the benefit is already listed.' },
  create_or_update_file: { actor: 'github', explain: 'Writes or updates a file in the repository through the GitHub API.' },
  create_pull_request:   { actor: 'github', explain: 'Opens a pull request with the change after the validator exits 0; Claude then merges it.' },
  add_comment:           { actor: 'github', explain: 'Comments on the original issue with the outcome.' },
  close_issue:           { actor: 'github', explain: null },
  create_issue:          { actor: 'github', explain: 'Opens a <code>new-benefit</code> issue for a discovered program, which starts add-benefit.' },
  'github-issue_read':   { actor: 'github', explain: 'Reads the issue to extract the submitted name and any optional details.' },
  websearch:             { actor: 'web',    explain: 'Searches the live web (Claude’s built-in WebSearch) to confirm the program exists and find its official page.' },
  web_fetch:             { actor: 'web',    explain: 'Opens the page (Claude’s built-in WebFetch) to confirm the terms and the signup URL.' },
  webfetch:              { actor: 'web',    explain: 'Opens the page (Claude’s built-in WebFetch) to confirm the terms and the signup URL.' },
  validate_data:         { actor: 'gate',   explain: 'Runs <code>validate_data.py</code>. Exit 0 is a pass, exit 1 a fail.' },
  edit:                  { actor: 'grant',  explain: 'Writes the entry into <code>data/benefits.json</code> in sorted position.' },
};

function actorBadge(actor, label) {
  const a = ACTORS[actor] || ACTORS.grant;
  return `<span class="actor"><span class="dot" style="--c:${a.hue}" aria-hidden="true"></span>${escapeHtml(label || a.label)}</span>`;
}

/* ── architecture details ──────────────────────────────────
   One panel under the diagram, present only while a part is selected. Its height moves on the
   snappy spring from what it was to what the new content needs, so opening, switching and
   closing never leave reserved space behind. */
const archPanel = document.getElementById('arch-panel');
const archInner = archPanel.querySelector('.arch-panel-inner');
let archOpen = null;
let archSeq = 0;

function selectNode(id) {
  const seq = ++archSeq;
  const next = archOpen === id ? null : id;
  const from = archPanel.hidden ? 0 : archPanel.offsetHeight;
  document.querySelectorAll('.arch-node').forEach(n => n.setAttribute('aria-expanded', String(n.id === 'node-' + next)));
  archOpen = next;
  if (next) {
    archInner.innerHTML = document.getElementById('panel-' + next).innerHTML;
    archPanel.hidden = false;
    const to = archPanel.offsetHeight;
    play(archPanel, [{ height: from + 'px' }, { height: to + 'px' }]);
    play(archInner, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }]);
  } else {
    play(archPanel, [{ height: from + 'px' }, { height: '0px' }], { fill: 'forwards' }).then(() => {
      if (seq !== archSeq) return;
      archPanel.hidden = true;
      archPanel.getAnimations().forEach(a => a.cancel());
    });
  }
}

document.querySelector('.arch-flow').addEventListener('click', e => {
  const btn = e.target.closest('.arch-node');
  if (btn) selectNode(btn.id.replace('node-', ''));
});

/* ── last real run ─────────────────────────────────────── */
function fmtDetail(tool) {
  if (tool.query) return 'query: ' + tool.query;
  if (tool.url) return tool.url.replace(/^https?:\/\//, '');
  return '';
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  } catch { return iso; }
}

// Green = passed, red = failed; a duplicate is neither, so it stays ink.
const OUTCOMES = {
  accepted:  { text: '✓ Accepted',  cls: 'ok' },
  rejected:  { text: '✗ Rejected',  cls: 'bad' },
  duplicate: { text: 'Duplicate',   cls: '' },
};
function outcomeHtml(o) {
  const x = OUTCOMES[o] || { text: o, cls: '' };
  return `<span class="outcome ${x.cls}">${escapeHtml(x.text)}</span>`;
}

function traceStep(actor, head, detail, primary, annotation, code) {
  return `<li class="step">
      <div class="step-head">${actorBadge(actor)}<span class="step-name mono">${escapeHtml(head)}</span>${detail ? `<span class="step-detail">${escapeHtml(detail)}</span>` : ''}</div>
      ${primary ? `<p class="step-primary">${primary}</p>` : ''}
      ${code ? `<pre class="step-code">${code}</pre>` : ''}
      ${annotation ? `<p class="step-note">${annotation}</p>` : ''}
    </li>`;
}

function renderRun(data) {
  const issueUrl = `https://github.com/${REPO}/issues/${encodeURIComponent(data.issue)}`;
  let html = `<p class="run-sub"><span>${escapeHtml(fmtTime(data.timestamp))}</span>
      <a href="${escapeHtml(issueUrl)}" target="_blank" rel="noopener noreferrer">Open issue #${escapeHtml(String(data.issue))}</a>
      ${data.run_url ? `<a href="${escapeHtml(data.run_url)}" target="_blank" rel="noopener noreferrer">Open the Actions run</a>` : ''}</p>
    <ol class="trace">`;
  for (const tool of (data.tools || [])) {
    const info = TOOLS[tool.name] || { actor: 'grant', explain: null };
    html += traceStep(info.actor, tool.name, fmtDetail(tool), tool.summary ? escapeHtml(tool.summary) : '', info.explain);
  }
  html += '</ol>';
  if (data.benefit && data.outcome === 'accepted') {
    html += `<div class="added">
        <p class="added-k">Added to the directory</p>
        <p class="added-name">${escapeHtml(data.benefit.name)} <span>· ${escapeHtml(data.benefit.category)}</span></p>
        ${data.benefit.description ? `<p class="added-desc">${escapeHtml(data.benefit.description)}</p>` : ''}
      </div>`;
  }
  document.getElementById('run-output').innerHTML = html;
  document.getElementById('run-summary-meta').innerHTML =
    outcomeHtml(data.outcome) + `<span class="fold-issue">#${escapeHtml(String(data.issue))} · ${escapeHtml(data.title)}</span>`;
}

/* ── simulated submission ─────────────────────────────── */
const SIM_STEPS = [
  { actor: 'github', head: 'get_issue', detail: 'issue #67',
    primary: 'Submitted: <em>“Vercel has a free plan for students”</em>',
    note: 'Reads the issue body to extract the benefit name and any optional link.' },
  { actor: 'github', head: 'get_file_contents', detail: 'data/benefits.json',
    primary: 'Existing benefits loaded. Checking for name and hostname matches.',
    note: 'Checks existing entries before any web research, to avoid duplicates.' },
  { actor: 'grant', head: 'no duplicate found', detail: null,
    primary: '<code>vercel.com</code> is not in the existing entries.', note: null },
  { actor: 'web', head: 'websearch', detail: 'Vercel student discount',
    primary: '5 results. Top: <code>vercel.com/docs/plans/hobby</code>',
    note: 'Confirms on the live web that the program exists and is active.' },
  { actor: 'web', head: 'web_fetch', detail: 'vercel.com/docs/plans/hobby',
    primary: 'Confirmed: free Hobby plan for personal, non-commercial projects; no student verification required.',
    note: 'Opens the page to read the exact terms and the signup URL.' },
  { actor: 'grant', head: 'edit', detail: 'data/benefits.json',
    primary: 'Wrote <strong>Vercel</strong> · Cloud &amp; Hosting',
    code: `{
  "id": "vercel",
  "name": "Vercel",
  "category": "Cloud &amp; Hosting",
  "offer_type": "free",
  "popularity": 4
}`,
    note: 'Inserts the entry into data/benefits.json in sorted position. Ranks it 4 from the rubric: free, but the same plan anyone gets.' },
  { actor: 'gate', head: 'validate_data.py', detail: 'exit 0',
    primary: 'Schema, URL shape, and sort order <strong class="ok">pass</strong>.',
    note: 'On a fail, Claude fixes the entry and runs the validator again.' },
  { actor: 'github', head: 'create_pull_request', detail: 'PR #68',
    primary: 'Opened PR #68, “Add 1 student benefit: Vercel”, on branch <code>add-benefit-67</code>, and squash-merged it.',
    note: 'The benefit is live on merge.' },
  { actor: 'github', head: 'add_comment', detail: 'issue #67',
    primary: 'Commented on issue #67 with the PR link.',
    note: 'Reports the outcome to the submitter.' }
];

let simStep = 0;
const simBtn = document.getElementById('sim-btn');
const simHint = document.getElementById('sim-hint');
const simTrace = document.getElementById('sim-trace');

function simNext() {
  if (simBtn.dataset.state === 'replay') {
    simTrace.innerHTML = ''; simStep = 0; simBtn.dataset.state = '';
    simBtn.textContent = 'Start'; simHint.textContent = '';
    return;
  }
  if (simStep >= SIM_STEPS.length) return;
  const s = SIM_STEPS[simStep];
  // head/detail are escaped in traceStep; primary/code/note are authored HTML in this file.
  simTrace.insertAdjacentHTML('beforeend', traceStep(s.actor, s.head, s.detail, s.primary, s.note, s.code));
  const el = simTrace.lastElementChild;
  play(el, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], springOf('soft'));
  simStep++;
  simHint.textContent = `Step ${simStep} of ${SIM_STEPS.length}`;
  if (simStep === SIM_STEPS.length) { simBtn.dataset.state = 'replay'; simBtn.textContent = 'Replay'; }
  else simBtn.textContent = 'Next step';
  simBtn.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
}
simBtn.addEventListener('click', simNext);

/* ── live workflow status ─────────────────────────────── */
// What the public Actions API cannot say: whether a workflow calls Claude, its trigger, and what it
// does (the table in AGENTS.md). A workflow added to .github/workflows/ needs a row here.
const WORKFLOW_INFO = {
  'add-benefit.yml':       { kind: 'llm',   cadence: 'on a new-benefit issue', does: 'Validates a submitted benefit, checks it against the list and past rejections, opens and merges its PR.' },
  'add-event.yml':         { kind: 'llm',   cadence: 'on a new-event issue', does: 'The same for a submitted event, against the event quality bar.' },
  'discover-benefits.yml': { kind: 'llm',   cadence: '1st and 15th', does: 'Searches for new programs and opens new-benefit issues for the best finds.' },
  'discover-events.yml':   { kind: 'llm',   cadence: '3rd and 17th', does: 'Finds new events, removes expired ones, opens and merges one PR.' },
  'maintain-benefits.yml': { kind: 'llm',   cadence: 'every Sunday', does: 'Runs check_links.py (HTTP status and final hostname for every link, then Jev on each loaded page); Claude fixes only the flagged entries and merges one PR.' },
  'validate-data.yml':     { kind: 'plain', cadence: 'on PR and push', does: 'Runs validate_data.py on every change to data/ or the validator.' },
};

const CONCLUSIONS = {
  success:         { icon: '✓', label: 'passed',    cls: 'ok' },
  failure:         { icon: '✗', label: 'failed',    cls: 'bad' },
  timed_out:       { icon: '✗', label: 'timed out', cls: 'bad' },
  action_required: { icon: '✗', label: 'blocked',   cls: 'bad' },
  cancelled:       { icon: '–', label: 'cancelled', cls: '' },
  skipped:         { icon: '–', label: 'skipped',   cls: '' },
  neutral:         { icon: '–', label: 'neutral',   cls: '' },
  stale:           { icon: '–', label: 'stale',     cls: '' },
};

function relTime(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return hrs + ' h ago';
  return Math.round(hrs / 24) + ' days ago';
}

function renderWorkflowRow(filename, info, run) {
  const kind = info.kind === 'llm' ? 'Claude' : 'no model';
  let status = '<span class="wf-status">no recorded run</span>';
  if (run) {
    const s = run.status !== 'completed'
      ? { icon: '●', label: 'running', cls: '' }
      : (CONCLUSIONS[run.conclusion] || { icon: '?', label: run.conclusion || 'unknown', cls: '' });
    status = `<a class="wf-status ${s.cls}" href="${escapeHtml(run.html_url)}" target="_blank" rel="noopener noreferrer">` +
      `<span aria-hidden="true">${s.icon}</span> ${escapeHtml(s.label)} · ${escapeHtml(relTime(run.created_at))}</a>`;
  }
  return `<div class="wf-row">
      <div class="wf-main">
        <p class="wf-name"><code>${escapeHtml(filename)}</code><span class="wf-kind">${kind}</span></p>
        <p class="wf-does">${escapeHtml(info.does || '')}</p>
      </div>
      <p class="wf-cadence">${escapeHtml(info.cadence || '')}</p>
      ${status}
    </div>`;
}

async function loadWorkflowStatus() {
  const el = document.getElementById('workflows-live');
  try {
    // One call covers every workflow: the repo's 100 most recent runs, newest first. The first run
    // per file path is that file's latest; this stays under the unauthenticated 60-requests/hour limit.
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=100`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const latestByPath = {};
    for (const run of data.workflow_runs || []) {
      if (!(run.path in latestByPath)) latestByPath[run.path] = run;
    }
    // A workflow that runs twice a month can fall outside the last 100 runs; ask for its own latest.
    await Promise.all(Object.keys(WORKFLOW_INFO).map(async f => {
      const path = '.github/workflows/' + f;
      if (path in latestByPath) return;
      const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${f}/runs?per_page=1`);
      if (!r.ok) return;
      const run = ((await r.json()).workflow_runs || [])[0];
      if (run) latestByPath[path] = run;
    }));
    el.innerHTML = Object.keys(WORKFLOW_INFO).sort().map(f =>
      renderWorkflowRow(f, WORKFLOW_INFO[f], latestByPath['.github/workflows/' + f] || null)).join('');
    return latestByPath;
  } catch (e) {
    el.innerHTML = '<p class="state">Live status is unavailable right now. ' +
      `<a href="https://github.com/${REPO}/actions" target="_blank" rel="noopener noreferrer">Open the Actions log</a>.</p>`;
    return {};
  }
}

/* ── pull requests and the validator ─────────────────────
   "Closed without merging" is not shown: until 2026-09-28 per-issue PRs were folded into batch
   PRs and closed, so that count mixes a retired mechanism with rejections and cannot be split live. */
async function ghSearchCount(q) {
  const r = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=1`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()).total_count;
}

async function ghRunCount(workflowId, query) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflowId}/runs?per_page=1&${query}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()).total_count;
}

function statTile(value, label, cls) {
  return `<div class="stat"><p class="stat-v${cls ? ' ' + cls : ''}">${escapeHtml(String(value))}</p><p class="stat-k">${escapeHtml(label)}</p></div>`;
}

async function loadLedger(validateDataWorkflowId) {
  const el = document.getElementById('ledger-live');
  try {
    // Space-joined, not a literal '+': encodeURIComponent turns '+' into '%2B', which GitHub's
    // search parser rejects (422) instead of reading it as the qualifier separator.
    const base = `repo:${REPO} is:pr author:app/claude`;
    const [opened, merged, open] = await Promise.all([
      ghSearchCount(base),
      ghSearchCount(base + ' is:merged'),
      ghSearchCount(base + ' is:open'),
    ]);
    const tiles = [
      statTile(opened, 'PRs opened by the workflows'),
      statTile(merged, 'merged'),
      statTile(open, 'open now'),
    ];
    if (validateDataWorkflowId) {
      const [gatePass, gateFail] = await Promise.all([
        ghRunCount(validateDataWorkflowId, 'event=pull_request&status=success'),
        ghRunCount(validateDataWorkflowId, 'event=pull_request&status=failure'),
      ]);
      tiles.push(statTile(gatePass, 'validate-data runs passed on PRs', 'ok'));
      tiles.push(statTile(gateFail, 'validate-data runs failed on PRs', gateFail > 0 ? 'bad' : ''));
    }
    el.innerHTML = tiles.join('');
  } catch (e) {
    el.innerHTML = '<p class="state">Counts are unavailable right now. ' +
      `<a href="https://github.com/${REPO}/pulls?q=is%3Apr+author%3Aapp%2Fclaude" target="_blank" rel="noopener noreferrer">Open the PR list</a>.</p>`;
  }
}

loadWorkflowStatus().then(latestByPath => {
  const vd = latestByPath['.github/workflows/validate-data.yml'];
  loadLedger(vd && vd.workflow_id);
});

fetch('/data/benefits.json')
  .then(r => r.ok ? r.json() : [])
  .then(data => { if (data.length) SIM_STEPS[1].primary = data.length + ' existing benefits loaded. Checking for name and hostname matches.'; })
  .catch(() => {});

/* ── model byline and last run ────────────────────────────
   Each state file records CLAUDE_MODEL at run time. The byline shows the model of the most recent
   run of any workflow, by timestamp. An unmapped value shows the raw model id rather than a guess. */
const MODEL_LABELS = { 'claude-sonnet-5-5': 'Claude Sonnet 5.5', 'claude-sonnet-4-6': 'Claude Sonnet 4.6' };
const STATE_FILES = ['last-run.json', 'last-events-submission.json', 'last-benefits-discovery.json', 'last-events-discovery.json'];

Promise.all(STATE_FILES.map(f => fetch(STATE + f).then(r => (r.ok ? r.json() : null)).catch(() => null)))
  .then(states => {
    const lastRun = states[0];
    if (lastRun) renderRun(lastRun);
    else document.getElementById('run-output').innerHTML = '<p class="state">No run recorded yet.</p>';
    const latest = states
      .filter(s => s && s.model && s.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    if (latest) {
      const el = document.getElementById('identity-model');
      el.textContent = MODEL_LABELS[latest.model] || latest.model;
      el.title = 'Model of the most recent recorded run, ' + fmtTime(latest.timestamp);
    }
  });
