# AGENTS.md — student-benefits.github.io

A community-curated directory of student benefits that help students build, learn, and ship. Static HTML/JS on GitHub Pages (served from `main` root), no build step: `/benefits/` renders `data/benefits.json`, `/events/` renders `data/events.json`, `/how-it-works/` shows how Grant (the Claude workflows) works from `agent/state/*.json` and the public GitHub API. `/agent/` is a redirect stub to it; `agent/state/` stays where the workflows write it.

## Curation thesis

A benefit qualifies if it helps a student create, learn, ship, or research: dev tools, infrastructure, cloud/AI credits, design and learning platforms, the hardware students build on. Consumption perks are rejected however good the deal: entertainment (music, video streaming), shopping, broad discount aggregators, consumer VPNs. The test is "does this advance building or learning?", never "is this a real student discount?".

## Operating rules

- Claude owns the merge: each data-writing workflow opens a PR and squash-merges it once `scripts/validate_data.py` exits 0 in-loop. That in-loop run is the only check before merge: `main` has no required status checks (they would also reject the direct `agent/state/` pushes), so the CI run of `validate-data` reports after the fact.
- Commits are authored `Claude <noreply@anthropic.com>`. `data/` changes go through a PR; `agent/state/` files are pushed directly to `main`.
- Claude Code runs on subscription auth (no per-token billing); the Jev call in `check_links.py` is the only metered call.
- No personal names in docs, context, or agent surfaces; the maintainer is `vars.MAINTAINER`, referenced as "the maintainer".
- `how-it-works/index.html` must match workflow behavior (logic, validation rules, schema, triggers). A mismatch is a bug.

## `data/benefits.json`

```json
{
  "id": "url-safe-id",
  "name": "Official Product Name",
  "category": "one of data/categories.json",
  "offer_type": "free | discount | credits | trial",
  "description": "What students get; be specific, max 120 chars",
  "link": "Direct URL to student signup or discount page",
  "tags": ["Tag1", "Tag2"],
  "popularity": 5,
  "repo": "owner/repo"
}
```

- `id`: lowercase, hyphens, no leading/trailing hyphens, unique.
- `category`: exactly one value from `data/categories.json`.
- `offer_type`: required; `free` (no cost), `discount` (reduced price), `credits` (cloud/platform credits), `trial` (free period, then paid).
- `description`: specific ("Free Pro plan for 1 year", not "Student discount available"); max 120 chars.
- `popularity`: integer 1–10. An editorial priority, never a usage count (nothing counts clicks), so the UI labels the sort "Recommended" and breaks ties free-first, then A–Z. 5 marks an entry not yet ranked; a new entry gets its rank from this rubric, which weighs how generous the offer is (free > credits or trial > discount, scaled by dollar value and duration) against how central the tool is to building or learning:
  - **9–10**: free use or credits worth roughly $75 or more, on a tool central to building or learning. 10 is a year or more of a flagship paid plan.
  - **6–8**: a real but bounded offer: free use with tight caps, a smaller or shorter trial or credit grant, a ≥50% discount on a central tool, a free plan of a specialised tool, or a generous offer limited to a named list of schools.
  - **1–4**: a discount under 50%, an offer little beyond the public free tier, or a tool peripheral to building or learning.
- `repo`: optional, open-source projects only.
- Entries are sorted by `id`; insert in sorted position, never append. Sorted insertion spreads concurrent additions across the file so parallel add-benefit PRs merge without conflicting. The UI re-sorts client-side.

## `data/events.json`

```json
{
  "id": "url-safe-id",
  "name": "Official Event Name",
  "organizer": "Organizing entity",
  "category": "hackathon | conference | fellowship | summit | workshop | grant",
  "date": "YYYY-MM-DD",
  "date_end": "YYYY-MM-DD",
  "deadline": "YYYY-MM-DD",
  "location": "City, State/Country",
  "remote": true,
  "eligibility": "Who can apply, concisely",
  "why": "Why this event is worth a student's time (max 200 chars)",
  "link": "Direct URL to application or registration",
  "expires": "YYYY-MM-DD"
}
```

- `id`: lowercase, hyphens, unique. `category`: one of the six values.
- `why`: written from the event page, not marketing copy; max 200 chars.
- `remote`: `true` only if fully virtual. `location`: omit if fully remote.
- `date_end`: omit if single-day. `expires`: `date_end`, or `date` if single-day.
- `deadline`: the last date a student can still apply, when the page states one (the final round if there are rounds; earlier rounds go in `why`). Omit when unstated; never guess. Must not fall after `expires`. The validator rejects an entry whose prose states a deadline without this field.
- Sorted by `date`, earliest first.

## Workflows

Plain Actions YAML in `.github/workflows/`; the agent step is `anthropics/claude-code-action@v1` with `CLAUDE_CODE_OAUTH_TOKEN` and model `vars.CLAUDE_MODEL`. Edit a workflow's `prompt:` to change behavior.

| Workflow | Trigger | Does |
|---|---|---|
| `add-benefit.yml` | issue labeled `new-benefit`, or dispatch | Validates, dedupes against `benefits.json` and `rejected.json`, opens and merges its own PR (branch `add-benefit-{issue}`) |
| `add-event.yml` | issue labeled `new-event`, or dispatch | Same for events against the event quality bar (branch `add-event-{issue}`) |
| `discover-benefits.yml` | 1st and 15th, or dispatch | Searches for new programs; opens `new-benefit` issues for the best finds |
| `discover-events.yml` | 3rd and 17th, or dispatch | Finds events, removes expired ones; opens and merges one PR |
| `maintain-benefits.yml` | Sunday, or dispatch | `check_links.py > flags.json`, then Claude fixes only the flagged entries, opens and merges one `[Maintenance]` PR, and closes open `link-health` issues with the outcome |
| `validate-data.yml` | PR or push to `main` touching `data/` or the validator | Runs `scripts/validate_data.py` |

- `check_links.py` records HTTP status and final hostname for every link; when the `TYPESAFE_API_KEY` secret is set, Jev (TypeSafe's classifier model) judges each loaded page against its description. Without the key, loaded pages are flagged `unjudged` and Claude reviews them.
- `validate_data.py` checks structure and URL shape offline and never fetches links; liveness is the weekly audit.
- Failure path (`add-*`): a failed run retries once via `workflow_dispatch` (label `redispatched`), then labels the issue `needs-manual-review` and @-mentions `vars.MAINTAINER`. The retry goes through `workflow_dispatch` because `claude-code-action` exempts it from the actor check that fails non-collaborator label events (#267).
- A new issue template's label must exist in the repo first; templates apply only existing labels.
- Each cron workflow's working-when criterion and teardown N are in its YAML header.

## Agent state (`agent/state/`)

Written by workflows, read by `how-it-works/index.html` (via `how-it-works/how-it-works.js`); never hand-edit. `timestamp` comes from the runner clock; `model` records `CLAUDE_MODEL` at run time.

| File | Written by |
|---|---|
| `last-run.json` | add-benefit |
| `last-events-submission.json` | add-event |
| `last-benefits-discovery.json` | discover-benefits (heartbeat) |
| `last-events-discovery.json` | discover-events (heartbeat) |
| `rejected.json` | add-benefit; read by add-benefit and discover-benefits for dedup |
