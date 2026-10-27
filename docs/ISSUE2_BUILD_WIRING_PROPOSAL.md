# Issue #2: local Rust/egui integration v1

The owner authorized the local kernel path dependency and matching lock entries.
`scripts/patch-upstream-selection.py <upstream-main.rs>` now stages the versioned
application module in `scripts/preview-v1/` when a real Cargo workspace exists.
The existing minimal selection and command-input fixtures remain supported.
No workflow, Gradle, controller, queue, existing test or original native3d file
is changed. The staged kernel is copied from native3d without source changes.
There are no new external dependencies.

The web shell owns PreviewState. Original CADCraft 2D drawing and command/IME
integration remain in place. A separate egui window provides EXTRUIR height in
millimetres, source selection validation, fit/clear, mesh picking, a projected
ViewCube with face snapping and incremental touch/pointer orbit, plus viewport
orbit and pinch/scroll zoom. Its software rasterizer interpolates a depth buffer
across all solids and shades mesh faces with directional light.

Closed straight LWPOLYLINE entities (including upstream rectangles) are read from
the actual selected document entity. Bulges/arcs, open profiles, circles, nonzero
XY-plane elevation, invalid geometry, oversized outlines and ambiguous/unsupported
INSUNITS are rejected. Supported INSUNITS convert coordinates to mm; requested
height is explicitly mm. The existing kernel validates the converted polygon and
requested extrusion. Upstream drawing entities are never replaced by preview solids.

Recovery uses a versioned eframe local-storage sidecar, separate from DXF saving.
It restores validated profiles, source handles, extrusion heights and camera only
when the complete serialized DXF drawing matches. A mismatch clears the preview
rather than attaching solids to another drawing. Document changes invalidate the
preview, and only one previous recovery snapshot is retained. Recovery is atomic
on invalid data. Preview IDs may be regenerated on restore. This is not native
solid persistence in CADCraft files, and does not claim DXF solid export.

## Validation

The new stdlib driver is:

```
python3 tests/preview/run.py /path/to/fresh/upstream-v0.13.0
```

It stages a temporary complete workspace, audits the manifest/lock delta and
kernel byte identity, then executes four actual Rust feature tests. These cover
profile conversion/rejection, extrusion volume, recovery and transactional errors,
order-independent depth occlusion, camera rendering and cube hit regions.
Compilation outputs stay outside the checkout. No network is used.

Executed checks and final compilation status are reported below after the finite
local validation run. Exact-candidate Actions, the controller's Android unit suite,
and phone validation are not performed by this invocation. The controller owns
Git/GitHub operations; no commit, push, PR, APK, release or merge is authorized.

## Remaining limitations

Phone touch, WebView rendering, viewport sizing, local-storage quota/recovery and
software rendering performance need device validation at a separately authorized
milestone. The viewport defaults collapsed to keep the 2D drawing usable. Solids
are previews in local browser recovery storage, not CAD document entities; source
edits invalidate rather than regenerate preview solids. Curved profiles and
nonzero profile elevation require later work. Large multi-solid scenes may render
slowly on mobile CPUs. Existing JavaScript 3D tools remain separate.

### Local results in this invocation

- Complete patched upstream: `cargo check --offline --locked --target
  wasm32-unknown-unknown -p cadcraft-web -j 2` passed (three inherited upstream
  dead-code warnings). This compiled the actual shell integration, not a probe.
- Existing kernel tests on the staged unchanged copy: 45 passed, zero failed.
- Existing minimal selection patch check passed; pinned command patch: eight
  assertions passed. Selection bridge: 15 assertions passed. File bridge passed.
  Command bridge: 18 assertions passed. `git diff --check` passed.
- Existing 3D JS harness, with the extracted script, hit its unchanged 3000 ms
  execution timeout. It is unresolved; assertions and timeout were not weakened.
- The first fixture-path repair was insufficient; a second guard repair fixed
  short fixture paths. The allowed two focused repairs are consumed.
- The full wasm build and four feature tests were also started offline; their
  final status must be checked in the handoff report. Starting a test build is
  not evidence those tests passed. Android tests, exact-SHA Actions and phone
  validation remain the controller/owner's responsibility.

Final handoff: validation is blocked by the unresolved inherited JS harness timeout
and exhausted repair allowance. The full wasm build and feature-test builds were
interrupted (exit 130) before completion to end this finite invocation; neither
is reported as passing. No build or test process is intentionally left running.
The four feature tests remain unverified. The completed wasm check and 45 kernel
tests are the available Rust evidence. The controller must review this incomplete
validation status before treating Issue #2 as done.
