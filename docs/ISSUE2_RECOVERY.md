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

Pendiente de ejecutar sobre esta rama. Ninguna CI histórica de PR #9 se atribuye
a esta implementación. Se comprobarán primero las regresiones pequeñas y después
las pruebas de integración y una construcción WASM completa. La verificación se
realiza fuera del controlador, con comandos de hasta 600 segundos y una ventana
acotada de 1142 segundos; no altera los contadores ni presupuestos de desarrollo.
La optimización de compilación se puede reducir mediante flags de ejecución,
sin editar los perfiles del proyecto, para evitar repetir el coste anterior.

La Issue #2 sigue abierta: recuperación de fuentes, compilación y pruebas de
núcleo no equivalen a validación interactiva en WebView/teléfono. Continúan
pendientes los gestos reales, restauración local, dimensionado del visor y
rendimiento en dispositivo. No se genera APK, no se hace merge y no se habilitan
servicios permanentes ni de pago.
