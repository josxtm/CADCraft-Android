#!/usr/bin/env python3
"""Expose the active CADCraft 2D selection to its own browser window.

Applies only to the pinned upstream CADCraft v0.13.0 sources. Fails closed if
the upstream's expected structure changes, rather than silently shipping a
nonfunctional APK.
"""
from pathlib import Path
import sys

target = Path(sys.argv[1] if len(sys.argv) > 1 else "upstream/apps/cadcraft-web/src/main.rs")
source = target.read_text(encoding="utf-8")
hook = "            self.0.logic(ctx);\n"
insertion = "            self.0.logic(ctx);\n            publish_selected_entity(&self.0);\n"
anchor = "    /// Writes the browser's document title"
if source.count(hook) != 1 or source.count(anchor) != 1:
    raise SystemExit("Upstream CADCraft v0.13.0 code changed: bridge patch anchors missing")
if "publish_selected_entity" in source:
    raise SystemExit("Selection bridge already installed: refusing duplicate patch")

bridge = """    /// Expose exactly one selected, potentially extrudable entity to the Android UI.
    /// This is read-only: CADCraft keeps owning the drawing and its selection.
    /// Other entity types, no selection or multiple selections clear the bridge.
    fn publish_selected_entity(app: &CadApp) {
        use wasm_bindgen::JsValue;

        let payload = app.session.state().ok().and_then(|st| {
            if st.selection.len() != 1 {
                return None;
            }
            let handle = st.selection.iter().next()?;
            let entity = st.doc.entity(*handle)?;
            let kind = serde_json::to_value(&entity.kind).ok()?;
            let entity_type = kind.get("type").and_then(serde_json::Value::as_str)?;
            if entity_type != "lwPolyline" && entity_type != "circle" {
                return None;
            }
            serde_json::to_string(&serde_json::json!({
                "handle": entity.handle.hex(),
                "kind": kind
            })).ok()
        });

        if let Some(window) = web_sys::window() {
            let value = payload.map(JsValue::from_str).unwrap_or(JsValue::NULL);
            let _ = web_sys::js_sys::Reflect::set(
                window.as_ref(),
                &JsValue::from_str("__cadcraftSelected2D"),
                &value,
            );
        }
    }

"""
source = source.replace(hook, insertion, 1)
source = source.replace(anchor, bridge + anchor, 1)
target.write_text(source, encoding="utf-8")
print(f"Selection bridge inserted into {target}")
