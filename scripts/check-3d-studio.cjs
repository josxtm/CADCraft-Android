const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2],'utf8');
const draw={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},clearRect(){},fillRect(){}};
const controls={width:{value:'100'},length:{value:'60'},height:{value:'25'},status:{textContent:''}};
const canvas={clientWidth:900,clientHeight:600,width:900,height:600,getContext(){return draw},addEventListener(){},setPointerCapture(){}};
const file={addEventListener(){},click(){}};
const document={
 getElementById(id){return id==='scene'?canvas:(id==='file'||id==='projectFile')?file:controls[id]},
 createElement(){return {click(){},style:{}}},
};
const window={addEventListener(){}};
const sessionData=new Map();
const sessionStorage={getItem:k=>sessionData.get(k)||null,setItem:(k,v)=>sessionData.set(k,String(v)),removeItem:k=>sessionData.delete(k)};
const context=vm.createContext({document,window,devicePixelRatio:1,Math,Number,Error,Map,Blob,URL,console,sessionStorage,setTimeout(){}});
vm.runInContext(source,context,{timeout:3000});
function evaluate(expression){return vm.runInContext(expression,context,{timeout:3000})}
assert.equal(evaluate('model.v.length'),8,'extrusion should have 8 vertices');
assert.equal(evaluate('model.faces.length'),12,'block should have 12 triangles');
assert.equal(evaluate('model.v[4][2]'),25,'extrusion height must be 25');
assert.equal(evaluate("snap('top'); Math.round(el*10000)"),Math.round(Math.PI/2*10000),'top view');
assert.equal(evaluate("snap('front'); el"),0,'front view');
assert.equal(evaluate("snap('iso'); el>0"),true,'isometric view');
assert.equal(evaluate("(()=>{try{extrude([[0,0],[10,10],[0,10],[10,0]],5);return false}catch(e){return true}})()"),true,'reject bowtie polygon');
assert.equal(evaluate("extrude([[0,0],[100,0],[100,60],[0,60]],-5).faces.length"),12,'negative extrusion');
assert.equal(evaluate("extrude([[0,0],[50,0],[50,20],[20,20],[20,50],[0,50]],10).faces.length"),20,'concave extrusion');
assert.equal(evaluate("setSketchProfile([[0,0],[40,0],[40,20],[0,20]]).faces.length"),12,'sketched rectangle extrudes');
assert.equal(evaluate("poly[1][0]"),40,'sketch and 3D model share the same profile');
assert.equal(evaluate("(()=>{try{setSketchProfile([[0,0],[10,10],[0,10],[10,0]]);return false}catch(e){return true}})()"),true,'invalid sketch rejected');
assert.equal(evaluate("poly[1][0]"),40,'invalid sketch cannot replace the active model');
assert.equal(evaluate("parseDxfProfile('0\\nLWPOLYLINE\\n70\\n1\\n10\\n0\\n20\\n0\\n10\\n40\\n20\\n0\\n10\\n40\\n20\\n20\\n10\\n0\\n20\\n20\\n0\\nENDSEC').length"),4,'DXF closed polyline parsing');
assert.equal(evaluate("importDxfText('0\\nLWPOLYLINE\\n70\\n1\\n10\\n0\\n20\\n0\\n10\\n40\\n20\\n0\\n10\\n40\\n20\\n20\\n10\\n0\\n20\\n20\\n0\\nENDSEC').faces.length"),12,'DXF 2D-to-3D extrusion');
sessionStorage.setItem('cadcraft.android.dxf.handoff',['0','LWPOLYLINE','70','1','10','0','20','0','10','20','20','0','10','20','20','10','10','0','20','10','0','ENDSEC'].join('\n'));
assert.equal(evaluate('receive2dHandoff(); model.faces.length'),12,'2D handoff builds a solid');
assert.equal(sessionStorage.getItem('cadcraft.android.dxf.handoff'),null,'handoff consumed exactly once');
assert.equal(evaluate("JSON.parse(serializeProject()).format"),'cadcraft-android-3d','project format');
assert.equal(evaluate("loadProjectText(serializeProject()).faces.length"),12,'project JSON roundtrip');
assert.equal(evaluate("(()=>{try{loadProjectText('{\"format\":\"invalid\"}');return false}catch(e){return true}})()"),true,'invalid project rejected');
assert.equal(typeof evaluate('addPrecisePoint'),'function','precise XY input is wired');
assert.equal(evaluate('parseDxfProfile(profileAsDxf([[0,0],[20,0],[20,10],[0,10]])).length'),4,'DXF export-import roundtrip');
assert.equal(evaluate("(()=>{try{profileAsDxf([[0,0],[10,10],[0,10],[10,0]]);return false}catch(e){return true}})()"),true,'invalid DXF profile cannot export');
assert.equal(evaluate('rectangleSketch(120,80).length'),4,'precise rectangle');
assert.equal(evaluate("rectangleSketch(120,80)[2][1]"),80,'rectangle dimensions');
assert.equal(evaluate("(()=>{try{rectangleSketch(-1,20);return false}catch(e){return true}})()"),true,'reject invalid rectangle');
assert.equal(evaluate('circleSketch(40,48).length'),48,'precision circle');
assert.equal(evaluate('extrude(circleSketch(40,48),10).faces.length'),188,'cylinder extrusion');
assert.equal(evaluate("(()=>{try{circleSketch(0);return false}catch(e){return true}})()"),true,'reject invalid circle');
assert.equal(evaluate('sketchPoints=[[0,0],[20,0],[20,20],[0,20]];selectedSketchVertex=1;sketchHistory=[];sketchRedoHistory=[];moveSketchVertex(1,30,0);sketchPoints[1][0]'),30,'edit existing vertex');
assert.equal(evaluate('undoSketchState();sketchPoints[1][0]'),20,'undo edit');
assert.equal(evaluate('redoSketchState();sketchPoints[1][0]'),30,'redo edit');
assert.equal(evaluate('removeSketchVertex(1);sketchPoints.length'),3,'remove vertex');
assert.equal(evaluate('undoSketchState();sketchPoints.length'),4,'undo vertex deletion');
assert.equal(evaluate('meshMeasurements(extrude([[0,0],[100,0],[100,60],[0,60]],25)).area'),6000,'area measurement');
assert.equal(evaluate('meshMeasurements(extrude([[0,0],[100,0],[100,60],[0,60]],25)).volume'),150000,'solid volume');
assert.equal(evaluate('meshMeasurements(extrude([[0,0],[100,0],[100,60],[0,60]],-25)).volume'),150000,'negative height volume');
assert.equal(evaluate('meshMeasurements(extrude([[0,0],[100,0],[100,60],[0,60]],25)).surface'),20000,'surface measurement');
assert.equal(evaluate("meshAsObj(extrude([[0,0],[100,0],[100,60],[0,60]],25)).split('\\n').filter(l=>l.startsWith('v ')).length"),8,'OBJ vertices');
assert.equal(evaluate("meshAsObj(extrude([[0,0],[100,0],[100,60],[0,60]],25)).split('\\n').filter(l=>l.startsWith('f ')).length"),12,'OBJ faces');
assert.equal(evaluate("(()=>{try{meshAsObj({v:[[0,0,0]],faces:[[0,1,2]]});return false}catch(e){return true}})()"),true,'reject invalid OBJ face');
sessionStorage.setItem('cadcraft.android.profile.handoff',JSON.stringify({
 version:1,sourceHandle:'2F',points:[[0,0],[80,0],[80,30],[0,30]]
}));
assert.equal(evaluate('receiveSelectedProfile()'),true,'direct selection received');
assert.equal(evaluate('model.v.length'),8,'native CADCraft selected shape extruded');
assert.equal(evaluate('sourceHandle'),'2F','source handle retained');
assert.equal(sessionStorage.getItem('cadcraft.android.profile.handoff'),null,'selected profile consumed once');
assert.equal(evaluate("JSON.parse(serializeProject()).sourceHandle"),'2F','origin metadata saved');
assert.equal(evaluate('receiveSelectedProfile()'),false,'no replay on reload');
sessionStorage.setItem('cadcraft.android.profile.handoff',JSON.stringify({
 version:1,sourceHandle:'bad',points:[[0,0],[10,10],[0,10],[10,0]]
}));
assert.equal(evaluate('receiveSelectedProfile()'),false,'invalid CADCraft selection rejected');
assert.equal(evaluate('model.v.length'),8,'invalid selection leaves previous solid unchanged');
assert.equal(evaluate("setSketchProfile([[0,0],[25,0],[25,25],[0,25]]).faces.length"),12,'replacement profile extrudes');
assert.equal(evaluate('sourceHandle'),null,'new manually edited profile clears previous CADCraft selection handle');
assert.equal(evaluate('JSON.parse(serializeProject()).sourceHandle'),null,'new project cannot retain stale origin');

console.log('3D studio tests passed');
