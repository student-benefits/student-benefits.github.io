---
name: Discover Student Benefits
description: |
  Proactively discovers new student benefits not yet in the directory. First
  checks curated aggregator and program pages directly, then runs keyword
  searches for unknown vendors. Filters against existing entries and
  previously-rejected programs, and creates issues for the best new
  discoveries (max 5 per run).

strict: false

engine:
  id: copilot
  model: claude-sonnet-4

on:
  schedule:
    - cron: 'weekly on monday'
  workflow_dispatch:

permissions: read-all

safe-outputs:
  create-issue:
    title-prefix: "[Benefit]: "
    labels: [new-benefit]

mcp-servers:
  tavily:
    command: npx
    args: ["-y", "tavily-mcp"]
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
    # Broad by design — the agent fetches arbitrary student benefit pages
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

Read `benefits.json`, `categories.json`, and `agent/rejected.json` from the repository. If `agent/rejected.json` does not exist, treat the rejected set as empty.

`agent/rejected.json` has this shape:
```json
[{ "name": "<product name lowercase>", "domain": "<hostname>" }]
```

Build three lookup sets:
- **Known names**: all existing benefit names (lowercase)
- **Known domains**: all hostnames from existing benefit links (strip `www.`)
- **Rejected names and domains**: from `agent/rejected.json`

Also read open GitHub issues labeled `new-benefit`. Extract the product name from each issue title and add it (lowercase) to **Known names**. This prevents creating duplicate issues for benefits already in the pipeline.

## Step 2: Check known sources

Fetch each URL below directly with `web-fetch`. Do not skip any.

| Source | URL |
|--------|-----|
| GitHub Student Developer Pack | `https://education.github.com/pack/offers` |
| JetBrains student programs | `https://www.jetbrains.com/community/education/` |
| Google for Students | `https://buildyourfuture.withgoogle.com/programs` |
| Microsoft Education | `https://www.microsoft.com/en-us/education` |
| AWS Educate | `https://aws.amazon.com/education/awseducate/` |
| Figma Education | `https://www.figma.com/education/` |
| Notion for Education | `https://www.notion.so/product/notion-for-education` |
| Canva for Education | `https://www.canva.com/education/` |
| Autodesk Education | `https://www.autodesk.com/education/edu-software/overview` |

For each page, extract any tools, products, or programs that look relevant.

## Step 3: Keyword-discovery pass

**IMPORTANT**: Do not use `web-fetch` for these searches. Use only the `tavily` MCP tool.

Call the tavily `search` tool with each of these queries. Do not skip any. Use the current year (the year you are running this workflow) in place of `YEAR`.

1. `"student plan" OR "education plan" developer tools software YEAR free`
2. `"free for students" OR "academic license" AI tools cloud YEAR`
3. `"lifestyle" OR "productivity" OR "domains" student discount OR "free for students" YEAR`
4. `student grant OR credits developer tools YEAR apply individual`

## Step 4: Verify each candidate

For each result from Steps 2 and 3, use `web-fetch` on the specific product or program page to confirm it is real and active, and that the name and hostname are not in your known or rejected sets. Note which pass discovered it (known-source or keyword). Then apply this quality bar:

1. Substantial offer: free tier, 50%+ discount, or meaningful platform credits — skip if token discount under 30% with no free tier or credits
2. Recognizable product — skip if niche, one-person, or no meaningful community of student users
3. Self-serve student program page — skip if requires institutional purchase, IT approval, or "contact us"
4. Fills a gap: prefer categories underrepresented in the directory — skip if it would be a 4th entry in an already-saturated category
5. Signup page loads and is currently active — skip if broken, gated, or clearly outdated

Keep a shortlist of the best candidates across both passes, up to **5 new benefits**.

## Step 5: Create issues for new discoveries

For each confirmed new benefit, up to **5 per run**, create a GitHub issue:

- **Title**: The product name only (e.g. `Figma` not `Figma has a student discount`)
- **Body**:
  ```
  **What students get**: <one sentence — be specific about plan, amount, or duration>
  **Signup**: <direct URL to the student program page>
  **Discovered via**: <known-source | keyword>
  **Pack**: GitHub Student Pack
  ```
  Omit the `**Pack**` line if the tool was not discovered from the GitHub Student Developer Pack source.

Create issues one at a time.

## Step 6: Update the discovery log

Replace the entire content of `agent/last-benefits-discovery.json` with:

```json
{
  "timestamp": "<current UTC time as ISO 8601>",
  "known_sources_checked": ["<url>", "..."],
  "keyword_queries": ["<query 1>", "<query 2>", "<query 3>", "<query 4>"],
  "discovered": [
    { "name": "<name>", "link": "<link>", "source": "known-source | keyword" }
  ],
  "issues_created": <number>
}
```

Write the complete file — do not append.
