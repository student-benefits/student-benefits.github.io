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

Only flag a benefit when the violation is unambiguous. If you are uncertain, skip it.

1. **Specific offer**: description must contain at least one concrete signal — a percentage, a dollar or credit amount, a plan name, or a duration. Flag if the description contains none of these and reads as a generic statement (e.g. "Student discount available", "Free access through your university"). Do not flag if the description is short but still names a concrete plan.
2. **Direct signup link**: flag only if the URL path is exactly `/` or `/home` (root homepage), or the subdomain is clearly non-enrollment (e.g. `support.`, `docs.`, `help.`, `blog.`). Do not flag based on page content — URL structure only.
3. **Self-serve**: flag only if the `description` itself contains language like "through your university", "ask your institution", or "contact IT". Do not fetch the page to make this determination.
4. **Offer type accuracy**: `offer_type` must match what the description says. Flag only clear mismatches: description says "% off" or "discount" but `offer_type` is `free`; description says "free" but `offer_type` is `discount`.
5. **Description length**: `description` is ≤ 120 characters. Flag if over — this is mechanical, count the characters.

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

If there are no findings at all, do not open or update any issue — stop here.
