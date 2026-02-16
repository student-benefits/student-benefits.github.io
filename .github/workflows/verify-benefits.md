---
description: |
  Monthly verification of student benefits. Picks 5 random benefits from
  benefits.json and uses the agent's knowledge to check if each program
  is still active and terms are correct. Creates issues for any that
  appear changed or discontinued.

on:
  schedule: "0 10 1 * *"
  workflow_dispatch:

permissions: read-all

safe-outputs:
  create-issue:
    title-prefix: "[Verify]: "
    labels: [needs-review, auto-verified]
    max: 5

tools:
  github:
    toolsets: [issues, repos]

timeout-minutes: 10
---

# Verify Benefits Still Active

You verify that student benefit programs listed in this repository are still active and their terms are correct.

## Step 1: Read benefits.json

Read `benefits.json` from the repository.

## Step 2: Pick 5 random benefits

Select 5 benefits at random from the full list. Log which benefits you are verifying.

## Step 3: Verify each benefit

For each of the 5 selected benefits, use your knowledge to determine:

1. **Does the student program still exist?**
2. **Are the terms approximately correct?** (discount amount, free tier details, duration)
3. **Is the URL likely still the correct signup page?**

Classify each benefit as one of:
- **active**: Program exists, terms are correct, URL is valid
- **changed**: Program exists but terms have significantly changed
- **discontinued**: Program no longer exists or no longer offers a student benefit
- **uncertain**: Cannot verify with confidence

Be conservative: only mark as "discontinued" if you are confident the program no longer exists. Mark as "changed" only if terms have significantly changed.

## Step 4: Create issues for problems

For each benefit classified as **changed** or **discontinued**, create a GitHub issue:

- **Title**: `{name} - {status}` (the safe-output title-prefix adds "[Verify]: ")
- **Body**:
  ```
  ### Automated Verification Alert

  **Benefit:** {name}
  **Status:** {status}

  **Notes:** {explanation of what changed or why it appears discontinued}

  ---
  _This issue was created by automated verification. Please manually verify and update or close if no action needed._
  ```

If all 5 benefits appear active, log that all verified benefits are still active and exit without creating any issues.
