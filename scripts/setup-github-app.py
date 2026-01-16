#!/usr/bin/env python3
"""
Creates a GitHub App via manifest flow.
"""

import json
import subprocess
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

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
    """Exchange the code for app credentials."""
    print("Exchanging code for app credentials...")

    result = subprocess.run(
        ["gh", "api", f"/app-manifests/{code}/conversions", "-X", "POST"],
        capture_output=True, text=True
    )

    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return None

    app = json.loads(result.stdout)
    print(f"\nApp created: {app['name']} (ID: {app['id']})")

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
            self.send_error(400, "Missing code")
            return

        app = exchange_code(code)
        CallbackHandler.app_data = app

        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()

        if app:
            install_url = f"https://github.com/settings/apps/{app['slug']}/installations"
            self.wfile.write(f"""
                <html><body style="font-family:system-ui;text-align:center;padding:40px">
                <h1>Done</h1>
                <p>App: <strong>{app['name']}</strong> (ID: {app['id']})</p>
                <p>Secrets added to repo.</p>
                <p><a href="{install_url}">Install the app</a></p>
                </body></html>
            """.encode())
        else:
            self.wfile.write(b"<html><body><h1>Failed</h1></body></html>")


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
    print(f"Callback:   http://localhost:{PORT}")
    print()

    input("Press Enter to open browser...")

    manifest = {**MANIFEST, "redirect_url": f"http://localhost:{PORT}"}
    url = f"https://github.com/settings/apps/new?manifest={json.dumps(manifest)}"

    print(f"\nWaiting for callback on http://localhost:{PORT}")
    print("After clicking 'Create GitHub App', your browser will redirect here.\n")
    print("If redirect fails, copy the URL from your browser's address bar")
    print("and paste it here (or Ctrl+C to cancel):\n")

    # Start server in background thread
    import threading
    server = HTTPServer(("localhost", PORT), CallbackHandler)
    server.timeout = 120

    def serve():
        server.handle_request()

    thread = threading.Thread(target=serve)
    thread.daemon = True
    thread.start()

    webbrowser.open(url)

    # Wait for callback or manual input
    while thread.is_alive():
        try:
            import select
            import sys
            if select.select([sys.stdin], [], [], 0.5)[0]:
                manual_url = input().strip()
                if "code=" in manual_url:
                    code = parse_qs(urlparse(manual_url).query).get("code", [None])[0]
                    if code:
                        exchange_code(code)
                        return
        except:
            pass

    if not CallbackHandler.app_data:
        print("\nNo callback received. If you created the app manually:")
        print("1. Go to https://github.com/settings/apps")
        print("2. Click on your app")
        print("3. Note the App ID")
        print("4. Generate a private key")
        print("5. Run:")
        print("   gh secret set APP_ID")
        print("   gh secret set APP_PRIVATE_KEY < private-key.pem")


if __name__ == "__main__":
    main()
