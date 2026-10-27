# Rescate controlado de Issue #2

La recuperación parte de `codex-queue/issue-2` en
`d75ddc6d0dfae278f57accc83bd864dc78deeaf7`, sin modificar esa rama ni PR #9.
El almacenamiento original volvió a estar disponible. Se respaldó el workspace
completo, incluidos `.git`, archivos ignorados/sin seguimiento y estado de cola,
antes de cambiar de rama. El tar se comparó contra el workspace completo y tiene
SHA-256 registrada en la copia privada. La copia completa permanece fuera del
repositorio y no se publica con el código.

## Procedencia

Los seis archivos de `issue2-recovery-manifest.json` son copias completas del
almacenamiento restaurado, preservadas sin editar en el primer commit de rescate.
Incluyen los cuatro archivos antes sin seguimiento: módulo Rust, stage.py y dos
archivos de pruebas. `stage.py` conserva la comprobación de ancestros/rutas cortas
que faltaba en las capturas de esta conversación. No fue necesario reconstruir
código desde fragmentos ni inventar las correcciones ausentes.

Los únicos archivos nuevos redactados para este rescate son este informe y su
manifiesto de procedencia. La documentación previa de la implementación se
conserva como informe histórico del agente; sus estados de pruebas no son el
resultado de la verificación independiente del rescate.

## Estado y límites

La cola no se ejecuta y su archivo de estado se conserva byte a byte. Issue #2
permanece bloqueada en ella, con dos llamadas consumidas, dos reparaciones y cero
llamadas restantes. La recuperación no autentica ni invoca Codex ni otros agentes.
No modifica las protecciones generales, los workflows, Gradle ni native3d.

La excepción del propietario permite solo el enlace local del crate existente
en el Cargo.toml del upstream y las entradas Cargo.lock correspondientes. El
stage copia el kernel sin cambios; no añade dependencias externas.

## Verificación del rescate

Verificación independiente ejecutada sobre el código recuperado, sin modificar
las seis fuentes originales. Ninguna CI histórica de PR #9 se atribuye a él.

| Comprobación | Resultado local actual |
| --- | --- |
| Selección, archivos y parches JS/Python | Correctos |
| Puente de comandos y parche upstream | 18 y 8 comprobaciones correctas |
| Kernel original en copia temporal | 45 pruebas correctas |
| Android, XML nuevos | 13 pruebas, 0 fallos/errores/omisiones |
| Integración Rust/egui | 4 pruebas correctas, ninguna omitida |
| Construcción completa WASM offline/locked | Correcta; artefacto válido de 103913373 bytes |
| Cargo/manifiestos/kernel staged | Solo dependencia local, sin cambios externos ni del kernel |

Hubo un timeout local inicial de 3000 ms en el harness JS heredado. Se compararon
sus archivos con la base: eran idénticos. La reproducción posterior sobre esa
misma base pasó con el límite original. El primer fallo se conserva en el JSON
de resultados; no se han debilitado assertions ni ampliado su timeout. Por esa
incidencia intermitente el resumen agregado local se registra como `partial`,
aunque las comprobaciones independientes restantes y WASM hayan pasado.

SHA-256 del artefacto WASM: `1f2aa6e4d157b507ad66b6219db2a38ce69a0f6b296fad6cb302166159baedf8`.
Resultados y tiempos en `issue2-recovery-verification.json`. Se completó la fase
local en 1092.04 segundos dentro de la ventana de 1142;
ningún comando superó el límite de 600 segundos. GitHub Actions debe comprobar
el SHA final de esta PR nueva, con `build_apk=false`. La CI existente comprueba
las regresiones heredadas y Android; los cuatro tests nuevos y WASM se ejecutaron
localmente y no se presentan como jobs nuevos de Actions. La verificación se
realiza fuera del controlador, con comandos de hasta 600 segundos y una ventana
acotada de 1142 segundos; no altera los contadores ni presupuestos de desarrollo.
La optimización de compilación se puede reducir mediante flags de ejecución,
sin editar los perfiles del proyecto, para evitar repetir el coste anterior.

La Issue #2 sigue abierta: recuperación de fuentes, compilación y pruebas de
núcleo no equivalen a validación interactiva en WebView/teléfono. Continúan
pendientes los gestos reales, restauración local, dimensionado del visor y
rendimiento en dispositivo. No se genera APK, no se hace merge y no se habilitan
servicios permanentes ni de pago.


Para reproducir la verificación fuera del controlador, se usaron las herramientas
retenidas del entorno, `CARGO_TARGET_DIR` fuera del repositorio y flags de proceso
`RUSTFLAGS="-C opt-level=0 -C debuginfo=0"`, perfiles dev/test de ejecución con
opt-level=0 y debug=0. No se editaron Cargo.toml/perfiles del proyecto para ello.
El driver `python3 tests/preview/run.py <referencia-v0.13.0>` materializa su copia
y ejecuta las cuatro pruebas. Para WASM se aplicó el entrypoint a otra copia
completa y se ejecutó `cargo build --offline --locked --target
wasm32-unknown-unknown -p cadcraft-web -j 4`. Es un build de verificación, no una
APK ni un paquete web de release validado en teléfono.
