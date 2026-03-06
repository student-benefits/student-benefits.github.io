---
description: |
  Proactively discovers notable student events and hackathons not yet in the
  feed. First checks a curated list of known high-value sources directly, then
  runs keyword searches for unknown organizers. Removes expired entries and
  opens PRs for the best new discoveries (max 3 per run). Human approves all
  changes — nothing merges automatically.

strict: false

engine:
  id: copilot
  model: claude-sonnet-4

on:
  schedule:
    - cron: 'weekly on wednesday'
  workflow_dispatch:

permissions: read-all

safe-outputs:
  create-pull-request:
    base-branch: main

mcp-servers:
  tavily:
    command: npx
    args: ["-y", "@tavily/mcp-server"]
    env:
      TAVILY_API_KEY: "${{ secrets.TAVILY_API_KEY }}"
    allowed: ["search", "search_news"]

tools:
  github:
    toolsets: [pull_requests, repos]
  web-fetch:
  edit:

network:
  allowed:
    - defaults
    # Broad by design — the agent fetches arbitrary event and organizer pages
    - "*.com"
    - "*.org"
    - "*.edu"
    - "*.io"
    - "*.dev"
    - "*.net"

timeout-minutes: 20
---

# Discover New Student Events

You proactively search for upcoming student events and hackathons worth featuring in the feed, then open a PR with additions and expired-entry removals.

## Step 1: Read existing data

Read `events.json` from the repository.

Build two lookup sets:
- **Known IDs**: all existing event IDs
- **Known names**: all existing event names (lowercase)

Also note today's UTC date (ISO 8601).

## Step 2: Remove expired entries

An entry is expired if its `expires` field is a date that has already passed (strictly before today).

If any expired entries exist, collect their IDs. You will remove them in Step 7.

## Step 3: Check known sources

Fetch each URL below directly with `web-fetch`. Do not skip any.

| Source | URL |
|--------|-----|
| YC Events | `https://events.ycombinator.com` |
| MLH Season schedule | `https://mlh.io/seasons/2026/events` |
| a16z Programs | `https://a16z.com/programs` |
| Anthropic programs | `https://www.anthropic.com/news` |
| OpenAI programs | `https://openai.com/news` |
| Google student programs | `https://buildyourfuture.withgoogle.com/programs` |
| GitHub Education events | `https://education.github.com/events` |
| HackMIT / MIT events | `https://hack.mit.edu` |

For each page, extract any programs or events that look relevant.

## Step 4: Keyword-discovery pass

**IMPORTANT**: Do NOT use `web-fetch` for these searches. Use only the `tavily` MCP tool.

Call the tavily `search` tool with each of these queries. Do not skip any.

1. `student hackathon 2026 free apply open`
2. `"open to students" conference 2026 free OR fellowship application`
3. `student grant OR "build grant" 2026 apply individual cash stipend`
4. `student residency OR cohort OR program 2026 free technical AI`

## Step 5: Verify each candidate

For each result from Steps 3 and 4, use `web-fetch` to confirm the event page is real, not already passed, and not already in your known names set. Then apply this quality bar:

1. Free or heavily subsidized (travel grants, stipends, or zero cost) — skip if fee >$50 with no scholarship pathway
2. Open to individual students — skip if requires team, startup, or company affiliation
3. Credible organizer (well-known company, university, VC firm, or non-profit) — skip if obscure or unverifiable
4. Genuinely career-altering — skip if not the kind of event a student would name as a turning point
5. Concrete date within 12 months and a working application page — skip if date has passed, is >12 months away, or page is broken/"coming soon"

Keep a shortlist of the best candidates across both passes, up to **3 new events**.

## Step 6: Draft each new event entry

For each candidate on your shortlist, produce a JSON object matching this schema exactly. Note which pass discovered it (known-source or keyword) — include this in the PR body.

```json
{
  "id": "<url-safe-id>",
  "name": "<Official Event Name>",
  "organizer": "<Organizing entity name>",
  "category": "<one of: hackathon | conference | fellowship | summit | workshop>",
  "date": "<YYYY-MM-DD>",
  "date_end": "<YYYY-MM-DD or omit if single-day>",
  "location": "<City, State/Country or omit if fully remote>",
  "remote": <true | false>,
  "eligibility": "<Who can apply, concisely>",
  "why": "<One or two sentences on why this event is worth a student's time — name speakers, outcomes, or what makes the room special. Max 200 chars.>",
  "link": "<Direct URL to the application or registration page>",
  "expires": "<YYYY-MM-DD>"
}
```

Rules:
- `id`: lowercase, hyphens only, unique, no leading/trailing hyphens (e.g. `mlh-hackcon-2026`)
- `category`: must be one of `hackathon`, `conference`, `fellowship`, `summit`, `workshop`
- `why`: write this yourself based on what you learned from the event page — do not copy marketing text verbatim; max 200 chars
- `remote`: set to `true` only if the event is fully virtual; set to `false` for in-person or hybrid
- `expires`: same as `date_end`, or `date` if the event is a single day
- Omit `date_end` if the event is a single day
- Omit `location` only if the event is fully remote

## Step 7: Open a PR

Construct the updated `events.json`:
- Remove any expired entries identified in Step 2
- Append new entries from Step 6 (in date order, earliest first)
- Preserve 2-space indent and a trailing newline

Write the updated file, then open a single pull request with:

**Title**: `[Events]: <comma-separated list of new event names, or "Expire stale entries" if only removing>`

**Body**:
```
## Summary

<one sentence describing what changed>

### Added
- <Event Name> — <date> — <organizer>

### Removed (expired)
- <Event Name> (expired <date>)

### Why these events
<For each added event: one sentence on why it clears the quality bar.>
```

Open one PR total — do not open separate PRs per event.

## Step 8: Update the discovery log

Write `agent/last-events-discovery.json` with the complete file content:

```json
{
  "timestamp": "<current UTC time as ISO 8601>",
  "known_sources_checked": ["<url>", "..."],
  "keyword_queries": ["<query 1>", "<query 2>", "<query 3>", "<query 4>"],
  "expired_removed": ["<id>", "..."],
  "discovered": [
    { "name": "<name>", "date": "<YYYY-MM-DD>", "link": "<link>", "source": "known-source | keyword" }
  ],
  "pr_opened": <true | false>
}
```

Write the complete file — do not append.
