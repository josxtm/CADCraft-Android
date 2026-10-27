"""Stage exactly one versioned Rust/egui 3D preview into pinned CADCraft v0.13.0.

The ordinary selection-bridge fixture uses a shallow temp path. Skip staging
only when the target is NOT the actual CADCraft upstream web shell path.
Never infer parents[3] until the path suffix has been verified. Fail closed on
partial real upstream trees, changed Cargo anchors or preexisting integrations.
"""
from pathlib import Path
import shutil


def stage(target: Path, source: str) -> str:
    target = target.resolve()
    if tuple(target.parts[-4:]) != ("apps", "cadcraft-web", "src", "main.rs"):
        return source  # Existing minimal selection-only fixture.
    root = target.parents[3]
    if not (root / "Cargo.toml").is_file():
        raise SystemExit("3D preview: upstream workspace Cargo.toml missing")
    manifest = root / "apps/cadcraft-web/Cargo.toml"
    lock = root / "Cargo.lock"
    if not manifest.is_file() or not lock.is_file():
        raise SystemExit("3D preview: pinned Cargo manifest/lock missing")
    cargo = manifest.read_text()
    locked = lock.read_text()
    anchors = {
        "shell": "        Option<String>,\n    );",
        "create": "Shell(app, inbox, host, reduced_motion, None)",
        "save": "            storage.set_string(cadcraft_ui_egui::PREFS_KEY, self.0.prefs_json());",
        "ui": "            self.0.ui(ui);",
    }
    if any(source.count(anchor) != 1 for anchor in anchors.values()):
        raise SystemExit("3D preview: upstream web Shell anchors changed")
    if cargo.count("[dependencies]\n") != 1 or locked.count('name = "cadcraft-web"\n') != 1:
        raise SystemExit("3D preview: Cargo package anchors changed")
    if "cadcraft-android-3d" in cargo or 'name = "cadcraft-android-3d"' in locked:
        raise SystemExit("3D preview: dependency already staged")
    lock_marker = '[[package]]\nname = "cadcraft-cli"'
    if locked.count(lock_marker) != 1:
        raise SystemExit("3D preview: Cargo.lock package anchor changed")
    package = root / "crates/cadcraft-android-3d"
    if package.exists() or target.with_name("android_preview.rs").exists():
        raise SystemExit("3D preview: refusing to overwrite kernel or preview module")
    repo = Path(__file__).resolve().parents[2]
    kernel = repo / "native3d"
    preview = Path(__file__).with_name("android_preview.rs")
    if not (kernel / "Cargo.toml").is_file() or not preview.is_file():
        raise SystemExit("3D preview: source kernel or module missing")
    source = source.replace(anchors["shell"], "        Option<String>,\n        crate::android_preview::Preview,\n    );")
    source = source.replace(anchors["create"],
        "Shell(app, inbox, host, reduced_motion, None, "
        "crate::android_preview::Preview::load(cc.storage.and_then(|s| s.get_string(crate::android_preview::KEY))))")
    source = source.replace(anchors["save"], anchors["save"] +
        "\n            storage.set_string(crate::android_preview::KEY, self.5.snapshot());")
    source = source.replace(anchors["ui"], anchors["ui"] +
        "\n            self.5.ui(&self.0, ui.ctx());")
    module_anchor = '#[cfg(target_arch = "wasm32")]\nmod upload;'
    if source.count(module_anchor) != 1:
        raise SystemExit("3D preview: module anchor changed")
    source = source.replace(module_anchor,
        '#[cfg(any(target_arch = "wasm32", test))]\nmod android_preview;\n\n' + module_anchor)
    cargo = cargo.replace("[dependencies]\n",
        '[dependencies]\ncadcraft-android-3d = { path = "../../crates/cadcraft-android-3d" }\n', 1)
    locked = locked.replace(lock_marker,
        '[[package]]\nname = "cadcraft-android-3d"\nversion = "0.1.0"\n\n' + lock_marker, 1)
    start = locked.index('name = "cadcraft-web"\n')
    before, after = locked[:start], locked[start:]
    if after.count("dependencies = [\n") < 1:
        raise SystemExit("3D preview: web dependency block missing")
    after = after.replace("dependencies = [\n", 'dependencies = [\n "cadcraft-android-3d",\n', 1)
    # No original files are overwritten. This stage runs in a freshly cloned
    # upstream during a release build or isolated feature-test workflow.
    shutil.copytree(kernel, package, ignore=shutil.ignore_patterns("target", "Cargo.lock"))
    shutil.copyfile(preview, target.with_name("android_preview.rs"))
    manifest.write_text(cargo)
    lock.write_text(before + after)
    return source
