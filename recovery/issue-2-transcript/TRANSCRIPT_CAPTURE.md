El entorno original sigue inaccesible: `environment configuration was canceled`. Tampoco hay un entorno disponible donde guardar un paquete descargable. **No he reemplazado el entorno, modificado la PR #9, reiniciado contadores ni ejecutado llamadas de desarrollo.**

La recuperación queda aquí en texto. **Son capturas históricas sin verificar; no representan necesariamente la última versión local.** Los resultados anteriores de pruebas no validan estas copias.

| Archivo                                 | Material recuperable                                           | Qué falta                                                                                      |
| --------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `scripts/preview-v1/android_preview.rs` | Captura extensa, desde los imports hasta el cierre de `render` | No se comprobó explícitamente el final del archivo ni su identidad con la última versión       |
| `scripts/preview-v1/stage.py`           | Versión inicial mostrada completa                              | Dos correcciones posteriores de rutas/fixtures; conocemos el problema, pero no su código final |
| `tests/preview/run.py`                  | Copia completa mostrada mediante `cat`                         | Verificarla nuevamente tras recuperar el resto                                                 |
| `tests/preview/integration.rs`          | Copia completa mostrada mediante `cat`                         | Verificarla nuevamente tras recuperar el resto                                                 |
| `scripts/patch-upstream-selection.py`   | Adición exacta de seis líneas sobre la base existente          | Conservar el archivo base; no sustituirlo por ese fragmento                                    |
| `docs/ISSUE2_BUILD_WIRING_PROPOSAL.md`  | Fragmentos de la documentación final                           | Documento completo y correspondencia exacta con la última edición                              |

**Copia capturada de `scripts/preview-v1/android_preview.rs`**

```
//! Android application integration v1. Kernel and original 2D drawing stay independent.
use cadcraft_android_3d::{workspace::PreviewState, Point2, Vec3, View};
use cadcraft_ui_egui::CadApp;
use serde_json::{json, Value};

pub const KEY: &str = "cadcraft.android.preview.v1";

pub fn unit_scale(code: i64) -> Result<f64, String> {
    // INSUNITS is mandatory: unitless and uncommon astronomical units fail closed.
    match code {
        1 => Ok(25.4), 2 => Ok(304.8), 3 => Ok(1_609_344.0),
        4 => Ok(1.0), 5 => Ok(10.0), 6 => Ok(1000.0), 7 => Ok(1_000_000.0),
        8 => Ok(0.0000254), 9 => Ok(0.0254), 10 => Ok(914.4),
        11 => Ok(1e-7), 12 => Ok(1e-6), 13 => Ok(0.001), 14 => Ok(100.0),
        _ => Err("Set supported drawing INSUNITS before EXTRUIR (unitless is ambiguous).".into()),
    }
}

pub fn profile(kind: &Value, units: i64) -> Result<Vec<Point2>, String> {
    let scale = unit_scale(units)?;
    if kind["type"] != "lwPolyline" || kind["closed"] != true {
        return Err("Select one closed straight polyline or rectangle.".into());
    }
    let elevation = kind["elevation"].as_f64().unwrap_or(0.0);
    if !elevation.is_finite() || elevation != 0.0 {
        return Err("Only profiles on the world XY plane are supported.".into());
    }
    let vertices = kind["vertices"].as_array().ok_or("Missing vertices")?;
    if !(3..=512).contains(&vertices.len()) { return Err("Profile requires 3–512 vertices.".into()); }
    vertices.iter().map(|v| {
        if v["bulge"].as_f64().unwrap_or(0.0) != 0.0 {
            return Err("Arc/bulge profiles require tessellation and are unsupported.".into());
        }
        let x = v["p"]["x"].as_f64().ok_or("Invalid X")? * scale;
        let y = v["p"]["y"].as_f64().ok_or("Invalid Y")? * scale;
        if !x.is_finite() || !y.is_finite() { return Err("Nonfinite profile".into()); }
        Ok(Point2::new(x, y))
    }).collect()
}

pub struct Preview {
    pub state: PreviewState,
    height: f64,
    message: String,
    drawing: String,
    stamp: Option<(u64, u64)>,
    recovery: Option<Value>,
    texture: Option<egui::TextureHandle>,
    visible: bool,
}
impl Default for Preview {
    fn default() -> Self {
        Self { state: PreviewState::default(), height: 25.0, message: String::new(),
            drawing: String::new(), stamp: None, recovery: None, texture: None, visible: false }
    }
}
impl Preview {
    pub fn load(saved: Option<String>) -> Self {
        let mut result = Self::default();
        result.recovery = saved.filter(|s| s.len() <= 8_000_000)
            .and_then(|s| serde_json::from_str(&s).ok());
        result
    }
    pub fn snapshot(&self) -> String {
        json!({"version":1,"drawing":self.drawing,"height":self.height,
            "camera":[self.state.camera.azimuth,self.state.camera.elevation,self.state.camera.distance,
                self.state.camera.target.x,self.state.camera.target.y,self.state.camera.target.z],
            "solids":self.state.solids.iter().map(|s| json!({"handle":s.source_handle,
                "height":s.height,"outline":s.outline.iter().map(|p| [p.x,p.y]).collect::<Vec<_>>()})).collect::<Vec<_>>()}).to_string()
    }
    pub fn restore(&mut self, saved: &Value, drawing: &str) -> Result<(), String> {
        if saved["version"] != 1 || saved["drawing"].as_str() != Some(drawing) {
            return Err("Preview recovery belongs to a different drawing.".into());
        }
        let solids = saved["solids"].as_array().ok_or("Missing solids")?;
        if solids.len() > 64 { return Err("Too many recovered solids".into()); }
        let mut candidate = PreviewState::default();
        for s in solids {
            let points = s["outline"].as_array().ok_or("Invalid outline")?;
            if !(3..=512).contains(&points.len()) { return Err("Invalid outline size".into()); }
            let points = points.iter().map(|p| Ok(Point2::new(p[0].as_f64().ok_or("X")?, p[1].as_f64().ok_or("Y")?)))
                .collect::<Result<Vec<_>, String>>()?;
            candidate.select_profile_checked(s["handle"].as_u64().ok_or("Invalid source handle")?, points)
                .map_err(|e| format!("{e:?}"))?;
            candidate.extrude_selected(s["height"].as_f64().ok_or("Invalid height")?).map_err(|e| format!("{e:?}"))?;
        }
        let camera = saved["camera"].as_array().ok_or("Missing camera")?;
        let values = camera.iter().map(|v| v.as_f64().filter(|n| n.is_finite()).ok_or("Invalid camera"))
            .collect::<Result<Vec<_>, _>>()?;
        if values.len() != 6 || !(0.01..=1e10).contains(&values[2]) || values[3..].iter().any(|n| n.abs()>1e8) {
            return Err("Invalid camera bounds".into());
        }
        candidate.camera.azimuth = values[0]; candidate.camera.elevation = values[1];
        candidate.camera.distance = values[2]; candidate.camera.target = Vec3::new(values[3],values[4],values[5]);
        candidate.clear_selection();
        self.state = candidate;
        self.height = saved["height"].as_f64().filter(|n| n.is_finite()).unwrap_or(25.0);
        self.drawing = drawing.into();
        Ok(())
    }
    pub fn ui(&mut self, app: &CadApp, ctx: &egui::Context) {
        let Ok(st) = app.session.state() else { self.state = PreviewState::default(); self.stamp=None; return };
        let stamp = (st.uid, st.revision);
        if self.stamp != Some(stamp) {
            let drawing = cadcraft_io::write_dxf(&st.doc);
            if drawing != self.drawing {
                if !self.drawing.is_empty() { self.recovery = serde_json::from_str(&self.snapshot()).ok(); }
                self.state = PreviewState::default();
                if let Some(saved) = self.recovery.clone() {
                    if let Err(e) = self.restore(&saved, &drawing) { self.message = e; }
                }
                self.drawing = drawing;
            }
            self.stamp = Some(stamp);
        }
        self.state.clear_selection();
        let selection = (|| {
            if st.selection.len()!=1 { return Err("Select one closed profile in the 2D drawing.".into()); }
            let handle = st.selection[0];
            let entity = st.doc.entity(handle).ok_or("Selection missing")?;
            let kind = serde_json::to_value(&entity.kind).map_err(|e| e.to_string())?;
            let points = profile(&kind, st.doc.header.i64("INSUNITS",0))?;
            let handle = u64::from_str_radix(&handle.hex(),16).map_err(|e| e.to_string())?;
            self.state.select_profile_checked(handle, points).map_err(|e| format!("{e:?}"))
        })();
        egui::Window::new("3D preview · EXTRUIR").default_pos(egui::pos2(12.0,80.0))
            .default_width(340.0).show(ctx, |ui| {
            ui.checkbox(&mut self.visible, "Show separate 3D viewport");
            if !self.visible { return; }
            ui.label("Preview recovery is local; solids are not written into DXF.");
            ui.horizontal(|ui| {
                ui.label("Height (mm)"); ui.add(egui::DragValue::new(&mut self.height).speed(0.5));
                if ui.add_enabled(selection.is_ok() && self.state.solids.len()<64, egui::Button::new("EXTRUIR")).clicked() {
                    match self.state.extrude_selected(self.height) {
                        Ok(_) => { self.state.frame_solids(); self.message="Extruded in millimetres.".into(); }
                        Err(e) => self.message=format!("{e:?}"),
                    }
                }
            });
            if let Err(e) = &selection { ui.label(e); }
            ui.label(&self.message);
            ui.horizontal(|ui| {
                if ui.button("Fit").clicked() { self.state.frame_solids(); }
                if ui.button("Isometric").clicked() { self.state.view(View::NorthEastIso); }
                if ui.button("Clear solids").clicked() { self.state.solids.clear(); }
            });
            self.viewcube(ui);
            let size=egui::vec2(ui.available_width().clamp(120.0,512.0),240.0);
            let (rect,response)=ui.allocate_exact_size(size,egui::Sense::click_and_drag());
            if response.dragged() {
                let delta=ui.input(|i| i.pointer.delta());
                self.state.drag_viewcube(delta.x as f64,delta.y as f64);
            }
            if response.hovered() {
                let zoom=ui.input(|i| i.zoom_delta() as f64 * (i.smooth_scroll_delta.y as f64 * 0.002).exp());
                self.state.camera.distance=(self.state.camera.distance / zoom).clamp(0.01,1e10);
            }
            let w=size.x as usize; let h=size.y as usize;
            let image=render(&self.state,w,h);
            let texture=self.texture.get_or_insert_with(||ctx.load_texture("android-preview-depth",image.clone(),egui::TextureOptions::LINEAR));
            texture.set(image,egui::TextureOptions::LINEAR);
            ui.painter().image(texture.id(),rect,egui::Rect::from_min_max(egui::Pos2::ZERO,egui::pos2(1.0,1.0)),egui::Color32::WHITE);
            if response.clicked() && let Some(p)=response.interact_pointer_pos() {
                let scale=size.x.min(size.y) as f64/self.state.camera.distance;
                let x=(p.x-rect.center().x) as f64/scale;
                let y=-(p.y-rect.center().y) as f64/scale;
                self.message=self.state.pick_solid_at(x,y).map(|id|format!("Solid {id}")).unwrap_or_else(||"No solid here".into());
            }
            ui.label("Drag to orbit · pinch/scroll to zoom · tap a cube face to snap");
        });
    }
    fn viewcube(&mut self, ui: &mut egui::Ui) {
        let (rect,response)=ui.allocate_exact_size(egui::vec2(120.0,100.0),egui::Sense::click_and_drag());
        if response.dragged() {
            let d=ui.input(|i|i.pointer.delta()); self.state.drag_viewcube(d.x as f64,d.y as f64);
        }
        let vertices=[Vec3::new(-1.,-1.,-1.),Vec3::new(1.,-1.,-1.),Vec3::new(1.,1.,-1.),Vec3::new(-1.,1.,-1.),
            Vec3::new(-1.,-1.,1.),Vec3::new(1.,-1.,1.),Vec3::new(1.,1.,1.),Vec3::new(-1.,1.,1.)];
        let (right,up,forward)=self.state.camera.basis();
        let projected=vertices.map(|v| (rect.center()+egui::vec2(v.dot(right) as f32*27.,-v.dot(up) as f32*27.),v.dot(forward)));
        let mut faces=vec![([0,3,2,1],View::Bottom,"Bottom"),([4,5,6,7],View::Top,"Top"),
            ([0,1,5,4],View::Front,"Front"),([3,7,6,2],View::Back,"Back"),
            ([0,4,7,3],View::Left,"Left"),([1,2,6,5],View::Right,"Right")];
        faces.sort_by(|a,b| {
            let depth=|f:&([usize;4],View,&str)| f.0.iter().map(|i| projected[*i].1).sum::<f64>();
            depth(b).total_cmp(&depth(a))
        });
        let mut snap=None;
        for (indices,view,label) in faces {
            let pts=indices.map(|i| projected[i].0);
            ui.painter().add(egui::Shape::convex_polygon(pts.to_vec(),egui::Color32::from_rgb(65,100,140),egui::Stroke::new(1.,egui::Color32::WHITE)));
            let center=egui::pos2(pts.iter().map(|p|p.x).sum::<f32>()/4.,pts.iter().map(|p|p.y).sum::<f32>()/4.);
            ui.painter().text(center,egui::Align2::CENTER_CENTER,label,egui::FontId::proportional(10.),egui::Color32::WHITE);
            if response.clicked() && response.interact_pointer_pos().is_some_and(|p| inside(p,&pts)) {snap=Some(view);}
        }
        if let Some(view)=snap {self.state.view(view);}
    }
}
fn inside(p:egui::Pos2, pts:&[egui::Pos2;4])->bool {
    let cross=|a:egui::Pos2,b:egui::Pos2| (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
    let c=[cross(pts[0],pts[1]),cross(pts[1],pts[2]),cross(pts[2],pts[3]),cross(pts[3],pts[0])];
    c.iter().all(|v|*v>=0.0)||c.iter().all(|v|*v<=0.0)
}

/// Per-pixel interpolated depth, across all solids; order independent occlusion.
pub fn render(state:&PreviewState,w:usize,h:usize)->egui::ColorImage {
    let mut image=egui::ColorImage::filled([w,h],egui::Color32::from_rgb(22,27,35));
    let mut depths=vec![f64::INFINITY;w*h];
    let scale=w.min(h) as f64/state.camera.distance;
    for solid in &state.solids { for triangle in &solid.mesh.triangles {
        let world=triangle.map(|i| solid.mesh.vertices[i as usize]+solid.offset);
        let p=world.map(|v|{let (x,y,z)=state.project(v);(w as f64/2.+x*scale,h as f64/2.-y*scale,z)});
        let area=(p[1].0-p[0].0)*(p[2].1-p[0].1)-(p[1].1-p[0].1)*(p[2].0-p[0].0);
        if area.abs()<1e-10 {continue;}
        let normal=(world[1]-world[0]).cross(world[2]-world[0]).normalized();
        let light=0.25+0.75*normal.dot(Vec3::new(-0.3,-0.5,0.8).normalized()).max(0.0);
        let color=egui::Color32::from_rgb((80.*light) as u8,(170.*light) as u8,(235.*light) as u8);
        let minx=p.iter().map(|p|p.0).fold(f64::INFINITY,f64::min).floor().max(0.) as usize;
        let maxx=p.iter().map(|p|p.0).fold(f64::NEG_INFINITY,f64::max).ceil().min(w as f64) as usize;
        let miny=p.iter().map(|p|p.1).fold(f64::INFINITY,f64::min).floor().max(0.) as usize;
        let maxy=p.iter().map(|p|p.1).fold(f64::NEG_INFINITY,f64::max).ceil().min(h as f64) as usize;
        for y in miny..maxy {for x in minx..maxx {
            let dx=x as f64+0.5-p[0].0; let dy=y as f64+0.5-p[0].1;
            let b=(dx*(p[2].1-p[0].1)-dy*(p[2].0-p[0].0))/area;
            let c=((p[1].0-p[0].0)*dy-(p[1].1-p[0].1)*dx)/area;
            let a=1.-b-c;
            if a>=0. && b>=0. && c>=0. {
                let z=a*p[0].2+b*p[1].2+c*p[2].2; let i=y*w+x;
                if z<depths[i] { depths[i]=z; image.pixels[i]=color; }
            }
        }}
    }}
    image
}
```

**Versión inicial de `scripts/preview-v1/stage.py`**

Debe conservarse como captura, por ejemplo con el nombre `stage.py.captured-before-fixture-fixes`. **Esta versión contiene el problema de acceso a `parents[3]`; no he inventado las dos correcciones que faltan.**

```
"""Apply the versioned application-only preview integration to a real workspace."""
from pathlib import Path
import shutil


def stage(target, source):
    root = target.resolve().parents[3]
    if not (root / 'Cargo.toml').is_file():
        return source  # Preserve the existing minimal bridge fixtures.
    manifest = root / 'apps/cadcraft-web/Cargo.toml'
    lock = root / 'Cargo.lock'
    cargo = manifest.read_text()
    locked = lock.read_text()
    anchors = {
        'shell': '        Option<String>,\n    );',
        'create': 'Shell(app, inbox, host, reduced_motion, None)',
        'save': '            storage.set_string(cadcraft_ui_egui::PREFS_KEY, self.0.prefs_json());',
        'ui': '            self.0.ui(ui);',
    }
    if any(source.count(a) != 1 for a in anchors.values()):
        raise SystemExit('Preview v1 shell anchors changed')
    if cargo.count('[dependencies]\n') != 1 or locked.count('name = "cadcraft-web"\n') != 1:
        raise SystemExit('Preview v1 dependency anchors changed')
    if 'cadcraft-android-3d' in cargo or 'cadcraft-android-3d' in locked:
        raise SystemExit('Preview dependency already staged')
    source = source.replace(anchors['shell'], '        Option<String>,\n        crate::android_preview::Preview,\n    );')
    source = source.replace(anchors['create'], 'Shell(app, inbox, host, reduced_motion, None, crate::android_preview::Preview::load(cc.storage.and_then(|s| s.get_string(crate::android_preview::KEY))))')
    source = source.replace(anchors['save'], anchors['save'] + '\n            storage.set_string(crate::android_preview::KEY, self.5.snapshot());')
    source = source.replace(anchors['ui'], anchors['ui'] + '\n            self.5.ui(&self.0, ui.ctx());')
    source += '\n#[cfg(any(target_arch = "wasm32", test))]\nmod android_preview;\n'
    cargo = cargo.replace('[dependencies]\n', '[dependencies]\ncadcraft-android-3d = { path = "../../crates/cadcraft-android-3d" }\n')
    marker = '[[package]]\nname = "cadcraft-cli"'
    if locked.count(marker) != 1:
        raise SystemExit('Preview lock package anchor changed')
    locked = locked.replace(marker, '[[package]]\nname = "cadcraft-android-3d"\nversion = "0.1.0"\n\n' + marker)
    start = locked.index('name = "cadcraft-web"\n')
    before, after = locked[:start], locked[start:]
    after = after.replace('dependencies = [\n', 'dependencies = [\n "cadcraft-android-3d",\n', 1)
    package = root / 'crates/cadcraft-android-3d'
    if package.exists():
        raise SystemExit('Refusing to overwrite existing kernel copy')
    repo = Path(__file__).resolve().parents[2]
    shutil.copytree(repo / 'native3d', package, ignore=shutil.ignore_patterns('target', 'Cargo.lock'))
    shutil.copyfile(Path(__file__).with_name('android_preview.rs'), target.with_name('android_preview.rs'))
    manifest.write_text(cargo)
    lock.write_text(before + after)
    return source
```

**Copia completa capturada de `tests/preview/run.py`**

```
#!/usr/bin/env python3
"""Offline feature tests against one fresh pinned upstream reference directory."""
from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile

repo = Path(__file__).resolve().parents[2]
reference = Path(sys.argv[1]).resolve()
env = os.environ.copy()
env['PATH'] = str(Path(env['CARGO_HOME']) / 'bin') + os.pathsep + env.get('PATH', '')
with tempfile.TemporaryDirectory(prefix='cadcraft-preview-') as work:
    root = Path(work) / 'upstream'
    shutil.copytree(reference, root, ignore=shutil.ignore_patterns('target', '.git'))
    subprocess.run([sys.executable, str(repo / 'scripts/patch-upstream-selection.py'), str(root / 'apps/cadcraft-web/src/main.rs')], check=True)
    for original in (repo / 'native3d').rglob('*'):
        if original.is_file() and 'target' not in original.parts and original.name != 'Cargo.lock':
            assert original.read_bytes() == (root / 'crates/cadcraft-android-3d' / original.relative_to(repo / 'native3d')).read_bytes()
    original = (reference / 'apps/cadcraft-web/Cargo.toml').read_text()
    staged = (root / 'apps/cadcraft-web/Cargo.toml').read_text()
    assert staged.replace('cadcraft-android-3d = { path = "../../crates/cadcraft-android-3d" }\n','') == original
    locked = (root / 'Cargo.lock').read_text()
    assert locked.replace('[[package]]\nname = "cadcraft-android-3d"\nversion = "0.1.0"\n\n','').replace(' "cadcraft-android-3d",\n','') == (reference / 'Cargo.lock').read_text()
    module = root / 'apps/cadcraft-web/src/android_preview.rs'
    module.write_text(module.read_text() + '\n#[cfg(test)]\nmod integration_tests {\n' + (Path(__file__).with_name('integration.rs')).read_text() + '\n}\n')
    env.setdefault('CARGO_TARGET_DIR', str(Path(tempfile.gettempdir()) / 'cadcraft-preview-feature-target'))
    subprocess.run(['cargo','test','--offline','--locked','--manifest-path',str(root / 'Cargo.toml'),'-p','cadcraft-web','android_preview::integration_tests','-j','4'],env=env,check=True)
print('Preview feature tests and staging audits passed')
```

**Copia completa capturada de `tests/preview/integration.rs`**

```
use super::*;
fn rectangle()->Value { json!({"type":"lwPolyline","closed":true,"vertices":[
    {"p":{"x":0.,"y":0.},"bulge":0.},{"p":{"x":100.,"y":0.}},
    {"p":{"x":100.,"y":60.}},{"p":{"x":0.,"y":60.}}]}) }
fn preview()->Preview {
    let mut p=Preview::default(); p.drawing="exact drawing contents".into();
    p.state.select_profile_checked(42,profile(&rectangle(),4).unwrap()).unwrap();
    p.state.extrude_selected(25.).unwrap(); p.state.frame_solids(); p
}
#[test] fn closed_profiles_units_and_geometry() {
    assert_eq!(profile(&rectangle(),4).unwrap()[1].x,100.);
    assert_eq!(profile(&rectangle(),1).unwrap()[1].x,2540.);
    assert!(profile(&rectangle(),0).is_err()); assert!(unit_scale(24).is_err());
    let mut p=rectangle(); p["closed"]=json!(false); assert!(profile(&p,4).is_err());
    p=rectangle(); p["vertices"][0]["bulge"]=json!(0.1); assert!(profile(&p,4).is_err());
    p=rectangle(); p["elevation"]=json!(1.); assert!(profile(&p,4).is_err());
    p=rectangle(); p["type"]=json!("circle"); assert!(profile(&p,4).is_err());
    let mut state=PreviewState::default();
    assert!(state.select_profile_checked(1,vec![Point2::new(0.,0.),Point2::new(10.,10.),Point2::new(0.,10.),Point2::new(10.,0.)]).is_err());
    let p=preview(); assert!((p.state.measure_solid(1).unwrap().volume_mm3-150000.).abs()<1e-6);
}
#[test] fn restore_roundtrip_camera_source_height_and_transactional_failure() {
    let mut p=preview(); p.state.view(View::Front); p.state.drag_viewcube(20.,-10.);
    let data:Value=serde_json::from_str(&p.snapshot()).unwrap();
    let mut restored=Preview::default(); restored.restore(&data,&p.drawing).unwrap();
    assert_eq!(restored.state.solids,p.state.solids); assert_eq!(restored.state.camera,p.state.camera);
    assert!(!restored.state.has_profile());
    assert!(restored.restore(&data,"other drawing").is_err());
    assert_eq!(restored.state.solids,p.state.solids);
    let mut bad=data.clone(); bad["solids"][0]["height"]=json!(0.);
    assert!(restored.restore(&bad,&p.drawing).is_err());
    assert_eq!(restored.state.solids,p.state.solids);
    bad=data; bad["camera"][2]=json!(-1.); assert!(restored.restore(&bad,&p.drawing).is_err());
}
#[test] fn depth_buffer_occlusion_and_camera_rendering() {
    let mut p=preview(); p.state.view(View::Top);
    let id=p.state.duplicate_solid(1,Vec3::new(0.,0.,30.)).unwrap();
    let image=render(&p.state,120,100);
    p.state.solids.reverse(); assert_eq!(image.pixels,render(&p.state,120,100).pixels);
    assert_eq!(p.state.pick_solid_at(0.,0.),Some(id));
    assert!(image.pixels.iter().any(|c|*c!=egui::Color32::from_rgb(22,27,35)));
    p.state.view(View::Front); assert_ne!(image.pixels,render(&p.state,120,100).pixels);
}
#[test] fn cube_hit_regions() {
    let pts=[egui::pos2(0.,0.),egui::pos2(10.,0.),egui::pos2(10.,10.),egui::pos2(0.,10.)];
    assert!(inside(egui::pos2(5.,5.),&pts)); assert!(!inside(egui::pos2(11.,5.),&pts));
}
```

**Adición recuperada de `scripts/patch-upstream-selection.py`**

La salida registró estas seis líneas **después** de `source = source.replace(anchor, bridge + anchor, 1)` y **antes** de `target.write_text(source, encoding="utf-8")`. No son un sustituto del archivo completo:

```
# Real Cargo workspaces receive the versioned Rust/egui application integration.
import importlib.util
preview_spec = importlib.util.spec_from_file_location("android_preview_stage", Path(__file__).with_name("preview-v1") / "stage.py")
preview_stage = importlib.util.module_from_spec(preview_spec)
preview_spec.loader.exec_module(preview_stage)
source = preview_stage.stage(target, source)
```

**Fragmento recuperado de la documentación**

Este es un extracto histórico del informe del agente, **anterior a las verificaciones posteriores del controlador**. Debe guardarse como fragmento, no como documento final reconstruido:

```
### Local results in this invocation

- Complete patched upstream: `cargo check --offline --locked --target
  wasm32-unknown-unknown -p cadcraft-web -j 2` passed (three inherited upstream
  dead-code warnings). This compiled the actual shell integration, not a probe.
- Existing kernel tests on the staged unchanged copy: 45 passed, zero failed.
- Existing minimal selection patch check passed; pinned command patch: eight
  assertions passed. Selection bridge: 15 assertions passed. File bridge passed.
  Command bridge: 18 assertions passed. `git diff --check` passed.
- Existing 3D JS harness, with the extracted script, hit its unchanged 3000 ms
  execution timeout. It is unresolved; assertions and timeout were not weakened.
- The first fixture-path repair was insufficient; a second guard repair fixed
  short fixture paths. The allowed two focused repairs are consumed.
- The full wasm build and four feature tests were also started offline; their
  final status must be checked in the handoff report. Starting a test build is
  not evidence those tests passed. Android tests, exact-SHA Actions and phone
  validation remain the controller/owner's responsibility.

Final handoff: validation is blocked by the unresolved inherited JS harness timeout
and exhausted repair allowance. The full wasm build and feature-test builds were
interrupted (exit 130) before completion to end this finite invocation; neither
is reported as passing. No build or test process is intentionally left running.
The four feature tests remain unverified. The completed wasm check and 45 kernel
tests are the available Rust evidence. The controller must review this incomplete
validation status before treating Issue #2 as done.
```

Las correcciones de código que faltan corresponden al tratamiento de fixtures y rutas cortas en `stage.py`. La conversación confirma que hubo dos reparaciones y muestra un `IndexError` en `target.resolve().parents[3]`, pero **no conserva el texto final de esas reparaciones**. No lo he suplido con una implementación nueva.

Para conservar y comprobar esta recuperación hay dos opciones:

1. **Recuperar primero el almacenamiento original.** Hacer una copia completa del repositorio —incluidos `.git` y los archivos sin seguimiento— y del estado de la cola, en un destino nuevo. Comparar después estas capturas con los archivos originales.
2. **Conservar las capturas en una rama nueva**, por ejemplo `recovery/issue-2-transcript`, partiendo del SHA documental conocido de la PR #9: `d75ddc6d0dfae278f57accc83bd864dc78deeaf7`. Guardarlas inicialmente bajo un directorio de recuperación, manteniendo `stage.py` marcado como versión anterior a las reparaciones. Esto permite preservarlas sin sobrescribir la PR #9 ni activar código incompleto.

Una verificación posterior, con un presupuesto separado y acotado, podría ejecutar el driver recuperado, las regresiones existentes, la construcción WASM y CI sobre el nuevo SHA. **No necesitaría llamadas de desarrollo para ejecutar pruebas**, pero esta reconstrucción todavía no está verificada y sus contadores deben seguir conservándose.
