#!/usr/bin/env python3
"""
Scout Reddit for student benefit discoveries and posting opportunities.

Two modes:
  --discover   Find new student benefits mentioned on Reddit
  --scout      Find posting opportunities (questions about student discounts)

Uses the Tavily search API (TAVILY_API_KEY env var) restricted to reddit.com,
avoiding Reddit's API which blocks GitHub Actions runner IPs.

Usage:
  python scout-reddit.py --discover [--dry-run]
  python scout-reddit.py --scout --webhook-url <url> [--dry-run]
  python scout-reddit.py --discover --scout --webhook-url <url>
"""

import argparse
import json
import os
import re
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
STATE_FILE = REPO_ROOT / "agent" / "reddit-state.json"
BENEFITS_FILE = REPO_ROOT / "benefits.json"
REJECTED_FILE = REPO_ROOT / "agent" / "rejected.json"

TAVILY_API = "https://api.tavily.com/search"

DISCOVER_QUERIES = [
    '"free for students" OR "student email" OR ".edu" student discount tools',
    '"free with student" OR "student perks" OR "academic license" software list',
]

SCOUT_QUERY = (
    '"student discount" OR "free for students" OR ".edu email" '
    '"what can I get" OR "recommendations" OR "suggestions" OR "list"'
)

MAX_PROCESSED_IDS = 500


def tavily_search(query: str, api_key: str, max_results: int = 10) -> list[dict]:
    """Search via Tavily, restricted to reddit.com."""
    payload = json.dumps({
        "query": query,
        "max_results": max_results,
        "include_domains": ["reddit.com"],
    }).encode()
    req = urllib.request.Request(
        TAVILY_API,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read()).get("results", [])


def post_id_from_url(url: str) -> str:
    """Extract Reddit post ID from URL, or return the URL as fallback."""
    m = re.search(r"/comments/([a-z0-9]+)/", url)
    return m.group(1) if m else url


def subreddit_from_url(url: str) -> str:
    m = re.search(r"reddit\.com/r/(\w+)/", url)
    return m.group(1) if m else "unknown"


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {
        "last_run": None,
        "processed_posts": [],
        "subreddit_scores": {},
        "benefits_discovered": 0,
        "opportunities_sent": 0,
    }


def save_state(state: dict):
    state["processed_posts"] = state["processed_posts"][-MAX_PROCESSED_IDS:]
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n")


def load_known_set() -> tuple[set, set]:
    """Load known benefit names and domains for dedup."""
    names = set()
    name_words = set()
    domains = set()

    if BENEFITS_FILE.exists():
        for b in json.loads(BENEFITS_FILE.read_text()):
            full = b["name"].lower()
            names.add(full)
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

    return names | name_words, domains


def extract_benefit_mentions(text: str, known_names: set) -> list[str]:
    """Extract product/tool names from benefit-list posts."""
    mentions = set()

    bullet_count = len(re.findall(r"^\s*[\*\-•]\s", text, re.MULTILINE))
    if bullet_count < 3:
        return []

    noise = {
        "edit", "update", "note", "important", "warning", "tip", "pro tip",
        "tldr", "tl;dr", "summary", "also", "bonus", "new", "free",
        "the", "but", "pack",
        "cuda", "pytorch", "jax", "tensorflow", "deep learning",
        "reinforcement learning", "transformers", "machine learning",
        "python", "javascript", "rust", "java", "c", "html", "css",
        "check if your university", "also feel free", "start with",
    }

    def is_known(name: str) -> bool:
        lower = name.lower()
        if lower in known_names:
            return True
        for word in lower.split():
            if word in known_names and len(word) > 2:
                return True
        return False

    for match in re.finditer(
        r"\*\*([A-Z][A-Za-z0-9 .]+?)\*\*\s*[–\-—:]\s+\S",
        text,
    ):
        name = match.group(1).strip()
        if (
            len(name) > 2 and len(name) < 40
            and not is_known(name)
            and name.lower() not in noise
            and not name.startswith("http")
        ):
            mentions.add(name)

    for match in re.finditer(
        r"^\s*[\*\-•]\s+([A-Z][A-Za-z0-9 .]+?)\s*[–\-—:]\s+\S",
        text,
        re.MULTILINE,
    ):
        name = match.group(1).strip().strip("*")
        if (
            len(name) > 2 and len(name) < 40
            and not is_known(name)
            and name.lower() not in noise
            and not name.startswith("http")
        ):
            mentions.add(name)

    return sorted(mentions)


def is_posting_opportunity(title: str, content: str) -> bool:
    """Check if a post is someone asking for student discount recommendations."""
    combined = (title + " " + content).lower()
    ask_signals = [
        "what free", "any student discount", "what can i get",
        "free with .edu", "free with student", "student email",
        "recommend", "suggestions", "what tools", "what software",
        "looking for", "does anyone know", "list of",
    ]
    return any(signal in combined for signal in ask_signals)


def send_discord_notification(webhook_url: str, title: str, url: str, subreddit: str):
    """Send a posting opportunity to Discord."""
    embed = {
        "embeds": [{
            "title": f"r/{subreddit} — Posting opportunity",
            "description": title,
            "url": url,
            "color": 0xFF6B35,
            "footer": {"text": "student-benefits.github.io scout"},
        }],
    }
    data = json.dumps(embed).encode()
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(req, timeout=10)


def cmd_discover(state: dict, api_key: str, dry_run: bool) -> list[dict]:
    """Find new student benefits mentioned on Reddit."""
    known_names, _ = load_known_set()
    processed = set(state.get("processed_posts", []))
    discoveries = []

    for query in DISCOVER_QUERIES:
        print(f"Searching: {query[:60]}...")
        try:
            results = tavily_search(query, api_key, max_results=10)
        except Exception as e:
            print(f"  Search failed: {e}")
            continue

        print(f"Got {len(results)} results")

        for result in results:
            post_id = post_id_from_url(result["url"])
            if post_id in processed:
                continue

            state["processed_posts"].append(post_id)
            sub = subreddit_from_url(result["url"])
            state.setdefault("subreddit_scores", {}).setdefault(sub, 0)

            content = result.get("content", "")
            mentions = extract_benefit_mentions(content, known_names)

            if mentions:
                state["subreddit_scores"][sub] += len(mentions)
                for name in mentions:
                    discoveries.append({
                        "name": name,
                        "source_post": result["url"],
                        "source_sub": sub,
                    })
                print(f"  r/{sub}: {len(mentions)} mentions — {result['url'][:60]}")
                for m in mentions:
                    print(f"    - {m}")

    if not discoveries:
        print("No new discoveries this run.")

    state["benefits_discovered"] = state.get("benefits_discovered", 0) + len(discoveries)
    return discoveries


def cmd_scout(state: dict, api_key: str, webhook_url: str, dry_run: bool) -> list[dict]:
    """Find posting opportunities on Reddit."""
    processed = set(state.get("processed_posts", []))
    opportunities = []

    print(f"Scouting: {SCOUT_QUERY[:60]}...")
    try:
        results = tavily_search(SCOUT_QUERY, api_key, max_results=10)
    except Exception as e:
        print(f"  Search failed: {e}")
        return []

    print(f"Got {len(results)} results")

    for result in results:
        post_id = post_id_from_url(result["url"])
        if post_id in processed:
            continue

        state["processed_posts"].append(post_id)

        title = result.get("title", "")
        content = result.get("content", "")
        sub = subreddit_from_url(result["url"])

        if is_posting_opportunity(title, content):
            opportunities.append(result)
            print(f"  r/{sub}: {title[:60]}")

            if webhook_url and not dry_run:
                try:
                    send_discord_notification(webhook_url, title, result["url"], sub)
                    state["opportunities_sent"] = state.get("opportunities_sent", 0) + 1
                    print("    -> sent to Discord")
                except Exception as e:
                    print(f"    -> Discord failed: {e}")

    if not opportunities:
        print("No posting opportunities found.")

    return opportunities


def main():
    parser = argparse.ArgumentParser(description="Scout Reddit for student benefits")
    parser.add_argument("--discover", action="store_true")
    parser.add_argument("--scout", action="store_true")
    parser.add_argument("--webhook-url")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.discover and not args.scout:
        parser.error("Specify --discover, --scout, or both")

    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        print("Error: TAVILY_API_KEY not set", file=sys.stderr)
        return 1

    state = load_state()
    results = {"discoveries": [], "opportunities": []}

    if args.discover:
        results["discoveries"] = cmd_discover(state, api_key, args.dry_run)

    if args.scout:
        webhook_url = args.webhook_url or os.environ.get("DISCORD_WEBHOOK_URL")
        results["opportunities"] = cmd_scout(state, api_key, webhook_url, args.dry_run)

    state["last_run"] = datetime.now(timezone.utc).isoformat()
    if not args.dry_run:
        save_state(state)

    summary = {
        "discoveries": len(results["discoveries"]),
        "opportunities": len(results["opportunities"]),
        "top_subreddits": sorted(
            state.get("subreddit_scores", {}).items(),
            key=lambda x: x[1],
            reverse=True,
        )[:5],
    }
    print("\n=== Summary ===")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
