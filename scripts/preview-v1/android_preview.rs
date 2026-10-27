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
    // Separate from the kernel's transient 2D profile selection.
    selected_solid: Option<u64>,
    edit_height: f64,
    cube_drag: OrbitDrag,
    viewport_drag: OrbitDrag,
}
impl Default for Preview {
    fn default() -> Self {
        Self { state: PreviewState::default(), height: 25.0, message: String::new(),
            drawing: String::new(), stamp: None, recovery: None, texture: None, visible: false,
            selected_solid: None, edit_height: 25.0,
            cube_drag: OrbitDrag::default(), viewport_drag: OrbitDrag::default() }
    }
}
impl Preview {
    pub fn load(saved: Option<String>) -> Self {
        let mut result = Self::default();
        result.recovery = saved.filter(|s| s.len() <= 8_000_000)
            .and_then(|s| serde_json::from_str(&s).ok());
        result.visible = result.recovery.as_ref().and_then(|s| s["visible"].as_bool()).unwrap_or(false);
        result
    }
    pub fn snapshot(&self) -> String {
        json!({"version":1,"drawing":self.drawing,"height":self.height,"visible":self.visible,
            // IDs can have gaps and are regenerated during recovery. Store the
            // selected position in this exact validated solids array instead.
            "selected_solid":self.state.solids.iter().position(|s| Some(s.id)==self.selected_solid),
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
        let visible = match saved.get("visible") {
            None => false, // Backward-compatible v1 snapshot.
            Some(v) => v.as_bool().ok_or("Invalid viewport visibility")?,
        };
        let selected = match saved.get("selected_solid") {
            None | Some(Value::Null) => None,
            Some(v) => {
                let index = v.as_u64().and_then(|i| usize::try_from(i).ok()).ok_or("Invalid selected solid")?;
                Some(candidate.solids.get(index).ok_or("Selected solid missing")?.id)
            }
        };
        self.state = candidate;
        self.visible = visible;
        self.select_solid(selected);
        self.cube_drag = OrbitDrag::default();
        self.viewport_drag = OrbitDrag::default();
        self.height = saved["height"].as_f64().filter(|n| n.is_finite()).unwrap_or(25.0);
        self.drawing = drawing.into();
        Ok(())
    }
    fn select_solid(&mut self, id: Option<u64>) {
        let solid = self.state.solids.iter().find(|s| Some(s.id)==id);
        self.selected_solid = solid.map(|s| s.id);
        if let Some(solid) = solid { self.edit_height = solid.height; }
    }
    fn pick(&mut self, x: f64, y: f64) {
        self.select_solid(self.state.pick_solid_at(x,y));
        self.message = self.selected_solid.map(|id|format!("Solid {id} selected"))
            .unwrap_or_else(||"No solid here".into());
    }
    fn reset_geometry(&mut self) {
        self.state = PreviewState::default();
        self.select_solid(None);
        self.cube_drag = OrbitDrag::default();
        self.viewport_drag = OrbitDrag::default();
    }
    pub fn ui(&mut self, app: &CadApp, ctx: &egui::Context) {
        let Ok(st) = app.session.state() else { self.reset_geometry(); self.stamp=None; return };
        let stamp = (st.uid, st.revision);
        if self.stamp != Some(stamp) {
            let drawing = cadcraft_io::write_dxf(&st.doc);
            if drawing != self.drawing {
                if !self.drawing.is_empty() { self.recovery = serde_json::from_str(&self.snapshot()).ok(); }
                self.reset_geometry();
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
            if !self.visible {
                self.cube_drag = OrbitDrag::default(); self.viewport_drag = OrbitDrag::default();
                return;
            }
            ui.label("Preview recovery is local; solids are not written into DXF.");
            ui.horizontal(|ui| {
                ui.label("Height (mm)"); ui.add(egui::DragValue::new(&mut self.height).speed(0.5));
                if ui.add_enabled(selection.is_ok() && self.state.solids.len()<64, egui::Button::new("EXTRUIR")).clicked() {
                    match self.state.extrude_selected(self.height) {
                        Ok(id) => { self.select_solid(Some(id)); self.state.frame_solids(); self.message="Extruded in millimetres.".into(); }
                        Err(e) => self.message=format!("{e:?}"),
                    }
                }
            });
            if let Err(e) = &selection { ui.label(e); }
            ui.label(&self.message);
            ui.horizontal(|ui| {
                if ui.button("Fit").clicked() { self.state.frame_solids(); }
                if ui.button("Isometric").clicked() { self.state.view(View::NorthEastIso); }
                if ui.button("Clear solids").clicked() { self.state.solids.clear(); self.select_solid(None); }
            });
            if let Some(id) = self.selected_solid {
                ui.horizontal(|ui| {
                    ui.label(format!("Selected solid {id}"));
                    if ui.button("Deselect").clicked() { self.select_solid(None); }
                });
                ui.horizontal(|ui| {
                    ui.label("Solid height (mm)");
                    ui.add(egui::DragValue::new(&mut self.edit_height).speed(0.5));
                    if ui.button("Apply height").clicked() {
                        self.message = match self.state.set_solid_height(id,self.edit_height) {
                            Ok(()) => format!("Solid {id} height updated"),
                            Err(e) => format!("{e:?}"),
                        };
                    }
                });
            } else { ui.label("Tap a solid to select it for editing."); }
            self.viewcube(ui);
            let size=egui::vec2(ui.available_width().clamp(120.0,512.0),240.0);
            let (rect,response)=ui.allocate_exact_size(size,egui::Sense::click_and_drag());
            self.viewport_drag.apply(&mut self.state,&response);
            if response.hovered() {
                let zoom=ui.input(|i| i.zoom_delta() as f64 * (i.smooth_scroll_delta.y as f64 * 0.002).exp());
                self.state.camera.distance=(self.state.camera.distance / zoom).clamp(0.01,1e10);
            }
            let w=size.x as usize; let h=size.y as usize;
            let image=render_selected(&self.state,w,h,self.selected_solid);
            let texture=self.texture.get_or_insert_with(||ctx.load_texture("android-preview-depth",image.clone(),egui::TextureOptions::LINEAR));
            texture.set(image,egui::TextureOptions::LINEAR);
            ui.painter().image(texture.id(),rect,egui::Rect::from_min_max(egui::Pos2::ZERO,egui::pos2(1.0,1.0)),egui::Color32::WHITE);
            if response.clicked() && let Some(p)=response.interact_pointer_pos() {
                let scale=size.x.min(size.y) as f64/self.state.camera.distance;
                let x=(p.x-rect.center().x) as f64/scale;
                let y=-(p.y-rect.center().y) as f64/scale;
                self.pick(x,y);
            }
            ui.label("Drag to orbit · pinch/scroll to zoom · tap a cube face to snap");
        });
    }
    fn viewcube(&mut self, ui: &mut egui::Ui) {
        let (rect,response)=ui.allocate_exact_size(egui::vec2(120.0,100.0),egui::Sense::click_and_drag());
        self.cube_drag.apply(&mut self.state,&response);
        let mut snap=None;
        for face in cube_faces(&self.state,rect) {
            let pts=face.points;
            ui.painter().add(egui::Shape::convex_polygon(pts.to_vec(),egui::Color32::from_rgb(65,100,140),egui::Stroke::new(1.,egui::Color32::WHITE)));
            let center=egui::pos2(pts.iter().map(|p|p.x).sum::<f32>()/4.,pts.iter().map(|p|p.y).sum::<f32>()/4.);
            let galley=ui.painter().layout_no_wrap(face.label.into(),egui::FontId::proportional(10.),egui::Color32::WHITE);
            if label_fits(&pts,center,galley.size()) {
                ui.painter().galley(center-galley.size()/2.,galley,egui::Color32::WHITE);
            }
            if response.clicked() && response.interact_pointer_pos().is_some_and(|p| inside(p,&pts)) {snap=Some(face.view);}
        }
        if let Some(view)=snap {self.state.view(view);}
    }
}

/// The first dragged frame must include movement accumulated before egui's
/// drag threshold, not just that frame's pointer delta (often zero on touch).
#[derive(Default)]
struct OrbitDrag { total: egui::Vec2 }
impl OrbitDrag {
    fn apply(&mut self, state: &mut PreviewState, response: &egui::Response) {
        self.update(state,response.dragged(),response.total_drag_delta().unwrap_or_default());
    }
    fn update(&mut self, state: &mut PreviewState, dragged: bool, total: egui::Vec2) {
        if !dragged { self.total=egui::Vec2::ZERO; return; }
        let delta=total-self.total;
        self.total=total;
        if !delta.is_finite() || delta==egui::Vec2::ZERO { return; }
        let mut dy=delta.y as f64;
        // From an exact Top/Bottom snap, either vertical drag direction should
        // leave the pole immediately instead of being swallowed by its clamp.
        if state.camera.elevation.abs()>=std::f64::consts::FRAC_PI_2-1.1e-4
            && dy*state.camera.elevation>0.0 { dy = -dy; }
        state.drag_viewcube(delta.x as f64,dy);
    }
}
struct CubeFace { points: [egui::Pos2;4], view: View, label: &'static str }
fn cube_faces(state: &PreviewState, rect: egui::Rect) -> Vec<CubeFace> {
        let vertices=[Vec3::new(-1.,-1.,-1.),Vec3::new(1.,-1.,-1.),Vec3::new(1.,1.,-1.),Vec3::new(-1.,1.,-1.),
            Vec3::new(-1.,-1.,1.),Vec3::new(1.,-1.,1.),Vec3::new(1.,1.,1.),Vec3::new(-1.,1.,1.)];
        let (right,up,forward)=state.camera.basis();
        let projected=vertices.map(|v| (rect.center()+egui::vec2(v.dot(right) as f32*27.,-v.dot(up) as f32*27.),v.dot(forward)));
        let faces=[([0,3,2,1],View::Bottom,"Bottom"),([4,5,6,7],View::Top,"Top"),
            ([0,1,5,4],View::Front,"Front"),([3,7,6,2],View::Back,"Back"),
            ([0,4,7,3],View::Left,"Left"),([1,2,6,5],View::Right,"Right")];
        faces.into_iter().filter_map(|(indices,view,label)| {
            let [a,b,c,_]=indices.map(|i|vertices[i]);
            let normal=(b-a).cross(c-a).normalized();
            // Hidden and edge-on faces must neither paint labels nor steal hits.
            (normal.dot(forward) < -1e-6).then(||CubeFace{points:indices.map(|i|projected[i].0),view,label})
        }).collect()
}
fn label_fits(points: &[egui::Pos2;4], center: egui::Pos2, size: egui::Vec2) -> bool {
    let bounds=egui::Rect::from_center_size(center,size+egui::vec2(4.,4.));
    [bounds.left_top(),bounds.right_top(),bounds.right_bottom(),bounds.left_bottom()]
        .iter().all(|p|inside(*p,points))
}
fn inside(p:egui::Pos2, pts:&[egui::Pos2;4])->bool {
    let cross=|a:egui::Pos2,b:egui::Pos2| (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
    let c=[cross(pts[0],pts[1]),cross(pts[1],pts[2]),cross(pts[2],pts[3]),cross(pts[3],pts[0])];
    c.iter().all(|v|*v>=0.0)||c.iter().all(|v|*v<=0.0)
}

/// Per-pixel interpolated depth, across all solids; order independent occlusion.
pub fn render(state:&PreviewState,w:usize,h:usize)->egui::ColorImage {
    render_selected(state,w,h,None)
}
fn render_selected(state:&PreviewState,w:usize,h:usize,selected:Option<u64>)->egui::ColorImage {
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
        let base=if selected==Some(solid.id) {[255.,190.,70.]} else {[80.,170.,235.]};
        let color=egui::Color32::from_rgb((base[0]*light) as u8,(base[1]*light) as u8,(base[2]*light) as u8);
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
