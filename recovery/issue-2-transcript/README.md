# Capturas históricas de Issue #2 — NO EJECUTAR

Fuente: `Markdown pegado.md`, proporcionado el 27 de octubre de 2026.
Rama: `recovery/issue-2-transcript`; base documental exacta PR #9 SHA `d75ddc6d0dfae278f57accc83bd864dc78deeaf7`.

Este material **no representa necesariamente el código final** del entorno original, cancelado e inaccesible. Se guarda documentalmente y no modifica rutas de ejecución, PR #9, ramas de desarrollo ni configuración CI.

- `TRANSCRIPT_CAPTURE.md`: copia textual íntegra de la recuperación.
- `android_preview.rs.captured.txt`: bloque extenso capturado; su final y su correspondencia con el archivo real final no están confirmados.
- `stage.py.before-fixture-fixes.captured.txt`: copia **anterior a dos reparaciones de rutas**; contiene `target.resolve().parents[3]` y no debe ejecutarse.
- `run.py.captured.txt`, `integration.rs.captured.txt`: transcripciones declaradas completas pero no reproducidas.
- `patch-upstream-selection.addition.captured.txt`: solo seis líneas adicionales, NO el archivo base.
- `ISSUE2_BUILD_WIRING_PROPOSAL.fragment.captured.txt`: extracto histórico parcial del informe, NO documento final.

El informe original describe un `cargo check` WASM correcto y 45 tests Rust correctos, **pero no se han repetido**. Declara pendiente un timeout del harness JS y compilaciones WASM/feature tests interrumpidas (exit 130); las cuatro pruebas de integración siguen sin verificación.

Para continuar: recuperar los originales cuando estén disponibles, cotejar SHA y cambios; reconstruir las correcciones ausentes **solo mediante trabajo nuevo revisado y probado**, no suponiendo que están en estas capturas. Las verificaciones y números de PR #9 no deben alterarse. No fusionar esta rama documental a `main` sin revisión.
