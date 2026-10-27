#!/usr/bin/env python3
"""Trusted preflight snapshot, executed in each task checkout. Never builds APK."""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET


def run(*args):
    subprocess.run(args, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--android', action='store_true')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='cadcraft-checks-') as directory:
        root = Path(directory)
        html = Path('app/src/main/assets/3d/index.html').read_text()
        if html.count('<script>') != 1 or html.count('</script>') != 1:
            raise ValueError('Unexpected embedded studio scripts')
        script = root / 'studio.js'
        script.write_text(html.split('<script>', 1)[1].split('</script>', 1)[0])
        run('node', '--check', str(script))
        run('node', 'scripts/check-3d-studio.cjs', str(script))
        run('node', '--check', 'app/src/main/assets/bridge/selection.js')
        run('node', 'scripts/check-selection-bridge.cjs', 'app/src/main/assets/bridge/selection.js')
        if Path('app/src/main/assets/bridge/files.js').exists():
            run('node', '--check', 'app/src/main/assets/bridge/files.js')
            run('node', 'scripts/check-file-bridge.cjs')
        patch = Path('scripts/patch-upstream-selection.py')
        compile(patch.read_text(), str(patch), 'exec')
        run('python3', 'scripts/check-upstream-selection-patch.py')
        # The original crate has no tracked lock/ignore file. Keep it unchanged.
        shutil.copytree('native3d', root / 'native3d', ignore=shutil.ignore_patterns('target'))
        run('cargo', 'test', '--offline', '--manifest-path', str(root / 'native3d/Cargo.toml'), '--all-targets', '-j', '4')
    if args.android:
        started = time.time_ns()
        run('gradle', '--no-daemon', '--max-workers=4', ':app:testDebugUnitTest', '--rerun')
        files = list(Path('app/build/test-results/testDebugUnitTest').glob('TEST-*.xml'))
        if not files or not all(p.stat().st_mtime_ns >= started for p in files):
            raise ValueError('Fresh Android results required')
        results = [ET.parse(p).getroot() for p in files]
        counts = {key: sum(int(r.get(key, '0')) for r in results) for key in ('tests', 'failures', 'errors', 'skipped')}
        if counts['tests'] <= 0 or any(counts[k] for k in ('failures', 'errors', 'skipped')):
            raise ValueError('Android suite did not fully pass: ' + str(counts))
        print('Android executed:', counts)


if __name__ == '__main__':
    main()
