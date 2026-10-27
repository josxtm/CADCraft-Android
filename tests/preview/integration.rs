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
    p.state.set_solid_offset(1,Vec3::new(5.,-3.,0.)).unwrap();
    let data:Value=serde_json::from_str(&p.snapshot()).unwrap();
    let mut restored=Preview::default(); restored.restore(&data,&p.drawing).unwrap();
    assert_eq!(restored.state.solids,p.state.solids); assert_eq!(restored.state.camera,p.state.camera);
    assert!(!restored.state.has_profile());
    assert!(restored.restore(&data,"other drawing").is_err());
    assert_eq!(restored.state.solids,p.state.solids);
    let mut bad=data.clone(); bad["solids"][0]["height"]=json!(0.);
    assert!(restored.restore(&bad,&p.drawing).is_err());
    assert_eq!(restored.state.solids,p.state.solids);
    bad=data.clone(); bad["camera"][2]=json!(-1.); assert!(restored.restore(&bad,&p.drawing).is_err());
    bad=data.clone(); bad["solids"][0]["offset"]=json!([f64::MAX,0.,0.]);
    assert!(restored.restore(&bad,&p.drawing).is_err());
    assert_eq!(restored.state.solids,p.state.solids);
    bad=data.clone(); bad["height"]=json!(0.);
    assert!(restored.restore(&bad,&p.drawing).is_err());
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
