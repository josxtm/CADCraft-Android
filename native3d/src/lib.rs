//! Independent 3D geometry prototype for CADCraft Android.
//! Does not modify upstream CADCraft or its document model.

pub mod workspace;
pub mod export;

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
/// Limited, index-based topology diagnostics for the experimental Rust core.
/// Every edge must be incident to exactly two triangles with opposite winding.
/// Each vertex's incident face fan must be connected. This does NOT replace
/// robust self-intersection, nesting or coplanar-overlap tests in the JS studio.
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum MeshTopologyError {
    Empty, InvalidVertex, InvalidFace, DuplicateFace, OpenOrNonManifoldEdge,
    InconsistentWinding, NonManifoldVertex, UnusedVertex, InvalidEuler,
}
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub struct MeshTopology {
    pub vertices:usize,
    pub edges:usize,
    pub faces:usize,
    pub shells:usize,
    pub genus:usize,
}
pub fn inspect_closed_mesh(mesh:&Mesh)->Result<MeshTopology,MeshTopologyError> {
    use std::collections::{HashMap,HashSet};
    if mesh.vertices.len()<4||mesh.triangles.len()<4 {
        return Err(MeshTopologyError::Empty);
    }
    if mesh.vertices.iter().any(|p|{
        [p.x,p.y,p.z].iter().any(|v|!v.is_finite()||v.abs()>MAX_WORLD_COORD)
    }) {return Err(MeshTopologyError::InvalidVertex)}
    let vertex_count=mesh.vertices.len();
    // Edge values are the two ordered usages and their incident faces.
    let mut edges:HashMap<(u32,u32),Vec<(u32,u32,usize)>>=HashMap::new();
    let mut faces=HashSet::new();
    let mut incident=vec![Vec::<usize>::new();vertex_count];
    for (fi,face) in mesh.triangles.iter().enumerate() {
        if face.iter().any(|&i|i as usize>=vertex_count)||
           face[0]==face[1]||face[1]==face[2]||face[2]==face[0] {
            return Err(MeshTopologyError::InvalidFace)
        }
        let mut canonical=*face;
        canonical.sort_unstable();
        if !faces.insert(canonical){return Err(MeshTopologyError::DuplicateFace)}
        let a=mesh.vertices[face[0] as usize];
        let b=mesh.vertices[face[1] as usize];
        let c=mesh.vertices[face[2] as usize];
        let magnitude=(b-a).cross(c-a).norm();
        if !magnitude.is_finite()||magnitude<=1e-12 {
            return Err(MeshTopologyError::InvalidFace)
        }
        for &i in face {incident[i as usize].push(fi);}
        for (u,v) in [(face[0],face[1]),(face[1],face[2]),(face[2],face[0])] {
            let key=(u.min(v),u.max(v));
            edges.entry(key).or_default().push((u,v,fi));
        }
    }
    if incident.iter().any(|v|v.is_empty()){return Err(MeshTopologyError::UnusedVertex)}
    for ((u,v),entries) in &edges {
        if entries.len()!=2{return Err(MeshTopologyError::OpenOrNonManifoldEdge)}
        if entries[0].0!=*u||entries[0].1!=*v {
            if entries[1].0!=*u||entries[1].1!=*v {
                return Err(MeshTopologyError::InconsistentWinding)
            }
        } else if entries[1].0!=*v||entries[1].1!=*u {
            return Err(MeshTopologyError::InconsistentWinding)
        }
        if entries[0].2==entries[1].2 {
            return Err(MeshTopologyError::InvalidFace)
        }
    }
    // A pair of otherwise closed shells touching at one indexed vertex
    // produces a bow-tie/nonmanifold fan. Check incident-face connectivity
    // through the two triangle edges meeting at that vertex.
    for (vertex,incident_faces) in incident.iter().enumerate(){
        if incident_faces.len()<2 {return Err(MeshTopologyError::NonManifoldVertex)}
        let mut reached=HashSet::new();
        let mut stack=vec![incident_faces[0]];
        while let Some(fi)=stack.pop(){
            if !reached.insert(fi){continue}
            let face=mesh.triangles[fi];
            for &other in &face {
                if other as usize==vertex {continue}
                let key=((vertex as u32).min(other),(vertex as u32).max(other));
                if let Some(usages)=edges.get(&key) {
                    for &(_,_,adjacent) in usages.iter() {
                        if !reached.contains(&adjacent){stack.push(adjacent);}
                    }
                }
            }
        }
        if reached.len()!=incident_faces.len(){
            return Err(MeshTopologyError::NonManifoldVertex)
        }
    }
    // Once closure and all vertex fans are verified, the triangle adjacency
    // graph splits into true edge-connected surface shells. For each closed
    // orientable shell: V - E + F = 2 - 2g. Aggregate this across shells.
    let mut visited=HashSet::new();
    let mut shells=0usize;
    for start in 0..mesh.triangles.len() {
        if visited.contains(&start){continue}
        shells+=1;
        let mut stack=vec![start];
        while let Some(fi)=stack.pop() {
            if !visited.insert(fi){continue}
            let [a,b,c]=mesh.triangles[fi];
            for (u,v) in [(a,b),(b,c),(c,a)] {
                let key=(u.min(v),u.max(v));
                if let Some(neighbors)=edges.get(&key) {
                    for &(_,_,adjacent) in neighbors {
                        if !visited.contains(&adjacent){stack.push(adjacent);}
                    }
                }
            }
        }
    }
    let euler=vertex_count as i64-edges.len() as i64+mesh.triangles.len() as i64;
    let double_genus=2*shells as i64-euler;
    if double_genus<0||double_genus%2!=0 {
        return Err(MeshTopologyError::InvalidEuler)
    }
    Ok(MeshTopology{vertices:vertex_count,edges:edges.len(),
                    faces:mesh.triangles.len(),shells,genus:(double_genus/2) as usize})
}

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

    #[test]fn rust_mesh_topology_accepts_positive_negative_and_distant_prisms() {
        let rect=[Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                  Point2::new(10.0,20.0),Point2::new(0.0,20.0)];
        for h in [5.0,-5.0] {
            let mesh=extrude(&rect,h).unwrap();
            assert_eq!(inspect_closed_mesh(&mesh),
                       Ok(MeshTopology{vertices:8,edges:18,faces:12,shells:1,genus:0}));
        }
        let shifted:Vec<Point2>=rect.iter().map(|p|Point2::new(p.x+9e7,p.y-9e7)).collect();
        assert_eq!(inspect_closed_mesh(&extrude(&shifted,-7.0).unwrap()),
                   Ok(MeshTopology{vertices:8,edges:18,faces:12,shells:1,genus:0}));
    }
    #[test]fn rust_topology_counts_disconnected_shells_and_handles() {
        let profile=[Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                     Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        let first=extrude(&profile,10.0).unwrap();
        let second=extrude(&profile,10.0).unwrap();
        let mut apart=first.clone();
        let shift=apart.vertices.len() as u32;
        apart.vertices.extend(second.vertices.iter().map(|p|*p+Vec3::new(30.0,0.0,0.0)));
        apart.triangles.extend(second.triangles.iter().map(|f|[f[0]+shift,f[1]+shift,f[2]+shift]));
        assert_eq!(inspect_closed_mesh(&apart),
                   Ok(MeshTopology{vertices:16,edges:36,faces:24,shells:2,genus:0}));
        // Torus: one watertight genus-1 shell (Euler characteristic zero).
        let around=12usize;
        let tube=10usize;
        let mut vertices=Vec::new();
        for i in 0..around {
            let theta=2.0*std::f64::consts::PI*i as f64/around as f64;
            for j in 0..tube {
                let phi=2.0*std::f64::consts::PI*j as f64/tube as f64;
                let radius=20.0+5.0*phi.cos();
                vertices.push(Vec3::new(radius*theta.cos(),radius*theta.sin(),5.0*phi.sin()));
            }
        }
        let mut triangles=Vec::new();
        for i in 0..around {
            for j in 0..tube {
                let a=(i*tube+j) as u32;
                let b=(((i+1)%around)*tube+j) as u32;
                let c=(i*tube+(j+1)%tube) as u32;
                let d=(((i+1)%around)*tube+(j+1)%tube) as u32;
                triangles.push([a,b,c]);
                triangles.push([b,d,c]);
            }
        }
        let torus=Mesh{vertices,triangles};
        assert_eq!(inspect_closed_mesh(&torus),
                   Ok(MeshTopology{vertices:120,edges:360,faces:240,shells:1,genus:1}));
    }
    #[test]fn rust_mesh_topology_catches_holes_winding_duplicates_and_bad_faces() {
        let rect=[Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                  Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        let original=extrude(&rect,10.0).unwrap();
        let mut mesh=original.clone();
        mesh.triangles.pop();
        assert_eq!(inspect_closed_mesh(&mesh),Err(MeshTopologyError::OpenOrNonManifoldEdge));
        let mut mesh=original.clone();
        mesh.triangles[0].swap(0,1);
        assert_eq!(inspect_closed_mesh(&mesh),Err(MeshTopologyError::InconsistentWinding));
        let mut mesh=original.clone();
        mesh.triangles.push(mesh.triangles[0]);
        assert_eq!(inspect_closed_mesh(&mesh),Err(MeshTopologyError::DuplicateFace));
        let mut mesh=original.clone();
        mesh.triangles[0]=[0,0,1];
        assert_eq!(inspect_closed_mesh(&mesh),Err(MeshTopologyError::InvalidFace));
        let mut mesh=original.clone();
        mesh.triangles[0][0]=99999;
        assert_eq!(inspect_closed_mesh(&mesh),Err(MeshTopologyError::InvalidFace));
        let mut mesh=original.clone();
        mesh.vertices.push(Vec3::new(900.0,900.0,900.0));
        assert_eq!(inspect_closed_mesh(&mesh),Err(MeshTopologyError::UnusedVertex));
    }
    #[test]fn rust_mesh_topology_catches_bowtie_vertex_and_edge_overuse() {
        let rect=[Point2::new(0.0,0.0),Point2::new(10.0,0.0),
                  Point2::new(10.0,10.0),Point2::new(0.0,10.0)];
        let first=extrude(&rect,10.0).unwrap();
        let second=extrude(&rect,10.0).unwrap();
        let mut separate=first.clone();
        let base=separate.vertices.len() as u32;
        separate.vertices.extend(second.vertices.iter().copied().map(|p|p+Vec3::new(30.0,0.0,0.0)));
        separate.triangles.extend(second.triangles.iter().map(|f|[f[0]+base,f[1]+base,f[2]+base]));
        assert!(inspect_closed_mesh(&separate).is_ok());
        // Weld only one vertex, making two otherwise closed fans share an ID.
        let second_first=base as usize;
        separate.vertices[second_first]=separate.vertices[0];
        for face in &mut separate.triangles {
            for vertex in face.iter_mut(){
                if *vertex==base {*vertex=0;}
            }
        }
        separate.vertices.remove(second_first);
        for face in &mut separate.triangles {
            for vertex in face.iter_mut() {
                if *vertex>base {*vertex-=1;}
            }
        }
        assert_eq!(inspect_closed_mesh(&separate),Err(MeshTopologyError::NonManifoldVertex));
        let mut overused=first.clone();
        overused.triangles.push([0,1,2]);
        // A new face through existing boundary vertices overuses some edges.
        assert_eq!(inspect_closed_mesh(&overused),Err(MeshTopologyError::OpenOrNonManifoldEdge));
        let mut duplicated=first.clone();
        duplicated.triangles.push(first.triangles[0]);
        assert_eq!(inspect_closed_mesh(&duplicated),Err(MeshTopologyError::DuplicateFace));
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
