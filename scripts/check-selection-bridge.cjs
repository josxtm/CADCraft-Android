#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2],'utf8');
const elements={};
const storage=new Map();
const sessionStorage={
 setItem(k,v){storage.set(k,String(v))},
 getItem(k){return storage.get(k)||null},
 removeItem(k){storage.delete(k)}
};
let alertText='';
const page={href:'../web/index.html'};
const document={
 body:{appendChild(node){elements[node.id]=node;}},
 getElementById(id){return elements[id]||null;},
 createElement(){return {id:'',textContent:'',style:{},addEventListener(event,callback){this[event]=callback;}};}
};
const window={};
vm.runInNewContext(source,{window,document,sessionStorage,location:page,alert:t=>{alertText=String(t);},Number,Math,Error,JSON});
const bridge=window.CADCraftSelectionBridge;
assert.ok(bridge,'selection converter installed');
function packet(kind,handle='B7'){return {handle,kind};}
const pl=packet({type:'lwPolyline',closed:true,vertices:[
 {p:{x:0,y:0},bulge:0},{p:{x:100,y:0},bulge:0},
 {p:{x:100,y:50},bulge:0},{p:{x:0,y:50},bulge:0}
]});
assert.equal(bridge.selectionToProfile(pl).points.length,4);
assert.equal(bridge.selectionToProfile(JSON.stringify(pl)).points[2][1],50);
assert.equal(bridge.stageSelection(pl,sessionStorage).sourceHandle,'B7');
assert.equal(JSON.parse(sessionStorage.getItem(bridge.key)).points.length,4);
assert.equal(bridge.selectionToProfile(packet({type:'circle',center:{x:10,y:20,z:0},radius:5})).points.length,64);
assert.throws(()=>bridge.selectionToProfile(null),/seleccionada/);
assert.throws(()=>bridge.selectionToProfile(packet({type:'lwPolyline',closed:false,vertices:pl.kind.vertices})),/cerrada/);
assert.throws(()=>bridge.selectionToProfile(packet({type:'lwPolyline',closed:true,vertices:pl.kind.vertices.map((v,i)=>({...v,bulge:i===0?1:0}))})),/arcos/);
assert.throws(()=>bridge.selectionToProfile(packet({type:'circle',center:{x:0,y:0},radius:-3})),/Radio/);
assert.throws(()=>bridge.selectionToProfile(packet({type:'line',a:{x:0,y:0},b:{x:3,y:2}})),/Solo/);
assert.throws(()=>bridge.selectionToProfile(packet({type:'circle',center:{x:NaN,y:0},radius:5})),/Coordenadas/);
assert.equal(elements.cadcraftSelectedExtrude.textContent,'EXTRUIR SELECCIÓN');
window.__cadcraftSelected2D=JSON.stringify(pl);
elements.cadcraftSelectedExtrude.click();
assert.equal(page.href,'../3d/index.html');
assert.equal(alertText,'');
console.log('CADCraft selection bridge tests passed (15 assertions)');
