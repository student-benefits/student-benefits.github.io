#!/usr/bin/env python3
"""
Guides through Reddit API app creation for the discover-benefits workflow.
"""

import signal
import sys
import webbrowser


def handle_sigint(_sig, _frame):
    print("\n\nCancelled.")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_sigint)

APP_NAME = "student-benefits-hub"
REDIRECT_URI = "https://localhost"  # Not used for script apps


def main():
    print("Reddit API Setup for Student Benefits Hub\n")

    print("This will create a Reddit 'script' app for server-side API access.")
    print("No user login required - uses client credentials flow.\n")

    print("Configuration to use:")
    print(f"  Name:         {APP_NAME}")
    print(f"  Type:         script (personal use)")
    print(f"  Redirect URI: {REDIRECT_URI}")
    print()

    input("Press Enter to open reddit.com/prefs/apps...")

    webbrowser.open("https://www.reddit.com/prefs/apps")

    print("\nIn the browser:")
    print('1. Scroll down and click "create another app..."')
    print(f'2. Enter name: {APP_NAME}')
    print('3. Select "script" (for personal use)')
    print(f'4. Enter redirect URI: {REDIRECT_URI}')
    print('5. Click "create app"\n')

    input("Press Enter after creating the app...")

    print("\nNow copy the credentials from the app you just created:")
    print("  - client_id: shown under the app name (short string)")
    print("  - client_secret: labeled 'secret'\n")

    print("Run these commands to save as GitHub secrets:\n")
    print("   gh secret set REDDIT_CLIENT_ID")
    print("   # paste client_id, press Enter, then Ctrl+D\n")
    print("   gh secret set REDDIT_CLIENT_SECRET")
    print("   # paste client_secret, press Enter, then Ctrl+D\n")


if __name__ == "__main__":
    main()
