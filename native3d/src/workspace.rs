//! UI-facing adapter for selected 2D profiles and an orbitable solid preview.
//! Independent of upstream egui so CADCraft can call this through a narrow API.
use crate::{extrude,inspect_closed_mesh,Camera,ExtrudeError,Mesh,Point2,View,Vec3,MAX_WORLD_COORD};

#[derive(Clone,Debug,PartialEq)]
pub struct Solid {
    pub id:u64,
    pub source_handle:Option<u64>,
    pub height:f64,
    pub outline:Vec<Point2>,
    pub mesh:Mesh,
    /// World-space translation; does not change the linked 2D sketch.
    pub offset:Vec3,
}

#[derive(Debug,PartialEq)]
pub enum WorkspaceError {
    NoProfile,
    InvalidHeight,
    InvalidOffset,
    Geometry(ExtrudeError),
    SolidNotFound,
    IdExhausted,
    InvalidMesh,
}

/// Read-only dimension report for a closed triangulated preview solid.
/// Surface area and volume are in mm²/mm³; AABB is in world coordinates.
#[derive(Clone,Copy,Debug,PartialEq)]
pub struct SolidMeasurements {
    pub volume_mm3:f64,
    pub surface_area_mm2:f64,
    pub bounds_min:Vec3,
    pub bounds_max:Vec3,
}

#[derive(Clone,Debug)]
pub struct PreviewState {
    pub camera:Camera,
    pub solids:Vec<Solid>,
    selected_outline:Option<Vec<Point2>>,
    selected_handle:Option<u64>,
    next_id:u64,
}

impl Default for PreviewState {
    fn default()->Self {
        Self{camera:Camera::new(),solids:Vec::new(),selected_outline:None,selected_handle:None,next_id:1}
    }
}
impl PreviewState {
    /// Send a CADCraft selected closed profile (rectangle or closed LWPOLYLINE)
    /// into the 3D preview. Coordinates are in the drawing's native units.
    /// A DXF bulge/arc must first be tessellated by the caller.
    /// Checked entry point for handing a selected 2D sketch to the 3D preview.
    /// The preflight uses a unit-height extrusion; the requested final height
    /// is validated separately by extrude_selected. Invalid input cannot
    /// overwrite a valid selection or consume a solid ID.
    pub fn select_profile_checked(&mut self,source_handle:u64,outline:Vec<Point2>)
        ->Result<(),WorkspaceError> {
        let candidate=extrude(&outline,1.0).map_err(WorkspaceError::Geometry)?;
        Self::validate_world_mesh(&candidate,Vec3::new(0.0,0.0,0.0))?;
        self.select_profile(source_handle,outline);
        Ok(())
    }
    /// Legacy unchecked selection setter; use select_profile_checked at the
    /// 2D-to-3D boundary for transactional input validation.
    pub fn select_profile(&mut self,source_handle:u64,outline:Vec<Point2>){
        self.selected_handle=Some(source_handle);
        self.selected_outline=Some(outline);
    }
    pub fn clear_selection(&mut self){
        self.selected_handle=None;
        self.selected_outline=None;
    }
    pub fn has_profile(&self)->bool {self.selected_outline.is_some()}
    /// Preflight every translated vertex before committing an edit.
    /// The original profile and its non-translated triangulation stay untouched.
    fn validate_world_mesh(mesh:&Mesh,offset:Vec3)->Result<(),WorkspaceError> {
        let components=[offset.x,offset.y,offset.z];
        if components.iter().any(|v|!v.is_finite()||v.abs()>MAX_WORLD_COORD) {
            return Err(WorkspaceError::InvalidOffset)
        }
        for point in &mesh.vertices {
            let world=*point+offset;
            if [world.x,world.y,world.z].iter().any(|v|!v.is_finite()||v.abs()>MAX_WORLD_COORD) {
                return Err(WorkspaceError::Geometry(ExtrudeError::OutOfBounds))
            }
        }
        Ok(())
    }
    pub fn extrude_selected(&mut self,height:f64)->Result<u64,WorkspaceError> {
        if !height.is_finite()||height.abs()<1e-10{return Err(WorkspaceError::InvalidHeight)}
        let points=self.selected_outline.as_ref().ok_or(WorkspaceError::NoProfile)?;
        let mesh=extrude(points,height).map_err(WorkspaceError::Geometry)?;
        // Reserve an ID only after geometry succeeds; never silently reuse
        // u64::MAX after saturating_add, which would create duplicate solids.
        let id=self.next_id;
        let following_id=id.checked_add(1).ok_or(WorkspaceError::IdExhausted)?;
        self.solids.push(Solid{id,source_handle:self.selected_handle,height,outline:points.clone(),mesh,
            offset:Vec3::new(0.0,0.0,0.0)});
        self.next_id=following_id;
        Ok(id)
    }
    /// Change an existing extrusion's height without replacing its identity
    /// or detaching it from its selected 2D source. Failed edits are atomic:
    /// neither the original height nor its triangles are touched.
    pub fn set_solid_height(&mut self,id:u64,height:f64)->Result<(),WorkspaceError> {
        let index=self.solids.iter().position(|solid|solid.id==id)
            .ok_or(WorkspaceError::SolidNotFound)?;
        if !height.is_finite()||height.abs()<1e-10 {
            return Err(WorkspaceError::InvalidHeight)
        }
        let candidate=extrude(&self.solids[index].outline,height)
            .map_err(WorkspaceError::Geometry)?;
        Self::validate_world_mesh(&candidate,self.solids[index].offset)?;
        self.solids[index].mesh=candidate;
        self.solids[index].height=height;
        Ok(())
    }
    /// Rebuild every preview solid linked to an edited 2D source profile.
    /// All meshes are checked first: invalid input leaves solids, IDs and
    /// the current selection untouched. Existing extrusion heights remain.
    /// This prototype is not yet connected to the Android document model.
    pub fn refresh_source_profile(&mut self,source_handle:u64,outline:Vec<Point2>)
        ->Result<usize,WorkspaceError> {
        let mut rebuilt=Vec::new();
        for (index,solid) in self.solids.iter().enumerate() {
            if solid.source_handle==Some(source_handle) {
                let mesh=extrude(&outline,solid.height).map_err(WorkspaceError::Geometry)?;
                Self::validate_world_mesh(&mesh,solid.offset)?;
                rebuilt.push((index,mesh));
            }
        }
        if rebuilt.is_empty() {
            // A 2D edit may arrive before the first extrusion. Refresh the
            // selected sketch as well, but never replace it with an invalid
            // profile. Other selections and the ID counter stay untouched.
            if self.selected_handle==Some(source_handle) {
                extrude(&outline,1.0).map_err(WorkspaceError::Geometry)?;
                self.selected_outline=Some(outline);
            }
            return Ok(0)
        }
        let count=rebuilt.len();
        for (index,mesh) in rebuilt {
            self.solids[index].mesh=mesh;
            self.solids[index].outline=outline.clone();
        }
        if self.selected_handle==Some(source_handle) {
            self.selected_outline=Some(outline);
        }
        Ok(count)
    }
    /// Place one source extrusion in world XYZ without changing its sketch,
    /// height, solid identity, or the saved source linkage.
    /// Out-of-range edits are rejected without mutating camera or solids.
    pub fn set_solid_offset(&mut self,id:u64,offset:Vec3)->Result<(),WorkspaceError> {
        let index=self.solids.iter().position(|solid|solid.id==id)
            .ok_or(WorkspaceError::SolidNotFound)?;
        Self::validate_world_mesh(&self.solids[index].mesh,offset)?;
        self.solids[index].offset=offset;
        Ok(())
    }
    /// Clone an existing extrusion into a new, independently movable solid.
    /// The 2D source link is intentionally shared: later sketch updates
    /// regenerate both copies, but dimensions and XYZ offsets remain per-solid.
    /// Validate placement and ID space before touching the live preview.
    pub fn duplicate_solid(&mut self,id:u64,offset:Vec3)->Result<u64,WorkspaceError> {
        let original=self.solids.iter().find(|solid|solid.id==id)
            .ok_or(WorkspaceError::SolidNotFound)?;
        Self::validate_world_mesh(&original.mesh,offset)?;
        let new_id=self.next_id;
        let following_id=new_id.checked_add(1).ok_or(WorkspaceError::IdExhausted)?;
        let mut copy=original.clone();
        copy.id=new_id;
        copy.offset=offset;
        self.solids.push(copy);
        self.next_id=following_id;
        Ok(new_id)
    }
    /// Detach one source extrusion from its shared 2D sketch. Its identity,
    /// local mesh, independently edited height, placement and camera remain
    /// unchanged. Other copies still follow future updates to the same sketch.
    /// Returns false when the extrusion is already independent.
    pub fn detach_solid_source(&mut self,id:u64)->Result<bool,WorkspaceError> {
        let solid=self.solids.iter_mut().find(|solid|solid.id==id)
            .ok_or(WorkspaceError::SolidNotFound)?;
        Ok(solid.source_handle.take().is_some())
    }
    /// Get a source mesh vertex with its current world XYZ translation.
    pub fn solid_world_vertex(&self,id:u64,vertex_index:usize)->Option<Vec3> {
        let solid=self.solids.iter().find(|solid|solid.id==id)?;
        solid.mesh.vertices.get(vertex_index).map(|point|*point+solid.offset)
    }
    /// Return manufacturing-oriented measurements of one selected extrusion.
    /// Compute face geometry relative to a local mesh origin so a part many
    /// kilometres from (0,0,0) does not lose small areas or volumes through
    /// cancellation. World bounds include the independent XYZ offset.
    /// Invalid faces are rejected; this query never changes model or camera.
    pub fn measure_solid(&self,id:u64)->Result<SolidMeasurements,WorkspaceError> {
        let solid=self.solids.iter().find(|item|item.id==id)
            .ok_or(WorkspaceError::SolidNotFound)?;
        let mesh=&solid.mesh;
        // Measurements are meaningless for an open/reversed/bow-tie mesh.
        inspect_closed_mesh(mesh).map_err(|_|WorkspaceError::InvalidMesh)?;
        let origin=*mesh.vertices.first().ok_or(WorkspaceError::InvalidMesh)?;
        if mesh.triangles.is_empty(){return Err(WorkspaceError::InvalidMesh)}
        let mut min=Vec3::new(f64::INFINITY,f64::INFINITY,f64::INFINITY);
        let mut max=Vec3::new(f64::NEG_INFINITY,f64::NEG_INFINITY,f64::NEG_INFINITY);
        for &local in &mesh.vertices {
            let p=local+solid.offset;
            if !p.x.is_finite()||!p.y.is_finite()||!p.z.is_finite()||
               [p.x,p.y,p.z].iter().any(|v|v.abs()>MAX_WORLD_COORD) {
                return Err(WorkspaceError::InvalidMesh)
            }
            min.x=min.x.min(p.x);min.y=min.y.min(p.y);min.z=min.z.min(p.z);
            max.x=max.x.max(p.x);max.y=max.y.max(p.y);max.z=max.z.max(p.z);
        }
        let mut oriented_volume=0.0;
        let mut surface_area=0.0;
        for face in &mesh.triangles {
            let a=*mesh.vertices.get(face[0] as usize).ok_or(WorkspaceError::InvalidMesh)?-origin;
            let b=*mesh.vertices.get(face[1] as usize).ok_or(WorkspaceError::InvalidMesh)?-origin;
            let c=*mesh.vertices.get(face[2] as usize).ok_or(WorkspaceError::InvalidMesh)?-origin;
            let normal=(b-a).cross(c-a);
            let double_area=normal.norm();
            if !double_area.is_finite()||double_area<=1e-12 {
                return Err(WorkspaceError::InvalidMesh)
            }
            surface_area+=double_area/2.0;
            oriented_volume+=a.dot(b.cross(c))/6.0;
        }
        if !surface_area.is_finite()||!oriented_volume.is_finite()||
           oriented_volume<=1e-10 {
            return Err(WorkspaceError::InvalidMesh)
        }
        Ok(SolidMeasurements{volume_mm3:oriented_volume,surface_area_mm2:surface_area,
                             bounds_min:min,bounds_max:max})
    }
    pub fn remove_solid(&mut self,id:u64)->bool {
        let before=self.solids.len();
        self.solids.retain(|solid|solid.id!=id);
        self.solids.len()!=before
    }
    /// Frame one object, without moving it or altering the current 2D source.
    /// A missing solid does not modify the camera.
    pub fn focus_solid(&mut self,id:u64)->Result<(),WorkspaceError> {
        let solid=self.solids.iter().find(|solid|solid.id==id)
            .ok_or(WorkspaceError::SolidNotFound)?;
        let mut min=Vec3::new(f64::INFINITY,f64::INFINITY,f64::INFINITY);
        let mut max=Vec3::new(f64::NEG_INFINITY,f64::NEG_INFINITY,f64::NEG_INFINITY);
        for &local in &solid.mesh.vertices {
            let p=local+solid.offset;
            min.x=min.x.min(p.x);min.y=min.y.min(p.y);min.z=min.z.min(p.z);
            max.x=max.x.max(p.x);max.y=max.y.max(p.y);max.z=max.z.max(p.z);
        }
        if !min.x.is_finite() {
            return Err(WorkspaceError::Geometry(ExtrudeError::DegeneratePolygon))
        }
        self.camera.target=(min+max)*0.5;
        self.camera.distance=((max-min).norm()*1.7).max(1.0);
        Ok(())
    }
    pub fn view(&mut self,view:View){self.camera.snap(view)}
    pub fn drag_viewcube(&mut self,dx:f64,dy:f64){self.camera.orbit(dx,dy,0.01)}
    /// Orthographic projection of a world point to camera coordinates.
    /// The caller should scale and translate these coordinates to viewport pixels.
    pub fn project(&self,point:Vec3)->(f64,f64,f64){
        let (right,up,forward)=self.camera.basis();
        let delta=point-self.camera.target;
        (delta.dot(right),delta.dot(up),delta.dot(forward))
    }
    /// A visible bounds estimate to frame current 3D solids.
    pub fn frame_solids(&mut self){
        let mut min=Vec3::new(f64::INFINITY,f64::INFINITY,f64::INFINITY);
        let mut max=Vec3::new(f64::NEG_INFINITY,f64::NEG_INFINITY,f64::NEG_INFINITY);
        for solid in &self.solids {
            for &local in &solid.mesh.vertices {
                let p=local+solid.offset;
                min.x=min.x.min(p.x);min.y=min.y.min(p.y);min.z=min.z.min(p.z);
                max.x=max.x.max(p.x);max.y=max.y.max(p.y);max.z=max.z.max(p.z);
            }
        }
        if min.x.is_finite() {
            self.camera.target=(min+max)*0.5;
            self.camera.distance=((max-min).norm()*1.7).max(1.0);
        }
    }
}

#[cfg(test)]
mod tests{
    use super::*;
    #[test]fn checked_2d_handoff_rejects_invalid_without_losing_selection() {
        let mut state=PreviewState::default();
        let square=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                        Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile_checked(7,square.clone()).unwrap();
        let id=state.extrude_selected(5.0).unwrap();
        let old_solids=state.solids.clone();
        let old_camera=state.camera;
        let crossed=vec![Point2::new(0.0,0.0),Point2::new(10.0,10.0),
                         Point2::new(0.0,10.0),Point2::new(10.0,0.0)];
        assert!(state.select_profile_checked(8,crossed).is_err());
        let outside=vec![Point2::new(MAX_WORLD_COORD+1.0,0.0),
                         Point2::new(MAX_WORLD_COORD+11.0,0.0),
                         Point2::new(MAX_WORLD_COORD+11.0,10.0),
                         Point2::new(MAX_WORLD_COORD+1.0,10.0)];
        assert_eq!(state.select_profile_checked(8,outside),
                   Err(WorkspaceError::Geometry(ExtrudeError::OutOfBounds)));
        assert_eq!(state.selected_handle,Some(7));
        assert_eq!(state.selected_outline,Some(square));
        assert_eq!(state.solids,old_solids);
        assert_eq!(state.camera,old_camera);
        let rectangle=vec![Point2::new(0.0,0.0),Point2::new(20.0,0.0),
                           Point2::new(20.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile_checked(8,rectangle.clone()).unwrap();
        assert_eq!(state.extrude_selected(3.0).unwrap(),id+1);
        assert_eq!(state.solids[0],old_solids[0]);
        assert_eq!(state.solids[1].source_handle,Some(8));
        assert_eq!(state.solids[1].outline,rectangle);
    }

    #[test]fn checked_2d_handoff_preserves_empty_state_on_rejection() {
        let mut state=PreviewState::default();
        assert!(state.select_profile_checked(4,vec![]).is_err());
        assert!(!state.has_profile());
        assert!(state.solids.is_empty());
        assert_eq!(state.next_id,1);
        let triangle=vec![Point2::new(0.0,0.0),Point2::new(5.0,0.0),
                          Point2::new(0.0,5.0)];
        state.select_profile_checked(4,triangle).unwrap();
        assert_eq!(state.extrude_selected(2.0),Ok(1));
    }

    #[test]fn selected_rectangle_to_solid(){
        let mut state=PreviewState::default();
        state.select_profile(0x101,vec![Point2::new(0.0,0.0),Point2::new(100.0,0.0),Point2::new(100.0,60.0),Point2::new(0.0,60.0)]);
        let id=state.extrude_selected(25.0).unwrap();
        assert_eq!(id,1);
        assert_eq!(state.solids[0].source_handle,Some(0x101));
        assert_eq!(state.solids[0].mesh.triangles.len(),12);
        state.frame_solids();
        assert_eq!(state.camera.target,Vec3::new(50.0,30.0,12.5));
        state.view(View::Top);
        assert!(state.camera.eye().z>state.camera.target.z);
        state.drag_viewcube(50.0,30.0);
        assert!(state.remove_solid(id));
        assert!(state.solids.is_empty());
    }
    #[test]fn rejects_empty_and_zero_height(){
        let mut state=PreviewState::default();
        assert_eq!(state.extrude_selected(5.0),Err(WorkspaceError::NoProfile));
        assert_eq!(state.extrude_selected(0.0),Err(WorkspaceError::InvalidHeight));
    }

    #[test]fn out_of_range_extrusion_preserves_solids_and_ids(){
        let mut state=PreviewState::default();
        let square=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                        Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile(7,square.clone());
        assert_eq!(state.extrude_selected(100_000_001.0),
                   Err(WorkspaceError::Geometry(ExtrudeError::OutOfBounds)));
        assert!(state.solids.is_empty());
        assert_eq!(state.extrude_selected(2.0).unwrap(),1);
        let original=state.solids[0].clone();
        state.select_profile(8,vec![Point2::new(100_000_001.0,0.0),
            Point2::new(100_000_011.0,0.0),Point2::new(100_000_011.0,10.0),
            Point2::new(100_000_001.0,10.0)]);
        assert_eq!(state.extrude_selected(2.0),
                   Err(WorkspaceError::Geometry(ExtrudeError::OutOfBounds)));
        assert_eq!(state.solids,vec![original]);
        state.select_profile(9,square);
        assert_eq!(state.extrude_selected(2.0).unwrap(),2);
    }
    #[test]fn changing_height_is_atomic_and_preserves_source_link() {
        let mut state=PreviewState::default();
        let square=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                        Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile(7,square.clone());
        assert_eq!(state.extrude_selected(2.0),Ok(1));
        assert_eq!(state.extrude_selected(5.0),Ok(2));
        state.select_profile(8,square.clone());
        assert_eq!(state.extrude_selected(3.0),Ok(3));
        let before=state.solids.clone();
        let camera=state.camera;
        assert_eq!(state.set_solid_height(999,4.0),Err(WorkspaceError::SolidNotFound));
        assert_eq!(state.set_solid_height(1,0.0),Err(WorkspaceError::InvalidHeight));
        assert_eq!(state.set_solid_height(1,f64::NAN),Err(WorkspaceError::InvalidHeight));
        assert_eq!(state.set_solid_height(1,100_000_001.0),
                   Err(WorkspaceError::Geometry(ExtrudeError::OutOfBounds)));
        assert_eq!(state.solids,before);
        assert_eq!(state.camera,camera);
        assert_eq!(state.set_solid_height(1,-4.0),Ok(()));
        assert_eq!(state.solids[0].id,1);
        assert_eq!(state.solids[0].source_handle,Some(7));
        assert_eq!(state.solids[0].height,-4.0);
        assert_eq!(state.solids[0].mesh.vertices[4].z,-4.0);
        assert_eq!(state.solids[0].mesh.triangles.len(),12);
        assert_eq!(state.solids[1],before[1]);
        assert_eq!(state.solids[2],before[2]);
        // A later 2D update respects each solid's *edited* height.
        let wide=vec![Point2::new(0.0,0.0),Point2::new(20.0,0.0),
                      Point2::new(20.0,10.0),Point2::new(0.0,10.0)];
        assert_eq!(state.refresh_source_profile(7,wide),Ok(2));
        assert_eq!(state.solids[0].height,-4.0);
        assert_eq!(state.solids[0].mesh.vertices[4].z,-4.0);
        assert_eq!(state.solids[1].height,5.0);
        assert_eq!(state.solids[2],before[2]);
        assert_eq!(state.extrude_selected(1.0),Ok(4));
    }
    #[test]fn exhausted_id_space_never_reuses_solid_ids() {
        let mut state=PreviewState::default();
        state.select_profile(1,vec![Point2::new(0.0,0.0),Point2::new(2.0,0.0),
                                    Point2::new(2.0,2.0),Point2::new(0.0,2.0)]);
        state.next_id=u64::MAX-1;
        assert_eq!(state.extrude_selected(2.0),Ok(u64::MAX-1));
        let before=state.solids.clone();
        assert_eq!(state.extrude_selected(3.0),Err(WorkspaceError::IdExhausted));
        assert_eq!(state.solids,before);
        assert_eq!(state.next_id,u64::MAX);
    }
    #[test]fn refreshing_selected_sketch_before_first_extrusion_is_safe() {
        let mut state=PreviewState::default();
        let square=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                        Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        let rectangle=vec![Point2::new(0.0,0.0),Point2::new(20.0,0.0),
                           Point2::new(20.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile(42,square.clone());
        let invalid=vec![Point2::new(0.0,0.0),Point2::new(2.0,2.0),
                         Point2::new(0.0,2.0),Point2::new(2.0,0.0)];
        assert!(state.refresh_source_profile(42,invalid).is_err());
        assert_eq!(state.selected_outline,Some(square.clone()));
        assert_eq!(state.next_id,1);
        assert!(state.solids.is_empty());
        // A different source must not replace the current 2D selection.
        assert_eq!(state.refresh_source_profile(999,rectangle.clone()),Ok(0));
        assert_eq!(state.selected_outline,Some(square));
        assert_eq!(state.refresh_source_profile(42,rectangle.clone()),Ok(0));
        assert_eq!(state.selected_outline,Some(rectangle.clone()));
        assert_eq!(state.next_id,1);
        let id=state.extrude_selected(3.0).unwrap();
        assert_eq!(id,1);
        assert_eq!(state.solids[0].source_handle,Some(42));
        assert_eq!(state.solids[0].outline,rectangle);
        assert_eq!(state.solids[0].mesh.vertices[1].x,20.0);
    }
    #[test]fn refreshing_a_2d_source_is_atomic_and_keeps_solid_identity(){
        let mut state=PreviewState::default();
        let square=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                        Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile(7,square.clone());
        assert_eq!(state.extrude_selected(2.0).unwrap(),1);
        assert_eq!(state.extrude_selected(5.0).unwrap(),2);
        state.select_profile(8,square.clone());
        assert_eq!(state.extrude_selected(3.0).unwrap(),3);
        state.select_profile(7,square.clone());
        let before=state.solids.clone();
        let invalid=vec![Point2::new(100_000_001.0,0.0),
                         Point2::new(100_000_011.0,0.0),
                         Point2::new(100_000_011.0,10.0),
                         Point2::new(100_000_001.0,10.0)];
        assert_eq!(state.refresh_source_profile(7,invalid),
                   Err(WorkspaceError::Geometry(ExtrudeError::OutOfBounds)));
        assert_eq!(state.solids,before);
        assert_eq!(state.selected_outline,Some(square));
        let rectangle=vec![Point2::new(0.0,0.0),Point2::new(20.0,0.0),
                           Point2::new(20.0,10.0),Point2::new(0.0,10.0)];
        assert_eq!(state.refresh_source_profile(7,rectangle.clone()),Ok(2));
        assert_eq!(state.solids.iter().map(|s|s.id).collect::<Vec<_>>(),vec![1,2,3]);
        assert_eq!(state.solids[0].source_handle,Some(7));
        assert_eq!(state.solids[1].source_handle,Some(7));
        assert_eq!(state.solids[0].height,2.0);
        assert_eq!(state.solids[1].height,5.0);
        assert_eq!(state.solids[0].mesh.vertices[1].x,20.0);
        assert_eq!(state.solids[1].mesh.vertices[5].z,5.0);
        assert_eq!(state.solids[0].outline,rectangle);
        assert_eq!(state.solids[2],before[2]);
        assert_eq!(state.selected_outline,Some(rectangle));
        assert_eq!(state.refresh_source_profile(999,vec![]),Ok(0));
        assert_eq!(state.extrude_selected(1.0).unwrap(),4);
    }

    #[test]fn translated_solids_have_safe_world_coordinates_and_camera_frame() {
        let mut state=PreviewState::default();
        let square=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                        Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile(7,square.clone());
        assert_eq!(state.extrude_selected(10.0),Ok(1));
        let first=state.solids[0].clone();
        assert_eq!(state.set_solid_offset(999,Vec3::new(40.0,20.0,5.0)),
                   Err(WorkspaceError::SolidNotFound));
        assert_eq!(state.set_solid_offset(1,Vec3::new(f64::NAN,0.0,0.0)),
                   Err(WorkspaceError::InvalidOffset));
        assert_eq!(state.set_solid_offset(1,Vec3::new(MAX_WORLD_COORD+1.0,0.0,0.0)),
                   Err(WorkspaceError::InvalidOffset));
        assert_eq!(state.set_solid_offset(1,Vec3::new(MAX_WORLD_COORD-5.0,0.0,0.0)),
                   Err(WorkspaceError::Geometry(ExtrudeError::OutOfBounds)));
        assert_eq!(state.solids[0],first);
        assert_eq!(state.set_solid_offset(1,Vec3::new(40.0,20.0,5.0)),Ok(()));
        assert_eq!(state.solid_world_vertex(1,0),Some(Vec3::new(40.0,20.0,5.0)));
        assert_eq!(state.solid_world_vertex(1,6),Some(Vec3::new(50.0,30.0,15.0)));
        assert_eq!(state.solid_world_vertex(1,99),None);
        assert_eq!(state.solid_world_vertex(999,0),None);
        assert_eq!(state.solids[0].mesh,first.mesh);
        assert_eq!(state.solids[0].source_handle,first.source_handle);
        state.frame_solids();
        assert_eq!(state.camera.target,Vec3::new(45.0,25.0,10.0));
        assert_eq!(state.set_solid_height(1,15.0),Ok(()));
        assert_eq!(state.solids[0].offset,Vec3::new(40.0,20.0,5.0));
        let rectangle=vec![Point2::new(0.0,0.0),Point2::new(12.0,0.0),
                           Point2::new(12.0,10.0),Point2::new(0.0,10.0)];
        assert_eq!(state.refresh_source_profile(7,rectangle),Ok(1));
        assert_eq!(state.solid_world_vertex(1,1),Some(Vec3::new(52.0,20.0,5.0)));
    }

    #[test]fn relocated_source_edits_are_transactional_at_world_bounds() {
        let mut state=PreviewState::default();
        let square=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                        Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile(42,square.clone());
        assert_eq!(state.extrude_selected(5.0),Ok(1));
        state.set_solid_offset(1,Vec3::new(MAX_WORLD_COORD-10.0,0.0,MAX_WORLD_COORD-5.0)).unwrap();
        let original=state.solids.clone();
        let next_id=state.next_id;
        assert_eq!(state.set_solid_height(1,6.0),
                   Err(WorkspaceError::Geometry(ExtrudeError::OutOfBounds)));
        let wider=vec![Point2::new(0.0,0.0),Point2::new(11.0,0.0),
                       Point2::new(11.0,10.0),Point2::new(0.0,10.0)];
        assert_eq!(state.refresh_source_profile(42,wider),
                   Err(WorkspaceError::Geometry(ExtrudeError::OutOfBounds)));
        assert_eq!(state.solids,original);
        assert_eq!(state.next_id,next_id);
        assert_eq!(state.selected_outline,Some(square));
        state.set_solid_offset(1,Vec3::new(20.0,30.0,2.0)).unwrap();
        assert_eq!(state.set_solid_height(1,6.0),Ok(()));
        assert_eq!(state.solid_world_vertex(1,4),Some(Vec3::new(20.0,30.0,8.0)));
    }

    #[test]fn duplicated_linked_extrusion_preserves_independent_offset_and_height() {
        let mut state=PreviewState::default();
        let original_profile=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                                  Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile_checked(77,original_profile).unwrap();
        assert_eq!(state.extrude_selected(5.0),Ok(1));
        let initial=state.solids[0].clone();
        let camera=state.camera;
        assert_eq!(state.duplicate_solid(1,Vec3::new(30.0,20.0,-2.0)),Ok(2));
        assert_eq!(state.solids.len(),2);
        assert_eq!(state.solids[0],initial);
        assert_eq!(state.solids[1].source_handle,Some(77));
        assert_eq!(state.solids[1].mesh,initial.mesh);
        assert_eq!(state.solids[1].height,5.0);
        assert_eq!(state.solids[1].offset,Vec3::new(30.0,20.0,-2.0));
        assert_eq!(state.solid_world_vertex(2,0),Some(Vec3::new(30.0,20.0,-2.0)));
        assert_eq!(state.camera,camera);
        // Two linked copies share sketch updates, not their height or placement.
        state.set_solid_height(2,7.0).unwrap();
        let wider=vec![Point2::new(0.0,0.0),Point2::new(12.0,0.0),
                       Point2::new(12.0,10.0),Point2::new(0.0,10.0)];
        assert_eq!(state.refresh_source_profile(77,wider),Ok(2));
        assert_eq!(state.solids[0].height,5.0);
        assert_eq!(state.solids[1].height,7.0);
        assert_eq!(state.solids[0].mesh.vertices[1].x,12.0);
        assert_eq!(state.solids[1].mesh.vertices[1].x,12.0);
        assert_eq!(state.solid_world_vertex(2,1),Some(Vec3::new(42.0,20.0,-2.0)));
        assert_eq!(state.solid_world_vertex(2,4),Some(Vec3::new(30.0,20.0,5.0)));
        assert_eq!(state.solids[0].offset,Vec3::new(0.0,0.0,0.0));
    }

    #[test]fn duplicate_rejection_never_consumes_ids_or_modifies_camera() {
        let mut state=PreviewState::default();
        let outline=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                         Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile_checked(9,outline).unwrap();
        assert_eq!(state.extrude_selected(10.0),Ok(1));
        let camera=state.camera;
        let initial=state.solids.clone();
        let next=state.next_id;
        assert_eq!(state.duplicate_solid(999,Vec3::new(30.0,0.0,0.0)),
                   Err(WorkspaceError::SolidNotFound));
        assert_eq!(state.duplicate_solid(1,Vec3::new(f64::NAN,0.0,0.0)),
                   Err(WorkspaceError::InvalidOffset));
        assert_eq!(state.duplicate_solid(1,Vec3::new(MAX_WORLD_COORD-5.0,0.0,0.0)),
                   Err(WorkspaceError::Geometry(ExtrudeError::OutOfBounds)));
        assert_eq!(state.solids,initial);
        assert_eq!(state.next_id,next);
        assert_eq!(state.camera,camera);
        // Exhaustion must fail before any insertion or changed selection.
        state.next_id=u64::MAX;
        assert_eq!(state.duplicate_solid(1,Vec3::new(40.0,0.0,0.0)),
                   Err(WorkspaceError::IdExhausted));
        assert_eq!(state.solids,initial);
        assert_eq!(state.camera,camera);
        state.next_id=next;
        assert_eq!(state.duplicate_solid(1,Vec3::new(40.0,0.0,0.0)),Ok(next));
        assert_eq!(state.solids.len(),2);
        assert_eq!(state.next_id,next+1);
    }

    #[test]fn detached_copy_does_not_follow_subsequent_2d_sketch_updates() {
        let mut preview=PreviewState::default();
        let square=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                        Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        preview.select_profile_checked(52,square.clone()).unwrap();
        let linked=preview.extrude_selected(4.0).unwrap();
        let detached=preview.duplicate_solid(linked,Vec3::new(35.0,5.0,-2.0)).unwrap();
        preview.set_solid_height(detached,6.0).unwrap();
        let original=preview.solids.clone();
        let camera=preview.camera;
        let next_id=preview.next_id;

        assert_eq!(preview.detach_solid_source(999),
                   Err(WorkspaceError::SolidNotFound));
        assert_eq!(preview.solids,original);
        assert_eq!(preview.detach_solid_source(detached),Ok(true));
        assert_eq!(preview.detach_solid_source(detached),Ok(false));
        assert_eq!(preview.solids[0],original[0]);
        let mut expected=original[1].clone();
        expected.source_handle=None;
        assert_eq!(preview.solids[1],expected);
        assert_eq!(preview.camera,camera);
        assert_eq!(preview.next_id,next_id);
        assert_eq!(preview.selected_handle,Some(52));

        let edited=vec![Point2::new(0.0,0.0),Point2::new(20.0,0.0),
                        Point2::new(20.0,10.0),Point2::new(0.0,10.0)];
        assert_eq!(preview.refresh_source_profile(52,edited.clone()),Ok(1));
        assert_eq!(preview.solids[0].outline,edited);
        assert_eq!(preview.solids[0].height,4.0);
        assert_eq!(preview.solids[0].source_handle,Some(52));
        assert_eq!(preview.solids[1],expected);
        assert_eq!(preview.solid_world_vertex(detached,0),Some(Vec3::new(35.0,5.0,-2.0)));
        assert_eq!(preview.camera,camera);
        assert_eq!(preview.next_id,next_id);
        assert_eq!(preview.extrude_selected(3.0),Ok(next_id));
        assert_eq!(preview.solids[2].source_handle,Some(52));
        assert_eq!(preview.solids[2].outline,preview.solids[0].outline);
    }

    #[test]fn detaching_an_unlinked_extrusion_is_a_noop() {
        let mut preview=PreviewState::default();
        preview.select_profile_checked(99,vec![Point2::new(0.0,0.0),Point2::new(4.0,0.0),
                                                Point2::new(4.0,4.0),Point2::new(0.0,4.0)]).unwrap();
        preview.clear_selection();
        // An unlinked source can still be introduced through a 2D preview;
        // its geometry and document IDs remain unchanged by this command.
        preview.select_profile(99,vec![Point2::new(0.0,0.0),Point2::new(4.0,0.0),
                                       Point2::new(4.0,4.0),Point2::new(0.0,4.0)]);
        let id=preview.extrude_selected(5.0).unwrap();
        preview.detach_solid_source(id).unwrap();
        let previous=preview.clone();
        assert_eq!(preview.detach_solid_source(id),Ok(false));
        assert_eq!(preview.solids,previous.solids);
        assert_eq!(preview.camera,previous.camera);
        assert_eq!(preview.next_id,previous.next_id);
    }

    #[test]fn measured_solids_report_world_bounds_and_local_stable_volume() {
        let mut state=PreviewState::default();
        let rectangle=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                           Point2::new(10.0,20.0),Point2::new(0.0,20.0)];
        state.select_profile_checked(73,rectangle).unwrap();
        let id=state.extrude_selected(-5.0).unwrap();
        state.set_solid_offset(id,Vec3::new(90_000_000.0,-90_000_000.0,100.0)).unwrap();
        let solids=state.solids.clone();
        let old_camera=state.camera;
        let m=state.measure_solid(id).unwrap();
        assert!((m.volume_mm3-1000.0).abs()<1e-6);
        assert!((m.surface_area_mm2-700.0).abs()<1e-6);
        assert_eq!(m.bounds_min,Vec3::new(90_000_000.0,-90_000_000.0,95.0));
        assert_eq!(m.bounds_max,Vec3::new(90_000_010.0,-89_999_980.0,100.0));
        assert_eq!(state.measure_solid(999),Err(WorkspaceError::SolidNotFound));
        assert_eq!(state.solids,solids);
        assert_eq!(state.camera,old_camera);
        state.set_solid_height(id,8.0).unwrap();
        let larger=state.measure_solid(id).unwrap();
        assert!((larger.volume_mm3-1600.0).abs()<1e-6);
        assert!((larger.surface_area_mm2-880.0).abs()<1e-6);
        assert_eq!(larger.bounds_min.z,100.0);
        assert_eq!(larger.bounds_max.z,108.0);
    }

    #[test]fn measuring_invalid_preview_faces_returns_error_without_panic() {
        let mut state=PreviewState::default();
        let square=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                        Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile_checked(1,square).unwrap();
        let id=state.extrude_selected(10.0).unwrap();
        let before=state.measure_solid(id).unwrap();
        assert!((before.volume_mm3-1000.0).abs()<1e-8);
        let cam=state.camera;
        state.solids[0].mesh.triangles[0][0]=999;
        let bad=state.solids.clone();
        assert_eq!(state.measure_solid(id),Err(WorkspaceError::InvalidMesh));
        assert_eq!(state.solids,bad);
        assert_eq!(state.camera,cam);
    }

    #[test]fn focusing_one_translated_solid_does_not_move_any_scene_geometry() {
        let mut state=PreviewState::default();
        let square=vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                        Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        state.select_profile(77,square);
        assert_eq!(state.extrude_selected(10.0),Ok(1));
        assert_eq!(state.extrude_selected(10.0),Ok(2));
        state.set_solid_offset(2,Vec3::new(100.0,0.0,0.0)).unwrap();
        let originals=state.solids.clone();
        state.frame_solids();
        assert_eq!(state.camera.target,Vec3::new(55.0,5.0,5.0));
        assert_eq!(state.focus_solid(2),Ok(()));
        assert_eq!(state.camera.target,Vec3::new(105.0,5.0,5.0));
        let second_distance=state.camera.distance;
        assert!((second_distance-10.0*3.0_f64.sqrt()*1.7).abs()<1e-8);
        assert_eq!(state.focus_solid(1),Ok(()));
        assert_eq!(state.camera.target,Vec3::new(5.0,5.0,5.0));
        let camera=state.camera;
        assert_eq!(state.focus_solid(999),Err(WorkspaceError::SolidNotFound));
        assert_eq!(state.camera,camera);
        assert_eq!(state.solids,originals);
        assert_eq!(state.solid_world_vertex(2,0),Some(Vec3::new(100.0,0.0,0.0)));
    }

}
