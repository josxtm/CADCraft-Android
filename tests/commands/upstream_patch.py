#!/usr/bin/env python3
"""Apply the complete application patch to a disposable pinned source fixture."""
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory

reference = Path(sys.argv[1])
with TemporaryDirectory() as temp:
    root = Path(temp)
    main = root / 'apps/cadcraft-web/src/main.rs'
    cmd = root / 'crates/ui-egui/src/cmdline.rs'
    for dest in (main, cmd):
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text((reference / dest.relative_to(root)).read_text())
    subprocess.run([sys.executable, 'scripts/patch-upstream-selection.py', str(main)], check=True)
    source = main.read_text()
    assert 'cadcraft_ui_egui::cmdline::submit(app);' in source
    assert 'Some("deselect") => app.session.set_selection(Vec::new())' in source
    assert source.index('android_command_input(&mut self.0);') < source.index('self.0.logic(ctx);')
    assert 'publish_android_command(&self.0, ui.ctx());' in source
    assert 'data.remove_temp::<[f32; 4]>' in source
    assert 'android-command-rect' in cmd.read_text()
    before = (source, cmd.read_text())
    result = subprocess.run([sys.executable, 'scripts/patch-upstream-selection.py', str(main)], capture_output=True)
    assert result.returncode != 0
    assert before == (main.read_text(), cmd.read_text())
print('Command patch: 8 assertions passed against pinned upstream')
