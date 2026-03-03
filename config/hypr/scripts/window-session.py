#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import pathlib
import shlex
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Any

SNAPSHOT_VERSION = 1
DEFAULT_LAUNCH_DELAY_SEC = 0.08
DEFAULT_MAX_WINDOWS = 80

IGNORE_CLASSES = {
    "",
    "ags",
    "xwaylandvideobridge",
}

CLASS_COMMAND_HINTS: dict[str, list[str]] = {
    "code": ["code"],
    "firefox": ["firefox"],
    "google-chrome": ["google-chrome-stable"],
    "kitty": ["kitty"],
    "org.wezfurlong.wezterm": ["wezterm"],
    "spotify": ["spotify"],
}

NON_RESTORABLE_BINARIES = {
    "chrome_crashpad_handler",
    "plugin-container",
    "webkitnetworkprocess",
    "webkitwebprocess",
}

NON_RESTORABLE_ARG_PREFIXES = (
    "--type=",
    "--utility-sub-type=",
    "--field-trial-handle=",
    "--gpu-preferences=",
)

NON_RESTORABLE_ARGS = {
    "-contentproc",
}


def state_dir() -> pathlib.Path:
    xdg_state_home = os.environ.get("XDG_STATE_HOME")
    if xdg_state_home:
        return pathlib.Path(xdg_state_home) / "hypr"
    return pathlib.Path.home() / ".local" / "state" / "hypr"


def default_snapshot_path() -> pathlib.Path:
    return state_dir() / "window-session.json"


def run_hyprctl_json(target: str) -> Any:
    try:
        output = subprocess.check_output(
            ["hyprctl", "-j", target],
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise RuntimeError(f"hyprctl query failed for '{target}'") from error

    try:
        return json.loads(output or "null")
    except json.JSONDecodeError as error:
        raise RuntimeError(f"hyprctl returned invalid JSON for '{target}'") from error


def run_hyprctl_dispatch(action: str, argument: str) -> None:
    subprocess.run(
        ["hyprctl", "dispatch", action, argument],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def read_cmdline(pid: int) -> list[str]:
    if pid <= 1:
        return []
    proc_cmdline = pathlib.Path("/proc") / str(pid) / "cmdline"
    try:
        raw = proc_cmdline.read_bytes()
    except OSError:
        return []
    parts = [chunk for chunk in raw.split(b"\x00") if chunk]
    return [chunk.decode("utf-8", "replace") for chunk in parts]


def command_looks_restorable(command: list[str]) -> bool:
    if not command:
        return False

    binary = pathlib.Path(command[0]).name.lower()
    if binary in NON_RESTORABLE_BINARIES:
        return False

    for arg in command[1:]:
        if arg in NON_RESTORABLE_ARGS:
            return False
        for prefix in NON_RESTORABLE_ARG_PREFIXES:
            if arg.startswith(prefix):
                return False

    return True


def command_for_class(class_name: str) -> list[str]:
    key = class_name.strip().lower()
    if not key:
        return []

    hinted = CLASS_COMMAND_HINTS.get(key)
    if hinted and hinted[0] and shutil.which(hinted[0]):
        return hinted

    if shutil.which(key):
        return [key]

    raw = class_name.strip()
    if raw and shutil.which(raw):
        return [raw]

    return []


def workspace_id_from_client(client: dict[str, Any]) -> int:
    workspace = client.get("workspace")
    if isinstance(workspace, dict):
        raw_id = workspace.get("id")
    else:
        raw_id = None
    try:
        return int(raw_id)
    except (TypeError, ValueError):
        return -1


def class_from_client(client: dict[str, Any]) -> str:
    class_name = client.get("class")
    if isinstance(class_name, str) and class_name.strip():
        return class_name.strip()
    initial = client.get("initialClass")
    if isinstance(initial, str):
        return initial.strip()
    return ""


def should_skip_client(client: dict[str, Any]) -> bool:
    workspace_id = workspace_id_from_client(client)
    if workspace_id <= 0:
        return True

    class_name = class_from_client(client).lower()
    if class_name in IGNORE_CLASSES:
        return True

    return False


def save_snapshot(snapshot_path: pathlib.Path) -> int:
    try:
        clients = run_hyprctl_json("clients")
        workspaces = run_hyprctl_json("workspaces")
        active_workspace = run_hyprctl_json("activeworkspace")
    except RuntimeError as error:
        print(f"[window-session] {error}", file=sys.stderr)
        return 1

    if not isinstance(clients, list):
        clients = []
    if not isinstance(workspaces, list):
        workspaces = []

    windows: list[dict[str, Any]] = []
    for client in clients:
        if not isinstance(client, dict):
            continue
        if should_skip_client(client):
            continue

        workspace_id = workspace_id_from_client(client)
        class_name = class_from_client(client)

        pid = client.get("pid")
        try:
            pid_int = int(pid)
        except (TypeError, ValueError):
            pid_int = -1

        command = read_cmdline(pid_int)
        if command and not command_looks_restorable(command):
            command = []

        if not command:
            command = command_for_class(class_name)

        entry: dict[str, Any] = {
            "workspace": workspace_id,
            "class": class_name,
        }
        if command:
            entry["cmd"] = command

        windows.append(entry)

    windows.sort(
        key=lambda item: (
            int(item.get("workspace", 9999)),
            str(item.get("class", "")).lower(),
        )
    )

    workspace_layout: dict[str, str] = {}
    for item in workspaces:
        if not isinstance(item, dict):
            continue
        try:
            ws_id = int(item.get("id"))
        except (TypeError, ValueError):
            continue
        if ws_id <= 0:
            continue
        monitor_name = item.get("monitor")
        if isinstance(monitor_name, str) and monitor_name:
            workspace_layout[str(ws_id)] = monitor_name

    active_workspace_id = None
    if isinstance(active_workspace, dict):
        try:
            active_workspace_id = int(active_workspace.get("id"))
        except (TypeError, ValueError):
            active_workspace_id = None

    snapshot = {
        "version": SNAPSHOT_VERSION,
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "workspace_layout": workspace_layout,
        "active_workspace": active_workspace_id,
        "windows": windows,
    }

    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = snapshot_path.with_suffix(snapshot_path.suffix + ".tmp")
    temp_path.write_text(json.dumps(snapshot, ensure_ascii=True, indent=2) + "\n")
    temp_path.replace(snapshot_path)

    print(f"[window-session] saved {len(windows)} window(s) to {snapshot_path}")
    return 0


def int_from_unknown(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def normalize_command(command: Any, class_name: str) -> str:
    if isinstance(command, list):
        args = [str(item) for item in command if str(item).strip()]
        if args:
            return " ".join(shlex.quote(part) for part in args)

    fallback = command_for_class(class_name)
    if fallback:
        return " ".join(shlex.quote(part) for part in fallback)
    return ""


def restore_snapshot(
    snapshot_path: pathlib.Path,
    launch_delay_sec: float,
    max_windows: int,
) -> int:
    if not snapshot_path.exists():
        print(f"[window-session] snapshot not found: {snapshot_path}", file=sys.stderr)
        return 2

    try:
        payload = json.loads(snapshot_path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        print(f"[window-session] invalid snapshot: {error}", file=sys.stderr)
        return 2

    windows = payload.get("windows")
    if not isinstance(windows, list) or not windows:
        print("[window-session] no windows to restore", file=sys.stderr)
        return 2

    try:
        monitors = run_hyprctl_json("monitors")
    except RuntimeError as error:
        print(f"[window-session] {error}", file=sys.stderr)
        return 1
    current_monitors = set()
    if isinstance(monitors, list):
        for item in monitors:
            if isinstance(item, dict):
                name = item.get("name")
                if isinstance(name, str) and name:
                    current_monitors.add(name)

    workspace_layout = payload.get("workspace_layout")
    if isinstance(workspace_layout, dict):
        for raw_workspace, raw_monitor in workspace_layout.items():
            workspace_id = int_from_unknown(raw_workspace, -1)
            if workspace_id <= 0:
                continue
            monitor_name = str(raw_monitor)
            if monitor_name not in current_monitors:
                continue
            run_hyprctl_dispatch(
                "moveworkspacetomonitor",
                f"{workspace_id} {monitor_name}",
            )

    restored = 0
    for window in windows[:max_windows]:
        if not isinstance(window, dict):
            continue

        workspace_id = int_from_unknown(window.get("workspace"), -1)
        if workspace_id <= 0:
            continue

        class_name = str(window.get("class", ""))
        command = normalize_command(window.get("cmd"), class_name)
        if not command:
            continue

        run_hyprctl_dispatch(
            "exec",
            f"[workspace {workspace_id} silent] {command}",
        )
        restored += 1
        if launch_delay_sec > 0:
            time.sleep(launch_delay_sec)

    active_workspace = int_from_unknown(payload.get("active_workspace"), -1)
    if active_workspace > 0:
        run_hyprctl_dispatch("workspace", str(active_workspace))

    if restored <= 0:
        print("[window-session] nothing restored", file=sys.stderr)
        return 3

    print(f"[window-session] restored {restored} window(s) from {snapshot_path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="window-session.py",
        description="Save and restore Hyprland windows across sessions.",
    )
    parser.add_argument(
        "--path",
        default=str(default_snapshot_path()),
        help="Snapshot JSON path (default: ~/.local/state/hypr/window-session.json)",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("save", help="Save current Hyprland windows to snapshot")

    restore = subparsers.add_parser(
        "restore",
        help="Restore Hyprland windows from snapshot",
    )
    restore.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_LAUNCH_DELAY_SEC,
        help=f"Delay in seconds between launches (default: {DEFAULT_LAUNCH_DELAY_SEC})",
    )
    restore.add_argument(
        "--max-windows",
        type=int,
        default=DEFAULT_MAX_WINDOWS,
        help=f"Maximum windows to relaunch (default: {DEFAULT_MAX_WINDOWS})",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    snapshot_path = pathlib.Path(args.path).expanduser()

    if not shutil.which("hyprctl"):
        print("[window-session] hyprctl not found", file=sys.stderr)
        return 1

    if args.command == "save":
        return save_snapshot(snapshot_path)
    if args.command == "restore":
        return restore_snapshot(snapshot_path, args.delay, args.max_windows)
    parser.error(f"unsupported command: {args.command}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
