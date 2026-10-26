# CADCraft Android — agent instructions

Goal: port the original CADCraft to Android without losing upstream functionality. Prioritize real Android defects: save/open files, keyboard, touch selection/deselection, ViewCube, navigation, extrusion, and APK stability.

Rules:
- Work in a feature branch. Group related changes; never commit directly to main.
- Keep the experimental Rust native3d kernel unchanged unless a future task explicitly authorizes it.
- Preserve CADCraft upstream integration and Android WebView compatibility.
- Before proposing a PR, run the repository's existing JS/Python checks and relevant Android build checks.
- If a test fails, attempt at most 2 focused fixes; otherwise stop and report logs.
- Never disable tests, alter CI to hide failures, or commit credentials.
- Do not claim an APK was generated unless the APK workflow succeeded and published an artifact.
- Prefer reviewable PRs and human approval before merge; no autonomous merge or releases.
- Every block must report commit link, tests run, and remaining risks.
