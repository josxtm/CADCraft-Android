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

assert.equal(evaluate('changeHeight(5)'),true,'increase extrusion height');
assert.equal(evaluate('model.h'),30,'extrusion height updated');
assert.equal(evaluate('model.v[4][2]'),30,'extrusion vertices updated');
assert.equal(evaluate('changeHeight(-30)'),false,'reject zero height from increment');
assert.equal(evaluate('model.h'),30,'zero increment must preserve active solid');
assert.equal(evaluate("(()=>{document.getElementById('height').value='0';return extrudeForm()})()"),false,'reject invalid numeric input');
assert.equal(evaluate('model.h'),30,'invalid form preserves current model');
assert.equal(evaluate("(()=>{document.getElementById('height').value='30';return extrudeForm()})()"),true,'restore valid form');
assert.equal(evaluate('faceType(model.faces[0],model)'), 'inferior','bottom faces classified');
assert.equal(evaluate('faceType(model.faces[1],model)'), 'superior','top faces classified');
assert.equal(evaluate('faceType(model.faces[4],model)'), 'lateral','side faces classified');
assert.equal(evaluate('insideTriangle2D([2,2],[0,0],[5,0],[0,5])'),true,'screen triangle point inside');
assert.equal(evaluate('insideTriangle2D([5,5],[0,0],[5,0],[0,5])'),false,'screen triangle point outside');
assert.equal(evaluate("(()=>{const p=makeProjection(),f=model.faces[1],v=f.map(i=>p(model.v[i])),sc=zoom*(devicePixelRatio||1),x=canvas.width/2+(v[0].x+v[1].x+v[2].x)/3*sc,y=canvas.height/2-(v[0].y+v[1].y+v[2].y)/3*sc;return selectFaceAt(x,y)})()"),true,'tap a projected triangle');
assert.equal(evaluate('selectedFace>=0'),true,'face selection retained');
assert.equal(evaluate('toggleFaceMode()'),true,'selection mode on');
assert.equal(evaluate('toggleFaceMode()'),false,'selection mode off');
assert.equal(evaluate('clearFaceSelection();selectedFace'),-1,'clear face selection');
assert.equal(evaluate('pickFaceAt(-2000,-2000)'),-1,'miss outside canvas');

// Multi-solid scene: mesh aggregation, independent editing, movement and JSON compatibility.
assert.equal(evaluate('duplicateSceneSolid()'),true,'duplicate current 3D solid');
assert.equal(evaluate('storedSolids.length'),1,'duplicated solid stored separately');
assert.equal(evaluate('combinedScene().faces.length'),24,'both solids rendered');
assert.equal(evaluate('meshAsObj(combinedScene()).split("\\n").filter(l=>l.startsWith("v ")).length'),16,'combined OBJ has both meshes');
assert.equal(evaluate('JSON.parse(serializeProject()).version'),2,'project format upgraded to v2');
assert.equal(evaluate('JSON.parse(serializeProject()).solids.length'),1,'scene is saved');
assert.equal(evaluate('loadProjectText(serializeProject()).faces.length'),12,'v2 scene roundtrip');
assert.equal(evaluate('combinedScene().faces.length'),24,'v2 restore retains both meshes');
assert.equal(evaluate('moveActiveSolid(12,23,34)'),true,'move active solid in XYZ');
assert.equal(evaluate('activeOffset[2]'),34,'Z offset retained');
assert.equal(evaluate('combinedScene().v[0][2]'),34,'rendered mesh uses XYZ offset');
assert.equal(evaluate("(()=>{try{moveActiveSolid(Infinity,0,0);return false}catch(e){return true}})()"),true,'invalid XYZ refused');
assert.equal(evaluate('activeOffset[0]'),12,'invalid XYZ preserves last offset');
assert.equal(evaluate('createSceneSolid()'),true,'add a new independent piece');
assert.equal(evaluate('storedSolids.length'),2,'scene grows to three pieces');
assert.equal(evaluate('combinedScene().faces.length'),36,'three solids rendered');
assert.equal(evaluate('cycleSceneSolid()'),true,'switch active piece');
assert.equal(evaluate('combinedScene().faces.length'),36,'switch does not lose meshes');
assert.equal(evaluate('JSON.parse(serializeProject()).solids.length'),2,'three solids serialized');
assert.equal(evaluate('loadProjectText(serializeProject()).faces.length'),12,'three-piece project roundtrip');
assert.equal(evaluate('combinedScene().faces.length'),36,'three solids reload');
assert.equal(evaluate('deleteSceneSolid()'),true,'delete selected piece');
assert.equal(evaluate('combinedScene().faces.length'),24,'deletion removes one mesh');
assert.equal(evaluate("(()=>{try{loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:2,profile:[[0,0],[20,0],[20,10],[0,10]],height:8,activeSolidId:1,activeOffset:[0,0,0],solids:[{id:1,profile:[[0,0],[10,0],[10,10],[0,10]],height:4,offset:[0,0,0]}]}));return false}catch(e){return true}})()"),true,'duplicate IDs invalid');
assert.equal(evaluate('combinedScene().faces.length'),24,'invalid project preserves active scene');
assert.equal(evaluate("loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[20,0],[20,10],[0,10]],height:8})).faces.length"),12,'legacy project v1 supported');
assert.equal(evaluate('storedSolids.length'),0,'legacy project removes new scene extras');

// Solid-to-solid contact detection (simple vertical prisms, not boolean B-Rep).
const pairResults=evaluate("(()=>{const rect=[[0,0],[10,0],[10,10],[0,10]];const r=(p,z=0,h=10,x=0,y=0)=>({id:1,profile:p,height:h,offset:[x,y,z],mesh:extrude(p,h)});const a=r(rect);return {overlap:relationBetweenSolids(a,r(rect,0,10,5,5)),touch:relationBetweenSolids(a,r(rect,0,10,10,0)),clear:relationBetweenSolids(a,r(rect,0,10,11,0)),same:relationBetweenSolids(a,r(rect)),ztouch:relationBetweenSolids(a,r(rect,10,10,0,0)),zgap:relationBetweenSolids(a,r(rect,11,10,0,0)),contained:relationBetweenSolids(a,r([[2,2],[4,2],[4,4],[2,4]])),concaveHole:relationBetweenSolids(r([[0,0],[20,0],[20,5],[5,5],[5,20],[0,20]]),r([[10,10],[13,10],[13,13],[10,13]])),negContact:relationBetweenSolids(r(rect,0,-10),r(rect,-20,10)),pairCount:sceneContacts([a,r(rect,0,10,5,5),r(rect,0,10,10,0)]).length};})()");
assert.equal(pairResults.overlap,'interseccion','overlapping prisms have interfering volume');
assert.equal(pairResults.touch,'contacto','touching side faces are not a volume intersection');
assert.equal(pairResults.clear,'separadas','separated XY bounds');
assert.equal(pairResults.same,'interseccion','identical footprints are volumetric intersections');
assert.equal(pairResults.ztouch,'contacto','contact across Z-facing planes');
assert.equal(pairResults.zgap,'separadas','vertical Z gap');
assert.equal(pairResults.contained,'interseccion','contained profile intersecting 3D volume');
assert.equal(pairResults.concaveHole,'separadas','concave cutout must not give bounding-box false positive');
assert.equal(pairResults.negContact,'contacto','negative-height extrusion face contact');
assert.equal(pairResults.pairCount,3,'all scene pairs are evaluated');
assert.equal(evaluate('createSceneSolid()'),true,'create second prism for collision test');
assert.equal(evaluate('moveActiveSolid(0,0,0)'),true,'overlap prisms deliberately');
assert.equal(evaluate("inspectSceneContacts()[0].relation"),'interseccion','collision analyser detects active overlapping piece');
assert.equal(evaluate('separateActiveSolid(10)'),true,'auto-separate active piece with 10 mm margin');
assert.equal(evaluate('inspectSceneContacts().length'),0,'pieces do not touch after automatic separation');
assert.equal(evaluate('loadProjectText(serializeProject()).faces.length'),12,'save and reload auto-separated scene');
assert.equal(evaluate('inspectSceneContacts().length'),0,'saved positions preserve separation');


// Exact intersection volumes using triangle clipping (prism extrusion shapes).
const volumes=evaluate("(()=>{const rect=[[0,0],[10,0],[10,10],[0,10]];const r=(p,h=10,x=0,y=0,z=0)=>({id:1,profile:p,height:h,offset:[x,y,z],mesh:extrude(p,h)});const a=r(rect);return {same:prismOverlapMetrics(a,a),quarter:prismOverlapMetrics(a,r(rect,10,5,5)),side:prismOverlapMetrics(a,r(rect,10,10,0)),gap:prismOverlapMetrics(a,r(rect,10,0,0,11)),nested:prismOverlapMetrics(a,r([[2,2],[4,2],[4,4],[2,4]])),concave:prismOverlapMetrics(r([[0,0],[20,0],[20,5],[5,5],[5,20],[0,20]]),r([[10,10],[13,10],[13,13],[10,13]])),negative:prismOverlapMetrics(r(rect,-10),r(rect,10,0,0,-5)),diamond:prismOverlapMetrics(r([[0,5],[5,0],[10,5],[5,10]]),r(rect))};})()");
assert.equal(volumes.same.intersectionVolume,1000,'identical volumes completely intersect');
assert.equal(volumes.same.differenceA,0,'identical shapes subtract to no volume');
assert.equal(volumes.quarter.intersectionVolume,250,'partially intersecting boxes are 250 mm3');
assert.equal(volumes.quarter.unionVolume,1750,'union volume removes double counting');
assert.equal(volumes.quarter.differenceA,750,'subtraction volume is original less overlap');
assert.equal(volumes.side.intersectionVolume,0,'touching faces have zero overlap');
assert.equal(volumes.gap.intersectionVolume,0,'separated Z intervals have zero overlap');
assert.equal(volumes.nested.intersectionVolume,40,'contained smaller extruded profile');
assert.equal(volumes.nested.differenceB,0,'full containment subtracts all smaller volume');
assert.equal(volumes.concave.intersectionVolume,0,'concave open area has no overlap');
assert.equal(volumes.negative.intersectionVolume,500,'negative height prisms have correct overlap');
assert.equal(volumes.diamond.intersectionVolume,500,'rotated profile overlap');

console.log('3D studio tests passed');
