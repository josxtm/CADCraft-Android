# CADCraft Android — prioritized development plan

## Current goal
Stable Android port of the original CADCraft, not a Shapr3D clone.

## Work packages
1. **File access:** verify Android native open/save behavior and add a proper file chooser/download bridge if necessary. Test repeated import, cancellation, invalid JSON, and recovery.
2. **Input and selection:** soft keyboard focus, command entry, single selection and deselection, touch gestures without accidental camera movement.
3. **3D navigation:** ViewCube and N/S/E/W controls, touch rotation, camera reset.
4. **Geometry integration:** verify extrusion and connect UI actions to the actual engine.
5. **Regression and release:** build APK at a meaningful milestone, test on real Android hardware, document behavior.

## Deferred
Experimental Rust native3d kernel integration. Keep it intact for future work.

## Acceptance criteria
- Related fixes grouped into reviewable commits.
- CI green at the exact candidate SHA.
- APK artifact only after explicit milestone build.
- No automatic merges, credentials, paid AI usage, or unattended code generation until separately configured and authorized.
