# CADCraft Android — prioritized development plan

The goal is a stable Android port of CADCraft, not an unrelated replacement engine.
These instructions extend the foundation proposed in PR #3 without merging it.

1. **File access — Issue #4 / PR #5:** Android file picker, native save, repeated
   JSON import, cancellation and recovery. Draft PR and exact-SHA CI verified;
   phone validation deferred to an explicitly authorized APK milestone.
2. **Input — Issue #1:** command entry and soft keyboard. Proposed next task,
   dependent on the verified file-access branch.
3. **3D navigation/integration — Issue #2:** inspect the issue scope first; use
   the previous verified branch. Do not modify the experimental Rust kernel.
4. **Regression/release:** manual review before merge. APK only at an authorized
   milestone, followed by tests on Nothing Phone 2a.

## Automation — Issue #6

The queue lists Issues #4, #1 and #2 with priority/dependencies/state. It does not
activate itself and does not recursively run Issue #6. The runner can advance to
the next task inside a single authorized, finite invocation after positive
exact-SHA checks. It cannot cause this chat to create its own next cloud session.

No automatic merges, releases, paid APIs or continuous execution. Failed checks
allow at most two repairs shared across local checks and CI. Unknown/access errors
block the queue. Review the documented simulation and technical limitations before
authorizing a live subscription-backed demonstration.
