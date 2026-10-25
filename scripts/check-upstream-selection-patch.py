#!/usr/bin/env python3
"""Regression checks for the build-time upstream CADCraft selection patch.

This catches invalid patch anchors, duplicate injection, and the specific
Option<String> / JsValue::from_str type mismatch fixed after v0.3.0 CI failed.
It is only a structural test; the WebAssembly compiler remains authoritative.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess
import sys

script = Path(__file__).with_name("patch-upstream-selection.py").resolve()
upstream_stub = (
    "mod web {\n"
    "    struct CadApp;\n"
    "    fn mock_logic(&mut self, ctx: &Context) {\n"
    "            self.0.logic(ctx);\n"
    "    }\n"
    "    /// Writes the browser's document title\n"
    "}\n"
)
with TemporaryDirectory() as temp:
    path = Path(temp) / "main.rs"
    path.write_text(upstream_stub, encoding="utf-8")
    first = subprocess.run([sys.executable, str(script), str(path)], capture_output=True, text=True)
    if first.returncode != 0:
        raise SystemExit(f"Patch first invocation failed: {first.stderr}")
    patched = path.read_text(encoding="utf-8")
    required = [
        "publish_selected_entity(&self.0);",
        "fn publish_selected_entity(app: &CadApp)",
        "payload.as_deref().map(JsValue::from_str)",
        "__cadcraftSelected2D",
        "serde_json::to_value(&entity.kind)",
    ]
    for marker in required:
        if marker not in patched:
            raise SystemExit(f"Patch missing required marker: {marker}")
    if "payload.map(JsValue::from_str)" in patched:
        raise SystemExit("Regression: Option<String> passed to JsValue::from_str")
    if patched.count("fn publish_selected_entity(") != 1:
        raise SystemExit("Duplicate bridge function injection")
    second = subprocess.run([sys.executable, str(script), str(path)], capture_output=True, text=True)
    if second.returncode == 0:
        raise SystemExit("Patch unexpectedly allowed a second injection")
    if path.read_text(encoding="utf-8") != patched:
        raise SystemExit("Duplicate patch attempt changed previously patched source")
print("Selection Rust source patch tests passed")
