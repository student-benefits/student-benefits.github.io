#!/usr/bin/env python3
"""
Creates a GitHub App via manifest flow.
Based on: https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
"""

import json
import subprocess
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote

APP_NAME = "student-benefits-hub-models"
HOMEPAGE = "https://agentivo.github.io/student-benefits-hub/"
PORT = 3456

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


def exchange_code(code):
    """Exchange the code for app credentials via GitHub API."""
    print("\nExchanging code for app credentials...")

    result = subprocess.run(
        ["gh", "api", f"/app-manifests/{code}/conversions", "-X", "POST"],
        capture_output=True, text=True
    )

    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return None

    app = json.loads(result.stdout)
    print(f"App created: {app['name']} (ID: {app['id']})")

    print("Saving APP_ID and APP_PRIVATE_KEY secrets...")
    subprocess.run(["gh", "secret", "set", "APP_ID"], input=str(app["id"]), text=True, check=True)
    subprocess.run(["gh", "secret", "set", "APP_PRIVATE_KEY"], input=app["pem"], text=True, check=True)

    print(f"\nDone! Install the app: https://github.com/settings/apps/{app['slug']}/installations")
    return app


class CallbackHandler(BaseHTTPRequestHandler):
    app_data = None

    def log_message(self, *args):
        pass

    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        code = query.get("code", [None])[0]

        if not code:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<html><body><h1>Waiting for GitHub callback...</h1></body></html>")
            return

        app = exchange_code(code)
        CallbackHandler.app_data = app

        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()

        if app:
            install_url = f"https://github.com/settings/apps/{app['slug']}/installations"
            self.wfile.write(f"""<!DOCTYPE html>
<html><body style="font-family:system-ui;text-align:center;padding:40px">
<h1>Success!</h1>
<p>App: <strong>{app['name']}</strong> (ID: {app['id']})</p>
<p>Secrets added to repository.</p>
<p><a href="{install_url}">Click here to install the app</a></p>
</body></html>""".encode())
        else:
            self.wfile.write(b"<html><body><h1>Failed to create app</h1></body></html>")


def main():
    print(f"Creating GitHub App: {APP_NAME}\n")

    print("Configuration:")
    print(f"  Name:     {APP_NAME}")
    print(f"  Homepage: {HOMEPAGE}")
    print(f"  Webhook:  Disabled")
    print()
    print("Permissions:")
    for perm, level in MANIFEST["default_permissions"].items():
        print(f"  {perm}: {level}")
    print()
    print(f"Callback: http://localhost:{PORT}")
    print()

    input("Press Enter to open browser...")

    # Build manifest with redirect URL
    manifest = {**MANIFEST, "redirect_url": f"http://localhost:{PORT}"}
    manifest_json = json.dumps(manifest)

    # URL encode the manifest (like encodeURIComponent in JS)
    encoded_manifest = quote(manifest_json, safe='')

    github_url = f"https://github.com/settings/apps/new?manifest={encoded_manifest}"

    # Start callback server
    server = HTTPServer(("localhost", PORT), CallbackHandler)
    server.timeout = 300

    print(f"\nOpening GitHub...")
    print("1. Review the pre-filled app settings")
    print("2. Click 'Create GitHub App'")
    print("3. You'll be redirected back here\n")

    webbrowser.open(github_url)

    # Wait for callback
    print("Waiting for callback...")
    while not CallbackHandler.app_data:
        server.handle_request()
        if CallbackHandler.app_data:
            break

    if CallbackHandler.app_data:
        slug = CallbackHandler.app_data['slug']
        print(f"\nNext step: Install the app at https://github.com/settings/apps/{slug}/installations")


if __name__ == "__main__":
    main()
