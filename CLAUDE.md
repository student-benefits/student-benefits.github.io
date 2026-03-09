# CLAUDE.md — student-benefits.github.io

This file is loaded automatically by Claude Code in every session.
All instructions here are mandatory and override default behavior.

---

## Project Context

A community-curated directory of student discounts, free tiers, and perks. The
site is a single static HTML/JS page (`index.html`) that reads from `benefits.json`
and renders a searchable, filterable card grid. Deployed via GitHub Pages.

### Core values

**Specificity.** Descriptions must say exactly what students get. Vague copy
("Student discount available") is rejected in favor of concrete offers
("Free Pro plan for 1 year").

**Data integrity.** All benefit data lives in `benefits.json` — one source of
truth, never hardcoded in HTML.

**Active discovery, not passive curation.** Content enters through multiple
paths: humans submit issues (pull); `discover-benefits` searches the web weekly
for new student programs (push); `discover-events` finds upcoming student events
and removes expired ones automatically (push + self-maintenance). The system
surfaces what people haven't thought to add and keeps itself current.

**Automation with human oversight.** Workflows handle validation and PR
creation. Humans (or Claude) own the merge decision. Grant cannot publish
directly — the merge is the trust boundary.

**Educational transparency.** The `/agent/` page exposes run logs, tool traces,
and architecture. The seams are visible by design so the system can be
understood and replicated. When working on this project, preserve that
transparency: keep workflows documented, keep the agent page accurate.

> Enforcement: if you change Grant's behavior (workflow logic, validation rules,
> schema, trigger conditions), update `agent/index.html` to reflect it. A
> mismatch between what Grant does and what the agent page says is a bug.

---

## Source of truth: `benefits.json`

All benefit data lives in `benefits.json`. Never modify the HTML to hardcode
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
- `category`: must exactly match one of the values in `categories.json` (the authoritative list)
- `description`: specific about what students actually get (e.g. "Free Pro plan for 1 year", not "Student discount available"); max 120 chars
- `offer_type`: required; one of `free` (no cost), `discount` (reduced price), `credits` (cloud/platform credits), `trial` (free period then paid/discounted)
- `popularity`: integer 1–10; use 5 as default for new entries
- `repo`: optional; only for open-source projects

---

## Automated workflows (gh-aw)

AI-driven workflows live in `.github/workflows/`:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `add-benefit.md` | Issue labeled `new-benefit` | Validates submission, deduplicates, creates PR |
| `discover-benefits.md` | Weekly (Monday) or manual | Searches the web for new benefits, opens issues for the best discoveries |
| `discover-events.md` | Weekly (Wednesday) or manual | Searches for notable student events, removes expired entries, opens PRs |
| `maintain-benefits.md` | Weekly (Sunday) or manual | Checks all benefit links and re-audits existing entries against the quality bar; fixes findings directly and opens a PR |

The compiled `.lock.yml` files are auto-generated — **never edit them directly**.
To change a workflow, edit the `.md` source and run `gh aw compile`.

`update-gh-aw.yml` runs every Tuesday, checks for a newer gh-aw release, and opens an issue with upgrade instructions if behind. It is a plain `.yml` — do not compile it with `gh aw`.

---

## PR review checklist

When reviewing PRs (especially those created by the add-benefit workflow):

- [ ] `id` is unique, URL-safe, matches the name
- [ ] `category` exactly matches a value in `categories.json`
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
gh workflow run maintain-benefits.lock.yml --repo student-benefits/student-benefits.github.io
```

---

## Git workflow

- All changes go through PRs — never push directly to `main`
- PRs must have a written Summary (not just a template placeholder)
- GitHub Pages serves the site directly from the `main` branch root
- Every PR automatically requests review from @jonasneves (via CODEOWNERS)
- Branch protection requires @jonasneves approval before any PR can merge

---

## Before opening or reviewing a PR

Run the `audit` agent on any changed files:

```
audit
```
