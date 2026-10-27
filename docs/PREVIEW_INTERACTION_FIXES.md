# Seguimiento del visor recuperado — desarrollo directo

Esta fase parte de `recovery/issue-2` en `18ed8ef`. No modifica esa rama ni la
PR #11. Es desarrollo directo autorizado, independiente del controlador: no
invoca agentes de la cola ni cambia sus contadores. `native3d` queda intacto.

## Cambios

- ViewCube: solo se pintan y reciben clics las caras orientadas a la cámara.
  Las etiquetas se dibujan únicamente si su rectángulo completo, con margen,
  cabe dentro de la cara. Las caras estrechas siguen siendo pulsables.
- Recuperación: el sidecar v1 añade `visible` y `selected_solid` opcionales.
  Conserva compatibilidad con instantáneas anteriores, que arrancan ocultas y
  sin selección. La visibilidad se restaura sin marcar otra vez la casilla.
- Arrastre: se acumula el desplazamiento desde la pulsación, incluido el anterior
  al umbral de egui. Un primer movimiento vertical en cualquiera de los sentidos
  sale de Top/Bottom, evitando que la limitación angular absorba el gesto.
- Selección 3D: es independiente del perfil 2D, permanece al navegar y recupera
  el mismo sólido lógico aunque sus identificadores se regeneren. El sidecar
  guarda la posición en su inventario validado; referencias inválidas se rechazan
  sin modificar el estado actual. Un color diferenciado y la etiqueta Selected
  solid muestran la selección. Pulsar el fondo o Deselect la borra; cambiar de
  dibujo o vaciar el inventario también. La extrusión selecciona el sólido nuevo.
- Edición mínima: Solid height / Apply height usa la API existente del kernel
  para cambiar la altura del sólido seleccionado, conservando identidad y perfil.
  Alturas inválidas no reemplazan la geometría ni borran la selección.

La geometría sigue siendo una previsualización guardada localmente; no se añaden
entidades 3D al DXF ni se promete recuperación entre documentos diferentes.
No se añaden dependencias ni se cambia la infraestructura de compilación.

## Validación de esta revisión

Los tres archivos, incluido este documento nuevo, se publicaron antes de compilar
en `a961bab9b15c461fa1d6b68263b0e71e0024bfa4`. La [PR #12](https://github.com/josxtm/CADCraft-Android/pull/12)
está en borrador sobre `recovery/issue-2`, sin modificar la PR #11. Este informe
recoge pruebas de esta implementación, no resultados de la recuperación anterior.

Pruebas específicas: `python3 tests/preview/run.py <upstream-v0.13.0>` sobre una
copia temporal, con Cargo offline/locked. Incluyen visibilidad y compatibilidad,
selección con huecos de identificadores, recuperación transaccional, edición,
selección con oclusión, primer arrastre en ambos polos y etiquetas/caras del cubo.
Resultados:

| Comprobación | Resultado |
| --- | --- |
| Integración Rust/egui y auditoría de staging | 9 pruebas correctas; dependencia solo local y copia del kernel byte-idéntica |
| WASM completo, offline/locked | Correcto, perfil de verificación sin optimización, 32,29 s |
| Puentes de selección, archivos y comandos | Correctos; selección 15 y comandos 18 comprobaciones |
| Parches upstream | Selección correcta y comandos 8 comprobaciones |
| CI del commit de implementación | [40585062981](https://github.com/josxtm/CADCraft-Android/actions/runs/40585062981), correcta; verificación de código y pruebas Android, job APK omitido |
| Navegador Chromium/WebGL2 | Correcto en los casos descritos abajo; cero excepciones JavaScript de página |

El artefacto WASM tiene 103916185 bytes, SHA-256
`01aac9a8041d520dfe89f8881f2d385f636e66e959bc25fa9ff5462d0d687b7d`.
Se usó wasm-bindgen 0.2.129 y una página temporal fuera del repositorio para
arrancar la aplicación. El DXF sintético 100×60 mm se abrió por el puente público
existente; las acciones se realizaron con ratón y tacto simulado CDP sobre el
canvas. No se inyectaron geometría, cámaras ni snapshots para fabricar resultados.

En Chromium 154, viewport 1400×1000, se comprobó:

- Extrusión de 25 mm, resaltado del sólido seleccionado y ViewCube isométrico y
  Top sin etiquetas superpuestas. Las caras demasiado estrechas no muestran texto.
- El primer arrastre desde Top, con un único evento de movimiento táctil hacia
  fuera del polo, cambió 1981 píxeles del viewport. Las pruebas Rust cubren ambos
  sentidos de arrastre desde Top y Bottom y que no se aplique dos veces el delta.
- Edición a 45 mm; altura cero rechazada con InvalidHeight sin perder el sólido.
  Deselect y picking volvieron a seleccionar el sólido.
- Después del autoguardado real, recargar y abrir el mismo DXF restituyó la
  visibilidad sin pulsar su casilla, el sólido seleccionado y la cámara. El nuevo
  autoguardado coincidió exactamente en sólidos, cámara y dibujo con el anterior.
- Tras esa recarga, sin perfil 2D seleccionado, se editó el sólido recuperado a
  55 mm; el autoguardado conservó selección, visibilidad, cámara y dibujo.

El harness JS 3D heredado alcanzó localmente su límite original de 3000 ms en
la primera ejecución y en la repetición. Sus fuentes y el asset probado son
idénticos a la base; en la CI del commit publicado pasó sin alterar el timeout.
Se conserva esta incidencia local sin presentar el conjunto local como libre de
fallos. Es independiente de las nueve pruebas nuevas y de los casos WASM anteriores.
La compilación emitió avisos dead_code del upstream/adaptador; no hubo errores.

Evidencias locales en `/workspace/scratch/preview-interaction-phase/`: registros
de pruebas, `wasm-artifact.json`, `interactions.jsonl`, capturas, snapshots reales
antes/después de recargar, `ci-code.json` y auditoría de preservación. La sesión de
control terminó por cierre de su entrada después de guardar los resultados;
el navegador y el servidor HTTP temporal quedaron detenidos.

La CI se inició manualmente con `build_apk=false`: el workflow automático solo
se dispara para PRs dirigidas a main. Las pruebas nuevas Rust/egui y el navegador
se ejecutaron localmente; no se atribuyen a jobs que aún no las incluyen.

WebView Android real y rendimiento de teléfono siguen pendientes; el entorno
no tiene emulador y ADB no pudo inicializar su directorio de usuario en la fase
anterior. Las pruebas de tacto del navegador son simuladas.
El renderizado usó SwiftShader por software; no mide rendimiento móvil. Siguen
pendientes viewport estrecho, multitáctil físico y persistencia tras reiniciar
Android. Issue #2 no se declara finalizada. No hubo APK, merge, cambios en
native3d, ejecución del encadenamiento ni reinicio de sus contadores.
