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
            let value = payload.as_deref().map(JsValue::from_str).unwrap_or(JsValue::NULL);
            let _ = web_sys::js_sys::Reflect::set(
                window.as_ref(),
                &JsValue::from_str("__cadcraftSelected2D"),
                &value,
            );
        }
    }

"""
# Keep this optional for the existing minimal selection-only fixture. Real pinned
# sources always contain the UI hook; validate the companion file before writing.
ui_hook = "            self.0.ui(ui);\n"
if ui_hook in source:
    cmdline = target.parents[3] / "crates/ui-egui/src/cmdline.rs"
    cmd_source = cmdline.read_text(encoding="utf-8")
    cmd_anchor = "    let g = p.layout_no_wrap(app.cmd.buffer.clone(), font, t.text);"
    if source.count(ui_hook) != 1 or cmd_source.count(cmd_anchor) != 1:
        raise SystemExit("Upstream command input anchors changed")
    cmd_source = cmd_source.replace(cmd_anchor, """    // Geometry in egui points; the Android HTML input leaves prompt keywords
    // and the history chevron available to the original canvas.
    ui.ctx().data_mut(|data| data.insert_temp(
        egui::Id::new("android-command-rect"),
        [x, bar.top(), (bar.right() - 28.0 - x).max(0.0), bar.height()],
    ));
""" + cmd_anchor)
    source = source.replace(hook, "            android_command_input(&mut self.0);\n" + hook)
    source = source.replace(ui_hook, ui_hook + "            publish_android_command(&self.0, ui.ctx());\n")
    source = source.replace(anchor, """    // A DOM input owns IME composition. Only complete submissions reach the
    // same handler used by the desktop command line (history, prompts, Enter).
    fn android_command_input(app: &mut CadApp) {
        use web_sys::js_sys::Reflect;
        use wasm_bindgen::JsValue;
        let Some(window) = web_sys::window() else { return };
        let draft_key = JsValue::from_str("__cadcraftCommandDraft");
        if let Some(draft) = Reflect::get(window.as_ref(), &draft_key).ok().and_then(|v| v.as_string()) {
            let _ = Reflect::set(window.as_ref(), &draft_key, &JsValue::NULL);
            if draft.len() <= 65536 {
                app.cmd.buffer = draft;
                app.cmd.note_typing();
            }
        }
        let key = JsValue::from_str("__cadcraftCommandRequest");
        let Some(request) = Reflect::get(window.as_ref(), &key).ok().and_then(|v| v.as_string()) else { return };
        let _ = Reflect::set(window.as_ref(), &key, &JsValue::NULL);
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&request) else { return };
        match value.get("action").and_then(|v| v.as_str()) {
            Some("submit") => {
                if let Some(text) = value.get("text").and_then(|v| v.as_str()).filter(|s| s.len() <= 65536) {
                    app.cmd.buffer = text.to_owned();
                    app.cmd.note_typing();
                    cadcraft_ui_egui::cmdline::submit(app);
                }
            }
            Some("deselect") => app.session.set_selection(Vec::new()),
            _ => {}
        }
    }

    fn publish_android_command(app: &CadApp, ctx: &egui::Context) {
        use wasm_bindgen::JsValue;
        let Some(window) = web_sys::window() else { return };
        // Remove stale geometry if the command line was hidden this frame.
        let rect = ctx.data_mut(|data| data.remove_temp::<[f32; 4]>(egui::Id::new("android-command-rect")));
        let state = serde_json::json!({
            "rect": rect, "buffer": app.cmd.buffer,
            "width": ctx.content_rect().width(), "height": ctx.content_rect().height()
        });
        let _ = web_sys::js_sys::Reflect::set(window.as_ref(),
            &JsValue::from_str("__cadcraftCommandState"), &JsValue::from_str(&state.to_string()));
        // DOM submissions must wake an otherwise idle canvas, even with the IME open.
        if web_sys::js_sys::Reflect::get(window.as_ref(), &JsValue::from_str("__cadcraftCommandsInstalled"))
            .ok().and_then(|v| v.as_bool()).unwrap_or(false) {
            ctx.request_repaint_after(std::time::Duration::from_millis(50));
        }
    }

""" + anchor)
    cmdline.write_text(cmd_source, encoding="utf-8")

source = source.replace(hook, insertion, 1)
source = source.replace(anchor, bridge + anchor, 1)
# Real Cargo workspaces receive the versioned Rust/egui application integration.
import importlib.util
preview_spec = importlib.util.spec_from_file_location("android_preview_stage", Path(__file__).with_name("preview-v1") / "stage.py")
preview_stage = importlib.util.module_from_spec(preview_spec)
preview_spec.loader.exec_module(preview_stage)
source = preview_stage.stage(target, source)
target.write_text(source, encoding="utf-8")
print(f"Selection bridge inserted into {target}")
