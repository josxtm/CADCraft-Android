# Auditoría de apertura y guardado Android — tarea #4

El editor ya tenía `onShowFileChooser` y un puente para descargas `blob:`/`data:`.
No era necesario sustituir el formato de proyecto, el importador ni la recuperación
local. Las descargas no deben depender del soporte de descargas blob del WebView:
el puente lee los bytes y Android abre **Guardar como** mediante SAF.

Se ha inspeccionado también CADCraft `v0.13.0` (commit
`1fcf654ea8414ea2ef052ca2b3b77411f2026f78`): `apps/cadcraft-web/src/upload.rs`
crea un input oculto nuevo para cada apertura DXF/DWG, y `download.rs` crea un
enlace blob con nombre y MIME. Ambos caminos pasan por los mecanismos auditados.
No se ha compilado ni modificado ese código upstream.

## Cambios

- El selector usa `ACTION_OPEN_DOCUMENT`/`CATEGORY_OPENABLE`. Admite tipos genéricos
  porque algunos proveedores etiquetan JSON/DXF como `application/octet-stream`.
  La validación de extensión, tamaño, formato y geometría sigue en el importador.
- Se corrige el patrón que rechazaba nombres `.json` normales. Se limpia el input
  antes de abrir y después de cada importación para permitir elegir el mismo JSON.
- Un error al abrir el selector devuelve `null` al callback exactamente una vez.
  Cancelar no modifica el proyecto. Al destruir la actividad se libera el callback.
- El puente de descarga, extraído a `assets/bridge/files.js`, conserva una sola
  petición hasta recibir el resultado nativo. Lee el blob antes de que el editor
  revoque su URL; informa de fallos de lectura y permite reintentar.
- El guardado conserva bytes en un archivo temporal privado, limitado a 32 MiB.
  Una segunda petición no sustituye la pendiente. El token y el nombre se conservan
  en el estado de la actividad, sin introducir el contenido en el Bundle.
- `ACTION_CREATE_DOCUMENT` deja elegir el destino. Se escribe fuera del hilo UI
  usando modo `wt` para truncar un destino existente. Solo se anuncia éxito tras
  escribir, vaciar y cerrar el stream. Cancelación y error tienen mensajes propios;
  el temporal se elimina al completar/cancelar/fallar o al cerrar la actividad.
- La escena y la copia de recuperación validada no se eliminan al cancelar o fallar
  el guardado. El resultado nativo llega también al estado del estudio 3D.

## Pruebas automáticas, sin APK

Desde la raíz, con Node 22 y Python 3:

```sh
python3 - <<'PY'
from pathlib import Path
html = Path('app/src/main/assets/3d/index.html').read_text()
assert html.count('<script>') == 1 and html.count('</script>') == 1
Path('/tmp/cadcraft-3d.js').write_text(html.split('<script>', 1)[1].split('</script>', 1)[0])
PY
node --check /tmp/cadcraft-3d.js
node scripts/check-3d-studio.cjs /tmp/cadcraft-3d.js
node --check app/src/main/assets/bridge/files.js
node scripts/check-file-bridge.cjs
node --check app/src/main/assets/bridge/selection.js
node scripts/check-selection-bridge.cjs app/src/main/assets/bridge/selection.js
python3 scripts/check-upstream-selection-patch.py
```

Con JDK 17+, Gradle 8.13, plataforma Android 35 y build-tools 35.0.0:

```sh
gradle --no-daemon --max-workers=4 :app:testDebugUnitTest
```

La tarea compila las fuentes Android y ejecuta las pruebas Robolectric del selector,
los bytes guardados, los fallos del proveedor y la recreación de actividad. No genera
APK. CI ejecuta estos controles en Pull Requests y conserva la compilación APK como
opción manual. Las pruebas Rust existentes siguen formando parte de preflight;
esta tarea no modifica `native3d`.

Validación de esta entrega: 13 pruebas Android ejecutadas, 0 fallos y 0 omitidas;
regresiones del estudio 3D y del puente de archivos correctas, 15 comprobaciones
del puente de selección correctas, regresión Python correcta y 45 pruebas Rust
existentes correctas. No se ha generado APK ni validado el teléfono.

## Límites y comprobaciones para el próximo hito

Robolectric y las pruebas JS no prueban el WebView ni proveedores SAF reales.
En la siguiente APK autorizada, comprobar en Nothing Phone 2a:

1. Abrir un JSON válido dos veces; importar uno inválido y uno demasiado grande.
   Los rechazados deben dejar intacta la escena y la recuperación.
2. Abrir DXF desde Descargas y desde un proveedor que anuncie tipo genérico.
3. Cancelar Abrir y Guardar como, continuar editando y volver a intentarlo.
4. Guardar JSON, DXF, OBJ y STL, elegir el destino y comprobar nombre, bytes y
   reapertura. Guardar sobre un destino más largo no debe dejar bytes sobrantes.
5. Rotar durante Guardar como y completar/cancelar. El archivo debe corresponder a
   la petición inicial; un segundo toque no debe sustituirla.
6. Probar un destino sin acceso o sin espacio. Debe aparecer error, nunca éxito;
   la escena y la copia local deben seguir disponibles.

La copia privada temporal puede ser eliminada por Android bajo presión de espacio.
En ese caso se informa del fallo y hay que volver a guardar desde el proyecto;
no se presenta el archivo como guardado. Las escrituras en proveedores externos
no son transacciones: un fallo puede dejar un destino parcial y requiere reintentar.
El motor 2D upstream considera iniciado el guardado cuando dispara la descarga;
su indicador de documento guardado no espera la confirmación asíncrona de SAF.
El mensaje nativo es la confirmación de escritura. Esta tarea no cambia ese
contrato del motor 2D ni añade a ese editor la recuperación propia del estudio 3D.
