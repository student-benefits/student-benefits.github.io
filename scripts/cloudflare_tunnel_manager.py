#!/usr/bin/env python3
"""
Cloudflare Tunnel Manager

Core API client for managing Cloudflare Tunnels.
"""

from __future__ import annotations

import json
import requests

CF_API_BASE = "https://api.cloudflare.com/client/v4"
CF_ZERO_TRUST_API_BASE = "https://api.cloudflare.com/client/v4/accounts"


class CloudflareTunnelManager:
    def __init__(self, api_token: str, account_id: str):
        self.api_token = api_token
        self.account_id = account_id
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, endpoint: str, data: dict | None = None) -> dict:
        url = f"{CF_ZERO_TRUST_API_BASE}/{self.account_id}/{endpoint}"
        response = requests.request(method, url, headers=self.headers, json=data)
        response.raise_for_status()
        result = response.json()
        if not result.get("success", False):
            raise Exception(f"Cloudflare API error: {result.get('errors', [])}")
        return result

    def get_tunnels(self) -> list[dict]:
        result = self._request("GET", "cfd_tunnel")
        return result.get("result", [])

    def get_tunnel_by_name(self, name: str) -> dict | None:
        tunnels = self.get_tunnels()
        return next((t for t in tunnels if t["name"] == name), None)

    def create_tunnel(self, name: str) -> tuple[str, str]:
        data = {"name": name, "config_src": "local"}
        result = self._request("POST", "cfd_tunnel", data)
        tunnel = result["result"]
        tunnel_id = tunnel["id"]

        token_result = self._request("GET", f"cfd_tunnel/{tunnel_id}/token")
        result_data = token_result.get("result", {})

        if isinstance(result_data, dict):
            tunnel_token = result_data.get("token", "")
        elif isinstance(result_data, str):
            tunnel_token = result_data
        else:
            raise ValueError(f"Unexpected token format: {type(result_data)}")

        if not tunnel_token:
            raise ValueError("Failed to retrieve tunnel token")

        return tunnel_id, tunnel_token

    def get_tunnel_token(self, tunnel_id: str) -> str:
        token_result = self._request("GET", f"cfd_tunnel/{tunnel_id}/token")
        result_data = token_result.get("result", {})

        if isinstance(result_data, dict):
            return result_data.get("token", "")
        elif isinstance(result_data, str):
            return result_data
        return ""

    def create_route(
        self,
        tunnel_id: str,
        subdomain: str,
        domain: str,
        service_url: str = "http://localhost:8080",
    ) -> dict:
        try:
            config_result = self._request("GET", f"cfd_tunnel/{tunnel_id}/configurations")
            result_data = config_result.get("result")

            if result_data is None:
                config = {}
            elif isinstance(result_data, str):
                config = json.loads(result_data)
            elif isinstance(result_data, dict):
                config = result_data.get("config", result_data)
                if isinstance(config, str):
                    config = json.loads(config)
                if config is None:
                    config = {}
            else:
                config = {}
        except (json.JSONDecodeError, KeyError, TypeError):
            config = {}

        if config is None:
            config = {}

        ingress = config.get("ingress", [])
        if not isinstance(ingress, list):
            ingress = []

        hostname = f"{subdomain}.{domain}"
        ingress = [r for r in ingress if r.get("hostname") != hostname]
        ingress.insert(0, {"hostname": hostname, "service": service_url})
        ingress = [r for r in ingress if r.get("service") != "http_status:404"]
        ingress.append({"service": "http_status:404"})

        config["ingress"] = ingress
        result = self._request("PUT", f"cfd_tunnel/{tunnel_id}/configurations", {"config": config})
        return_result = result.get("result", {})
        return return_result if isinstance(return_result, dict) else {}

    def ensure_dns_record(self, zone_id: str, subdomain: str, domain: str, tunnel_id: str) -> dict:
        dns_target = f"{tunnel_id}.cfargotunnel.com"
        records_url = f"{CF_API_BASE}/zones/{zone_id}/dns_records"
        record_name = f"{subdomain}.{domain}"

        response = requests.get(
            records_url,
            headers=self.headers,
            params={"name": record_name, "type": "CNAME"}
        )
        response.raise_for_status()
        result = response.json()

        if not result.get("success", False):
            raise Exception(f"Cloudflare API error: {result.get('errors', [])}")

        records = result.get("result", [])

        if records:
            record = records[0]
            existing_content = record.get("content", "").rstrip(".")
            if existing_content != dns_target.rstrip(".") or not record.get("proxied", False):
                response = requests.put(
                    f"{records_url}/{record['id']}",
                    headers=self.headers,
                    json={
                        "name": record_name,
                        "type": "CNAME",
                        "content": dns_target,
                        "ttl": 1,
                        "proxied": True,
                    }
                )
                response.raise_for_status()
                return response.json().get("result", {})
            return record
        else:
            response = requests.post(
                records_url,
                headers=self.headers,
                json={
                    "name": record_name,
                    "type": "CNAME",
                    "content": dns_target,
                    "ttl": 1,
                    "proxied": True,
                }
            )
            response.raise_for_status()
            return response.json().get("result", {})

    def get_zone_id(self, domain: str) -> str:
        response = requests.get(
            f"{CF_API_BASE}/zones",
            headers=self.headers,
            params={"name": domain}
        )
        response.raise_for_status()
        zones = response.json().get("result", [])
        if not zones:
            raise Exception(f"Domain {domain} not found")
        return zones[0]["id"]
