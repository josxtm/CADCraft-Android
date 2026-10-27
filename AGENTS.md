# CADCraft Android — agent instructions

Goal: port the original CADCraft to Android without losing upstream functionality.
Prioritize Android save/open, keyboard, touch selection, ViewCube, navigation and
extrusion. Use the existing checkout; tasks already run in isolated environments.
Do not create worktrees unless explicitly requested.

- Work in a feature branch; never commit or merge directly to main.
- Keep the experimental `native3d` Rust kernel unchanged.
- Preserve upstream integration, validation and local recovery.
- Run existing JS/Python/Rust checks and relevant Android checks before a PR.
- A zero-test run is not verification. Check the exact candidate SHA in Actions.
- Attempt at most two focused repairs per task. Block on exhausted attempts,
  missing access, unknown failures or changes outside the authorized scope.
- Never disable assertions, weaken CI, commit credentials or print secret values.
- Do not generate APK, create releases, merge PRs or use paid APIs without separate
  explicit authorization. No unattended/continuous execution is enabled here.
- Report commit/PR links, executed tests, skipped/unrun checks and remaining risks.

## Queue controller

`automation/queue.json` is an explicit proposal, disabled by default. This PR
implements Issue #6; the runner must not recursively queue its own implementation.
CI runs tests and simulations only. It never calls a coding model.

Live bounded execution requires the owner's authorization for using their existing
ChatGPT subscription, both configuration gates and the explicit CLI flag. No API
key mode, scheduler or background daemon is supported. Keep a manual kill switch,
local and remote locks, fixed budgets, one issue/branch/draft PR per task and a
maximum of two repairs. A verified draft PR is `done`; this never means merged.

Ordinary queued tasks cannot change the controller, queue, workflow, existing
test harnesses, build configuration or native3d. Infrastructure changes require
separate review. Do not loosen these controls to make a queued task pass.

See [execution and limits](docs/TASK_QUEUE.md) before proposing activation.
