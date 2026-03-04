---
description: |
  Proactively discovers new student benefits not yet in the directory.
  Searches the web for popular student discounts, filters against existing
  entries and previously-rejected programs, and creates issues for the best
  new discoveries (max 5 per run).

strict: false

engine:
  id: copilot
  model: claude-sonnet-4

on:
  schedule:
    - cron: '0 9 1 * *'  # Monthly on the 1st at 9am UTC
  workflow_dispatch:

permissions: read-all

safe-outputs:
  create-issue:
    title-prefix: "[Benefit]: "
    labels: [new-benefit]

mcp-servers:
  tavily:
    command: npx
    args: ["-y", "@tavily/mcp-server"]
    env:
      TAVILY_API_KEY: "${{ secrets.TAVILY_API_KEY }}"
    allowed: ["search", "search_news"]

tools:
  github:
    toolsets: [issues, repos]
  web-fetch:
  edit:

network:
  allowed:
    - defaults
    - "*.com"
    - "*.org"
    - "*.edu"
    - "*.io"
    - "*.dev"
    - "*.net"

timeout-minutes: 20
---

# Discover New Student Benefits

You proactively search for student benefits not yet in the directory and create GitHub issues for the best discoveries. These issues will be automatically picked up and processed by the add-benefit workflow.

## Step 1: Read existing data

Read `benefits.json` and `agent/rejected.json` from the repository.

Build two lookup sets:
- **Known names**: all existing benefit names (lowercase)
- **Known domains**: all hostnames from existing benefit links (strip `www.`)
- **Rejected names and domains**: from `agent/rejected.json`

## Step 2: Search for new benefits

Run these Tavily searches:

1. `"student discount" OR "free for students" developer tools software 2026`
2. `"edu email" OR "higher education" free plan productivity design 2026`
3. `"student program" cloud hosting OR security tools free 2026`

For each promising result, use `web-fetch` to confirm:
- The student program is real and currently active
- It offers a genuine discount or free tier (not just a marketing page)
- The name and hostname are not in your known or rejected sets

Keep a shortlist of the best candidates — programs that are:
- Clearly useful to students
- Not already in the directory
- Verifiably active with a direct signup URL

## Step 3: Create issues for new discoveries

For each confirmed new benefit, up to **5 per run**, create a GitHub issue:

- **Title**: The product name only (e.g. `Figma` not `Figma has a student discount`)
- **Body**: One or two sentences describing what students get and the direct signup URL

The `create-issue` safe-output will automatically add the `new-benefit` label, which triggers the add-benefit workflow to process and validate each one.

Create issues one at a time.

## Step 4: Update the discovery log

Replace the entire content of `agent/last-discovery.json` with:

```json
{
  "timestamp": "<current UTC time as ISO 8601>",
  "queries": ["<query 1>", "<query 2>", "<query 3>"],
  "discovered": [
    { "name": "<name>", "link": "<link>" }
  ],
  "issues_created": <number>
}
```

Write the complete file — do not append.
