#!/usr/bin/env python3
"""Safety net for add-benefit.yml / add-event.yml runs that silently produce
nothing — either issue #267 (the triggering actor lacks write access, so
claude-code-action's app-token exchange 401s before the agent step even
starts) or any other cause (see #320).

Detects the OBSERVABLE SYMPTOM — issue still open, still labeled, zero
comments, past a grace period — rather than the specific root cause, and
redispatches via `gh workflow run` (workflow_dispatch), a write-privileged
path that sidesteps #267's actor-permission gate regardless of who
originally triggered the label event.

Three states per issue, tracked via labels so this never spams or loops:
  no `redispatched` label            -> redispatch once, add the label
  `redispatched`, no `needs-manual-review` -> still stalled after a retry;
                                              comment once, add that label
  `needs-manual-review` present      -> already flagged, leave it alone

Usage: python3 scripts/redispatch_stalled.py
"""
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone

GRACE_MINUTES = 15

TARGETS = [
    ("new-benefit", "add-benefit.yml"),
    ("new-event", "add-event.yml"),
]


def run(cmd, **kwargs):
    kwargs.setdefault("check", True)
    kwargs.setdefault("capture_output", True)
    kwargs.setdefault("text", True)
    return subprocess.run(cmd, **kwargs)


def run_ok(cmd, **kwargs):
    kwargs["check"] = False
    return run(cmd, **kwargs)


def main() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=GRACE_MINUTES)

    for label, workflow in TARGETS:
        r = run(["gh", "issue", "list", "--state", "open", "--label", label,
                 "--json", "number,createdAt,comments,labels", "--limit", "100"])
        issues = json.loads(r.stdout)

        for issue in issues:
            created = datetime.fromisoformat(issue["createdAt"].replace("Z", "+00:00"))
            if created >= cutoff or issue["comments"]:
                continue  # too fresh to judge, or the bot already responded

            num = issue["number"]
            issue_labels = {l["name"] for l in issue["labels"]}

            if "needs-manual-review" in issue_labels:
                continue  # already flagged, don't repeat

            if "redispatched" in issue_labels:
                print(f"#{num}: still stalled after a retry — flagging for manual review")
                run_ok(["gh", "issue", "comment", str(num), "--body",
                        "Automatic redispatch didn't resolve this — this submission needs "
                        "manual attention. Known failure modes: #267 (external submitter, "
                        "GitHub App token exchange requires write access) or #320 "
                        f"(internal permission-denial stall). Process directly with "
                        f"`gh workflow run {workflow} -f issue={num}`."])
                run_ok(["gh", "issue", "edit", str(num), "--add-label", "needs-manual-review"])
                continue

            print(f"#{num}: stalled, no prior redispatch — redispatching via {workflow}")
            labeled = run_ok(["gh", "issue", "edit", str(num), "--add-label", "redispatched"])
            if labeled.returncode != 0:
                print(f"  warn: could not label #{num} — skipping redispatch this cycle")
                continue
            dispatched = run_ok(["gh", "workflow", "run", workflow, "-f", f"issue={num}"])
            if dispatched.returncode != 0:
                print(f"  warn: could not redispatch #{num}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
