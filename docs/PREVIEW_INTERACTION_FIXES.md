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

Los cambios y los archivos nuevos se publican antes de compilar. Los resultados
se añadirán después de ejecutar las pruebas; este documento no atribuye a esta
revisión las pruebas de la recuperación anterior.

Pruebas específicas: `python3 tests/preview/run.py <upstream-v0.13.0>` sobre una
copia temporal, con Cargo offline/locked. Incluyen visibilidad y compatibilidad,
selección con huecos de identificadores, recuperación transaccional, edición,
selección con oclusión, primer arrastre en ambos polos y etiquetas/caras del cubo.
Después se compila WASM y se ejercita en navegador. CI existente se comprueba
para el SHA publicado; no se genera APK ni se hace merge.

WebView Android real y rendimiento de teléfono siguen pendientes; el entorno
no tiene emulador y ADB no pudo inicializar su directorio de usuario en la fase
anterior. Las pruebas de tacto del navegador son simuladas.
