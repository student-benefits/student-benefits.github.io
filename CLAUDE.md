# CLAUDE.md — student-benefits.github.io

This file is loaded automatically by Claude Code in every session.

---

## Project Context

A community-curated directory of student benefits that help students **build,
learn, and ship** — dev tools, cloud credits, AI/ML platforms, design and
learning resources. The site is a single static HTML/JS page (`index.html`) that
reads from `data/benefits.json` and renders a searchable, filterable card grid.
Deployed via GitHub Pages.

### Core values

**Build & grow, not consumption.** The curation thesis — what earns an entry.
A benefit qualifies if it helps a student *create, learn, ship, or research*:
dev tools, infrastructure, cloud/AI credits, design and learning platforms, the
hardware students build on. It does **not** qualify if it's a consumption perk —
entertainment (music, video streaming), shopping, or broad discount aggregators —
however good the deal. The test isn't "is this a real student discount?" (the
proxy) but "does this advance building or learning?" (the criterion). A genuine,
well-priced consumer VPN or music subscription is still a reject.

**Data integrity.** All benefit data lives in `data/benefits.json` — one source of
truth, never hardcoded in HTML.

**Active discovery, not passive curation.** Content enters through multiple
paths: humans submit issues (pull); `discover-benefits` searches the web
biweekly for new student programs (push); `discover-events` finds upcoming student events
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
| `add-benefit.yml` | Issue labeled `new-benefit` | Validates + deduplicates, then opens its own standalone PR (branch `add-benefit-{issue}`) |
| `add-event.yml` | Issue labeled `new-event` | Validates against the event quality bar + deduplicates, then opens its own standalone PR (branch `add-event-{issue}`) |
| `consolidate-pending.yml` | Every 6h or manual | Deterministic, no LLM. Folds open standalone `add-benefit-N`/`add-event-N` PRs into one review-ready PR per data file |
| `redispatch-stalled.yml` | Hourly or manual | Deterministic, no LLM. Safety net: redispatches `add-benefit`/`add-event` runs that produced no comment/PR within 15 min, once; flags `needs-manual-review` if that doesn't resolve it |
| `discover-benefits.yml` | Biweekly (Monday, even ISO weeks) or manual | Searches for new student benefits, opens issues for the best finds |
| `discover-events.yml` | Biweekly (Wednesday, even ISO weeks) or manual | Searches for notable student events, removes expired entries, opens one PR |
| `maintain-benefits.yml` | Weekly (Sunday) or manual | Audits link health and quality, fixes findings, opens one PR (closes any still-open prior `[Maintenance]` PR of its own first) |
| `validate-data.yml` | PR touching `data/` or the validator | Runs `scripts/validate_data.py` — the deterministic data-integrity gate. |
| `pr-concierge.yml` | Daily (13:00 UTC) or manual | Sweeps open PRs; once a PR's required checks are green, @-mentions the maintainer (from CODEOWNERS) and labels it `ready-for-review` (idempotent dedup marker). Surfaces Copilot's verdict but gates only on CI; never merges. Deterministic — no LLM. |

Edit a workflow's `prompt:` directly to change Grant's behavior — no compile step.

When adding a new issue template that introduces a new label, create the GitHub label first — templates auto-apply labels, but only if the label already exists in the repo.

No router/orchestrator yet: the two label-triggered workflows (add-benefit, add-event) both fire on any label event and the non-matching one skips correctly. Revisit a dispatcher at 3+ label-triggered workflows.

**Per-issue PRs, consolidated deterministically** (redesigned 2026-08-11 — see #320). `add-benefit`/`add-event` each open their own standalone PR per issue rather than a shared branch — a shared branch needed a `git reset --hard` fallback for concurrent-push races, and `claude-code-action`'s headless mode has a built-in, non-configurable restriction on exactly that command shape, which was silently stalling runs (`success` with no comment, no PR). Full rationale: `scripts/consolidate_pending.py`'s docstring, nearest the code it explains.

`consolidate-pending.yml` (plain Python, no Claude, every 6h) folds every open standalone PR into one review-ready PR per data file — matched structurally (branch pattern **and** `app/claude` authorship, never title text, which anyone can set). Never silently drops a submission: an id collision or post-merge validation failure leaves the source PR open, unfolded, for manual attention. Consolidation never merges anything; the merge stays the human trust boundary.

`redispatch-stalled.yml` is the companion safety net (hourly), covering #267 (non-collaborator label events fail the GitHub App token exchange before the agent step starts — no override exists) and any other silent-stall cause: an issue left open with zero comments past a 15-minute grace period gets redispatched once via `workflow_dispatch` (write-privileged, sidesteps the actor-permission gate), tracked via the `redispatched` label so it never loops. Still stalled after that → `needs-manual-review` label + one comment, then left alone.

### Falsifiability (scheduled workflows)

Every cron workflow carries, in its YAML, a **working-when** criterion + an **N-cycle teardown** clause (the "running systems" convention). **Criteria are contract** (in the files); **cycle history is state** (the Actions run log) — don't restate run history here. The criteria are silence-tolerant by design: these are discovery/maintenance surfacers that *may legitimately find nothing* some cycles, so the test is **the pipeline being alive**, never an output count. Working-when = a scheduled run *completes and leaves a positive trace of having looked* (an issue/PR, or a dated heartbeat in its state file). Default N = **8 cycles at that workflow's own cadence** — total elapsed time varies (biweekly workflows use N=4 for the same ~2-month window; the two deterministic hourly/6h mechanisms are pure plumbing with no content-volume signal, so their N is about the mechanism erroring, not finding nothing).

| Workflow | Working-when (positive trace) | N |
|---|---|---|
| `discover-benefits` | `new-benefit` issue opened **or** `last-benefits-discovery.json` timestamp bumped | 4 biwk |
| `discover-events` | PR opened **or** `last-events-discovery.json` timestamp bumped | 4 biwk |
| `maintain-benefits` | `[Maintenance]` PR **or** `link-health` issues closed with outcome; else green scheduled run in Actions log | 8 wk |
| `consolidate-pending` | Green scheduled run in Actions log (most runs legitimately find nothing to fold) | 8 × 6h |
| `redispatch-stalled` | Green scheduled run in Actions log (most runs legitimately find nothing stalled) | 8 × 1h |
| `pr-concierge` | Green scheduled run in Actions log (most days legitimately find nothing newly ready) | 8 × 1d |

**The criterion's FIRST job is catching a cron that silently isn't running** — not weak output. Verify each working-when against the live Actions run history before trusting any "stays current automatically" claim; a missing/stale state file is the alarm, not noise. (Scar 2026-08-11: two different failure shapes hid behind the same symptom. `last-benefits-discovery.json` sat 2 months stale — not because the cron wasn't firing, but because its PRs weren't being merged, masking a real backlog. `reddit-state.json` was stuck since March for a genuine reason — `scout-reddit.yml`'s commit step ran after `claude-code-action` revoked its own push token, so every scheduled run hard-failed for 10 straight weeks. Diagnosed and removed rather than fixed, since it had never produced a usable find in that time. Lesson: a stale heartbeat means "go find out why," not "assume the obvious cause.")

### Agent state files

Workflows write these; `agent/index.html` reads them to render run history. Never hand-edit — they're regenerated each run.

- `agent/state/last-run.json` — last add-benefit run
- `agent/state/last-events-submission.json` — last add-event run
- `agent/state/last-events-discovery.json` — last discover-events run
- `agent/state/rejected.json` — rejected programs, used for deduplication by add-benefit

---

## PR review checklist

`scripts/validate_data.py` (run in CI by `validate-data.yml` on any PR touching
the data files) enforces the structural rules below automatically: schema,
`id`/`category`/`offer_type` validity, ≤120-char descriptions, canonical
formatting, and the forbidden-link rule (no `help.`/`support.`/`docs.`/`blog.`
subdomains, `/articles/` paths, or bare homepages). A red check means the data
is invalid — don't merge. (The data-writing workflows now run this same
validator in-loop and fix what it flags before opening a PR, so a red check
should be rare — CI is the backstop, not the first line.) The remaining items
below still need a human eye (liveness, duplicates, whether the link is
genuinely the signup page).

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
- **Authorship: the agent authors, the maintainer approves and merges** — the merge is the trust boundary. A PR's GitHub author is fixed by the token that opens it: workflow-opened PRs are authored by the Claude GitHub App (`app/claude`), the intended state. A PR opened from a locally maintainer-authenticated `gh` is authored by the maintainer instead — so to keep the agent as author, push commits onto an existing `app/claude` branch (e.g. when consolidating) rather than opening a fresh PR, and author commits as `Claude <noreply@anthropic.com>`. Never self-approve or self-merge.

---

## Before opening or reviewing a PR

Run the `audit` agent on any changed files:

```
audit
```
