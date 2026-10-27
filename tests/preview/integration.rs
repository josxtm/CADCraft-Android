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

#[test] fn viewport_visibility_roundtrip_and_legacy_snapshots() {
    let mut p=preview();
    for visible in [true,false] {
        p.visible=visible;
        let data:Value=serde_json::from_str(&p.snapshot()).unwrap();
        let mut loaded=Preview::load(Some(data.to_string()));
        assert_eq!(loaded.visible,visible);
        loaded.restore(&data,&p.drawing).unwrap();
        assert_eq!(loaded.visible,visible);
    }
    let mut legacy:Value=serde_json::from_str(&p.snapshot()).unwrap();
    legacy.as_object_mut().unwrap().remove("visible");
    legacy.as_object_mut().unwrap().remove("selected_solid");
    p.restore(&legacy,"exact drawing contents").unwrap();
    assert!(!p.visible); assert_eq!(p.selected_solid,None);
    let before=p.snapshot();
    legacy["visible"]=json!("yes");
    assert!(p.restore(&legacy,"exact drawing contents").is_err());
    assert_eq!(p.snapshot(),before);
}

#[test] fn solid_selection_survives_profile_clear_camera_edits_and_reload_with_id_gaps() {
    let mut p=preview();
    let second=p.state.extrude_selected(40.).unwrap();
    assert!(p.state.remove_solid(1)); // Recovery will renumber the remaining solid.
    p.state.frame_solids();
    p.pick(0.,0.);
    assert_eq!(p.selected_solid,Some(second));
    assert_eq!(p.edit_height,40.);
    p.state.clear_selection(); // Normal 2D selection synchronization each frame.
    p.state.view(View::Front);
    p.state.drag_viewcube(10.,-4.);
    assert_eq!(p.selected_solid,Some(second));
    let data:Value=serde_json::from_str(&p.snapshot()).unwrap();
    assert_eq!(data["selected_solid"],json!(0));
    let mut loaded=Preview::default();
    loaded.restore(&data,&p.drawing).unwrap();
    assert_eq!(loaded.selected_solid,Some(loaded.state.solids[0].id));
    assert_eq!(loaded.state.solids[0].source_handle,Some(42));
    assert_eq!(loaded.edit_height,40.);
    let id=loaded.selected_solid.unwrap();
    loaded.state.set_solid_height(id,55.).unwrap();
    assert_eq!(loaded.selected_solid,Some(id));
    assert_eq!(loaded.state.solids[0].height,55.);
    assert_eq!(loaded.state.solids[0].id,id);
    let before=loaded.snapshot();
    assert!(loaded.state.set_solid_height(id,0.).is_err());
    assert_eq!(loaded.snapshot(),before);
    let mut bad=data.clone(); bad["selected_solid"]=json!(999);
    assert!(loaded.restore(&bad,&p.drawing).is_err()); assert_eq!(loaded.snapshot(),before);
    bad["selected_solid"]=json!(-1);
    assert!(loaded.restore(&bad,&p.drawing).is_err()); assert_eq!(loaded.snapshot(),before);
    loaded.pick(1e6,1e6); assert_eq!(loaded.selected_solid,None);
    loaded.select_solid(Some(id));
    loaded.reset_geometry(); assert_eq!(loaded.selected_solid,None);
    assert!(loaded.state.solids.is_empty());
}

#[test] fn selection_highlight_respects_depth_and_other_solids() {
    let mut p=preview(); p.state.view(View::Top);
    let upper=p.state.duplicate_solid(1,Vec3::new(0.,0.,30.)).unwrap();
    let ordinary=render(&p.state,120,100);
    // Fully occluded selected geometry must not bleed through the visible solid.
    assert_eq!(ordinary.pixels,render_selected(&p.state,120,100,Some(1)).pixels);
    assert_ne!(ordinary.pixels,render_selected(&p.state,120,100,Some(upper)).pixels);
    p.pick(0.,0.); assert_eq!(p.selected_solid,Some(upper));
}

#[test] fn first_drag_from_both_poles_moves_in_either_direction_without_lost_threshold() {
    for view in [View::Top,View::Bottom] {
        for dy in [-20.,20.] {
            let mut p=preview(); p.state.view(view);
            let before=render(&p.state,160,140);
            let solids=p.state.solids.clone();
            let mut drag=OrbitDrag::default();
            // First event includes the full pre-threshold displacement.
            drag.update(&mut p.state,true,egui::vec2(12.,dy));
            assert!((p.state.camera.azimuth-0.12).abs()<1e-9);
            assert!((p.state.camera.elevation.abs()-(std::f64::consts::FRAC_PI_2-0.2)).abs()<1e-6);
            assert_ne!(before.pixels,render(&p.state,160,140).pixels);
            let first=p.state.camera;
            drag.update(&mut p.state,true,egui::vec2(12.,dy));
            assert_eq!(p.state.camera,first); // Repeated frame cannot apply twice.
            drag.update(&mut p.state,true,egui::vec2(16.,dy));
            assert!((p.state.camera.azimuth-0.16).abs()<1e-9);
            drag.update(&mut p.state,false,egui::Vec2::ZERO);
            drag.update(&mut p.state,true,egui::vec2(10.,0.));
            assert!((p.state.camera.azimuth-0.26).abs()<1e-9);
            assert_eq!(p.state.solids,solids);
        }
    }
}

#[test] fn cube_culls_hidden_faces_and_labels_fit_without_overlapping() {
    let rect=egui::Rect::from_min_size(egui::Pos2::ZERO,egui::vec2(120.,100.));
    let mut p=preview();
    for view in [View::Top,View::Bottom,View::Front,View::Back,View::Left,View::Right] {
        p.state.view(view);
        let faces=cube_faces(&p.state,rect);
        assert_eq!(faces.len(),1);
        assert_eq!(faces[0].view,view);
        assert!(inside(rect.center(),&faces[0].points));
        assert!(label_fits(&faces[0].points,rect.center(),egui::vec2(35.,12.)));
    }
    // Sweep orientations including nearly edge-on faces. Fit rectangles cannot
    // overlap because their four corners must stay within disjoint front faces.
    for a in 0..24 { for e in -11..=11 {
        p.state.camera.azimuth=a as f64*std::f64::consts::TAU/24.;
        p.state.camera.elevation=e as f64*std::f64::consts::FRAC_PI_2/12.;
        let faces=cube_faces(&p.state,rect);
        assert!((1..=3).contains(&faces.len()));
        let mut labels:Vec<egui::Rect>=Vec::new();
        for face in faces {
            let center=egui::pos2(face.points.iter().map(|p|p.x).sum::<f32>()/4.,face.points.iter().map(|p|p.y).sum::<f32>()/4.);
            let size=egui::vec2(35.,12.);
            if label_fits(&face.points,center,size) {
                let bounds=egui::Rect::from_center_size(center,size);
                assert!(labels.iter().all(|previous|!previous.intersects(bounds)));
                labels.push(bounds);
            }
        }
    }}
}
