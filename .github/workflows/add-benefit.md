---
description: |
  Processes new student benefit submissions from issues. Reads the issue,
  validates the benefit, checks for duplicates against benefits.json,
  and creates a PR with the new entry if valid.

on:
  issues:
    types: [labeled]
    names: "new-benefit"
    lock-for-agent: true

permissions: read-all

safe-outputs:
  create-pull-request:
    title-prefix: "Add benefit: "
    labels: [new-benefit]
  add-comment:

tools:
  github:
    toolsets: [issues, repos]
  edit:

timeout-minutes: 10
---

# Add Benefit from Issue

You process student benefit submissions from GitHub issues. Read the triggering issue, validate the submission, check for duplicates, and either create a PR adding the benefit or comment explaining why it can't be added.

## Step 1: Read the issue

Fetch issue #${{ github.event.issue.number }} using the `get_issue` tool. Extract:
- The issue title and body (the user's description of the benefit)
- The optional **Link** field (under `### Link (optional)`)
- The optional **Category** field (under `### Category (optional)`)

Users submit casually (e.g. "Notion is free for students") — your job is to identify the product.

## Step 2: Read benefits.json and check for duplicates

Read `src/data/benefits.json` from the repository. Check for duplicates by:

1. **Name match**: Does any existing benefit have a similar name (case-insensitive)?
2. **Domain match**: Does any existing benefit link share the same hostname (ignoring `www.`)?

If the submission is a duplicate, comment on the issue:
> **Duplicate detected:** This appears to be the same as **{existing benefit name}** already in our directory.
>
> If you believe this is different, please provide more details.

Then stop — do not create a PR.

## Step 3: Validate the benefit

Determine whether this is a real student discount or free-access program. Use your knowledge of the product/service. Only accept if you are confident the program exists.

If invalid, comment on the issue:
> **Cannot add this benefit:**
>
> {reason — e.g. no known student program, unclear what product is meant}
>
> Please provide more details or submit a different benefit.

Then stop — do not create a PR.

## Step 4: Generate the benefit entry

Create a JSON object matching this exact schema:

```json
{
  "id": "url-safe-id",
  "name": "Official Product/Service Name",
  "category": "one of the categories below",
  "description": "What students get — be specific about discounts, free tiers, duration (max 120 chars)",
  "link": "Direct URL to the student signup/discount page",
  "tags": ["Tag1", "Tag2", "Tag3"],
  "popularity": 5
}
```

If the product is open source, also include `"repo": "owner/repo"`.

**ID generation**: Lowercase the name, replace non-alphanumeric characters with hyphens, strip leading/trailing hyphens. Verify the ID doesn't already exist in benefits.json.

**Valid categories** (use exactly one):
- AI & Dev Tools
- Cloud & Hosting
- Learning
- Design
- Productivity
- Lifestyle
- Domains & Security
- Other

If the user provided a link, prefer it. If the user provided a category, use it. Otherwise, use your knowledge to find the correct student discount URL and pick the best category.

**Description rules**: Be specific (e.g. "Free Pro plan for 1 year" not "Student discount available"). Max 120 characters.

## Step 5: Update benefits.json

Use the edit tool to append the new benefit object to the array in `src/data/benefits.json`. Maintain the existing JSON formatting (2-space indent, trailing newline).

## Step 6: Create a pull request

Create a PR with the changes. Use this format:

- **Title**: `Add benefit: {name}` (the safe-output title-prefix handles the prefix, so just use the benefit name)
- **Branch**: `add-benefit-{id}`
- **Body**:
  ```
  ## {name}

  **Category:** {category}
  **Link:** {link}

  {description}

  ---
  Closes #{issue_number}
  ```

## Step 7: Comment on the issue

After creating the PR, add a comment on issue #${{ github.event.issue.number }}:

```
PR created to add **{name}**!

| Field | Value |
|-------|-------|
| Category | {category} |
| Link | {link} |
| Tags | {tags, comma-separated} |

> {description}

The PR will be reviewed and merged shortly.
```
