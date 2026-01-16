#!/usr/bin/env python3
"""
Student Benefits Hub Tunnel Setup

Creates Cloudflare tunnel for benefits.neevs.io

Usage:
    # Create .env file with CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID
    python scripts/setup_tunnel.py --domain neevs.io --subdomain benefits
"""

import os
import sys
import json
import subprocess
import argparse
from pathlib import Path

from dotenv import load_dotenv
from cloudflare_tunnel_manager import CloudflareTunnelManager

# Load .env from project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

TUNNEL_NAME = "student-benefits-hub"
SERVICE_PORT = 8080


def try_add_github_secret(token: str) -> bool:
    try:
        result = subprocess.run(["gh", "auth", "status"], capture_output=True, timeout=5)
        if result.returncode != 0:
            return False

        process = subprocess.Popen(
            ["gh", "secret", "set", "STUDENT_BENEFITS_TUNNEL_TOKEN"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        process.communicate(input=token, timeout=10)
        return process.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
        return False


def setup_tunnel(domain: str, subdomain: str, no_auto_secret: bool = False) -> None:
    api_token = os.getenv("CLOUDFLARE_API_TOKEN")
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")

    if not api_token or not account_id:
        print("Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set")
        sys.exit(1)

    manager = CloudflareTunnelManager(api_token, account_id)
    zone_id = manager.get_zone_id(domain)
    service_url = f"http://localhost:{SERVICE_PORT}"

    print(f"Setting up tunnel: {subdomain}.{domain}")

    existing = manager.get_tunnel_by_name(TUNNEL_NAME)
    if existing:
        print(f"Tunnel exists: {existing['id']}")
        tunnel_id = existing["id"]
        tunnel_token = manager.get_tunnel_token(tunnel_id)
    else:
        print(f"Creating tunnel: {TUNNEL_NAME}")
        tunnel_id, tunnel_token = manager.create_tunnel(TUNNEL_NAME)
        print(f"Tunnel created: {tunnel_id}")

    print(f"Creating route: {subdomain}.{domain} -> {service_url}")
    manager.create_route(tunnel_id, subdomain, domain, service_url)

    print(f"Configuring DNS: {subdomain}.{domain}")
    try:
        manager.ensure_dns_record(zone_id, subdomain, domain, tunnel_id)
    except Exception as e:
        if "400" in str(e):
            print("DNS record may be auto-managed")
        else:
            print(f"DNS warning: {e}")

    print(f"\nTunnel ready: https://{subdomain}.{domain}")

    if os.getenv("GITHUB_ACTIONS") == "true":
        print(f"::add-mask::{tunnel_token}")

    if not no_auto_secret and try_add_github_secret(tunnel_token):
        print("Secret STUDENT_BENEFITS_TUNNEL_TOKEN added to GitHub")
    else:
        print(f"\nAdd this token as GitHub secret STUDENT_BENEFITS_TUNNEL_TOKEN:")
        print(tunnel_token)

    with open("tunnel.json", "w") as f:
        json.dump({
            "tunnel_id": tunnel_id,
            "tunnel_name": TUNNEL_NAME,
            "subdomain": subdomain,
            "domain": domain,
            "url": f"https://{subdomain}.{domain}",
        }, f, indent=2)
    print("\nConfig saved to tunnel.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Setup Cloudflare tunnel for Student Benefits Hub")
    parser.add_argument("--domain", default="neevs.io", help="Domain (default: neevs.io)")
    parser.add_argument("--subdomain", default="benefits", help="Subdomain (default: benefits)")
    parser.add_argument("--no-auto-secret", action="store_true", help="Skip automatic GitHub secret")

    args = parser.parse_args()
    setup_tunnel(args.domain, args.subdomain, args.no_auto_secret)
