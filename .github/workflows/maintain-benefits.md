---
name: Maintain Benefits
description: |
  Weekly maintenance pass over existing benefits.json entries. Checks link
  health and quality bar for every benefit, then fixes each finding directly:
  updates broken or redirected links, corrects offer_type mismatches, and
  removes entries for programs that no longer exist. Opens a PR with all
  changes. Human approves the merge — nothing lands automatically.

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
  create-pull-request:
    base-branch: main
  close-issue:

mcp-servers:
  tavily:
    command: npx
    args: ["-y", "tavily-mcp"]
    env:
      TAVILY_API_KEY: "${{ secrets.TAVILY_API_KEY }}"
    allowed: ["tavily_search"]

tools:
  github:
    toolsets: [issues, pull_requests, repos]
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

timeout-minutes: 45
---

# Maintain Benefits

You audit all existing `benefits.json` entries for link health and quality, fix every finding you can, and open a PR with the changes. You do not open issues — findings go directly to a PR.

## Step 1: Read existing data

Read `benefits.json` from the repository.

Note today's UTC date (ISO 8601).

## Step 2: Check link health

For each benefit in `benefits.json`, fetch its `link` with `web-fetch`. Classify each result:

- **Broken**: fetch fails (network error, DNS failure, or the returned page clearly indicates a 404 / "not found"). Skip 403 responses — that is commonly bot-blocking, not a broken page.
- **Redirected**: the final URL's hostname differs from the original URL's hostname (cross-domain redirect). Same-domain path changes are not redirects.
- **Healthy**: anything else.

Collect broken and redirected benefits. Rate-limit to one request per second.

## Step 3: Quality review

For each benefit in `benefits.json`, apply the quality bar. Only flag when the violation is unambiguous. If you are uncertain, skip it.

1. **Specific offer**: description must contain at least one concrete signal — a percentage, a dollar or credit amount, a plan name, or a duration. Flag if none are present and the description reads as a generic statement.
2. **Direct signup link**: flag only if the URL path is exactly `/` or `/home`, or the subdomain is clearly non-enrollment (`support.`, `docs.`, `help.`, `blog.`) AND the path does not contain an enrollment keyword (`/edu`, `/education`, `/student`, `/students`, `/enrollment`). URL structure only — do not flag based on page content.
3. **Self-serve**: flag only if the `description` itself contains language like "through your university", "ask your institution", or "contact IT".
4. **Offer type accuracy**: flag only clear mismatches — description says "% off" or "discount" but `offer_type` is `free`; or description says "free" but `offer_type` is `discount`.
5. **Description length**: flag if `description` exceeds 120 characters (mechanical count).

## Step 4: Fix each finding

Work through every finding from Steps 2 and 3. For each one, attempt a fix.

### Broken or redirected links

Use the Tavily `search` tool with a query like `"{benefit name}" student discount signup`. Then use `web-fetch` to verify the top result.

- If a valid student signup page is found: update `link` to the correct URL.
- If the program no longer exists (no student page found after search): remove the entire entry from `benefits.json`.

For redirected links: if the redirect destination is a valid student signup page, update `link` to the destination URL. If not, treat as broken.

### Quality flags

- **Direct signup link** (root URL): use Tavily to find the direct student signup page. Update `link` if found; otherwise leave unchanged.
- **Offer type mismatch**: update `offer_type` to match what the description says.
- **Description length**: trim the `description` to ≤ 120 characters without losing the essential offer details. If trimming would lose meaning, leave unchanged.
- **Specific offer** or **Self-serve**: only fix if the correct information is clearly findable via web-fetch. If uncertain, leave unchanged.

## Step 5: Apply changes to benefits.json

If any fixes were made (updates or removals), edit `benefits.json`:
- Preserve 2-space indent and trailing newline
- Maintain the existing entry order; do not reorder

## Step 6: Open a PR (only if fixes were made)

If no fixes were made, skip to Step 7.

Open a single pull request with all changes.

**Branch**: `maintain-benefits-{today's date as YYYY-MM-DD}`

**Title**: `[Maintenance]: Fix {N} benefit(s)` where N is the number of entries changed or removed.

**Body**:
```
## Summary

<one sentence describing what changed overall>

### Fixed
| Benefit | Issue | Change |
|---------|-------|--------|
| {name} | {broken link / redirected / offer_type mismatch / ...} | {what was changed} |

### Removed
| Benefit | Reason |
|---------|--------|
| {name} | Program no longer offers a student benefit |
```

Omit the Removed section if no entries were removed. Omit the Fixed section if no entries were updated.

## Step 7: Close any open link-health issues

Check for any open GitHub issues labeled `link-health`. Close each one with a comment that matches the outcome:

- **No findings from Steps 2 or 3**: "All benefits are healthy."
- **Findings existed but none were fixable** (every fix attempt was uncertain or unsuccessful): "Found {N} issue(s) that require manual review: {list benefit names}."
- **PR was opened**: "Fixed in PR #{pr_number}."
