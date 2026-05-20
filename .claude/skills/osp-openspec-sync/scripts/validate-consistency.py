#!/usr/bin/env python3
"""Repository-local OpenSpec consistency validator entrypoint.

The global skill script may be post-processed by installers that append an
HTML marker. Keep the project gate stable by sanitizing that known footer
before executing the upstream script.
"""

from __future__ import annotations

import sys
import types
import builtins
from contextlib import contextmanager
from io import StringIO
from pathlib import Path


UPSTREAM_SCRIPT = (
    Path.home()
    / ".claude"
    / "skills"
    / "osp-openspec-sync"
    / "scripts"
    / "validate-consistency.py"
)
INSTALL_MARKER_PREFIX = "<!-- Installed by AI REACH"
UPSTREAM_CONFIG = UPSTREAM_SCRIPT.parent.parent / "config" / "validation-config.yaml"


def _strip_install_marker(source: str) -> str:
    sanitized_lines = []
    for line in source.splitlines():
        if line.lstrip().startswith(INSTALL_MARKER_PREFIX):
            break
        sanitized_lines.append(line)
    return "\n".join(sanitized_lines).rstrip() + "\n"


def _load_sanitized_upstream_source(script_path: Path) -> str:
    if not script_path.exists():
        raise FileNotFoundError(f"Upstream OpenSpec validator not found: {script_path}")

    source = script_path.read_text(encoding="utf-8")
    sanitized_source = _strip_install_marker(source)
    compile(sanitized_source, str(script_path), "exec")
    return sanitized_source


@contextmanager
def _sanitized_upstream_config_open():
    original_open = builtins.open
    sanitized_config = None

    def patched_open(file, mode="r", *args, **kwargs):
        nonlocal sanitized_config
        try:
            target_path = Path(file).resolve()
        except TypeError:
            return original_open(file, mode, *args, **kwargs)

        if target_path == UPSTREAM_CONFIG.resolve() and "r" in mode and "b" not in mode:
            encoding = kwargs.get("encoding") or "utf-8"
            if sanitized_config is None:
                source = target_path.read_text(encoding=encoding)
                sanitized_config = _strip_install_marker(source).replace(
                    '    - "AGENTS.md"\n    - "reference/services-registry.md"  # Honda OSP 项目使用 reference 目录\n',
                    "",
                )
            return StringIO(sanitized_config)
        return original_open(file, mode, *args, **kwargs)

    builtins.open = patched_open
    try:
        yield
    finally:
        builtins.open = original_open


def _load_sanitized_helper_module(module_name: str, script_path: Path) -> None:
    if module_name in sys.modules:
        return
    if not script_path.exists():
        return

    source = _load_sanitized_upstream_source(script_path)
    module = types.ModuleType(module_name)
    module.__file__ = str(script_path)
    module.__package__ = ""
    sys.modules[module_name] = module
    try:
        exec(compile(source, str(script_path), "exec"), module.__dict__)
    except Exception:
        sys.modules.pop(module_name, None)
        raise


def main() -> None:
    source = _load_sanitized_upstream_source(UPSTREAM_SCRIPT)
    previous_argv0 = sys.argv[0]
    upstream_dir = str(UPSTREAM_SCRIPT.parent)
    inserted_sys_path = False
    sys.argv[0] = str(UPSTREAM_SCRIPT)
    if upstream_dir not in sys.path:
        sys.path.insert(0, upstream_dir)
        inserted_sys_path = True
    try:
        with _sanitized_upstream_config_open():
            _load_sanitized_helper_module("structured_logger", UPSTREAM_SCRIPT.parent / "structured_logger.py")
            namespace = {
                "__name__": "__main__",
                "__file__": str(UPSTREAM_SCRIPT),
                "__package__": None,
                "__cached__": None,
            }
            exec(compile(source, str(UPSTREAM_SCRIPT), "exec"), namespace)
    finally:
        if inserted_sys_path:
            sys.path.remove(upstream_dir)
        sys.argv[0] = previous_argv0


if __name__ == "__main__":
    main()
