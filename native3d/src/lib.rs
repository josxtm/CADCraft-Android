//! Independent 3D geometry prototype for CADCraft Android.
//! Does not modify upstream CADCraft or its document model.

pub mod workspace;

/// Same conservative world-coordinate limit as the Android 3D studio (drawing units: mm).
pub const MAX_WORLD_COORD: f64 = 100_000_000.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Vec3 { pub x:f64, pub y:f64, pub z:f64 }
impl Vec3 {
    pub const fn new(x:f64,y:f64,z:f64)->Self { Self{x,y,z} }
    pub fn dot(self,b:Self)->f64 { self.x*b.x+self.y*b.y+self.z*b.z }
    pub fn cross(self,b:Self)->Self { Self::new(self.y*b.z-self.z*b.y,self.z*b.x-self.x*b.z,self.x*b.y-self.y*b.x) }
    pub fn norm(self)->f64 { self.dot(self).sqrt() }
    pub fn normalized(self)->Self {let n=self.norm(); if n<1e-12 {self} else {self*(1.0/n)}}
}
impl std::ops::Add for Vec3 { type Output=Self; fn add(self,b:Self)->Self {Self::new(self.x+b.x,self.y+b.y,self.z+b.z)} }
impl std::ops::Sub for Vec3 { type Output=Self; fn sub(self,b:Self)->Self {Self::new(self.x-b.x,self.y-b.y,self.z-b.z)} }
impl std::ops::Mul<f64> for Vec3 { type Output=Self; fn mul(self,k:f64)->Self {Self::new(self.x*k,self.y*k,self.z*k)} }

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Point2 {pub x:f64,pub y:f64}
impl Point2 {pub const fn new(x:f64,y:f64)->Self{Self{x,y}}}
#[derive(Clone, Debug, PartialEq)]
pub struct Mesh {pub vertices:Vec<Vec3>,pub triangles:Vec<[u32;3]>}
#[derive(Clone, Debug, PartialEq)]
pub enum ExtrudeError {NotEnoughVertices,ZeroHeight,DegeneratePolygon,SelfIntersection,NonFiniteInput,TooManyVertices,OutOfBounds}

fn area(p:&[Point2])->f64 {
    // Use a profile-local origin. Absolute shoelace products catastrophically
    // cancel for a small sketch far from the drawing origin.
    if p.len()<3 {return 0.0}
    let origin=p[0];
    let mut twice_area=0.0;
    for i in 1..p.len()-1 {twice_area+=orient(origin,p[i],p[i+1]);}
    twice_area*0.5
}
fn orient(a:Point2,b:Point2,c:Point2)->f64 {(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
fn between(a:Point2,b:Point2,c:Point2)->bool {
    c.x>=a.x.min(b.x)-1e-10&&c.x<=a.x.max(b.x)+1e-10&&c.y>=a.y.min(b.y)-1e-10&&c.y<=a.y.max(b.y)+1e-10
}
fn segment_intersects(a:Point2,b:Point2,c:Point2,d:Point2)->bool {
    let (o1,o2,o3,o4)=(orient(a,b,c),orient(a,b,d),orient(c,d,a),orient(c,d,b));
    if ((o1>1e-10&&o2< -1e-10)||(o1< -1e-10&&o2>1e-10))&&((o3>1e-10&&o4< -1e-10)||(o3< -1e-10&&o4>1e-10)){return true}
    (o1.abs()<1e-10&&between(a,b,c))||(o2.abs()<1e-10&&between(a,b,d))||(o3.abs()<1e-10&&between(c,d,a))||(o4.abs()<1e-10&&between(c,d,b))
}
fn point_in_triangle(p:Point2,a:Point2,b:Point2,c:Point2)->bool {
    orient(a,b,p)>=-1e-10&&orient(b,c,p)>=-1e-10&&orient(c,a,p)>=-1e-10
}

/// Extrudes a simple closed planar profile into a triangle mesh.
/// Accepts convex or concave polygons without holes. Automatically
/// removes repeated final vertex and consecutive duplicate vertices.
/// Triangles are outward facing for either extrusion direction.
pub fn extrude(profile:&[Point2],height:f64)->Result<Mesh,ExtrudeError> {
    if !height.is_finite()||profile.iter().any(|p|!p.x.is_finite()||!p.y.is_finite()){return Err(ExtrudeError::NonFiniteInput)}
    if height.abs()>MAX_WORLD_COORD || profile.iter().any(|p|p.x.abs()>MAX_WORLD_COORD||p.y.abs()>MAX_WORLD_COORD){return Err(ExtrudeError::OutOfBounds)}
    if height.abs()<1e-10{return Err(ExtrudeError::ZeroHeight)}
    let mut p:Vec<Point2>=Vec::new();
    for &pt in profile {if p.last().map_or(true,|last| (last.x-pt.x).abs()>1e-10||(last.y-pt.y).abs()>1e-10){p.push(pt)}}
    if p.len()>1 && (p[0].x-p[p.len()-1].x).abs()<1e-10&&(p[0].y-p[p.len()-1].y).abs()<1e-10 {p.pop();}
    let n=p.len();
    if n<3{return Err(ExtrudeError::NotEnoughVertices)}
    if n>u32::MAX as usize/2{return Err(ExtrudeError::TooManyVertices)}
    let signed_area=area(&p);
    if signed_area.abs()<1e-10{return Err(ExtrudeError::DegeneratePolygon)}
    // Normalize boundary to CCW order.
    if signed_area<0.0{p.reverse();}
    for i in 0..n {
        for j in i+1..n {
            if (i+1)%n==j||(j+1)%n==i{continue}
            if segment_intersects(p[i],p[(i+1)%n],p[j],p[(j+1)%n]){return Err(ExtrudeError::SelfIntersection)}
        }
    }
    let mut indices:Vec<usize>=(0..n).collect();
    let mut top:Vec<[usize;3]>=Vec::new();
    while indices.len()>3 {
        let mut ear=None;
        for i in 0..indices.len() {
            let a=indices[(i+indices.len()-1)%indices.len()];
            let b=indices[i];let c=indices[(i+1)%indices.len()];
            if orient(p[a],p[b],p[c])<=1e-10 {continue}
            if indices.iter().copied().any(|q|q!=a&&q!=b&&q!=c&&point_in_triangle(p[q],p[a],p[b],p[c])){continue}
            ear=Some((i,[a,b,c]));break
        }
        if let Some((i,tri))=ear {top.push(tri);indices.remove(i);}
        else{return Err(ExtrudeError::DegeneratePolygon)}
    }
    top.push([indices[0],indices[1],indices[2]]);
    let mut vertices=Vec::with_capacity(2*n);
    for z in [0.0,height] {for point in &p {vertices.push(Vec3::new(point.x,point.y,z));}}
    let mut triangles=Vec::with_capacity(2*(n-2)+2*n);
    let positive=height>0.0;
    for [a,b,c] in top {
        let (a,b,c)=(a as u32,b as u32,c as u32);
        if positive {
            triangles.push([c,b,a]);triangles.push([a+n as u32,b+n as u32,c+n as u32]);
        } else {
            triangles.push([a,b,c]);triangles.push([c+n as u32,b+n as u32,a+n as u32]);
        }
    }
    for i in 0..n {
        let j=(i+1)%n;
        let (a,b,c,d)=(i as u32,j as u32,(j+n) as u32,(i+n) as u32);
        if positive {triangles.push([a,b,c]);triangles.push([a,c,d]);}
        else {triangles.push([c,b,a]);triangles.push([d,c,a]);}
    }
    Ok(Mesh{vertices,triangles})
}

#[derive(Clone,Copy,Debug,PartialEq)]
pub enum View {
    Top, Bottom, Front, Back, Left, Right, NorthEastIso, NorthWestIso, SouthEastIso, SouthWestIso
}

/// Orbit camera angles in radians. Z is world up. azimuth is around Z.
#[derive(Clone,Copy,Debug,PartialEq)]
pub struct Camera {pub azimuth:f64,pub elevation:f64,pub distance:f64,pub target:Vec3}
impl Camera {
    pub fn new()->Self{Self{azimuth:std::f64::consts::FRAC_PI_4,elevation:std::f64::consts::FRAC_PI_6,distance:15.0,target:Vec3::new(0.0,0.0,0.0)}}
    pub fn snap(&mut self,view:View) {
        use std::f64::consts::{PI,FRAC_PI_2,FRAC_PI_4};
        let iso=(1.0/2.0_f64.sqrt()).atan();
        let (a,e)=match view {
            View::Top=>(0.0,FRAC_PI_2),
            View::Bottom=>(0.0,-FRAC_PI_2),
            View::Front=>(-FRAC_PI_2,0.0),
            View::Back=>(FRAC_PI_2,0.0),
            View::Left=>(PI,0.0),
            View::Right=>(0.0,0.0),
            View::NorthEastIso=>(FRAC_PI_4,iso),
            View::NorthWestIso=>(3.0*FRAC_PI_4,iso),
            View::SouthEastIso=>(-FRAC_PI_4,iso),
            View::SouthWestIso=>(-3.0*FRAC_PI_4,iso),
        };
        self.azimuth=a;self.elevation=e;
    }
    pub fn orbit(&mut self,dx:f64,dy:f64,sensitivity:f64) {
        if dx.is_finite()&&dy.is_finite()&&sensitivity.is_finite(){
            self.azimuth=(self.azimuth+dx*sensitivity).rem_euclid(std::f64::consts::TAU);
            self.elevation=(self.elevation+dy*sensitivity).clamp(-std::f64::consts::FRAC_PI_2+1e-4,std::f64::consts::FRAC_PI_2-1e-4);
        }
    }
    pub fn eye(&self)->Vec3 {
        let e=self.elevation;let a=self.azimuth;
        self.target+Vec3::new(e.cos()*a.cos(),e.cos()*a.sin(),e.sin())*self.distance
    }
    pub fn basis(&self)->(Vec3,Vec3,Vec3) {
        let forward=(self.target-self.eye()).normalized();
        let mut right=forward.cross(Vec3::new(0.0,0.0,1.0)).normalized();
        if right.norm()<1e-10 {right=Vec3::new(-self.azimuth.sin(),self.azimuth.cos(),0.0);}
        let up=right.cross(forward).normalized();
        (right,up,forward)
    }
}
impl Default for Camera {fn default()->Self{Self::new()}}

#[cfg(test)]
mod tests {
    use super::*;
    fn sq()->Vec<Point2>{vec![Point2::new(0.0,0.0),Point2::new(10.0,0.0),Point2::new(10.0,10.0),Point2::new(0.0,10.0)]}
    #[test]fn square_mesh(){let m=extrude(&sq(),5.0).unwrap();assert_eq!(m.vertices.len(),8);assert_eq!(m.triangles.len(),12);assert_eq!(m.vertices[4].z,5.0);}
    #[test]fn negative_extrusion(){let m=extrude(&sq(),-2.0).unwrap();assert_eq!(m.triangles.len(),12);assert_eq!(m.vertices[4].z,-2.0);}
    #[test]fn closed_profile(){let mut p=sq();p.push(p[0]);assert_eq!(extrude(&p,3.0).unwrap().triangles.len(),12);}
    #[test]fn concave_profile(){let p=[Point2::new(0.0,0.0),Point2::new(3.0,0.0),Point2::new(3.0,1.0),Point2::new(1.0,1.0),Point2::new(1.0,3.0),Point2::new(0.0,3.0)];assert_eq!(extrude(&p,2.0).unwrap().triangles.len(),20);}
    #[test]fn rejects_open_or_degenerate(){assert_eq!(extrude(&sq(),0.0),Err(ExtrudeError::ZeroHeight));assert_eq!(extrude(&sq()[..2],2.0),Err(ExtrudeError::NotEnoughVertices));}
    #[test]fn rejects_crossed_polygon(){let p=[Point2::new(0.0,0.0),Point2::new(3.0,3.0),Point2::new(0.0,3.0),Point2::new(3.0,0.0)];assert!(extrude(&p,1.0).is_err());}
    #[test]fn camera_views(){let mut c=Camera::new();c.snap(View::Top);assert!(c.eye().z>c.target.z);c.snap(View::Front);assert!((c.eye().z-c.target.z).abs()<1e-9);}
    #[test]fn camera_orbit(){let mut c=Camera::new();let a=c.azimuth;c.orbit(40.0,15.0,0.01);assert_ne!(c.azimuth,a);assert!(c.elevation.abs()<std::f64::consts::FRAC_PI_2);}
    fn mesh_signed_volume(mesh:&Mesh)->f64 {
        let origin=mesh.vertices[0];
        mesh.triangles.iter().map(|f| {
            let a=mesh.vertices[f[0] as usize]-origin;
            let b=mesh.vertices[f[1] as usize]-origin;
            let c=mesh.vertices[f[2] as usize]-origin;
            a.dot(b.cross(c))/6.0
        }).sum()
    }
    #[test]fn distant_square_and_reverse_winding() {
        for (x,y) in [(9e7,-9e7),(-9e7,9e7)] {
            let shifted:Vec<Point2>=sq().iter().map(|p|Point2::new(p.x+x,p.y+y)).collect();
            for height in [5.0,-5.0] {
                let mesh=extrude(&shifted,height).expect("far square remains valid");
                assert_eq!(mesh.triangles.len(),12);
                assert!((mesh_signed_volume(&mesh)-500.0).abs()<1e-6);
                let reverse:Vec<Point2>=shifted.iter().rev().copied().collect();
                let mirrored=extrude(&reverse,height).expect("reverse far square remains valid");
                assert!((mesh_signed_volume(&mirrored)-500.0).abs()<1e-6);
            }
        }
    }
    #[test]fn distant_concave_profile_and_collinear_rejection() {
        let l=[Point2::new(0.0,0.0),Point2::new(10.0,0.0),Point2::new(10.0,4.0),
               Point2::new(4.0,4.0),Point2::new(4.0,10.0),Point2::new(0.0,10.0)];
        let p:Vec<Point2>=l.iter().map(|v|Point2::new(v.x+9e7,v.y-9e7)).collect();
        let mesh=extrude(&p,7.0).expect("far concave profile triangulates");
        assert_eq!(mesh.triangles.len(),20);
        assert!((mesh_signed_volume(&mesh)-448.0).abs()<1e-6);
        let line=[Point2::new(9e7,-9e7),Point2::new(9e7+1.0,-9e7+1.0),
                  Point2::new(9e7+2.0,-9e7+2.0)];
        assert_eq!(extrude(&line,7.0),Err(ExtrudeError::DegeneratePolygon));
    }

    #[test]fn extrusion_respects_world_bounds() {
        let near_limit=[
            Point2::new(99_999_990.0,0.0),Point2::new(MAX_WORLD_COORD,0.0),
            Point2::new(MAX_WORLD_COORD,10.0),Point2::new(99_999_990.0,10.0)
        ];
        assert!(extrude(&near_limit,-5.0).is_ok());
        let outside=[
            Point2::new(MAX_WORLD_COORD+1.0,0.0),Point2::new(MAX_WORLD_COORD+11.0,0.0),
            Point2::new(MAX_WORLD_COORD+11.0,10.0),Point2::new(MAX_WORLD_COORD+1.0,10.0)
        ];
        assert_eq!(extrude(&outside,5.0),Err(ExtrudeError::OutOfBounds));
        assert_eq!(extrude(&sq(),MAX_WORLD_COORD+1.0),Err(ExtrudeError::OutOfBounds));
        assert_eq!(extrude(&sq(),-MAX_WORLD_COORD-1.0),Err(ExtrudeError::OutOfBounds));
        assert_eq!(extrude(&sq(),f64::INFINITY),Err(ExtrudeError::NonFiniteInput));
    }
}
