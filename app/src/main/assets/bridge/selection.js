/* CADCraft Android: read-only selected-entity bridge.
 * Input is written by the patched, pinned CADCraft WebAssembly frontend.
 * Only closed straight LWPOLYLINE and Circle are supported.
 */
(function(){
'use strict';
if(window.CADCraftSelectionBridge)return;
const KEY='cadcraft.android.profile.handoff';
function finite(n){return typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e9;}
function xy(point){
 if(!point||!finite(point.x)||!finite(point.y))throw Error('Coordenadas de dibujo inválidas');
 return [point.x,point.y];
}
function selectionToProfile(raw){
 const data=typeof raw==='string'?JSON.parse(raw):raw;
 if(!data||typeof data!=='object'||!data.kind)throw Error('No hay ninguna entidad seleccionada');
 const k=data.kind;
 let points;
 if(k.type==='lwPolyline'){
  if(k.closed!==true)throw Error('Selecciona una polilínea cerrada');
  if(!Array.isArray(k.vertices)||k.vertices.length<3||k.vertices.length>10000)throw Error('Número de vértices no válido');
  if(k.vertices.some(v=>!v||!finite(Number(v.bulge===undefined?0:v.bulge))||Math.abs(Number(v.bulge||0))>1e-9))
   throw Error('Las polilíneas con arcos todavía no se pueden extruir');
  points=k.vertices.map(v=>xy(v.p));
 }else if(k.type==='circle'){
  const [cx,cy]=xy(k.center);
  if(!finite(k.radius)||k.radius<=0)throw Error('Radio no válido');
  const segments=64;
  points=Array.from({length:segments},(_,i)=>{
   const a=i*Math.PI*2/segments;return [cx+k.radius*Math.cos(a),cy+k.radius*Math.sin(a)];
  });
 }else throw Error('Solo se permiten polilíneas cerradas o círculos');
 return {points,sourceHandle:typeof data.handle==='string'?data.handle:null};
}
function stageSelection(raw,storage){
 const profile=selectionToProfile(raw);
 const value=JSON.stringify({version:1,points:profile.points,sourceHandle:profile.sourceHandle});
 if(value.length>512000)throw Error('Perfil demasiado grande');
 storage.setItem(KEY,value);
 return profile;
}
window.CADCraftSelectionBridge={selectionToProfile,stageSelection,key:KEY};
if(!document.body||document.getElementById('cadcraftSelectedExtrude'))return;
const button=document.createElement('button');
button.id='cadcraftSelectedExtrude';
button.textContent='EXTRUIR SELECCIÓN';
button.style.cssText='position:fixed;left:10px;bottom:48px;z-index:2147483647;background:#176b62;color:#fff;border:1px solid #a6eee1;border-radius:9px;padding:12px;font:600 14px sans-serif;box-shadow:0 3px 12px #0008';
button.addEventListener('click',()=>{
 try{
  stageSelection(window.__cadcraftSelected2D,sessionStorage);
  location.href='../3d/index.html';
 }catch(error){alert(error.message||String(error));}
});
document.body.appendChild(button);
})();
