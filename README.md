# CADCraft Android

Adaptación experimental de [CADCraft](https://github.com/storytold/cadcraft) para **Android**, con compilación de APK en la nube utilizando **GitHub Actions**.

> **Estado:** la APK 2D v0.1.0 fue probada en Nothing Phone 2a. Se ha añadido un estudio 3D independiente aún no validado en móvil.

## Flujo de desarrollo y APK (desde octubre de 2026)

**No se compila una APK en cada cambio de código.** Los envíos a `main` ejecutan únicamente el control automático `preflight` (JavaScript, Rust y validaciones), sin construir Android ni subir ningún APK.

Solo al completar **una mejora importante** y cuando haya un guion de pruebas útil, propondremos generar una nueva APK. La compilación Android requiere ir a **Actions → CADCraft · Verificación continua / APK manual → Run workflow**, marcar **GENERAR APK** e indicar en el campo de objetivo qué se desea comprobar. La casilla está desactivada de forma predeterminada. Si no se marca, se ejecutan pruebas pero no se crea el APK.

La versión en `app/build.gradle` se reserva para las compilaciones de prueba de una versión importante; corregir código entre versiones no implica distribuir una APK nueva. Antes de recomendar una APK se explicarán las novedades y se facilitará una lista concreta de pruebas para el Nothing Phone 2a. El guion completo y los criterios para decidir cuándo compilar están en [Protocolo de pruebas en móvil](docs/MOBILE_TESTING.md).

**Importante:** una compilación solo está confirmada cuando el trabajo `android` de GitHub Actions finaliza correctamente y publica un artefacto instalable. Pasar `preflight` no implica que exista una APK.

## Objetivo

Disponer de una aplicación CAD para Android que aproveche el código abierto de CADCraft y permita trabajar con dibujos desde una pantalla táctil. Las prioridades son dibujo 2D, precisión, cotas, apertura/guardado de archivos y evolución posterior de las herramientas 3D.

La primera vía técnica prevista consiste en compilar la versión web **Rust → WebAssembly** y empaquetarla en una APK con una actividad Android **WebView**. Una integración nativa de Rust/egui queda como opción futura si WebView impone limitaciones.

## Modo experimental 3D (nuevos cambios)

La actividad Android añade el botón **3D EXTRUIR**, que abre una pantalla 3D táctil empaquetada sin conexión en `app/src/main/assets/3d/index.html`. Esta pantalla ofrece:

- Crear un sólido extruyendo un rectángulo con ancho, largo y altura numéricos.
- Rotar con un dedo, zoom con pellizco y botones de orientación (superior, frontal, izquierda, derecha, isométrica).
- Importar un archivo DXF **LWPOLYLINE cerrado con segmentos rectos** para extruirlo; por ahora utiliza el primer contorno compatible, sin agujeros ni arcos.
- Exportar la malla a STL (sin garantía todavía de compatibilidad del selector de descarga Android).

**Integración Android v0.3.0:** al compilar se aplica `scripts/patch-upstream-selection.py` sobre CADCraft `v0.13.0`. El editor 2D expone una única entidad seleccionada (LWPOLYLINE cerrada sin arcos o círculo) al botón **EXTRUIR SELECCIÓN**, que transfiere el perfil al estudio 3D sin exportar DXF. Los círculos se convierten en perfiles de 64 segmentos. La extrusión se crea en el estudio 3D independiente, **no modifica el dibujo original CADCraft** ni implementa todavía edición de sólidos dentro del mismo editor. Si no hay selección o no es compatible, el botón muestra una advertencia. El ViewCube original sigue sin repararse; el del estudio 3D es independiente.

Este modo todavía requiere una **compilación manual nueva** y pruebas en Nothing Phone 2a. No confundir código publicado con APK generada.

## Estudio 3D táctil (desarrollo octubre 2026)

Se han incorporado herramientas experimentales de boceto 2D directamente en la vista 3D:

- Crear rectángulos por ancho y largo exactos y círculos por diámetro (aproximados con 48 segmentos rectos).
- Añadir puntos XY en milímetros, seleccionar o arrastrar vértices, borrar vértices, deshacer y rehacer.
- Activar/desactivar el ajuste a cuadrícula de 5 mm.
- Extruir un contorno simple sin autointersecciones y exportar su perfil 2D a DXF.
- Importar perfiles DXF LWPOLYLINE cerrados y rectos mediante selector Android, y exportar el sólido a STL.
- Guardar y abrir proyectos propios JSON con perfil y altura, independientes del proyecto original de CADCraft.
- Transferir desde la pantalla principal un archivo DXF seleccionado por el usuario al módulo 3D.

**Alcance:** la selección de objetos directamente desde el lienzo del editor original CADCraft y su extrusión sin archivos intermedios todavía no está integrada. Los círculos se aproximan mediante segmentos; no se admiten agujeros, splines ni arcos DXF. Esta rama exige probar el APK en teléfono: los commits por sí solos no validan la compilación ni el funcionamiento Android.

En GitHub Actions, el trabajo `preflight` comprueba la sintaxis JavaScript, la geometría y las pruebas Rust antes de `android`. El archivo APK solo aparecerá si todos los pasos concluyen correctamente.

### Paquete de verificación 0.2.0
- Estadísticas geométricas (área de base, superficie exterior y volumen) con unidades de dibujo asumidas como mm.
- Exportación OBJ de malla triangulada además de STL y DXF.
- Rectángulos y círculos precisos, rejilla opcional, deshacer y rehacer, selección, desplazamiento y borrado de vértices.
- Android permite cambiar la orientación de pantalla (en lugar de estar bloqueado en apaisado).
- Compilación de CADCraft web desde la etiqueta de origen `v0.13.0` para evitar cambios inesperados en cada ejecución.
- APK de desarrollo versionada `0.2.0`, aplicación id `com.josxtm.cadcraft` (se conserva para actualización).

**Calidad:** se prueban automáticamente los cálculos geométricos y la estructura del OBJ. Esta verificación no sustituye la compilación en GitHub Actions ni las pruebas en el teléfono.

### Selección 2D → 3D sin archivos (v0.3.0, pendiente de validar en APK)

1. En CADCraft 2D, dibuja un círculo o una polilínea **cerrada** de segmentos rectos.
2. Selecciona **solo esa entidad**.
3. Pulsa **EXTRUIR SELECCIÓN**, elige la altura en la vista 3D y pulsa EXTRUIR si necesitas cambiarla.
4. Puedes exportar STL/OBJ o guardar el proyecto JSON; el perfil se asocia al handle original cuando existe.

El puente WebAssembly es de **solo lectura** y funciona con la versión fija `v0.13.0`. No ofrece todavía selección múltiple, curvas DXF con bulge, agujeros, reconocimiento de límites a partir de líneas sueltas, sincronización de vuelta al documento original ni operaciones booleanas. La compilación WASM de GitHub Actions es obligatoria para comprobar que el parche Rust funciona con ese código. Las pruebas JavaScript por sí solas **no confirman un APK válida**.

### Estudio 3D: selección y edición (v0.4.0)

- Alternar entre **giro de cámara** y **selección de caras** en la barra inferior.
- Seleccionar con un toque un triángulo visible de la malla y resaltarlo en naranja. La interfaz indica si pertenece a la cara superior, inferior o lateral.
- **Deseleccionar** y continuar girando libremente al salir del modo selección.
- Modificar la altura de extrusión en pasos de ±5 mm o mediante el campo de altura y **APLICAR EXTRUSIÓN**.
- Comprobar la nueva geometría antes de sustituir la actual: entradas incorrectas o altura cero mantienen el último sólido válido.
- Añadir 19 pruebas para selección, geometría y cambios de altura. La prueba JavaScript conjunta alcanza 71 comprobaciones, ejecutadas localmente; la compilación Rust/WASM y la APK requieren verificación por Actions.

**Alcance:** esta es selección de triángulos de una única malla de extrusión, no un selector topológico B-Rep ni edición paramétrica de caras arbitrarias. Todavía no incluye múltiples sólidos, operaciones booleanas ni modificación de la geometría original de CADCraft 2D.

### Escena 3D de varias piezas (v0.5.0)

El estudio 3D incorpora una escena con un máximo de **24 sólidos extruidos**:

- **Nueva pieza**: conserva las piezas anteriores y crea otra para modificarla.
- **Duplicar pieza**: crea una copia independiente separada en el eje X.
- **Siguiente pieza**: cambia cuál de las piezas es la activa para editar su altura o su perfil.
- **Eliminar pieza**: elimina la pieza activa, dejando como mínimo una pieza.
- **Mover pieza activa**: desplazamiento XYZ introduciendo coordenadas absolutas respecto al origen de la escena.
- Renderizar todas las piezas a la vez y exportar la escena completa en **STL** u **OBJ**.
- **Proyecto JSON v2**: guarda los sólidos, perfiles, alturas, identificadores y desplazamientos; sigue abriendo proyectos JSON v1 de una sola pieza.
- Validación transaccional: un archivo inválido se rechaza antes de sustituir la escena cargada.
- El indicador de medidas sigue mostrando la geometría de la **pieza activa**, no la suma de toda la escena.

**Limitaciones:** el motor sigue basado en triangulación de contornos 2D extruidos, no en un sólido B-Rep. No hay unión, resta, intersección, agujeros ni restricciones geométricas entre piezas. La selección de caras opera únicamente sobre la pieza activa. Las piezas exportadas se agrupan como malla, sin operación booleana. El límite de 24 piezas es provisional para controlar memoria y rendimiento en Android.

La regresión JavaScript de esta fase suma **98 comprobaciones**, incluida compatibilidad JSON v1/v2, agregado de mallas, operaciones de escena y preservación ante errores. Esto no sustituye la confirmación de la compilación APK ni pruebas táctiles en el teléfono.

### Análisis de contactos entre piezas — desarrollo posterior a 0.5.0

Este bloque se publica en el código **sin crear una APK** y sin cambiar aún el número de versión:

- Botón **Comprobar contactos**: identifica parejas de piezas que se interpenetran volumétricamente, que solo están en contacto o que están separadas.
- El análisis utiliza los contornos 2D reales de cada extrusión (incluidos los perfiles cóncavos), la posición X/Y y los intervalos en Z. No se limita a comprobar si se superponen sus cajas rectangulares.
- La comprobación admite alturas de extrusión negativas y distingue el contacto por una cara de la intersección con volumen compartido.
- Botón **Separar pieza +10 mm**: sitúa la pieza activa a la derecha de las demás dejando al menos 10 mm entre sus límites en X.
- El resultado del análisis se marca como no actualizado si se edita o mueve una pieza; es necesario volver a comprobarlo.
- Se han añadido pruebas de superposición, contacto lateral, contacto vertical, contención, perfil cóncavo, altura negativa y separación automática.

**Todavía NO implementa booleanas** (unir, cortar, restar, intersecar como nueva malla), ni garantiza tolerancias de fabricación. Las intersecciones se detectan entre prismas simples, no entre superficies B-Rep arbitrarias. Esta fase de análisis sirve para preparar las futuras operaciones booleanas de manera controlada.

El paquete JavaScript del estudio 3D suma **115 comprobaciones locales correctas**, pero se mantiene el compromiso de **no generar una nueva APK por cada modificación**. Se indicará cuándo se alcance un hito que merezca una nueva prueba en Android.

### Booleanas iniciales y mediciones geométricas (desarrollo después de v0.5.0)

Implementadas en el estudio 3D, todavía **sin solicitar una nueva APK**:

- **Calcular unión/resta** muestra los volúmenes teóricos en mm³ de dos extrusiones, incluso con perfiles cóncavos y alturas negativas. El volumen común se calcula triangulando los contornos y recortando triángulos en XY, multiplicando el área compartida por el intervalo común en Z.
- **Unión OBJ · bloques**, **Resta OBJ · bloques** e **Intersección OBJ · bloques** generan un archivo de malla real de dos prismas **rectangulares y alineados a los ejes XYZ**, sin superficies interiores redundantes. Se prueban casos superpuestos, disjuntos, idénticos y uno contenido dentro del otro. Los bordes de las mallas producidas en esos casos son cerrados.
- Los dos operandos son la **pieza activa** y la **primera pieza almacenada** de la escena. Si no hay segunda pieza, no hay operación.
- Las geometrías se exportan a **OBJ** como resultado independiente. **No reemplazan la escena actual, no se pueden editar como una entidad paramétrica y no se guardan en el JSON del proyecto**.
- Los perfiles circulares, inclinados, cóncavos o los booleanos entre más de dos piezas siguen **sin generar una malla booleana**. Las mediciones de volumen de dos perfiles concavos sí están admitidas.
- Una resta que no deja volumen, o una intersección vacía, se indica como resultado vacío y no intenta exportar una malla inexistente.

Estas operaciones son una etapa limitada y explícita antes de integrar un motor CSG/B-Rep general. Las pruebas JavaScript de geometría no sustituyen la compilación Android ni las pruebas manuales en el teléfono.

## Hoja de ruta

| Versión | Objetivo | Estado |
|---|---|---|
| v0.1.0 | Proyecto Android, compilación de CADCraft WebAssembly y APK con GitHub Actions | Pendiente |
| v0.2.0 | Gestos táctiles, zoom, selección y botones adaptados al móvil | Planificada |
| v0.3.0 | Abrir/guardar y comprobar compatibilidad de archivos DXF/DWG | Planificada |
| v0.4.0 | Acotaciones, entrada numérica y mejoras de interfaz en castellano | Planificada |
| v0.5.0 | Investigar extrusión y funciones 3D | Exploración |

## Arquitectura propuesta

1. Obtener el código fuente de `storytold/cadcraft`.
2. Compilar su frontend con Rust, destino `wasm32-unknown-unknown` y Trunk.
3. Copiar los archivos web generados a `app/src/main/assets/web/`.
4. Cargarlos localmente mediante `WebViewAssetLoader`, sin necesidad de un servidor externo.
5. Construir `app-debug.apk` con Gradle dentro de GitHub Actions.
6. Publicar el APK como *artifact* para descargarlo e instalarlo manualmente.

**Nota:** esto es un diseño de integración, no una garantía de compatibilidad. Debemos comprobar el renderizado y el almacenamiento de CADCraft en Android WebView.

## Generación manual de APK solo para hitos importantes

Una vez incorporado el proyecto y el archivo `.github/workflows/android-apk.yml`:

1. Esperar a que se indique que una versión contiene mejoras importantes y qué debemos probar en el teléfono.
2. Entrar en **Actions** y seleccionar **CADCraft · Verificación continua / APK manual**.
3. Pulsar **Run workflow** y marcar la casilla **GENERAR APK**. Añadir el objetivo de las pruebas.
4. Comprobar que terminan correctamente los trabajos **preflight** y **android**.
5. Descargar el artefacto de la ejecución, extraer el ZIP e instalar `app-debug.apk` en el teléfono Android.
6. Seguir las pruebas indicadas en [Protocolo de pruebas en móvil](docs/MOBILE_TESTING.md) y comunicar los resultados.

El APK *debug* es únicamente para pruebas. La compilación necesita además revisión de licencias, permisos Android, manejo de archivos y pruebas reales.

## Pruebas previstas

- Arranque sin conexión tras la instalación.
- Dibujo de líneas, rectángulos y círculos.
- Zoom y desplazamiento con pantalla táctil.
- Selección y edición de entidades.
- Introducción de medidas precisas.
- Abrir/guardar un dibujo y comprobar persistencia.
- Importar/exportar DXF y evaluar DWG.
- Rendimiento, consumo de memoria y estabilidad en un **Nothing Phone 2a**.

## Limitaciones y precauciones

- CADCraft está en desarrollo; la compatibilidad 3D completa no debe darse por supuesta.
- Las funciones de archivo del navegador pueden requerir puentes específicos de Android.
- Conservar siempre copias de los dibujos originales: las conversiones de formatos CAD pueden perder elementos no soportados.
- Hasta superar las pruebas, no utilizar la APK para documentación técnica crítica.

## Relación con MyCAD

**CADCraft Android es independiente de MyCAD.** Su objetivo es experimentar con el motor CAD original sin alterar la aplicación MyCAD existente.

## Origen, atribución y licencia

Este proyecto se basa en [storytold/cadcraft](https://github.com/storytold/cadcraft). CADCraft publica código bajo términos **MIT OR Apache-2.0**; antes de distribuir binarios es necesario conservar los avisos de copyright, atribuciones y licencias correspondientes a las dependencias incluidas. Este proyecto no está afiliado oficialmente a sus desarrolladores.

---

**Registro de cambios**

- **v0.1.0 (preparación):** documentación del propósito, arquitectura, fases previstas y procedimiento de compilación. APK todavía sin verificar.
