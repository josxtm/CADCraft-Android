# CADCraft Android

Adaptación experimental de [CADCraft](https://github.com/storytold/cadcraft) para **Android**, con compilación de APK en la nube utilizando **GitHub Actions**.

> **Estado:** la APK 2D v0.1.0 fue probada en Nothing Phone 2a. Se ha añadido un estudio 3D independiente aún no validado en móvil.

## Objetivo

Disponer de una aplicación CAD para Android que aproveche el código abierto de CADCraft y permita trabajar con dibujos desde una pantalla táctil. Las prioridades son dibujo 2D, precisión, cotas, apertura/guardado de archivos y evolución posterior de las herramientas 3D.

La primera vía técnica prevista consiste en compilar la versión web **Rust → WebAssembly** y empaquetarla en una APK con una actividad Android **WebView**. Una integración nativa de Rust/egui queda como opción futura si WebView impone limitaciones.

## Modo experimental 3D (nuevos cambios)

La actividad Android añade el botón **3D EXTRUIR**, que abre una pantalla 3D táctil empaquetada sin conexión en `app/src/main/assets/3d/index.html`. Esta pantalla ofrece:

- Crear un sólido extruyendo un rectángulo con ancho, largo y altura numéricos.
- Rotar con un dedo, zoom con pellizco y botones de orientación (superior, frontal, izquierda, derecha, isométrica).
- Importar un archivo DXF **LWPOLYLINE cerrado con segmentos rectos** para extruirlo; por ahora utiliza el primer contorno compatible, sin agujeros ni arcos.
- Exportar la malla a STL (sin garantía todavía de compatibilidad del selector de descarga Android).

**Limitación importante:** el modo 3D es una pantalla independiente del editor CADCraft 2D. Todavía **no** recibe automáticamente las entidades seleccionadas en el editor principal, ni crea sólidos dentro del documento CADCraft/DXF. Esta integración completa queda pendiente. No afirmar que el ViewCube original del editor CADCraft se ha reparado; el ViewCube funcional es el del nuevo modo 3D.

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

## Compilación prevista desde GitHub Actions

Una vez incorporado el proyecto y el archivo `.github/workflows/android-apk.yml`:

1. Ir a **Actions** en este repositorio.
2. Seleccionar **Build CADCraft Android APK**.
3. Pulsar **Run workflow**.
4. Si termina correctamente, descargar el *artifact* de la ejecución.
5. Extraer el ZIP e instalar el archivo `app-debug.apk` en el teléfono Android.

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
