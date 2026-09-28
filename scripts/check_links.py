"""Weekly audit input: which benefits need Claude's attention.

Fetches every `link` in data/benefits.json, then, when TYPESAFE_API_KEY is set,
asks Jev (TypeSafe's System One model) typed questions about each entry and its
page. Prints the entries that need work as JSON; everything else is healthy and
Claude never opens it. Without the key, every loaded page is `unjudged` and
Claude reviews it itself: a check that could not run is not a pass.
"""
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")
TEXT_CHARS = 3000
MIN_TEXT = 200  # below this the page is script-rendered and Jev has nothing to read
PASS = 0.5
JEV = "https://api.typesafe.ai/v1/systemone"

QUESTIONS = {
    "offer_page": {
        "type": "noul",
        "instructions": "Is `page` the program's own student signup, pricing, or program-overview page "
                        "for the product in `entry`, rather than a generic homepage, a help or docs "
                        "article, a blog post, or an unrelated page?",
    },
    "offers_described": {
        "type": "noul",
        "instructions": "Does `page` still offer students what `entry.description` says, "
                        "rather than showing the program ended, changed materially, or is not mentioned?",
    },
    "specific": {
        "type": "noul",
        "instructions": "Does `entry.description` name a concrete plan, amount, percentage, or duration "
                        "a student gets, rather than a vague phrase like \"student discount available\"?",
    },
    "self_serve": {
        "type": "noul",
        "instructions": "Can an individual student claim the offer in `entry.description` on their own, "
                        "rather than only through their university, institution, or IT department?",
    },
    "offer_type": {
        "type": "choice",
        "instructions": "Which offer type does `entry.description` describe?",
        "criteria": {
            "free": "No cost to the student",
            "discount": "A reduced price",
            "credits": "Cloud, API, or platform credits",
            "trial": "A free period, then paid or discounted",
        },
    },
}


def host(url):
    return (urlparse(url).hostname or "").removeprefix("www.")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read(400_000).decode(r.headers.get_content_charset() or "utf-8", "replace")
            return r.status, r.url, body
    except urllib.error.HTTPError as e:
        return e.code, url, ""
    except Exception as e:
        return None, url, str(e)


def page_text(body):
    title = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
    body = re.sub(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", body, flags=re.S | re.I)
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body))).strip()
    return (html.unescape(title.group(1)).strip() if title else ""), text[:TEXT_CHARS]


def jev(key, entry, page):
    body = json.dumps({"model": "jev-latest", "state": {"entry": entry, "page": page},
                       "questions": QUESTIONS}).encode()
    for attempt in range(5):
        req = urllib.request.Request(JEV, data=body, headers={
            "authorization": f"Bearer {key}", "content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)["answers"]
        except urllib.error.HTTPError as e:
            if e.code not in (429, 529):
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("Jev: retries exhausted")


def check(b, key):
    status, final, body = fetch(b["link"])
    row = {"id": b["id"], "link": b["link"], "status": status}
    if status is None:
        return {**row, "problem": "unreachable", "detail": body[:160]}
    if status in (401, 403, 429):
        return None  # bot-blocking, not evidence the page is gone
    if status >= 400:
        return {**row, "problem": "broken"}
    if host(final) != host(b["link"]):
        return {**row, "problem": "redirected", "final_url": final}
    title, text = page_text(body)
    if not key or len(text) < MIN_TEXT:
        return {**row, "problem": "unjudged", "reason": "no Jev key" if key is None else "page has no readable text"}
    entry = {k: b[k] for k in ("name", "description", "offer_type")}
    try:
        a = jev(key, entry, {"url": final, "title": title, "text": text})
    except Exception as e:
        return {**row, "problem": "unjudged", "reason": f"Jev failed: {e}"[:160]}
    failed = [q for q in ("offer_page", "offers_described", "specific", "self_serve") if a[q]["noul"] < PASS]
    if a["offer_type"]["choice"] != b["offer_type"] and a["offer_type"]["confidence"] >= 0.8:
        failed.append(f"offer_type:{a['offer_type']['choice']}")
    if failed:
        return {**row, "problem": "judged", "failed": failed,
                "scores": {q: round(a[q]["noul"], 2) for q in QUESTIONS if a[q]["type"] == "noul"}}
    return None


def main():
    key = os.environ.get("TYPESAFE_API_KEY") or None
    benefits = json.load(open("data/benefits.json"))
    with ThreadPoolExecutor(8) as pool:
        flags = [f for f in pool.map(lambda b: check(b, key), benefits) if f]
    json.dump({"checked": len(benefits), "jev": bool(key), "flags": flags}, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
