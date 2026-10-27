# Issue #2: dependency wiring proposal — blocked, no functional integration

## Verified starting point

Issue #1 remains an open draft PR #8 at
`8c6fadfd958e407fc7616f9c623f42d1ac9a3851`, with Code verification gate and Android
file access regression tests successful. APK generation was skipped. A fresh
`codex exec` connection probe using the owner's ChatGPT login succeeded before
starting this task.

The controller created `codex-queue/issue-2` from that exact SHA and invoked the
agent once. The agent produced no project changes because the required build
wiring is outside ordinary queued-task scope. No further invocation was made.
Issue #1 was not repeated. Persistent state remains Issue #2 `blocked`,
`agent_calls: 1`; the finite continuation allowed at most two calls, leaving one
unused, without increasing that limit. Both external execution gates returned to
false, and the remote controller lock was released.

## Exact scope conflict

`AGENTS.md` from the reviewed controller branch states:

> Ordinary queued tasks cannot change the controller, queue, workflow, existing
> test harnesses, build configuration or native3d. Infrastructure changes require
> separate review. Do not loosen these controls to make a queued task pass.

The prompt repeats the build restriction. The pinned upstream web app has no
Cargo dependency on `cadcraft-android-3d`. Reusing `PreviewState` from egui needs
that dependency; changes confined to the existing JavaScript 3D viewer would not
satisfy the requested Rust/egui integration. The trusted instructions were supplied
inline by the controller although AGENTS.md/DEVELOPMENT_PLAN.md are absent from
the inherited application branch itself.

This draft contains documentation only. It does not apply the proposed build
changes or implement EXTRUIR, rendering, ViewCube, units conversion or persistence.
Passing inherited regression checks is not evidence that Issue #2 is implemented.

## Minimum proposed change for separate review

Keep every original native3d source and manifest byte-for-byte unchanged. At
upstream patch/build staging time, copy that existing crate into
`upstream/crates/cadcraft-android-3d/`, which matches the existing `crates/*`
workspace member pattern. The repository's experimental kernel remains untouched.
The proposed web-only manifest change, not applied by this PR, is:

```diff
--- a/apps/cadcraft-web/Cargo.toml
+++ b/apps/cadcraft-web/Cargo.toml
@@ -26,6 +26,7 @@
 web-sys = { version = "0.3", features = ["HtmlInputElement", "FileList", "File"] }
 
 [target.'cfg(target_arch = "wasm32")'.dependencies]
+cadcraft-android-3d = { path = "../../crates/cadcraft-android-3d" }
 eframe = { workspace = true, features = ["persistence", "default_fonts", "wgpu", "accesskit"] }
 wasm-bindgen = "0.2"
 wasm-bindgen-futures = "0.4"
```

Cargo resolves the local package with only these lockfile additions. Do not
update registry versions, remove the lockfile, disable checks or change Android
Gradle configuration, CI, queue limits or existing tests:

```diff
--- a/Cargo.lock
+++ b/Cargo.lock
@@ -576,6 +576,10 @@
 ]
 
 [[package]]
+name = "cadcraft-android-3d"
+version = "0.1.0"
+
+[[package]]
 name = "cadcraft-cli"
 version = "0.13.0"
 dependencies = [
@@ -742,6 +746,7 @@
 name = "cadcraft-web"
 version = "0.13.0"
 dependencies = [
+ "cadcraft-android-3d",
  "cadcraft-engine",
  "cadcraft-io",
  "cadcraft-ui-egui",
```

After separately authorizing this narrow dependency wiring, a bounded continuation
can implement the application adapter in a new web-shell module using the existing
kernel APIs. It must preserve the upstream 2D drawing, validate closed straight
profiles, reject unsupported bulges/arcs and ambiguous units, render a separate
3D view with depth and shading, route ViewCube/touch interactions to PreviewState,
and define/test restoration without silently altering the original drawing.
Existing JS functionality must not be relabeled as this integration. No extra
agent call or broader scope is approved by this document itself.

## Checks actually executed

A disposable copy of pinned upstream v0.13.0 outside the checkout was used for a
compile-only spike. The existing Issue #1 application patch, proposed local Cargo
dependency, an unchanged copy of native3d, and a probe calling
`select_profile_checked`, `extrude_selected`, `focus_solid`, `view`,
`drag_viewcube` and `project` were applied to that copy only.

- `cargo check --offline --target wasm32-unknown-unknown -p cadcraft-web -j 4`:
  passed. Cargo added the local package to the disposable lockfile; existing
  registry pins were preserved. This proves API/dependency compilation only.
- `cargo test --offline --locked -p cadcraft-android-3d --all-targets -j 4` on
  that copy: 45 passed, 0 failed. These are existing kernel tests, not tests of a
  new integration.
- The copied original kernel files were compared byte-for-byte before testing.
  Repository native3d, main, workflows and build configuration were unchanged.
- No tests ran inside the blocked coding invocation because it made no changes.
- This documentation-only candidate is also sent through the inherited GitHub
  Actions workflow with `build_apk=false`; results are reported in the PR. New
  integration tests and device validation remain unrun because the feature does
  not exist yet.

Logs and compile-only fixtures remain private outside the checkout under
`/workspace/.cadcraft-tools/issue2-*`. No tokens, device codes, APK, release, merge,
paid API, scheduler or permanent service are included. The recovery of Issue #1
was supervised and Issue #2 stopped on scope, so a complete autonomous chain of
two successful development tasks has not been demonstrated.
