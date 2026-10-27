# Android command entry — Issue #1

The pinned upstream v0.13.0 command bar draws text and a caret with an egui
painter; it does not use TextEdit or request an IME. Changing Android window
soft-input flags alone cannot make this painted bar editable.

The application patch now publishes the text area's rectangle in egui points.
`bridge/commands.js` places a real HTML text input over that rectangle, leaving
prompt keywords and the history chevron on the original canvas. Android WebView
can focus this input directly from a tap and own IME composition. Enter submits
the complete input through upstream `cmdline::submit`, retaining command history,
empty Enter, and interactive command prompts. Completed input edits also update
the upstream command buffer for its suggestions, without forwarding intermediate
IME composition text. DOM keyboard events stop before
reaching the canvas to avoid duplicate characters. Closing the keyboard preserves
the draft. The separate **Deseleccionar** button calls upstream `set_selection`
without erasing entities or cancelling an active command.

The bridge uses a single pending request and rejects additional submissions until
it is consumed, preserving the next draft. While installed, the patched web UI
requests a frame every 50 ms to consume DOM requests even when egui would be idle.
This has a potential battery cost that needs device measurement. The Rust kernel,
file access, build configuration and existing tests are unchanged.

Verification for this change:

- `node tests/commands/bridge.cjs`: composition, submission, draft retention,
  duplicate event prevention, layout mapping, deselection and repeated installation.
- `python3 tests/commands/upstream_patch.py /workspace/.cadcraft-tools/upstream-v0.13.0`:
  real pinned application patch, handler wiring and duplicate patch rejection.
- Existing JavaScript studio, file and selection checks and Python selection patch
  checks passed. All 45 existing Rust tests passed on a temporary kernel copy.
- Controller-side `:app:testDebugUnitTest`: 13 tests passed with zero failures,
  errors or skips. The agent-shell Gradle lock/IP failure did not reproduce there.
- `cargo check --locked --target wasm32-unknown-unknown -p cadcraft-web -j 4`
  passed against a disposable copy of pinned upstream v0.13.0 with the application
  patch applied. The missing craft-libs/hayro-jbig2 Git revision was downloaded
  using the existing network configuration; dependency pins and lockfile stayed
  unchanged. This checks Rust/WASM compilation, not browser/device behavior.

No APK was requested or generated. A separately authorized device milestone must check: tap the command
text area; type and execute LINE and successive coordinate prompts; enter accented
text with composition; dismiss and reopen the keyboard without losing a draft;
submit empty Enter; use a physical keyboard; select entities and tap Deseleccionar;
use prompt keywords/history; rotate with the keyboard open; confirm other inputs
and file open/save still work. Nothing Phone 2a behavior remains unverified.

`AGENTS.md` and `DEVELOPMENT_PLAN.md` were absent from this checkout during this
invocation; the owner-supplied instructions governed scope. Git/GitHub operations
and exact-candidate-SHA Actions verification belong to the controller.

## Controller-side verification after the agent

The controlled external write probe passed before the single additional invocation. The agent produced these changes at cumulative agent_calls=4. The queue then blocked on its overly broad scripts/check-* protection, which also rejects new tests. Existing harnesses were not changed. No further agent invocation was made.

Controller-side verification passed: 18 new bridge assertions, 8 pinned-upstream patch assertions, existing JS/Python checks, 45 Rust tests on a temporary copy, and 13 Android unit tests (0 failures/errors/skips). Gradle succeeded outside the agent command network sandbox. The initial offline WASM check was blocked, but the supervised online check described above now passes. Issue #2 had not started during this verification.

## Supervised continuation

The new command tests now live under `tests/commands/`, outside the controller's
reserved harness paths. The controller protection is unchanged; all changes are
checked against the verified file-access base, not just the latest commit. This
is one supervised follow-up to the generated changes, with no fifth agent call and
no reset of invocation or repair counters. The task is not ready to advance until
GitHub Actions also passes on this follow-up commit.
