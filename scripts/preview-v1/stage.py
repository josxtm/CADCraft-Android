"""Apply the versioned application-only preview integration to a real workspace."""
from pathlib import Path
import shutil


def stage(target, source):
    if len(target.resolve().parents) < 4:
        return source
    root = target.resolve().parents[3]
    if not (root / 'Cargo.toml').is_file():
        return source  # Preserve the existing minimal bridge fixtures.
    manifest = root / 'apps/cadcraft-web/Cargo.toml'
    lock = root / 'Cargo.lock'
    cargo = manifest.read_text()
    locked = lock.read_text()
    anchors = {
        'shell': '        Option<String>,\n    );',
        'create': 'Shell(app, inbox, host, reduced_motion, None)',
        'save': '            storage.set_string(cadcraft_ui_egui::PREFS_KEY, self.0.prefs_json());',
        'ui': '            self.0.ui(ui);',
    }
    if any(source.count(a) != 1 for a in anchors.values()):
        raise SystemExit('Preview v1 shell anchors changed')
    if cargo.count('[dependencies]\n') != 1 or locked.count('name = "cadcraft-web"\n') != 1:
        raise SystemExit('Preview v1 dependency anchors changed')
    if 'cadcraft-android-3d' in cargo or 'cadcraft-android-3d' in locked:
        raise SystemExit('Preview dependency already staged')
    source = source.replace(anchors['shell'], '        Option<String>,\n        crate::android_preview::Preview,\n    );')
    source = source.replace(anchors['create'], 'Shell(app, inbox, host, reduced_motion, None, crate::android_preview::Preview::load(cc.storage.and_then(|s| s.get_string(crate::android_preview::KEY))))')
    source = source.replace(anchors['save'], anchors['save'] + '\n            storage.set_string(crate::android_preview::KEY, self.5.snapshot());')
    source = source.replace(anchors['ui'], anchors['ui'] + '\n            self.5.ui(&self.0, ui.ctx());')
    source += '\n#[cfg(any(target_arch = "wasm32", test))]\nmod android_preview;\n'
    cargo = cargo.replace('[dependencies]\n', '[dependencies]\ncadcraft-android-3d = { path = "../../crates/cadcraft-android-3d" }\n')
    marker = '[[package]]\nname = "cadcraft-cli"'
    if locked.count(marker) != 1:
        raise SystemExit('Preview lock package anchor changed')
    locked = locked.replace(marker, '[[package]]\nname = "cadcraft-android-3d"\nversion = "0.1.0"\n\n' + marker)
    start = locked.index('name = "cadcraft-web"\n')
    before, after = locked[:start], locked[start:]
    after = after.replace('dependencies = [\n', 'dependencies = [\n "cadcraft-android-3d",\n', 1)
    package = root / 'crates/cadcraft-android-3d'
    if package.exists():
        raise SystemExit('Refusing to overwrite existing kernel copy')
    repo = Path(__file__).resolve().parents[2]
    shutil.copytree(repo / 'native3d', package, ignore=shutil.ignore_patterns('target', 'Cargo.lock'))
    shutil.copyfile(Path(__file__).with_name('android_preview.rs'), target.with_name('android_preview.rs'))
    manifest.write_text(cargo)
    lock.write_text(before + after)
    return source
