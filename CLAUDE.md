# CLAUDE.md — student-benefits.github.io

This file is loaded automatically by Claude Code in every session.
All instructions here are mandatory and override default behavior.

---

## Project Context

A community-curated directory of student discounts, free tiers, and perks. The
site is a single static HTML/JS page (`index.html`) that reads from `benefits.json`
and renders a searchable, filterable card grid. Deployed via GitHub Pages.

The primary contribution flow is fully automated via GitHub Agentic Workflows
(gh-aw): users open an issue, a workflow validates and creates a PR, and a
human (or Claude) reviews it.

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
  "description": "What students get — be specific, max 120 chars",
  "link": "Direct URL to student signup or discount page",
  "tags": ["Tag1", "Tag2"],
  "popularity": 1,
  "repo": "owner/repo"
}
```

- `id`: lowercase, hyphens, no leading/trailing hyphens, unique
- `category`: must exactly match one of the values in `categories.json` (the authoritative list)
- `description`: specific about what students actually get (e.g. "Free Pro plan
  for 1 year", not "Student discount available"); max 120 chars
- `offer_type`: required; one of `free` (no cost), `discount` (reduced price), `credits` (cloud/platform credits), `trial` (free period then paid/discounted)
- `popularity`: integer 1–10; use 5 as default for new entries
- `repo`: optional; only for open-source projects

---

## Automated workflows (gh-aw)

Two AI-driven workflows live in `.github/workflows/`:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `add-benefit.md` | Issue labeled `new-benefit` | Validates submission, deduplicates, creates PR |
| `check-links.yml` | Weekly (Sunday) or manual | Checks all benefit links, opens issue if broken/redirected |

The compiled `.lock.yml` files are auto-generated — **never edit them directly**.
To change a workflow, edit the `.md` source and run `gh aw compile`.

### Known failure: secret not configured

Issues #4 and #5 are workflow failures caused by a missing secret. The
gh-aw runtime requires a token to be set in repo Settings → Secrets → Actions.
Check the run URL in issue #5 for the exact secret name needed.

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

## Broken link workflow

When a link health report issue appears (labeled `link-health`):

1. Read the issue body for the list of broken URLs
2. For each broken benefit, find the current correct student program URL
   (use WebFetch to verify it resolves to a real page)
3. Update `benefits.json` with the corrected links
4. Open a PR that closes the link health issue

### Stale Copilot PR #3

PR #3 (draft, from Jan 2026) attempts to fix the 6 broken links from
issue #2, but Copilot couldn't verify URLs due to firewall restrictions
and the PR has been stale for weeks. The changes it proposed are guesses.
Do not merge it as-is. Either verify each URL and update the PR, or
close it and create a fresh one with verified links.

---

## Git workflow

- All changes go through PRs — never push directly to `main`
- PRs must have a written Summary (not just a template placeholder)
- The `deploy.yml` workflow fires on every push to `main` and deploys to
  GitHub Pages automatically

---

## Before opening or reviewing a PR

Run the `code-simplifier` agent on any changed files:

```
code-simplifier
```
