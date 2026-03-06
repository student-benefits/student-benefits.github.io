---
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
    - cron: '0 9 * * 1'  # Weekly on Monday at 9am UTC
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

Read `benefits.json` and `agent/rejected.json` from the repository.

Build three lookup sets:
- **Known names**: all existing benefit names (lowercase)
- **Known domains**: all hostnames from existing benefit links (strip `www.`)
- **Rejected names and domains**: from `agent/rejected.json`

## Step 2: Check known aggregator sources (web-fetch)

Fetch each URL below directly with `web-fetch`. These pages reliably list student programs regardless of what vocabulary individual vendors use — "discount," "academic license," "education plan," and "free for students" all mean the same thing and all appear here. Do not skip any.

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

For each page, extract any tools, products, or programs that look relevant. Note the name and URL — you will verify them in Step 4.

## Step 3: Keyword-discovery pass (Tavily)

**IMPORTANT**: Do not use `web-fetch` for these searches. Web-fetch on search engines returns nothing useful. Use only the `tavily` MCP tool for all searches in this step.

Call the tavily `search` tool with each of these queries. Do not skip any.

1. `"student plan" OR "education plan" developer tools software 2025 OR 2026 free`
2. `"free for students" OR "academic license" AI tools cloud 2025 OR 2026`
3. Look at the category distribution in `benefits.json` and pick the **most underrepresented category** (fewest entries). Then call tavily search with: `"<that category>" student OR education free OR discount 2025 OR 2026`
4. `student grant OR credits developer tools 2026 apply individual`

These queries target unknown vendors not covered by the aggregator pages in Step 2.

## Step 4: Verify each candidate

For each result from Steps 2 and 3, use `web-fetch` on the specific product or program page to confirm:
- The student program is real and currently active
- It offers a genuine discount or free tier (not just a marketing page)
- The name and hostname are not in your known or rejected sets
- The signup page loads and is self-serve (no "contact us" gate)

Note which pass discovered each candidate (known-source or keyword).

Keep a shortlist of the best candidates. Apply this quality bar:

**Include** if all of the following are true:
- The benefit is substantial: free tier, 50%+ discount, or meaningful platform credits. A 10–20% discount is not enough.
- The tool is recognizable: a CS student, designer, or developer in the target domain would know it without explanation.
- There is a dedicated student program page — not "contact us for education pricing" or an informal policy.
- It fills a gap: prefer discoveries in categories underrepresented in the directory over a 4th tool in an already-populated category.

**Skip** if any of the following are true:
- The benefit is a token discount (under 30% off, no free tier, no credits).
- The product is niche, one-person, or has no meaningful community of student users.
- The student program requires institutional purchase or IT approval — it must be self-serve.
- The signup page is broken, gated, or clearly outdated.

## Step 5: Create issues for new discoveries

For each confirmed new benefit, up to **5 per run**, create a GitHub issue:

- **Title**: The product name only (e.g. `Figma` not `Figma has a student discount`)
- **Body**: One or two sentences describing what students get and the direct signup URL. Include which pass discovered it (known-source or keyword).

The `create-issue` safe-output will automatically add the `new-benefit` label, which triggers the add-benefit workflow to process and validate each one.

Create issues one at a time.

## Step 6: Update the discovery log

Replace the entire content of `agent/last-discovery.json` with:

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
