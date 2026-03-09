---
description: |
  Weekly maintenance pass over existing benefits.json entries. Checks link
  health for every benefit, then applies the quality bar (specificity, self-serve,
  direct student signup link, offer type accuracy) to flag entries that would
  not pass today's review checklist. Opens or updates a single consolidated
  issue with both categories of findings. Replaces check-links.yml.

strict: false

engine:
  id: copilot
  model: claude-sonnet-4

on:
  schedule:
    - cron: 'weekly on sunday'
  workflow_dispatch:

permissions: read-all

safe-outputs:
  create-issue:
    labels: [link-health, needs-review]

tools:
  github:
    toolsets: [issues, repos]
  web-fetch:
  edit:

network:
  allowed:
    - defaults
    # Broad by design — the agent fetches arbitrary student benefit pages
    - "*.com"
    - "*.org"
    - "*.edu"
    - "*.io"
    - "*.dev"
    - "*.net"

timeout-minutes: 30
---

# Maintain Benefits

You audit all existing `benefits.json` entries for link health and quality, then open or update a single consolidated GitHub issue with the findings.

## Step 1: Read existing data

Read `benefits.json` and `categories.json` from the repository.

Note today's UTC date (ISO 8601).

## Step 2: Check link health

For each benefit in `benefits.json`, fetch its `link` with `web-fetch`. Classify each result:

- **Broken**: fetch fails (network error, DNS failure, or the returned page clearly indicates a 404 / "not found"). Skip 403 responses — that is commonly bot-blocking, not a broken page.
- **Redirected**: the final URL's hostname differs from the original URL's hostname (cross-domain redirect, likely a moved or acquired product). Same-domain path changes are not redirects.
- **Healthy**: anything else.

Collect broken and redirected benefits. Rate-limit to one request per second to avoid triggering bot-blocking.

## Step 3: Quality review

For each benefit in `benefits.json`, apply the quality bar. Treat link health from Step 2 as one input — a broken link is automatic failure regardless of other criteria.

Flag the benefit if any criterion fails:

1. **Specific offer**: description names what students actually get — plan name, discount percentage, credit amount, or duration. Flag if vague ("Student discount available", "Free access through your university").
2. **Direct signup link**: `link` goes to a student-specific enrollment or signup page. Flag if the URL is a product homepage (e.g. `github.com`, `canva.com`), a generic marketing page, or a support/FAQ page.
3. **Self-serve**: a student can claim the benefit without institutional purchase, IT approval, or "contact sales". Flag if the page says "contact your institution" or requires an admin to unlock it.
4. **Offer type accuracy**: `offer_type` matches what the description actually says. Flag if mismatched (e.g. description says "50% off" but `offer_type` is `free`).
5. **Description length**: `description` is ≤ 120 characters. Flag if over.

For each flagged benefit, record which criterion failed and a brief reason.

## Step 4: Open or update the maintenance issue

Check for an existing open GitHub issue labeled `link-health`.

Build the issue body using this format:

```
## Weekly Benefit Maintenance Report

_Last checked: <today's date>_

### Link Health

<If no findings: "All links healthy.">

**Broken**
| Benefit | Link | Reason |
|---------|------|--------|

**Redirected (cross-domain)**
| Benefit | Original | Now Points To |
|---------|----------|--------------|

### Quality Flags

<If no findings: "All entries pass the quality bar.">

| Benefit | Criterion | Reason |
|---------|-----------|--------|
```

If an open `link-health` issue exists, update its body with the new report. Otherwise, create a new issue:

- **Title**: `Benefit Maintenance: <N> issue(s) found` (N = total broken + redirected + quality flags)
- **Labels**: `link-health`, `needs-review`

If there are no findings at all, do not open or update any issue. Log the clean run in Step 5 and stop.

## Step 5: Write the maintenance log

Write `agent/last-maintenance.json` with the complete file content. Do not append.

```json
{
  "timestamp": "<current UTC time as ISO 8601>",
  "total_checked": 0,
  "broken": [{ "name": "<name>", "link": "<link>", "reason": "<reason>" }],
  "redirected": [{ "name": "<name>", "link": "<link>", "redirects_to": "<url>" }],
  "quality_flags": [{ "name": "<name>", "criterion": "<criterion>", "reason": "<reason>" }],
  "issue_updated": false
}
```
