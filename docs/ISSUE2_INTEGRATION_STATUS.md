# Issue #2 — Rust/egui ViewCube y extrusión: integración de prueba

Esta rama de integración añade una ventana 3D Rust al Shell egui del CADCraft upstream v0.13.0, sin escribir sólidos 3D en el documento DXF ni modificar el kernel `native3d`.
El código se reconstruyó a partir de capturas recuperadas: **no se presupone que sea el contenido final perdido**.
La integración se instala **solo al compilar una copia limpia del upstream** mediante `scripts/patch-upstream-selection.py` y `scripts/preview-v1/stage.py`.

Flujo: selección única del perfil cerrado 2D → detección de unidades INSUNITS → `PreviewState::select_profile_checked` → EXTRUIR → cámara, ViewCube, selección de pieza y representación por depth-buffer. El preview se guarda aparte con identificación del DXF y restaura posiciones XYZ y cámara, con validación transaccional. Rechaza polígonos abiertos, bulges, planos fuera de XY, unidades ambiguas y geometría inválida.

## Reglas de compatibilidad
- El parche falla ante marcadores Cargo/egui desconocidos o copias de kernel previas, **sin sobreescribir**.
- Las fixtures minimalistas del puente de selección no deben activar el enlazado Cargo.
- Los tests específicos están en `tests/preview`; no se reducen tiempos ni se desactivan tests existentes.
- Este código **NO** sustituye aún al estudio 3D JavaScript ni convierte el dibujo 2D en B-Rep. No se fusionará mientras compilación WASM, pruebas de integración, harness JS y compilación Android sean rojas.
- Validación real (la fuente de verdad): acciones GitHub del SHA actual de esta rama; NO los resultados históricos del archivo de recuperación.
