//! Deterministic, read-only interchange from the experimental Rust 3D preview.
//! These exporters are NOT connected to the Android WebView or its save dialog.
//! They preserve world XYZ in millimetres, without silently quantizing to f32.

use std::collections::HashSet;
use std::fmt::Write;
use crate::workspace::{PreviewState, Solid};
use crate::Vec3;

/// Limit accidental multi-megabyte exports from malformed or untrusted input.
const MAX_EXPORT_TRIANGLES:usize=200_000;

#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum ExportError {
    EmptySelection,
    DuplicateId(u64),
    MissingSolid(u64),
    InvalidSolid(u64),
    TooManyFaces,
}

/// Validate the entire selection before emitting any geometry.
/// Separate solids are exported as separate shells; this is not a CSG union.
fn checked_solids<'a>(state:&'a PreviewState,ids:&[u64])
    ->Result<Vec<&'a Solid>,ExportError> {
    if ids.is_empty(){return Err(ExportError::EmptySelection)}
    let mut seen=HashSet::new();
    let mut result=Vec::with_capacity(ids.len());
    let mut total=0usize;
    for &id in ids {
        if !seen.insert(id){return Err(ExportError::DuplicateId(id))}
        let solid=state.solids.iter().find(|solid|solid.id==id)
            .ok_or(ExportError::MissingSolid(id))?;
        state.measure_solid(id).map_err(|_|ExportError::InvalidSolid(id))?;
        total=total.checked_add(solid.mesh.triangles.len())
            .ok_or(ExportError::TooManyFaces)?;
        if total>MAX_EXPORT_TRIANGLES{return Err(ExportError::TooManyFaces)}
        result.push(solid);
    }
    Ok(result)
}

fn world_point(solid:&Solid,index:u32)->Vec3 {
    // Prevalidated by measure_solid, including face indices and world bounds.
    solid.mesh.vertices[index as usize]+solid.offset
}

impl PreviewState {
    /// Wavefront OBJ with stable object groups and 1-based global vertex IDs.
    /// Uses 17 decimal places to retain small features far from the origin.
    /// OBJ is unitless; CADCraft interprets the source drawing units as mm.
    pub fn export_obj(&self,ids:&[u64])->Result<String,ExportError> {
        let solids=checked_solids(self,ids)?;
        let mut out=String::from("# CADCraft native3d experimental OBJ; coordinates in mm\n");
        let mut base=1usize;
        for solid in solids {
            writeln!(out,"o solid_{}",solid.id).unwrap();
            for (i,_) in solid.mesh.vertices.iter().enumerate() {
                let p=solid.mesh.vertices[i]+solid.offset;
                writeln!(out,"v {:.17} {:.17} {:.17}",p.x,p.y,p.z).unwrap();
            }
            for face in &solid.mesh.triangles {
                let a=base.checked_add(face[0] as usize).ok_or(ExportError::TooManyFaces)?;
                let b=base.checked_add(face[1] as usize).ok_or(ExportError::TooManyFaces)?;
                let c=base.checked_add(face[2] as usize).ok_or(ExportError::TooManyFaces)?;
                writeln!(out,"f {a} {b} {c}").unwrap();
            }
            base=base.checked_add(solid.mesh.vertices.len())
                .ok_or(ExportError::TooManyFaces)?;
        }
        Ok(out)
    }

    /// ASCII STL with outward-facing unit normals and world-space vertices.
    /// ASCII avoids the severe f32 coordinate rounding of binary STL at
    /// CADCraft's supported +/-100 million mm drawing limits.
    /// STL has no standard unit metadata: downstream consumers must use mm.
    pub fn export_ascii_stl(&self,ids:&[u64])->Result<String,ExportError> {
        let solids=checked_solids(self,ids)?;
        let mut out=String::from("solid CADCraft_mm\n");
        for solid in solids {
            for face in &solid.mesh.triangles {
                let [a,b,c]=face.map(|index|world_point(solid,index));
                // Normal from local coordinates, so large translations cannot
                // introduce cancellation in the cross product.
                let [ia,ib,ic]=*face;
                let la=solid.mesh.vertices[ia as usize];
                let lb=solid.mesh.vertices[ib as usize];
                let lc=solid.mesh.vertices[ic as usize];
                let normal=(lb-la).cross(lc-la).normalized();
                writeln!(out,"  facet normal {:.17} {:.17} {:.17}",
                         normal.x,normal.y,normal.z).unwrap();
                writeln!(out,"    outer loop").unwrap();
                for p in [a,b,c] {
                    writeln!(out,"      vertex {:.17} {:.17} {:.17}",
                             p.x,p.y,p.z).unwrap();
                }
                writeln!(out,"    endloop\n  endfacet").unwrap();
            }
        }
        out.push_str("endsolid CADCraft_mm\n");
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Point2,View,Vec3};

    fn square(x:f64,y:f64,side:f64)->Vec<Point2> {
        vec![Point2::new(x,y),Point2::new(x+side,y),
             Point2::new(x+side,y+side),Point2::new(x,y+side)]
    }
    #[test]fn sketch_to_edited_solid_to_world_obj_and_stl() {
        let mut s=PreviewState::default();
        s.select_profile_checked(55,square(0.0,0.0,10.0)).unwrap();
        let first=s.extrude_selected(5.0).unwrap();
        let second=s.duplicate_solid(first,Vec3::new(90_000_000.125,0.0,0.0)).unwrap();
        s.set_solid_height(second,-7.0).unwrap();
        s.refresh_source_profile(55,square(0.0,0.0,12.0)).unwrap();
        s.view(View::Top);
        let before_camera=s.camera;
        let before_solids=s.solids.clone();
        let obj=s.export_obj(&[second,first]).unwrap();
        assert!(obj.contains("o solid_2\n"));
        assert!(obj.contains("o solid_1\n"));
        assert_eq!(obj.lines().filter(|line|line.starts_with("v ")).count(),16);
        assert_eq!(obj.lines().filter(|line|line.starts_with("f ")).count(),24);
        assert!(obj.contains("v 90000000.12500000000000000"));
        assert!(obj.contains(" -7.00000000000000000"));
        // Each object's faces must reference its own globally numbered
        // vertex range regardless of ear-clipping order or winding.
        let groups:Vec<&str>=obj.split("o solid_1\n").collect();
        assert_eq!(groups.len(),2);
        let first_group=groups[0].split("o solid_2\n").nth(1).unwrap();
        for (group,lower,upper) in [(first_group,1usize,8usize),(groups[1],9,16)] {
            let mut faces=0;
            for line in group.lines().filter(|line|line.starts_with("f ")) {
                let ids:Vec<usize>=line.split_whitespace().skip(1)
                    .map(|token|token.parse().unwrap()).collect();
                assert_eq!(ids.len(),3);
                assert!(ids.iter().all(|id|*id>=lower&&*id<=upper));
                faces+=1;
            }
            assert_eq!(faces,12);
        }
        let stl=s.export_ascii_stl(&[second,first]).unwrap();
        assert!(stl.starts_with("solid CADCraft_mm\n"));
        assert!(stl.ends_with("endsolid CADCraft_mm\n"));
        assert_eq!(stl.matches("facet normal").count(),24);
        assert_eq!(stl.matches("      vertex ").count(),72);
        assert!(stl.contains("vertex 90000000.12500000000000000"));
        assert!(stl.contains("facet normal 0.00000000000000000 0.00000000000000000 1.00000000000000000"));
        assert!(stl.contains("facet normal 0.00000000000000000 0.00000000000000000 -1.00000000000000000"));
        assert_eq!(s.camera,before_camera);
        assert_eq!(s.solids,before_solids);
    }

    #[test]fn export_preflight_rejects_bad_selection_without_changing_scene() {
        let mut s=PreviewState::default();
        assert_eq!(s.export_obj(&[]),Err(ExportError::EmptySelection));
        s.select_profile_checked(7,square(0.0,0.0,10.0)).unwrap();
        let id=s.extrude_selected(10.0).unwrap();
        let before=s.solids.clone();
        assert_eq!(s.export_ascii_stl(&[id,id]),Err(ExportError::DuplicateId(id)));
        assert_eq!(s.export_obj(&[id,999]),Err(ExportError::MissingSolid(999)));
        assert_eq!(s.solids,before);
        s.solids[0].mesh.triangles.pop();
        assert_eq!(s.export_obj(&[id]),Err(ExportError::InvalidSolid(id)));
        assert_eq!(s.export_ascii_stl(&[id]),Err(ExportError::InvalidSolid(id)));
        s.solids=before;
        s.solids[0].offset=Vec3::new(100_000_000.0,0.0,0.0);
        assert_eq!(s.export_obj(&[id]),Err(ExportError::InvalidSolid(id)));
        assert_eq!(s.export_ascii_stl(&[id]),Err(ExportError::InvalidSolid(id)));
    }

    #[test]fn ascii_stl_normals_have_unit_length_after_negative_extrusion() {
        let mut s=PreviewState::default();
        s.select_profile_checked(1,square(0.0,0.0,3.0)).unwrap();
        let id=s.extrude_selected(-3.0).unwrap();
        let stl=s.export_ascii_stl(&[id]).unwrap();
        let mut count=0;
        for line in stl.lines().filter(|line|line.trim_start().starts_with("facet normal ")) {
            let xyz:Vec<f64>=line.split_whitespace().skip(2).map(|x|x.parse().unwrap()).collect();
            assert_eq!(xyz.len(),3);
            let norm=xyz.iter().map(|x|x*x).sum::<f64>().sqrt();
            assert!((norm-1.0).abs()<1e-12);
            count+=1;
        }
        assert_eq!(count,12);
    }
    #[test]fn export_rejects_non_manifold_vertex_and_duplicate_shell_coordinates() {
        let mut s=PreviewState::default();
        s.select_profile_checked(9,square(0.0,0.0,10.0)).unwrap();
        let id=s.extrude_selected(4.0).unwrap();
        let original=s.solids.clone();
        // A geometrically coincident vertex with a different index is an
        // unwelded seam, even when all original triangles remain unchanged.
        let duplicate=s.solids[0].mesh.vertices[0];
        s.solids[0].mesh.vertices.push(duplicate);
        // Rewire a face to the duplicate: identical geometry, broken indexing.
        let duplicate_index=(s.solids[0].mesh.vertices.len()-1) as u32;
        let face=s.solids[0].mesh.triangles.iter_mut()
            .find(|face|face.contains(&0)).expect("extruded square uses vertex zero");
        for vertex in face.iter_mut() {
            if *vertex==0 { *vertex=duplicate_index; break; }
        }
        assert_eq!(s.export_obj(&[id]),Err(ExportError::InvalidSolid(id)));
        assert_eq!(s.export_ascii_stl(&[id]),Err(ExportError::InvalidSolid(id)));
        // A valid mesh remains exportable after restoring the source.
        s.solids=original.clone();
        assert!(s.export_obj(&[id]).is_ok());
        assert!(s.export_ascii_stl(&[id]).is_ok());
        assert_eq!(s.solids,original);
    }

    #[test]fn repeated_exports_are_byte_stable_and_do_not_mutate_workspace() {
        let mut state=PreviewState::default();
        state.select_profile_checked(31,square(0.0,0.0,8.0)).unwrap();
        let first=state.extrude_selected(6.0).unwrap();
        let second=state.duplicate_solid(first,Vec3::new(20.0,0.0,0.0)).unwrap();
        state.set_solid_height(second,-4.0).unwrap();
        let scene_before=state.solids.clone();
        let camera_before=state.camera;
        let selection=[second,first];
        let obj=state.export_obj(&selection).unwrap();
        let stl=state.export_ascii_stl(&selection).unwrap();
        for _ in 0..3 {
            assert_eq!(state.export_obj(&selection).unwrap(),obj);
            assert_eq!(state.export_ascii_stl(&selection).unwrap(),stl);
        }
        assert_eq!(state.solids,scene_before);
        assert_eq!(state.camera,camera_before);
        assert_ne!(state.export_obj(&[first,second]).unwrap(),obj);
    }

    #[test]fn invalid_selection_does_not_emit_partial_export_after_valid_solid() {
        let mut state=PreviewState::default();
        state.select_profile_checked(41,square(0.0,0.0,5.0)).unwrap();
        let valid=state.extrude_selected(3.0).unwrap();
        let invalid=state.duplicate_solid(valid,Vec3::new(15.0,0.0,0.0)).unwrap();
        let baseline=state.export_obj(&[valid]).unwrap();
        state.solids.iter_mut().find(|solid|solid.id==invalid).unwrap()
            .mesh.triangles.pop();
        assert_eq!(state.export_obj(&[valid,invalid]),Err(ExportError::InvalidSolid(invalid)));
        assert_eq!(state.export_ascii_stl(&[valid,invalid]),Err(ExportError::InvalidSolid(invalid)));
        assert_eq!(state.export_obj(&[valid]).unwrap(),baseline);
    }

    #[test]fn export_preserves_negative_zero_free_coordinates_and_world_offsets() {
        let mut state=PreviewState::default();
        state.select_profile_checked(51,square(0.0,0.0,2.0)).unwrap();
        let id=state.extrude_selected(1.0).unwrap();
        state.set_solid_offset(id,Vec3::new(10.0,20.0,30.0)).unwrap();
        let obj=state.export_obj(&[id]).unwrap();
        assert!(obj.contains("v 10.00000000000000000 20.00000000000000000 30.00000000000000000"));
        assert_eq!(obj.lines().filter(|line|line.starts_with("v ")).count(),8);
        let stl=state.export_ascii_stl(&[id]).unwrap();
        assert!(stl.contains("vertex 10.00000000000000000 20.00000000000000000 30.00000000000000000"));
        assert_eq!(stl.matches("facet normal").count(),12);
    }

}
