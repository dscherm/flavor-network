#!/usr/bin/env python3
"""PreToolUse hook on Edit|Write|NotebookEdit: inject design context for UI files.

When the file being edited is a UI file, print one JSON object whose
`hookSpecificOutput.additionalContext` carries design/DESIGN.md, the active
bead's design brief (<state_dir>/design/<task_id>.md) and a short checklist.
Any other file, and any malformed or oversized input, prints nothing. It never
blocks a tool call and always exits 0.

Copied into each project, so it cannot import the harness resolver; the state
dir lookup below is an inlined copy of tools/_internal/paths (new name first,
legacy second, NEW when neither exists).
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

UI_DIRS = ("ui", "scenes/ui")
UI_SUFFIXES = (".css", ".scss", ".tsx", ".jsx", ".html", ".vue", ".svelte")

CHECKLIST = (
    "Design checklist for this UI edit:\n"
    "- Take values from the design tokens in DESIGN.md; do not invent new tokens.\n"
    "- Cover all states: default, hover, pressed, disabled, focused, empty, error.\n"
    "- Respect the minimum control size for touch and pointer targets.\n"
    "- Give every interactive control a visible focus indicator and keyboard reachability.\n"
    "- No literal colour values (hex, rgb, Color(...)) in UI code; reference a token."
)

MISSING_LINE = "design/DESIGN.md is missing"

_STATE_DIR_NAMES = (".schermness", ".ralph")
_MAX_STDIN = 1_000_000
_MAX_FILE = 200_000
_TASK_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_NODE_ROOT_RE = re.compile(r'^\[node\s+name="[^"]*"\s+type="([^"]+)"', re.M)
_CONTROL_TYPES = {
    "Control", "Panel", "PanelContainer", "Container", "BoxContainer", "VBoxContainer",
    "HBoxContainer", "MarginContainer", "CenterContainer", "GridContainer", "FlowContainer",
    "ScrollContainer", "TabContainer", "TabBar", "SplitContainer", "HSplitContainer",
    "VSplitContainer", "AspectRatioContainer", "SubViewportContainer", "Label", "RichTextLabel",
    "Button", "LinkButton", "CheckBox", "CheckButton", "OptionButton", "MenuButton",
    "TextureButton", "ColorPickerButton", "LineEdit", "TextEdit", "CodeEdit", "ItemList",
    "Tree", "ProgressBar", "TextureProgressBar", "TextureRect", "ColorRect", "NinePatchRect",
    "HSlider", "VSlider", "SpinBox", "HScrollBar", "VScrollBar", "Range", "Popup", "PopupMenu",
    "PopupPanel", "Window", "ReferenceRect", "GraphEdit", "GraphNode", "VideoStreamPlayer",
}


def _state_dir(root: Path) -> Path:
    for name in _STATE_DIR_NAMES:
        if (root / name).is_dir():
            return root / name
    return root / _STATE_DIR_NAMES[0]


def _read(path: Path) -> str | None:
    try:
        if not path.is_file():
            return None
        with open(path, "rb") as fh:
            text = fh.read(_MAX_FILE).decode("utf-8", errors="replace")
        return "\n".join(text.splitlines())
    except (OSError, ValueError):
        return None


def _relative(path: str | Path, project: Path | None) -> Path:
    p = Path(path)
    if project is not None and p.is_absolute():
        try:
            return p.relative_to(project)
        except ValueError:
            try:
                return p.resolve().relative_to(Path(project).resolve())
            except (ValueError, OSError):
                return p
    return p


def _control_root(text: str) -> bool:
    m = _NODE_ROOT_RE.search(text)
    return bool(m) and m.group(1) in _CONTROL_TYPES


def is_ui_file(path: str | Path, project: Path | None = None) -> bool:
    if not isinstance(path, (str, Path)):
        raise TypeError("path must be str or Path")
    proj = Path(project) if project is not None else None
    rel = _relative(path, proj)
    name = rel.name.lower()
    suffix = rel.suffix.lower()
    if suffix == ".tres" and "theme" in name:
        return True
    if suffix == ".tscn":
        full = rel if (rel.is_absolute() or proj is None) else proj / rel
        text = _read(full)
        if text is not None and _control_root(text):
            return True
    if suffix in UI_SUFFIXES:
        return True
    parts = [x.lower() for x in rel.parts]
    for d in UI_DIRS:
        want = d.split("/")
        n = len(want)
        if any(parts[i:i + n] == want for i in range(len(parts) - n + 1)):
            return True
    return False


def build_context(project: Path, file_path: str, task_id: str | None) -> str:
    project = Path(project)
    chunks: list[str] = []
    design = _read(project / "design" / "DESIGN.md")
    chunks.append(design.strip() if design is not None else MISSING_LINE)
    if isinstance(task_id, str) and _TASK_ID_RE.match(task_id) and ".." not in task_id:
        brief = _read(_state_dir(project) / "design" / f"{task_id}.md")
        if brief is not None:
            chunks.append(brief.strip())
    chunks.append(CHECKLIST)
    return "\n\n".join(chunks)


def active_task_id(project: Path) -> str | None:
    text = _read(_state_dir(Path(project)) / "bridge-state.json")
    if text is None:
        return None
    try:
        data = json.loads(text)
        for t in data.get("tasks", []):
            if isinstance(t, dict) and t.get("status") == "active" and isinstance(t.get("id"), str):
                return t["id"]
    except (ValueError, AttributeError, TypeError):
        pass
    return None


def main() -> int:
    try:
        raw = sys.stdin.read(_MAX_STDIN + 1)
        if not raw.strip() or len(raw) > _MAX_STDIN:
            return 0
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            return 0
        tin = payload.get("tool_input")
        if not isinstance(tin, dict):
            return 0
        fp = tin.get("file_path") or tin.get("notebook_path")
        if not isinstance(fp, str) or not fp.strip():
            return 0
        cwd = payload.get("cwd")
        if isinstance(cwd, str) and cwd.strip():
            project = Path(cwd)
        else:
            project = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
        if not is_ui_file(fp, project):
            return 0
        ctx = build_context(project, fp, active_task_id(project))
        sys.stdout.write(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse", "additionalContext": ctx}}) + "\n")
    except Exception:
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
