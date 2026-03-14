#!/usr/bin/env python3
"""
Scout Reddit for student benefit discoveries and posting opportunities.

Two modes:
  --discover   Find new student benefits mentioned on Reddit
  --scout      Find posting opportunities (questions about student discounts)

Hits Reddit's search endpoint ONCE per mode. Maintains state in
agent/reddit-state.json to avoid re-processing posts and to learn
which subreddits yield the best results.

Usage:
  python scout-reddit.py --discover [--dry-run]
  python scout-reddit.py --scout --webhook-url <url> [--dry-run]
  python scout-reddit.py --discover --scout --webhook-url <url>
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
STATE_FILE = REPO_ROOT / "agent" / "reddit-state.json"
BENEFITS_FILE = REPO_ROOT / "benefits.json"
REJECTED_FILE = REPO_ROOT / "agent" / "rejected.json"

USER_AGENT = "StudentBenefitsBot/1.0 (github.com/student-benefits)"

# Subreddits worth searching, ordered by historical yield.
# The script searches ONE combined multireddit endpoint to avoid multiple requests.
DISCOVER_SUBREDDITS = [
    "EngineeringStudents",
    "college",
    "internships",
    "cscareerquestions",
    "learnprogramming",
    "GradSchool",
    "studentdiscounts",
]

DISCOVER_QUERY = '"free for students" OR "student email" OR ".edu" OR "student discount"'

SCOUT_QUERIES = [
    (
        'title:"student discount" OR title:"free for students" '
        'OR title:".edu email" OR title:"student perks" '
        'OR title:"student software" OR title:"free stuff" student'
    ),
]

# Posts need this many upvotes to be worth processing
MIN_SCORE_DISCOVER = 10
MIN_SCORE_SCOUT = 5

# Max processed post IDs to keep in state (rolling window)
MAX_PROCESSED_IDS = 500


def reddit_get(endpoint: str, params: dict) -> dict:
    """Single Reddit JSON API request with rate-limit awareness."""
    params.setdefault("limit", 25)
    params.setdefault("raw_json", 1)
    qs = urllib.parse.urlencode(params)
    url = f"https://www.reddit.com/{endpoint}.json?{qs}"

    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=15) as resp:
        # Respect rate limits
        remaining = resp.headers.get("x-ratelimit-remaining")
        if remaining and float(remaining) < 2:
            reset = float(resp.headers.get("x-ratelimit-reset", 5))
            time.sleep(min(reset, 10))
        return json.loads(resp.read())


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {
        "last_run": None,
        "processed_posts": [],
        "subreddit_scores": {},
        "effective_queries": [],
        "benefits_discovered": 0,
        "opportunities_sent": 0,
    }


def save_state(state: dict):
    # Trim processed_posts to rolling window
    state["processed_posts"] = state["processed_posts"][-MAX_PROCESSED_IDS:]
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n")


def load_known_set() -> tuple[set, set]:
    """Load known benefit names and domains for dedup.

    Builds both exact names and individual words from names, so
    "Figma Education" matches a mention of just "Figma".
    """
    names = set()
    name_words = set()
    domains = set()

    if BENEFITS_FILE.exists():
        for b in json.loads(BENEFITS_FILE.read_text()):
            full = b["name"].lower()
            names.add(full)
            # Add individual significant words (skip common suffixes)
            skip = {"student", "education", "pro", "premium", "for", "free", "ides"}
            for word in full.split():
                if word not in skip and len(word) > 2:
                    name_words.add(word)
            try:
                domain = urllib.parse.urlparse(b["link"]).netloc.replace("www.", "")
                domains.add(domain)
            except Exception:
                pass

    if REJECTED_FILE.exists():
        for r in json.loads(REJECTED_FILE.read_text()):
            name = r.get("name", "").lower()
            names.add(name)
            for word in name.split():
                if len(word) > 2:
                    name_words.add(word)
            if r.get("domain"):
                domains.add(r["domain"])

    # Merge: full names + significant words
    return names | name_words, domains


def extract_posts(data: dict) -> list[dict]:
    """Extract post data from Reddit listing response."""
    posts = []
    for child in data.get("data", {}).get("children", []):
        if child["kind"] != "t3":
            continue
        d = child["data"]
        posts.append({
            "id": d["name"],  # fullname like t3_xxx
            "title": d.get("title", ""),
            "selftext": d.get("selftext", ""),
            "score": d.get("score", 0),
            "num_comments": d.get("num_comments", 0),
            "subreddit": d.get("subreddit", ""),
            "permalink": d.get("permalink", ""),
            "created_utc": d.get("created_utc", 0),
            "url": d.get("url", ""),
        })
    return posts


def extract_benefit_mentions(text: str, known_names: set) -> list[str]:
    """
    Extract product/tool names from benefit-list posts.

    Only triggers on posts that look like curated lists (bullet points with
    bold names and descriptions). Filters out common false positives like
    section headers, generic words, and short fragments.
    """
    import re
    mentions = set()

    # Only process posts that look like benefit lists (multiple bullet points)
    bullet_count = len(re.findall(r"^\s*[\*\-•]\s", text, re.MULTILINE))
    if bullet_count < 3:
        return []

    # Words/phrases that appear bold but aren't product names
    noise = {
        "edit", "update", "note", "important", "warning", "tip", "pro tip",
        "tldr", "tl;dr", "summary", "also", "bonus", "new", "free",
        "the", "but", "pack",
        # Technologies/concepts, not student benefits
        "cuda", "pytorch", "jax", "tensorflow", "deep learning",
        "reinforcement learning", "transformers", "machine learning",
        "python", "javascript", "rust", "java", "c", "html", "css",
        # Generic terms
        "check if your university", "also feel free", "start with",
    }

    def is_known(name: str) -> bool:
        """Check if any significant word in the name matches a known benefit."""
        lower = name.lower()
        if lower in known_names:
            return True
        # Check if any word in the mention matches a known word
        for word in lower.split():
            if word in known_names and len(word) > 2:
                return True
        return False

    # Pattern: **Name** – description (the standard list format)
    # Requires a dash/colon after the bold name to filter out random bold text
    for match in re.finditer(
        r"\*\*([A-Z][A-Za-z0-9 .]+?)\*\*\s*[–\-—:]\s+\S",
        text,
    ):
        name = match.group(1).strip()
        if (
            len(name) > 2
            and len(name) < 40
            and not is_known(name)
            and name.lower() not in noise
            and not name.startswith("http")
        ):
            mentions.add(name)

    # Pattern: * Name – description (unbold list items)
    for match in re.finditer(
        r"^\s*[\*\-•]\s+([A-Z][A-Za-z0-9 .]+?)\s*[–\-—:]\s+\S",
        text,
        re.MULTILINE,
    ):
        name = match.group(1).strip().strip("*")
        if (
            len(name) > 2
            and len(name) < 40
            and not is_known(name)
            and name.lower() not in noise
            and not name.startswith("http")
        ):
            mentions.add(name)

    return sorted(mentions)


def extract_comment_mentions(permalink: str, known_names: set) -> list[str]:
    """
    Fetch top comments from a post and extract product mentions.

    Comments often contain single-line suggestions like "Altium" or
    "Solidworks" — different pattern from list posts.
    """
    import re

    try:
        data = reddit_get(permalink.rstrip("/"), {
            "sort": "top",
            "limit": 50,
        })
    except Exception:
        return []

    if not isinstance(data, list) or len(data) < 2:
        return []

    mentions = set()
    noise = {
        "remindme", "remind me", "this", "yes", "no", "same", "thanks",
        "great list", "nice", "wow", "lol", "edit", "update", "not anymore",
        "neat. thank you", "in a different vein", "tossing it in there",
        "wait really", "this!", "facts", "agreed", "based", "huge",
    }

    # Reject comments that look like conversational text, not product names
    def looks_like_product(text: str) -> bool:
        lower = text.lower()
        # Must not start with common sentence starters
        if any(lower.startswith(w) for w in [
            "i ", "my ", "the ", "a ", "an ", "it ", "in ", "on ", "at ",
            "we ", "you ", "not ", "this ", "that ", "how ", "what ",
            "wait", "neat", "tossing", "also", "just ", "but ",
            "free ", "check", "got ",
        ]):
            return False
        # Must not contain spaces + lowercase (sentence-like)
        words = text.split()
        if len(words) > 1 and all(w[0].islower() for w in words[1:] if w):
            return False
        return True

    def scan_comments(children):
        for c in children:
            if c.get("kind") != "t1":
                continue
            d = c["data"]
            if d.get("score", 0) < 3:
                continue
            body = d.get("body", "").strip()

            # Short comments (1-3 words) are often product name suggestions
            words = body.split()
            if 1 <= len(words) <= 4 and body.lower() not in noise:
                candidate = body.strip("!.? ")
                if (
                    candidate
                    and candidate[0].isupper()
                    and len(candidate) > 2
                    and len(candidate) < 40
                    and looks_like_product(candidate)
                ):
                    lower = candidate.lower()
                    known = lower in known_names or any(
                        w in known_names for w in lower.split() if len(w) > 2
                    )
                    if not known:
                        mentions.add(candidate)

            # Also look for "Product — description" patterns in longer comments
            for match in re.finditer(
                r"(?:^|\n)\s*\*?\*?([A-Z][A-Za-z0-9 .]+?)\*?\*?\s*[–\-—:]\s+\S",
                body,
            ):
                name = match.group(1).strip().strip("*")
                if (
                    len(name) > 2
                    and len(name) < 40
                    and looks_like_product(name)
                ):
                    lower = name.lower()
                    known = lower in known_names or any(
                        w in known_names for w in lower.split() if len(w) > 2
                    )
                    if not known:
                        mentions.add(name)

            # Recurse into replies
            replies = d.get("replies")
            if isinstance(replies, dict):
                scan_comments(replies["data"]["children"])

    scan_comments(data[1]["data"]["children"])
    return sorted(mentions)


def is_posting_opportunity(post: dict) -> bool:
    """Check if a post is someone asking for student discount recommendations."""
    title = post["title"].lower()
    text = post["selftext"].lower()
    combined = title + " " + text

    ask_signals = [
        "what free", "any student discount", "what can i get",
        "free with .edu", "free with student", "student email",
        "recommend", "suggestions", "what tools", "what software",
        "looking for", "does anyone know", "list of",
    ]
    return any(signal in combined for signal in ask_signals)


def send_discord_notification(webhook_url: str, post: dict):
    """Send a posting opportunity to Discord."""
    age_hours = (time.time() - post["created_utc"]) / 3600
    age_str = f"{age_hours:.0f}h ago" if age_hours < 24 else f"{age_hours/24:.0f}d ago"

    embed = {
        "embeds": [{
            "title": f"r/{post['subreddit']} — Posting opportunity",
            "description": post["title"],
            "url": f"https://reddit.com{post['permalink']}",
            "color": 0xFF6B35,
            "fields": [
                {"name": "Score", "value": str(post["score"]), "inline": True},
                {"name": "Comments", "value": str(post["num_comments"]), "inline": True},
                {"name": "Age", "value": age_str, "inline": True},
            ],
            "footer": {
                "text": "student-benefits.github.io scout",
            },
        }],
    }

    data = json.dumps(embed).encode()
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
    )
    urllib.request.urlopen(req, timeout=10)


def cmd_discover(state: dict, dry_run: bool) -> list[dict]:
    """Find new student benefits mentioned on Reddit."""
    known_names, known_domains = load_known_set()
    processed = set(state.get("processed_posts", []))

    # Use multireddit: r/sub1+sub2+sub3/search — single HTTP request
    multi = "+".join(DISCOVER_SUBREDDITS)
    print(f"Searching r/{multi[:40]}... for: {DISCOVER_QUERY[:50]}...")
    data = reddit_get(f"r/{multi}/search", {
        "q": DISCOVER_QUERY,
        "sort": "top",
        "t": "month",
        "limit": 25,
        "restrict_sr": "on",
    })

    posts = extract_posts(data)
    print(f"Got {len(posts)} posts")

    discoveries = []

    for post in posts:
        if post["id"] in processed:
            continue
        if post["score"] < MIN_SCORE_DISCOVER:
            continue

        state["processed_posts"].append(post["id"])

        # Track subreddit productivity
        sub = post["subreddit"]
        if sub not in state.get("subreddit_scores", {}):
            state["subreddit_scores"][sub] = 0

        mentions = extract_benefit_mentions(
            post["selftext"] + "\n" + post["title"], known_names
        )

        # For high-scoring list posts, also scan top comments (one extra request)
        if post["score"] >= 50 and post["num_comments"] >= 5:
            comment_mentions = extract_comment_mentions(
                post["permalink"], known_names
            )
            mentions.extend(m for m in comment_mentions if m not in mentions)

        if mentions:
            state["subreddit_scores"][sub] += len(mentions)
            for name in mentions:
                discoveries.append({
                    "name": name,
                    "source_post": f"https://reddit.com{post['permalink']}",
                    "source_sub": sub,
                    "post_score": post["score"],
                })

            print(f"  [{post['score']}↑] r/{sub}: {len(mentions)} new mentions")
            for m in mentions:
                print(f"    - {m}")

    if not discoveries:
        print("No new discoveries this run.")

    state["benefits_discovered"] += len(discoveries)
    return discoveries


def cmd_scout(state: dict, webhook_url: str, dry_run: bool) -> list[dict]:
    """Find posting opportunities on Reddit."""
    processed = set(state.get("processed_posts", []))
    opportunities = []

    # Single search request for posting opportunities
    query = SCOUT_QUERIES[0]
    print(f"Scouting Reddit: {query[:60]}...")
    data = reddit_get("search", {
        "q": query,
        "sort": "new",
        "t": "week",
        "limit": 25,
        "type": "link",
    })

    posts = extract_posts(data)
    print(f"Got {len(posts)} posts")

    for post in posts:
        if post["id"] in processed:
            continue
        if post["score"] < MIN_SCORE_SCOUT:
            continue

        state["processed_posts"].append(post["id"])

        if is_posting_opportunity(post):
            opportunities.append(post)
            age_hours = (time.time() - post["created_utc"]) / 3600
            print(f"  [{post['score']}↑] r/{post['subreddit']}: {post['title'][:60]}")

            if webhook_url and not dry_run:
                try:
                    send_discord_notification(webhook_url, post)
                    state["opportunities_sent"] = state.get("opportunities_sent", 0) + 1
                    print("    -> sent to Discord")
                except Exception as e:
                    print(f"    -> Discord failed: {e}")

    if not opportunities:
        print("No posting opportunities found.")

    return opportunities


def main():
    parser = argparse.ArgumentParser(description="Scout Reddit for student benefits")
    parser.add_argument("--discover", action="store_true", help="Find new benefits")
    parser.add_argument("--scout", action="store_true", help="Find posting opportunities")
    parser.add_argument("--webhook-url", help="Discord webhook URL")
    parser.add_argument("--dry-run", action="store_true", help="Don't send notifications or create issues")
    args = parser.parse_args()

    if not args.discover and not args.scout:
        parser.error("Specify --discover, --scout, or both")

    state = load_state()

    results = {"discoveries": [], "opportunities": []}

    if args.discover:
        results["discoveries"] = cmd_discover(state, args.dry_run)

    if args.scout:
        if not args.webhook_url:
            webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
        else:
            webhook_url = args.webhook_url
        results["opportunities"] = cmd_scout(state, webhook_url, args.dry_run)

    state["last_run"] = datetime.now(timezone.utc).isoformat()
    if not args.dry_run:
        save_state(state)

    # Output summary as JSON for workflow consumption
    summary = {
        "discoveries": len(results["discoveries"]),
        "opportunities": len(results["opportunities"]),
        "top_subreddits": sorted(
            state.get("subreddit_scores", {}).items(),
            key=lambda x: x[1],
            reverse=True,
        )[:5],
    }
    print(f"\n=== Summary ===")
    print(json.dumps(summary, indent=2))

    return 0 if (results["discoveries"] or results["opportunities"]) else 0


if __name__ == "__main__":
    sys.exit(main())
