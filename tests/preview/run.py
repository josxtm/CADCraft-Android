#!/usr/bin/env python3
"""Offline feature tests against one fresh pinned upstream reference directory."""
from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile

repo = Path(__file__).resolve().parents[2]
reference = Path(sys.argv[1]).resolve()
env = os.environ.copy()
env['PATH'] = str(Path(env.get('CARGO_HOME', str(Path.home() / '.cargo'))) / 'bin') + os.pathsep + env.get('PATH', '')
with tempfile.TemporaryDirectory(prefix='cadcraft-preview-') as work:
    root = Path(work) / 'upstream'
    shutil.copytree(reference, root, ignore=shutil.ignore_patterns('target', '.git'))
    subprocess.run([sys.executable, str(repo / 'scripts/patch-upstream-selection.py'), str(root / 'apps/cadcraft-web/src/main.rs')], check=True)
    for original in (repo / 'native3d').rglob('*'):
        if original.is_file() and 'target' not in original.parts and original.name != 'Cargo.lock':
            assert original.read_bytes() == (root / 'crates/cadcraft-android-3d' / original.relative_to(repo / 'native3d')).read_bytes()
    original = (reference / 'apps/cadcraft-web/Cargo.toml').read_text()
    staged = (root / 'apps/cadcraft-web/Cargo.toml').read_text()
    assert staged.replace('cadcraft-android-3d = { path = "../../crates/cadcraft-android-3d" }\n','') == original
    locked = (root / 'Cargo.lock').read_text()
    assert locked.replace('[[package]]\nname = "cadcraft-android-3d"\nversion = "0.1.0"\n\n','').replace(' "cadcraft-android-3d",\n','') == (reference / 'Cargo.lock').read_text()
    module = root / 'apps/cadcraft-web/src/android_preview.rs'
    module.write_text(module.read_text() + '\n#[cfg(test)]\nmod integration_tests {\n' + (Path(__file__).with_name('integration.rs')).read_text() + '\n}\n')
    env.setdefault('CARGO_TARGET_DIR', str(Path(tempfile.gettempdir()) / 'cadcraft-preview-feature-target'))
    subprocess.run(['cargo','test','--offline','--locked','--manifest-path',str(root / 'Cargo.toml'),'-p','cadcraft-web','android_preview::integration_tests','-j','4'],env=env,check=True)
print('Preview feature tests and staging audits passed')
