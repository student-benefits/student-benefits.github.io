#!/usr/bin/env python3
"""Deterministically consolidate standalone add-benefit-N / add-event-N PRs
into one review-ready PR, without an LLM in the loop.

add-benefit.yml / add-event.yml each open their own standalone PR per issue
(never a shared branch — see CLAUDE.md's "Per-issue PRs, consolidated
deterministically" section for why: claude-code-action's headless mode has
a built-in, non-configurable restriction on force-push/reset-shaped
commands, and a shared branch needs exactly that to resolve concurrent-push
races). This script is the plain,
non-agentic step that does the consolidation instead: read each open
candidate PR, extract the one entry it adds (by set-difference against
current main, robust to main having moved since that PR branched), fold all
of them into current main in one pass, and push a single consolidated PR.

Run with no side effects beyond git/gh calls already scoped by the calling
workflow's permissions. Safe to run repeatedly — a run with nothing new to
fold in is a no-op.

Usage: python3 scripts/consolidate_pending.py <benefits|events>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

MODES = {
    "benefits": dict(
        data_file="data/benefits.json",
        branch_re=re.compile(r"^add-benefit-(\d+)$"),
        consolidated_branch="pending-benefits-consolidated",
        label="pending-benefits",
        sort_key=lambda e: e["id"],
        item_line=lambda e: f"- {e['name']} ({e['category']})",
        pr_title="Add {n} student benefit{s}",
    ),
    "events": dict(
        data_file="data/events.json",
        branch_re=re.compile(r"^add-event-(\d+)$"),
        consolidated_branch="pending-events-consolidated",
        label="pending-events",
        sort_key=lambda e: e["date"],
        item_line=lambda e: f"- {e['name']} ({e['category']}, {e['date']})",
        pr_title="Add {n} student event{s}",
    ),
}


def run(cmd, **kwargs):
    kwargs.setdefault("cwd", ROOT)
    kwargs.setdefault("check", True)
    kwargs.setdefault("capture_output", True)
    kwargs.setdefault("text", True)
    return subprocess.run(cmd, **kwargs)


def run_ok(cmd, **kwargs):
    kwargs["check"] = False
    return run(cmd, **kwargs)


def load_json_at_ref(ref: str, path: str):
    r = run_ok(["git", "show", f"{ref}:{path}"])
    if r.returncode != 0:
        return None
    return json.loads(r.stdout)


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def gh_json(args):
    r = run(["gh"] + args)
    return json.loads(r.stdout)


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in MODES:
        print(f"usage: {sys.argv[0]} <{'|'.join(MODES)}>", file=sys.stderr)
        return 2
    mode = MODES[sys.argv[1]]
    data_path = ROOT / mode["data_file"]

    run(["git", "fetch", "origin", "main"])
    main_data = load_json_at_ref("origin/main", mode["data_file"])
    main_ids = {e["id"] for e in main_data}

    prs = gh_json(["pr", "list", "--state", "open", "--json",
                    "number,headRefName,author", "--limit", "100"])

    candidates = []  # (pr_number, issue_number, entry)
    skipped_stale = []  # PRs whose branch added nothing new (already superseded)
    for pr in prs:
        m = mode["branch_re"].match(pr["headRefName"])
        # Both checks matter: branch name alone is a PR author's free choice,
        # not proof this PR came from add-benefit.yml/add-event.yml.
        if not m or pr["author"]["login"] != "app/claude":
            continue
        issue_number = int(m.group(1))
        run(["git", "fetch", "origin", pr["headRefName"]])
        branch_data = load_json_at_ref("FETCH_HEAD", mode["data_file"])
        if branch_data is None:
            continue
        branch_ids = {e["id"] for e in branch_data}
        new_ids = branch_ids - main_ids
        if not new_ids:
            skipped_stale.append(pr["number"])
            continue
        by_id = {e["id"]: e for e in branch_data}
        for nid in new_ids:
            candidates.append((pr["number"], issue_number, by_id[nid]))

    # Close stale PRs immediately — this doesn't depend on whether any
    # candidate below successfully consolidates, so it must not live behind
    # an early return further down (a run with only stale PRs and no
    # candidates would otherwise never close them).
    for src_pr in skipped_stale:
        run_ok(["gh", "pr", "close", str(src_pr), "--comment",
                "Superseded — this entry is already on main."])

    if not candidates:
        print(f"Nothing to consolidate. {len(skipped_stale)} stale PR(s) closed.")
        return 0

    # Build the consolidated branch fresh off current main.
    run(["git", "checkout", "-B", mode["consolidated_branch"], "origin/main"])
    write_json(data_path, main_data)

    included = []     # (pr_number, issue_number, entry)
    needs_review = []  # (pr_number, issue_number, entry, reason) — id collision or validation failure
    working = {e["id"]: e for e in main_data}

    for pr_number, issue_number, entry in candidates:
        if entry["id"] in working:
            needs_review.append((pr_number, issue_number, entry, "id collision"))
            continue
        working[entry["id"]] = entry
        merged = sorted(working.values(), key=mode["sort_key"])
        write_json(data_path, merged)
        v = run_ok(["python3", "scripts/validate_data.py"])
        if v.returncode != 0:
            # This entry alone doesn't validate against the merged state —
            # back it out, leave its source PR open for manual attention.
            del working[entry["id"]]
            merged = sorted(working.values(), key=mode["sort_key"])
            write_json(data_path, merged)
            needs_review.append((pr_number, issue_number, entry, "validation failure"))
            continue
        included.append((pr_number, issue_number, entry))

    if not included:
        print(f"Nothing validated cleanly; nothing to push. "
              f"{len(needs_review)} need manual attention.")
        run(["git", "checkout", "-"])
        return 0

    run(["git", "add", mode["data_file"]])
    diff = run_ok(["git", "diff", "--cached", "--quiet"])
    if diff.returncode == 0:
        print(f"No diff against main after merge — nothing to push. "
              f"{len(needs_review)} need manual attention.")
        return 0

    n = len(included)
    run(["git", "-c", "user.name=Claude", "-c", "user.email=noreply@anthropic.com",
         "commit", "-m", f"Consolidate {n} pending {sys.argv[1]}"])
    run(["git", "push", "--force-with-lease", "-u", "origin", mode["consolidated_branch"]])

    body_lines = [mode["item_line"](e) for _, _, e in included]
    closes_lines = [f"Closes #{issue_number}" for _, issue_number, _ in included]
    body = "\n".join(body_lines) + "\n\n" + "\n".join(closes_lines)
    title = mode["pr_title"].format(n=n, s="" if n == 1 else "s")

    existing = gh_json(["pr", "list", "--state", "open", "--head",
                         mode["consolidated_branch"], "--json", "number"])
    if existing:
        pr_number = existing[0]["number"]
        run(["gh", "pr", "edit", str(pr_number), "--title", title, "--body", body])
    else:
        r = run(["gh", "pr", "create", "--base", "main", "--label", mode["label"],
                  "--title", title, "--body", body, "--head", mode["consolidated_branch"]])
        pr_number = int(r.stdout.strip().rstrip("/").rsplit("/", 1)[-1])

    for src_pr, issue_number, entry in included:
        run_ok(["gh", "pr", "close", str(src_pr), "--comment",
                f"Folded into #{pr_number}."])

    for src_pr, issue_number, entry, reason in needs_review:
        print(f"PR #{src_pr} (issue #{issue_number}, id={entry['id']!r}) "
              f"needs manual attention — {reason}.")

    print(f"Consolidated {n} {sys.argv[1]} into PR #{pr_number}. "
          f"{len(needs_review)} need manual attention. {len(skipped_stale)} already stale.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
