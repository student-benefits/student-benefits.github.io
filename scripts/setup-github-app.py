#!/usr/bin/env python3
"""
Creates a GitHub App with pre-filled settings.
"""

import signal
import sys
import webbrowser
from urllib.parse import quote


def handle_sigint(_sig, _frame):
    print("\n\nCancelled.")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_sigint)

APP_NAME = "student-benefits-hub-models"
HOMEPAGE = "https://agentivo.github.io/student-benefits-hub/"
DESCRIPTION = "AI-powered student benefits discovery"

PERMISSIONS = {
    "contents": "write",
    "issues": "write",
    "pull_requests": "write",
    "organization_models": "read",  # GitHub Models API access
}


def main():
    print(f"Creating GitHub App: {APP_NAME}\n")

    print("Configuration:")
    print(f"  Name:        {APP_NAME}")
    print(f"  Description: {DESCRIPTION}")
    print(f"  Homepage:    {HOMEPAGE}")
    print(f"  Webhook:     Disabled")
    print()
    print("Permissions:")
    for perm, level in PERMISSIONS.items():
        print(f"  {perm}: {level}")
    print()

    input("Press Enter to open browser...")

    query_parts = [
        f"name={quote(APP_NAME)}",
        f"description={quote(DESCRIPTION)}",
        f"url={quote(HOMEPAGE, safe='')}",
        "webhook_active=false",
        "public=false",
    ] + [f"{perm}={level}" for perm, level in PERMISSIONS.items()]

    github_url = "https://github.com/settings/apps/new?" + "&".join(query_parts)

    webbrowser.open(github_url)

    print("\nAfter creating the app:")
    print("1. Copy the App ID from the app settings page")
    print("2. Scroll down and click 'Generate a private key'")
    print("3. Run these commands:\n")
    print("   gh secret set APP_ID")
    print("   # paste App ID, press Enter, then Ctrl+D\n")
    print("   gh secret set APP_PRIVATE_KEY < ~/Downloads/*.private-key.pem\n")
    print("4. Install the app on your repo (left sidebar → Install App)")


if __name__ == "__main__":
    main()
