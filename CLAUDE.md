# CLAUDE.md — student-benefits.github.io

This file is loaded automatically by Claude Code in every session.

---

## Project Context

A community-curated directory of student discounts, free tiers, and perks. The
site is a single static HTML/JS page (`index.html`) that reads from `data/benefits.json`
and renders a searchable, filterable card grid. Deployed via GitHub Pages.

### Core values

**Specificity.** Descriptions must say exactly what students get. Vague copy
("Student discount available") is rejected in favor of concrete offers
("Free Pro plan for 1 year").

**Data integrity.** All benefit data lives in `data/benefits.json` — one source of
truth, never hardcoded in HTML.

**Active discovery, not passive curation.** Content enters through multiple
paths: humans submit issues (pull); `discover-benefits` searches the web weekly
for new student programs (push); `discover-events` finds upcoming student events
and removes expired ones automatically (push + self-maintenance). The system
surfaces what people haven't thought to add and keeps itself current.

**Automation with human oversight.** Workflows handle validation and PR
creation. Humans own the merge decision. Grant cannot publish directly —
the merge is the trust boundary.

**Zero-cost.** Built on free-tier GitHub services and Claude Code (subscription auth, no per-token billing).

**Educational transparency.** The `/agent/` page exposes run logs, tool traces,
and architecture. The seams are visible by design so the system can be
understood and replicated. When working on this project, preserve that
transparency: keep workflows documented, keep the agent page accurate.

**Impersonal, dense docs.** No personal name or narrative voice in docs, context,
or agent surfaces. Maintainer identity lives once, in CODEOWNERS — reference it as
"the maintainer", never a restated handle. Functional handles are excepted (the
CODEOWNERS list itself, the @-mention that triggers a notification, the LICENSE
legal name). Maximize meaning per token: cut hedging, restatement, ceremony.

Keep `agent/index.html` in sync with Grant's behavior — workflow logic,
validation rules, schema, trigger conditions. Mismatch is a bug.

---

## Source of truth: `data/benefits.json`

All benefit data lives in `data/benefits.json`. Never modify the HTML to hardcode
benefits — all data must go through this file.

### Schema

```json
{
  "id": "url-safe-id",
  "name": "Official Product Name",
  "category": "one of the valid categories below",
  "offer_type": "free | discount | credits | trial",
  "description": "What students get; be specific, max 120 chars",
  "link": "Direct URL to student signup or discount page",
  "tags": ["Tag1", "Tag2"],
  "popularity": 1,
  "repo": "owner/repo"
}
```

- `id`: lowercase, hyphens, no leading/trailing hyphens, unique
- `category`: must exactly match one of the values in `data/categories.json` (the authoritative list)
- `description`: specific about what students actually get (e.g. "Free Pro plan for 1 year", not "Student discount available"); max 120 chars
- `offer_type`: required; one of `free` (no cost), `discount` (reduced price), `credits` (cloud/platform credits), `trial` (free period then paid/discounted)
- `popularity`: integer 1–10; use 5 as default for new entries
- `repo`: optional; only for open-source projects

Entries are sorted by `id` (ascending); the validator enforces it. Insert new
entries in sorted position — never append to the end. (Sorted insertion spreads
concurrent additions across the file, so a burst of add-benefit PRs auto-merges
instead of all colliding at the array tail. Display order is unaffected — the UI
re-sorts client-side by popularity.)

---

## Source of truth: `data/events.json`

All event data lives in `data/events.json`. Schema:

```json
{
  "id": "url-safe-id",
  "name": "Official Event Name",
  "organizer": "Organizing entity",
  "category": "hackathon | conference | fellowship | summit | workshop | grant",
  "date": "YYYY-MM-DD",
  "date_end": "YYYY-MM-DD",
  "location": "City, State/Country",
  "remote": true,
  "eligibility": "Who can apply, concisely",
  "why": "Why this event is worth a student's time (max 200 chars)",
  "link": "Direct URL to application or registration",
  "expires": "YYYY-MM-DD"
}
```

- `id`: lowercase, hyphens, unique
- `category`: must be one of the six listed values
- `why`: written from the event page, not marketing copy; max 200 chars
- `remote`: `true` only if fully virtual; `false` for in-person or hybrid
- `expires`: same as `date_end`, or `date` if single-day
- `date_end`: omit if single-day
- `location`: omit if fully remote

Events are sorted by `date` (earliest first).

---

## Automated workflows

Each workflow is a plain GitHub Actions YAML in `.github/workflows/`. The agent step is `anthropics/claude-code-action@v1`, authenticated via `CLAUDE_CODE_OAUTH_TOKEN`.

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `add-benefit.yml` | Issue labeled `new-benefit` | Validates submission, deduplicates, creates PR |
| `add-event.yml` | Issue labeled `new-event` | Validates against the event quality bar, deduplicates, creates PR |
| `discover-benefits.yml` | Weekly (Monday) or manual | Searches for new student benefits, opens issues for the best finds |
| `discover-events.yml` | Weekly (Wednesday) or manual | Searches for notable student events, removes expired entries, opens one PR |
| `maintain-benefits.yml` | Weekly (Sunday) or manual | Audits link health and quality, fixes findings, opens one PR |
| `scout-reddit.yml` | Weekly (Friday) or manual | Scouts Reddit (`site:reddit.com` searches) for benefit mentions (`MODE=discover`) and posting opportunities (`MODE=scout`, → Discord via the `DISCORD_WEBHOOK_URL` secret). State in `agent/state/reddit-state.json`; `DRY_RUN=true` skips writes and the webhook. |
| `validate-data.yml` | PR touching `data/` or the validator | Runs `scripts/validate_data.py` — the deterministic data-integrity gate. |
| `pr-concierge.yml` | Daily (13:00 UTC) or manual | Sweeps open PRs; once a PR's required checks are green, @-mentions the maintainer (from CODEOWNERS) and labels it `ready-for-review` (idempotent dedup marker). Surfaces Copilot's verdict but gates only on CI; never merges. Deterministic — no LLM. |

Edit a workflow's `prompt:` directly to change Grant's behavior — no compile step.

When adding a new issue template that introduces a new label, create the GitHub label first — templates auto-apply labels, but only if the label already exists in the repo.

No router/orchestrator yet: the two label-triggered workflows (add-benefit, add-event) both fire on any label event and the non-matching one skips correctly. Revisit a dispatcher at 3+ label-triggered workflows.

### Falsifiability (scheduled workflows)

Every cron workflow carries, in its YAML, a **working-when** criterion + an **N-cycle teardown** clause (the "running systems" convention). **Criteria are contract** (in the files); **cycle history is state** (the Actions run log) — don't restate run history here. The criteria are silence-tolerant by design: these are discovery/maintenance surfacers that *may legitimately find nothing* some weeks, so the test is **the pipeline being alive**, never an output count. Working-when = a scheduled run *completes and leaves a positive trace of having looked* (an issue/PR, or a dated heartbeat in its state file). Default N = **8 weekly cycles (~2 months)**, adjustable per workflow.

| Workflow | Working-when (positive trace) | N |
|---|---|---|
| `discover-benefits` | `new-benefit` issue opened **or** `last-benefits-discovery.json` timestamp bumped | 8 wk |
| `discover-events` | PR opened **or** `last-events-discovery.json` timestamp bumped | 8 wk |
| `maintain-benefits` | `[Maintenance]` PR **or** `link-health` issues closed with outcome; else green scheduled run in Actions log | 8 wk |
| `scout-reddit` | `reddit-state.json` `last_run` advances (committed by the push step) | 8 wk |

**The criterion's FIRST job is catching a cron that silently isn't running** — not weak output. This is live: `agent/state/last-benefits-discovery.json` is **absent** (discover-benefits appears to have never committed) and `reddit-state.json` `last_run` is **months stale** (~2026-03) — the exact silent-cron failure. So **verify each working-when against the live Actions run history before trusting any "stays current automatically" claim** (the Core-values "keeps itself current" line is unverified until the run log confirms scheduled runs are firing). A missing/stale state file is the alarm, not noise.

### Agent state files

Workflows write these; `agent/index.html` reads them to render run history. Never hand-edit — they're regenerated each run.

- `agent/state/last-run.json` — last add-benefit run
- `agent/state/last-events-submission.json` — last add-event run
- `agent/state/last-events-discovery.json` — last discover-events run
- `agent/state/reddit-state.json` — reddit scout state (processed post IDs, subreddit scores, counters)
- `agent/state/rejected.json` — rejected programs, used for deduplication by add-benefit and scout-reddit

---

## PR review checklist

`scripts/validate_data.py` (run in CI by `validate-data.yml` on any PR touching
the data files) enforces the structural rules below automatically: schema,
`id`/`category`/`offer_type` validity, ≤120-char descriptions, canonical
formatting, and the forbidden-link rule (no `help.`/`support.`/`docs.`/`blog.`
subdomains, `/articles/` paths, or bare homepages). A red check means the data
is invalid — don't merge. The remaining items below still need a human eye
(liveness, duplicates, whether the link is genuinely the signup page).

When reviewing PRs (especially those created by the add-benefit workflow):

- [ ] `id` is unique, URL-safe, matches the name
- [ ] `category` exactly matches a value in `data/categories.json`
- [ ] `offer_type` is set and accurate (`free`, `discount`, `credits`, or `trial`)
- [ ] `description` is ≤ 120 chars and specific about what students get
- [ ] `link` goes to the actual student signup page, not a marketing page
- [ ] No duplicate: same name or same hostname doesn't already exist
- [ ] JSON is valid and preserves 2-space indent, trailing newline
- [ ] `popularity` is set (default 5 for new entries)

Flag the issue and stop — do not approve PRs that fail any of these.

---

## Handling link-health issues mid-week

The `maintain-benefits` workflow runs every Sunday and closes open `link-health` issues automatically. If one appears mid-week (filed via the report-broken template or a prior run), either wait for Sunday or trigger the workflow manually:

```
gh workflow run maintain-benefits.yml --repo student-benefits/student-benefits.github.io
```

---

## Git workflow

- All changes go through PRs — never push directly to `main`
- PRs must have a written Summary (not just a template placeholder)
- GitHub Pages serves the site directly from the `main` branch root
- Every PR automatically requests review from the maintainer (via CODEOWNERS)
- Branch protection requires maintainer approval (CODEOWNERS) before any PR can merge

---

## Before opening or reviewing a PR

Run the `audit` agent on any changed files:

```
audit
```
