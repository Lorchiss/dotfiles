#!/usr/bin/env python3
"""Spotify API helper for AGS popup.

Commands:
- login
- like-status --track-id <id>
- toggle-like --track-id <id>
- accent --cover <path>
"""

from __future__ import annotations

import argparse
import base64
import colorsys
import hashlib
import json
import os
import secrets
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

AUTH_HOST = "127.0.0.1"
AUTH_PORT = 8898
REDIRECT_URI = f"http://{AUTH_HOST}:{AUTH_PORT}/callback"
SCOPES = "user-library-read user-library-modify"
SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"
TRACK_ID_PATTERN = r"^[A-Za-z0-9]{22}$"
ACCESS_TOKEN_LEEWAY = 45


class SpotifyApiError(Exception):
    """Raised for expected Spotify API failures."""


@dataclass
class CallbackResult:
    code: str | None
    state: str | None
    error: str | None


def auth_file_path() -> Path:
    xdg_config = os.environ.get("XDG_CONFIG_HOME")
    if xdg_config:
        base = Path(xdg_config)
    else:
        base = Path.home() / ".config"
    return base / "ags" / "private" / "spotify-auth.json"


def ensure_private_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(path.parent, 0o700)
    except OSError:
        pass


def load_auth_data() -> dict[str, Any]:
    path = auth_file_path()
    if not path.exists():
        return {}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SpotifyApiError(f"No se pudo leer {path}: {exc}") from exc

    if not isinstance(data, dict):
        raise SpotifyApiError(f"Formato inválido en {path}")
    return data


def save_auth_data(data: dict[str, Any]) -> None:
    path = auth_file_path()
    ensure_private_dir(path)

    payload = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
    path.write_text(payload + "\n", encoding="utf-8")

    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def now_epoch() -> int:
    return int(time.time())


def json_response(payload: dict[str, Any], exit_code: int = 0) -> int:
    print(json.dumps(payload, ensure_ascii=False))
    return exit_code


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def create_pkce_pair() -> tuple[str, str]:
    verifier = b64url(secrets.token_bytes(64))
    challenge = b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def open_browser(url: str) -> None:
    try:
        result = subprocess.run(
            ["xdg-open", url],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if int(result.returncode) != 0:
            raise SpotifyApiError("xdg-open devolvió código no exitoso")
    except Exception as exc:
        raise SpotifyApiError(f"No se pudo abrir navegador con xdg-open: {exc}") from exc


def wait_for_oauth_callback(expected_state: str, timeout: int = 180) -> str:
    received = CallbackResult(code=None, state=None, error=None)
    done = threading.Event()

    class CallbackHandler(BaseHTTPRequestHandler):
        def log_message(self, _format: str, *_args: Any) -> None:
            return

        def do_GET(self) -> None:  # noqa: N802
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path != "/callback":
                self.send_response(404)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(b"Not Found")
                return

            query = urllib.parse.parse_qs(parsed.query)
            received.code = (query.get("code") or [None])[0]
            received.state = (query.get("state") or [None])[0]
            received.error = (query.get("error") or [None])[0]

            ok = bool(received.code) and received.state == expected_state and not received.error
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()

            if ok:
                body = """<!doctype html><html><body style=\"font-family:sans-serif;padding:24px\"><h2>Spotify conectado</h2><p>Puedes cerrar esta pestaña y volver a AGS.</p></body></html>"""
            else:
                body = """<!doctype html><html><body style=\"font-family:sans-serif;padding:24px\"><h2>Error de autenticación</h2><p>Regresa a AGS para ver el detalle.</p></body></html>"""
            self.wfile.write(body.encode("utf-8"))
            done.set()

    try:
        httpd = HTTPServer((AUTH_HOST, AUTH_PORT), CallbackHandler)
    except OSError as exc:
        raise SpotifyApiError(
            f"No se pudo abrir {AUTH_HOST}:{AUTH_PORT}. Cierra el proceso que use ese puerto."
        ) from exc

    httpd.timeout = 0.5
    started = time.monotonic()
    try:
        while not done.is_set():
            httpd.handle_request()
            if time.monotonic() - started > timeout:
                raise SpotifyApiError("Timeout esperando callback OAuth de Spotify")
    finally:
        httpd.server_close()

    if received.error:
        raise SpotifyApiError(f"Spotify devolvió error OAuth: {received.error}")
    if received.state != expected_state:
        raise SpotifyApiError("Estado OAuth inválido")
    if not received.code:
        raise SpotifyApiError("No se recibió código OAuth")

    return received.code


def http_post_form(url: str, payload: dict[str, str]) -> dict[str, Any]:
    body = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read().decode("utf-8", errors="replace")
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
            raise SpotifyApiError("Respuesta inválida del token endpoint")
    except urllib.error.HTTPError as exc:
        body_raw = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body_raw)
            detail = parsed.get("error_description") or parsed.get("error") or body_raw
        except Exception:
            detail = body_raw or str(exc)
        raise SpotifyApiError(f"Error token endpoint: {detail}") from exc
    except urllib.error.URLError as exc:
        raise SpotifyApiError(f"No se pudo conectar al token endpoint: {exc}") from exc


def update_tokens(auth: dict[str, Any], token_payload: dict[str, Any]) -> dict[str, Any]:
    access_token = str(token_payload.get("access_token") or "").strip()
    if not access_token:
        raise SpotifyApiError("Respuesta de token sin access_token")

    expires_in_raw = token_payload.get("expires_in")
    try:
        expires_in = int(expires_in_raw)
    except Exception:
        expires_in = 3600

    auth["access_token"] = access_token
    auth["token_type"] = str(token_payload.get("token_type") or "Bearer")
    refresh = str(token_payload.get("refresh_token") or "").strip()
    if refresh:
        auth["refresh_token"] = refresh

    scope = str(token_payload.get("scope") or "").strip()
    if scope:
        auth["scope"] = scope

    auth["expires_at"] = now_epoch() + max(30, expires_in)
    auth["updated_at"] = now_epoch()
    return auth


def run_login() -> dict[str, Any]:
    auth = load_auth_data()
    client_id = str(auth.get("client_id") or "").strip()
    if not client_id:
        path = auth_file_path()
        raise SpotifyApiError(
            "Falta client_id. Configura "
            f"{path} con tu Spotify client_id y vuelve a intentar."
        )

    verifier, challenge = create_pkce_pair()
    state = secrets.token_urlsafe(24)

    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "code_challenge_method": "S256",
        "code_challenge": challenge,
        "state": state,
    }
    auth_url = f"{SPOTIFY_AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"

    open_browser(auth_url)
    code = wait_for_oauth_callback(state)

    token_payload = http_post_form(
        SPOTIFY_TOKEN_URL,
        {
            "grant_type": "authorization_code",
            "client_id": client_id,
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
        },
    )

    updated = update_tokens(auth, token_payload)
    save_auth_data(updated)

    return {
        "ok": True,
        "authorized": True,
        "message": "Spotify API conectada",
        "authFile": str(auth_file_path()),
    }


def refresh_access_token(auth: dict[str, Any]) -> dict[str, Any]:
    client_id = str(auth.get("client_id") or "").strip()
    refresh_token = str(auth.get("refresh_token") or "").strip()

    if not client_id:
        raise SpotifyApiError("Falta client_id en spotify-auth.json")
    if not refresh_token:
        raise SpotifyApiError("No hay refresh_token. Usa el botón Conectar")

    token_payload = http_post_form(
        SPOTIFY_TOKEN_URL,
        {
            "grant_type": "refresh_token",
            "client_id": client_id,
            "refresh_token": refresh_token,
        },
    )

    updated = update_tokens(auth, token_payload)
    save_auth_data(updated)
    return updated


def get_valid_access_token() -> tuple[str, dict[str, Any]]:
    auth = load_auth_data()

    access = str(auth.get("access_token") or "").strip()
    expires_at_raw = auth.get("expires_at")
    try:
        expires_at = int(expires_at_raw)
    except Exception:
        expires_at = 0

    if access and expires_at > now_epoch() + ACCESS_TOKEN_LEEWAY:
        return access, auth

    if auth.get("refresh_token"):
        refreshed = refresh_access_token(auth)
        access = str(refreshed.get("access_token") or "").strip()
        if access:
            return access, refreshed

    raise SpotifyApiError("No hay sesión Spotify API válida. Usa Conectar")


def api_request(
    method: str,
    path: str,
    token: str,
    params: dict[str, str] | None = None,
) -> tuple[int, Any]:
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    url = f"{SPOTIFY_API_BASE}{path}{query}"

    req = urllib.request.Request(
        url,
        method=method.upper(),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            status = int(response.status)
            raw = response.read().decode("utf-8", errors="replace")
            if not raw.strip():
                return status, None
            try:
                return status, json.loads(raw)
            except Exception:
                return status, raw
    except urllib.error.HTTPError as exc:
        status = int(exc.code)
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = raw
        return status, parsed
    except urllib.error.URLError as exc:
        raise SpotifyApiError(f"Error de red al llamar Spotify API: {exc}") from exc


def call_api_with_refresh(
    method: str,
    path: str,
    params: dict[str, str] | None = None,
) -> tuple[int, Any, bool]:
    token, auth = get_valid_access_token()
    status, payload = api_request(method, path, token, params=params)
    if status != 401:
        return status, payload, True

    if not auth.get("refresh_token"):
        return status, payload, False

    refreshed = refresh_access_token(auth)
    token = str(refreshed.get("access_token") or "").strip()
    if not token:
        return status, payload, False

    status, payload = api_request(method, path, token, params=params)
    return status, payload, True


def is_valid_track_id(track_id: str) -> bool:
    import re

    return bool(re.match(TRACK_ID_PATTERN, track_id))


def run_like_status(track_id: str) -> dict[str, Any]:
    clean_track = track_id.strip()
    if not is_valid_track_id(clean_track):
        raise SpotifyApiError("Track ID inválido")

    status, payload, authorized = call_api_with_refresh(
        "GET", "/me/tracks/contains", params={"ids": clean_track}
    )

    if status == 200 and isinstance(payload, list) and payload:
        liked = bool(payload[0])
        return {
            "ok": True,
            "authorized": True,
            "liked": liked,
            "message": "Estado de favoritos leído",
        }

    if status in {401, 403}:
        return {
            "ok": False,
            "authorized": False,
            "liked": False,
            "message": "Sesión Spotify API no autorizada",
        }

    message = "No se pudo consultar favoritos"
    if isinstance(payload, dict):
        message = str(payload.get("error", {}).get("message") or message)

    return {
        "ok": False,
        "authorized": authorized,
        "liked": False,
        "message": message,
    }


def run_toggle_like(track_id: str) -> dict[str, Any]:
    clean_track = track_id.strip()
    if not is_valid_track_id(clean_track):
        raise SpotifyApiError("Track ID inválido")

    current = run_like_status(clean_track)
    if not current.get("authorized"):
        return {
            "ok": False,
            "authorized": False,
            "liked": False,
            "message": str(current.get("message") or "No autorizado"),
        }

    currently_liked = bool(current.get("liked"))
    method = "DELETE" if currently_liked else "PUT"

    status, payload, authorized = call_api_with_refresh(
        method,
        "/me/tracks",
        params={"ids": clean_track},
    )

    if status in {200, 201, 202, 204}:
        return {
            "ok": True,
            "authorized": True,
            "liked": not currently_liked,
            "message": "Eliminado de favoritos" if currently_liked else "Guardado en favoritos",
        }

    if status in {401, 403}:
        return {
            "ok": False,
            "authorized": False,
            "liked": currently_liked,
            "message": "Sesión Spotify API no autorizada",
        }

    message = "No se pudo actualizar favoritos"
    if isinstance(payload, dict):
        message = str(payload.get("error", {}).get("message") or message)

    return {
        "ok": False,
        "authorized": authorized,
        "liked": currently_liked,
        "message": message,
    }


def hue_to_accent_class(hue_deg: float, sat: float, val: float) -> str:
    if sat < 0.12 or val < 0.2:
        return "spotify-accent-default"

    if 35 <= hue_deg < 70:
        return "spotify-accent-amber"
    if 70 <= hue_deg < 170:
        return "spotify-accent-emerald"
    if 170 <= hue_deg < 215:
        return "spotify-accent-cyan"
    if 215 <= hue_deg < 290:
        return "spotify-accent-blue"
    return "spotify-accent-rose"


def run_accent(cover_path: str) -> dict[str, Any]:
    clean_path = cover_path.strip()
    if not clean_path:
        return {
            "ok": True,
            "accentClass": "spotify-accent-default",
            "message": "Sin portada",
        }

    image_path = Path(clean_path)
    if not image_path.exists() or not image_path.is_file():
        return {
            "ok": True,
            "accentClass": "spotify-accent-default",
            "message": "Portada no encontrada",
        }

    try:
        from PIL import Image
    except Exception:
        return {
            "ok": True,
            "accentClass": "spotify-accent-default",
            "message": "Pillow no disponible",
        }

    try:
        with Image.open(image_path) as img:
            rgb = img.convert("RGB")
            rgb.thumbnail((80, 80))
            quantized = rgb.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
            colors = quantized.getcolors(maxcolors=2048) or []
            palette = quantized.getpalette() or []

            best_score = -1.0
            best_hsv = (0.0, 0.0, 0.0)

            for item in colors:
                count, palette_index = item
                base = int(palette_index) * 3
                if base + 2 >= len(palette):
                    continue
                r = palette[base]
                g = palette[base + 1]
                b = palette[base + 2]
                h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                score = float(count) * (0.4 + s * 0.9) * (0.5 + v * 0.5)
                if score > best_score:
                    best_score = score
                    best_hsv = (h, s, v)

            h, s, v = best_hsv
            accent = hue_to_accent_class(h * 360.0, s, v)
            return {
                "ok": True,
                "accentClass": accent,
                "message": "Acento calculado",
            }
    except Exception as exc:
        return {
            "ok": True,
            "accentClass": "spotify-accent-default",
            "message": f"No se pudo calcular acento: {exc}",
        }


def run_cli(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Spotify API helper for AGS")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("login", help="Start OAuth PKCE login")

    like_status = sub.add_parser("like-status", help="Read liked state")
    like_status.add_argument("--track-id", required=True)

    toggle_like = sub.add_parser("toggle-like", help="Toggle liked state")
    toggle_like.add_argument("--track-id", required=True)

    accent = sub.add_parser("accent", help="Resolve accent class from cover")
    accent.add_argument("--cover", required=True)

    args = parser.parse_args(argv)

    try:
        if args.command == "login":
            return json_response(run_login())
        if args.command == "like-status":
            return json_response(run_like_status(args.track_id))
        if args.command == "toggle-like":
            return json_response(run_toggle_like(args.track_id))
        if args.command == "accent":
            return json_response(run_accent(args.cover))

        return json_response({"ok": False, "message": "Comando no soportado"}, exit_code=0)
    except SpotifyApiError as exc:
        return json_response(
            {
                "ok": False,
                "authorized": False,
                "liked": False,
                "accentClass": "spotify-accent-default",
                "message": str(exc),
            },
            exit_code=0,
        )
    except Exception as exc:
        return json_response(
            {
                "ok": False,
                "authorized": False,
                "liked": False,
                "accentClass": "spotify-accent-default",
                "message": f"Error inesperado: {exc}",
            },
            exit_code=0,
        )


if __name__ == "__main__":
    sys.exit(run_cli(sys.argv[1:]))
