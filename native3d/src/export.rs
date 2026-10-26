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
        assert!(obj.lines().any(|line|line=="f 9 10 11"||
                                 line=="f 11 10 9"||
                                 line=="f 12 10 9"));
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
}
