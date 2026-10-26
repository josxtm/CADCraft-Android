//! UI-facing adapter for selected 2D profiles and an orbitable solid preview.
//! Independent of upstream egui so CADCraft can call this through a narrow API.
use crate::{extrude,Camera,ExtrudeError,Mesh,Point2,View,Vec3};

#[derive(Clone,Debug,PartialEq)]
pub struct Solid {
    pub id:u64,
    pub source_handle:Option<u64>,
    pub height:f64,
    pub outline:Vec<Point2>,
    pub mesh:Mesh,
}

#[derive(Debug,PartialEq)]
pub enum WorkspaceError {
    NoProfile,
    InvalidHeight,
    Geometry(ExtrudeError),
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
    pub fn select_profile(&mut self,source_handle:u64,outline:Vec<Point2>){
        self.selected_handle=Some(source_handle);
        self.selected_outline=Some(outline);
    }
    pub fn clear_selection(&mut self){
        self.selected_handle=None;
        self.selected_outline=None;
    }
    pub fn has_profile(&self)->bool {self.selected_outline.is_some()}
    pub fn extrude_selected(&mut self,height:f64)->Result<u64,WorkspaceError> {
        if !height.is_finite()||height.abs()<1e-10{return Err(WorkspaceError::InvalidHeight)}
        let points=self.selected_outline.as_ref().ok_or(WorkspaceError::NoProfile)?;
        let mesh=extrude(points,height).map_err(WorkspaceError::Geometry)?;
        let id=self.next_id;
        self.next_id=self.next_id.saturating_add(1);
        self.solids.push(Solid{id,source_handle:self.selected_handle,height,outline:points.clone(),mesh});
        Ok(id)
    }
    pub fn remove_solid(&mut self,id:u64)->bool {
        let before=self.solids.len();
        self.solids.retain(|solid|solid.id!=id);
        self.solids.len()!=before
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
            for &p in &solid.mesh.vertices {
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
}
