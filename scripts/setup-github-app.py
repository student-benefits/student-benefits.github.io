#!/usr/bin/env python3
"""
Creates a GitHub App via manifest flow.
One browser click required (GitHub security requirement), everything else automated.
Once created, install on any repo - no manual tokens needed.
"""

import json
import subprocess
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

APP_NAME = "student-benefits-hub-models"
HOMEPAGE = "https://agentivo.github.io/student-benefits-hub/"
PORT = 3456

# App permissions - includes Models access
MANIFEST = {
    "name": APP_NAME,
    "url": HOMEPAGE,
    "hook_attributes": {"active": False},
    "public": False,
    "default_permissions": {
        "contents": "write",
        "issues": "write",
        "pull_requests": "write",
        "models": "read"
    },
    "default_events": []
}


class CallbackHandler(BaseHTTPRequestHandler):
    app_data = None

    def log_message(self, *args):
        pass

    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        code = query.get("code", [None])[0]

        if not code:
            self.send_error(400, "Missing code")
            return

        print("Exchanging code for app credentials...")

        # Exchange code via gh api
        result = subprocess.run(
            ["gh", "api", f"/app-manifests/{code}/conversions", "-X", "POST"],
            capture_output=True, text=True
        )

        if result.returncode != 0:
            print(f"Error: {result.stderr}")
            self.send_error(500, "Failed")
            return

        app = json.loads(result.stdout)
        CallbackHandler.app_data = app

        print(f"\nApp created: {app['name']} (ID: {app['id']})")

        # Save credentials
        print("Saving APP_ID and APP_PRIVATE_KEY secrets...")
        subprocess.run(["gh", "secret", "set", "APP_ID"], input=str(app["id"]), text=True, check=True)
        subprocess.run(["gh", "secret", "set", "APP_PRIVATE_KEY"], input=app["pem"], text=True, check=True)

        install_url = f"https://github.com/settings/apps/{app['slug']}/installations"

        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(f"""
            <html><body style="font-family:system-ui;text-align:center;padding:40px">
            <h1>Done</h1>
            <p>App: <strong>{app['name']}</strong> (ID: {app['id']})</p>
            <p>Secrets added to repo.</p>
            <p><a href="{install_url}">Install the app on your repos</a></p>
            </body></html>
        """.encode())


def main():
    print(f"Creating GitHub App: {APP_NAME}\n")

    print("Configuration:")
    print(f"  Name:     {APP_NAME}")
    print(f"  Homepage: {HOMEPAGE}")
    print(f"  Webhook:  Disabled")
    print(f"  Public:   No (only you can install)")
    print()
    print("Permissions:")
    for perm, level in MANIFEST["default_permissions"].items():
        print(f"  {perm}: {level}")
    print()

    input("Press Enter to open browser and create the app...")

    manifest = {**MANIFEST, "redirect_url": f"http://localhost:{PORT}"}
    url = f"https://github.com/settings/apps/new?manifest={json.dumps(manifest)}"

    webbrowser.open(url)

    HTTPServer(("localhost", PORT), CallbackHandler).handle_request()

    if CallbackHandler.app_data:
        slug = CallbackHandler.app_data['slug']
        print(f"\nNext: Install the app at https://github.com/settings/apps/{slug}/installations")
        print("Once installed, workflows will use the app for GitHub Models access.")


if __name__ == "__main__":
    main()
