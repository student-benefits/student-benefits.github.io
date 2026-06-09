#!/usr/bin/env python3
"""Validate data/benefits.json and data/events.json against the schema.

Deterministic gate for the data integrity rules in CLAUDE.md. Runs in CI on
every PR that touches the data files, so the rules hold regardless of which
workflow (or which model) produced the change.

Checks structure and URL shape only — never fetches links. Liveness is the
maintain-benefits workflow's job; this gate is about what we can prove offline.

Exit 0 if clean, 1 if any error.
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
OFFER_TYPES = {"free", "discount", "credits", "trial"}
# subdomains/paths that are documentation, not signup destinations (see PR #197)
FORBIDDEN_SUBDOMAINS = ("help.", "support.", "docs.", "blog.")
FORBIDDEN_PATH = "/articles/"

errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def load(name: str):
    path = DATA / name
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    # canonical formatting: 2-space indent, unicode preserved, trailing newline
    canonical = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if raw != canonical:
        err(f"{name}: not canonically formatted (expected 2-space indent + trailing newline)")
    return data


def check_link(name: str, link: str) -> None:
    parsed = urlparse(link)
    if parsed.scheme != "https":
        err(f"{name}: link must be https — {link}")
        return
    host = parsed.netloc.lower()
    path = parsed.path or "/"
    if host.startswith(FORBIDDEN_SUBDOMAINS):
        err(f"{name}: link uses a documentation subdomain (help/support/docs/blog) — {link}")
    if FORBIDDEN_PATH in path:
        err(f"{name}: link is a help/docs article (/articles/) — {link}")
    if path in ("/", "/home"):
        err(f"{name}: link points at the homepage, not a signup/program page — {link}")


def validate_benefits() -> None:
    data = load("benefits.json")
    if not isinstance(data, list):
        err("benefits.json: top-level must be a list")
        return
    categories = set(json.loads((DATA / "categories.json").read_text(encoding="utf-8")))
    seen_ids: set[str] = set()
    for i, b in enumerate(data):
        tag = f"benefits[{i}]"
        name = b.get("name", tag)
        for key in ("id", "name", "category", "offer_type", "description", "link", "tags", "popularity"):
            if key not in b:
                err(f"{name}: missing required field '{key}'")
        bid = b.get("id", "")
        if bid:
            if not ID_RE.match(bid):
                err(f"{name}: id '{bid}' must be lowercase, hyphen-separated, no leading/trailing hyphen")
            if bid in seen_ids:
                err(f"{name}: duplicate id '{bid}'")
            seen_ids.add(bid)
        if b.get("category") not in categories:
            err(f"{name}: category '{b.get('category')}' not in categories.json")
        if b.get("offer_type") not in OFFER_TYPES:
            err(f"{name}: offer_type '{b.get('offer_type')}' not one of {sorted(OFFER_TYPES)}")
        desc = b.get("description", "")
        if len(desc) > 120:
            err(f"{name}: description is {len(desc)} chars (max 120)")
        pop = b.get("popularity")
        if not isinstance(pop, int) or not (1 <= pop <= 10):
            err(f"{name}: popularity must be an integer 1-10, got {pop!r}")
        tags = b.get("tags")
        if not isinstance(tags, list) or not tags:
            err(f"{name}: tags must be a non-empty list")
        if isinstance(b.get("link"), str):
            check_link(name, b["link"])

    ids = [b.get("id", "") for b in data if b.get("id")]
    if ids != sorted(ids):
        err("benefits.json: entries must be sorted by id (ascending) — insert new entries in sorted position, do not append to the end")


def validate_events() -> None:
    data = load("events.json")
    if not isinstance(data, list):
        err("events.json: top-level must be a list")
        return
    categories = set(json.loads((DATA / "event-categories.json").read_text(encoding="utf-8")))
    seen_ids: set[str] = set()
    dates: list[str] = []
    for i, e in enumerate(data):
        name = e.get("name", f"events[{i}]")
        for key in ("id", "name", "organizer", "category", "date", "remote", "eligibility", "why", "link", "expires"):
            if key not in e:
                err(f"{name}: missing required field '{key}'")
        eid = e.get("id", "")
        if eid:
            if not ID_RE.match(eid):
                err(f"{name}: id '{eid}' must be lowercase, hyphen-separated")
            if eid in seen_ids:
                err(f"{name}: duplicate id '{eid}'")
            seen_ids.add(eid)
        if e.get("category") not in categories:
            err(f"{name}: category '{e.get('category')}' not in event-categories.json")
        if len(e.get("why", "")) > 200:
            err(f"{name}: why is {len(e.get('why',''))} chars (max 200)")
        for dk in ("date", "date_end", "expires"):
            if dk in e and not DATE_RE.match(str(e[dk])):
                err(f"{name}: {dk} '{e[dk]}' must be YYYY-MM-DD")
        if isinstance(e.get("date"), str) and DATE_RE.match(e["date"]):
            dates.append(e["date"])
    if dates != sorted(dates):
        err("events.json: entries must be sorted by date (earliest first)")


def main() -> int:
    validate_benefits()
    validate_events()
    if errors:
        print(f"✗ {len(errors)} validation error(s):", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print("✓ data/benefits.json and data/events.json are valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
