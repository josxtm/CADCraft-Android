const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2],'utf8');
const draw={highlightCount:0,beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){if(this.fillStyle==='rgba(255,152,47,0.55)')this.highlightCount++;},stroke(){},clearRect(){},fillRect(){},arc(){},fillText(){}};
const controls={width:{value:'100'},length:{value:'60'},height:{value:'25'},faceDistance:{value:'5'},moveAxis:{value:'XY'},moveSnap:{value:'0'},moveSensitivity:{value:'1'},featureAxis:{value:'X'},featureDistance:{value:'5'},vertexModeButton:{textContent:''},edgeModeButton:{textContent:''},dragFaceButton:{textContent:''},toolsPanel:{classList:{toggle(){}}},toolsToggle:{textContent:''},moveModeButton:{textContent:''},selectFaceButton:{textContent:''},offsetX:{value:'0'},offsetY:{value:'0'},offsetZ:{value:'0'},status:{textContent:''}};
const canvas={clientWidth:900,clientHeight:600,width:900,height:600,getContext(){return draw},getBoundingClientRect(){return {left:0,top:0,width:900,height:600}},listeners:{},addEventListener(name,fn){this.listeners[name]=fn},setPointerCapture(){}};
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
assert.equal(evaluate('JSON.parse(serializeProject()).version'),3,'project format upgraded to v3');
assert.equal(evaluate('JSON.parse(serializeProject()).solids.length'),1,'scene is saved');
assert.equal(evaluate('loadProjectText(serializeProject()).faces.length'),12,'v3 scene roundtrip');
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


// Limited but real boolean triangulated output for pairs of axis-aligned boxes.
// Validate signed volume of oriented surface triangles, not only volume formulas.
const booleanResults=evaluate("(()=>{const rect=[[0,0],[10,0],[10,10],[0,10]],make=(p,h=10,x=0,y=0,z=0)=>({id:1,profile:p,height:h,offset:[x,y,z],mesh:extrude(p,h)});const a=make(rect);const pair=(b)=>Object.fromEntries(['union','subtract','intersect'].map(op=>[op,meshOrientedVolume(booleanBoxMesh(a,b,op))]));const box=make(rect,10,5,5);return {overlap:pair(box),separate:pair(make(rect,10,20,20)),contained:pair(make([[2,2],[8,2],[8,8],[2,8]])),identical:pair(make(rect)),triangles:booleanBoxMesh(a,box,'union').faces.length,vertices:booleanBoxMesh(a,box,'union').v.length,refusesAngled:(()=>{try{booleanBoxMesh(a,make([[0,5],[5,0],[10,5],[5,10]]),'union');return false}catch(e){return true}})(),refusesInvalidMode:(()=>{try{booleanBoxMesh(a,box,'xor');return false}catch(e){return true}})()};})()");
const roundSix=x=>Math.round(x*1e6)/1e6;
assert.equal(roundSix(booleanResults.overlap.union),1750,'boolean union mesh volume');
assert.equal(roundSix(booleanResults.overlap.subtract),750,'boolean subtraction mesh volume');
assert.equal(roundSix(booleanResults.overlap.intersect),250,'boolean intersection mesh volume');
assert.equal(roundSix(booleanResults.separate.union),2000,'boolean union of disjoint blocks');
assert.equal(roundSix(booleanResults.separate.subtract),1000,'boolean subtraction of disjoint blocks');
assert.equal(roundSix(booleanResults.separate.intersect),0,'empty boolean intersection');
assert.equal(roundSix(booleanResults.contained.union),1000,'union with fully contained block');
assert.equal(roundSix(booleanResults.contained.subtract),640,'subtraction creates cavity');
assert.equal(roundSix(booleanResults.contained.intersect),360,'contained box intersection');
assert.equal(roundSix(booleanResults.identical.union),1000,'union of identical boxes');
assert.equal(roundSix(booleanResults.identical.subtract),0,'subtraction of identical boxes is empty');
assert.equal(roundSix(booleanResults.identical.intersect),1000,'intersection of identical boxes');
assert.equal(booleanResults.refusesAngled,true,'axis-aligned rectangular restriction enforced');
assert.equal(booleanResults.refusesInvalidMode,true,'reject unsupported boolean operation');
assert.equal(booleanResults.triangles>12,true,'partially merged box mesh has triangulated surface');
assert.equal(booleanResults.vertices>8,true,'partially merged mesh has additional boundary vertices');


// Boolean OBJ meshes must be watertight: every undirected triangle edge is shared twice.
const manifoldChecks=evaluate("(()=>{const p=[[0,0],[10,0],[10,10],[0,10]],make=(v,h=10,x=0,y=0,z=0)=>({id:1,profile:v,height:h,offset:[x,y,z],mesh:extrude(v,h)});const a=make(p),cases=[make(p,10,5,5),make(p,10,20,20),make([[2,2],[8,2],[8,8],[2,8]]),make(p),make(p,10,10,0)];return cases.flatMap(b=>['union','subtract','intersect'].map(op=>{const m=booleanBoxMesh(a,b,op),edges=new Map();for(const face of m.faces)for(let j=0;j<3;j++){const p=face[j],q=face[(j+1)%3],key=[Math.min(p,q),Math.max(p,q)].join('-');edges.set(key,(edges.get(key)||0)+1);}return [...edges.values()].every(count=>count===2)}));})()");
assert.equal(manifoldChecks.length,15,'all boolean shape scenarios checked for manifold edges');
assert.equal(manifoldChecks.every(Boolean),true,'boolean meshes have no open triangle edges');


// Persisted booleans as independent scene meshes: JSON v3 with v1/v2 imports.
assert.equal(evaluate('createSceneSolid()'),true,'second extruded prism created for boolean');
assert.equal(evaluate('moveActiveSolid(50,0,0)'),true,'position partial overlapping extrusion');
assert.equal(evaluate("Number.isInteger(addBooleanToScene('subtract'))"),true,'create boolean as a scene object');
assert.equal(evaluate('derivedSolids.length'),1,'one boolean result retained in scene');
assert.equal(evaluate('selectedDerivedId===derivedSolids[0].id'),true,'new boolean result is selected');
assert.equal(evaluate('validateDerivedMesh(derivedSolids[0].mesh).faces.length>0'),true,'stored derived triangle mesh is manifold');
assert.equal(evaluate('combinedScene().owners.includes(selectedDerivedId)'),true,'scene renderer includes boolean result');
assert.equal(evaluate('moveActiveSolid(100,20,30)'),true,'move selected boolean result XYZ');
assert.equal(evaluate('selectedDerived().offset[2]'),30,'mesh Z offset changed');
assert.equal(evaluate('activeOffset[0]'),50,'changing derived mesh does not move source extrusion');
assert.equal(evaluate('allSceneMeshes().at(-1).v[0][2]-derivedSolids[0].mesh.v[0][2]'),30,'derived world mesh obeys offset');
assert.equal(evaluate('JSON.parse(serializeProject()).version'),3,'JSON v3 stores derived meshes');
assert.equal(evaluate('JSON.parse(serializeProject()).derivedSolids.length'),1,'serialized project includes boolean results');
assert.equal(evaluate('loadProjectText(serializeProject()).faces.length'),12,'JSON v3 roundtrip retains active extrusion');
assert.equal(evaluate('derivedSolids.length'),1,'JSON v3 restores boolean scene objects');
assert.equal(evaluate('selectedDerived()!=null'),true,'project restores selected boolean');
assert.equal(evaluate('selectedDerived().offset[0]'),100,'project restores boolean XYZ offset');
assert.equal(evaluate('selectedDerived().parents.length'),2,'operation retains both source IDs');
assert.equal(evaluate('changeHeight(1)'),false,'boolean mesh does not masquerade as parametric extrusion');
assert.equal(evaluate('duplicateDerivedSolid()'),true,'duplicate selected boolean mesh');
assert.equal(evaluate('derivedSolids.length'),2,'scene holds two independent boolean copies');
assert.equal(evaluate('cycleDerivedSolid()'),true,'cycle selected boolean result');
assert.equal(evaluate('deleteDerivedSolid()'),true,'delete selected boolean mesh');
assert.equal(evaluate('derivedSolids.length'),1,'deleting one mesh preserves other objects');
assert.equal(evaluate("meshAsObj(combinedScene()).split('\\n').filter(l=>l.startsWith('f ')).length>24"),true,'combined OBJ exports derived and extrusions');
const savedBoolean=evaluate('serializeProject()');
const derivedBefore=evaluate('derivedSolids.length');
assert.equal(evaluate("(()=>{const o=JSON.parse(serializeProject());o.derivedSolids[0].mesh.faces[0]=[0,0,0];try{loadProjectText(JSON.stringify(o));return false}catch(e){return true}})()"),true,'malformed boolean faces rejected on load');
assert.equal(evaluate('derivedSolids.length'),derivedBefore,'rejected file does not overwrite scene');
assert.equal(evaluate("(()=>{const o=JSON.parse(serializeProject());o.derivedSolids[0].id=o.activeSolidId;try{loadProjectText(JSON.stringify(o));return false}catch(e){return true}})()"),true,'duplicate source and result IDs rejected');
assert.equal(evaluate('derivedSolids.length'),derivedBefore,'rejected duplicate ID leaves data intact');
assert.equal(evaluate("(()=>{const o=JSON.parse(serializeProject());o.selectedDerivedId=999999;try{loadProjectText(JSON.stringify(o));return false}catch(e){return true}})()"),true,'unknown selected boolean ID rejected');
assert.equal(evaluate('derivedSolids.length'),derivedBefore,'rejected selected ID leaves data intact');
assert.equal(evaluate('loadProjectText(serializeProject()).faces.length'),12,'valid boolean scene still loadable');
assert.equal(evaluate("loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:2,profile:[[0,0],[10,0],[10,10],[0,10]],height:10,activeSolidId:4,activeOffset:[0,0,0],solids:[]})).faces.length"),12,'legacy v2 project imports');
assert.equal(evaluate('derivedSolids.length'),0,'legacy v2 project has no derived meshes');
assert.equal(evaluate('selectedDerivedId'),null,'legacy v2 project has no derived selection');


// Selecting any visible face must switch the active scene object, while
// derived meshes support bounded planar push/pull and local undo/redo.
assert.equal(evaluate("loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[100,0],[100,60],[0,60]],height:25})).faces.length"),12,'fresh 100x60 extrusion for tactile picking');
assert.equal(evaluate('createSceneSolid()'),true,'create spatially separate second extrusion');
const tapFromOther=evaluate("(()=>{snap('top');const s=combinedScene(),owner=storedSolids[0].id,idx=s.owners.findIndex((id,i)=>id===owner&&s.faces[i].every(j=>Math.abs(s.v[j][2]-25)<1e-8));const face=s.faces[idx],p=makeProjection(s),q=face.map(i=>p(s.v[i])),x=canvas.width/2+q.reduce((t,v)=>t+v.x,0)/3*zoom,y=canvas.height/2-q.reduce((t,v)=>t+v.y,0)/3*zoom;return {owner,selected:selectFaceAt(x,y),active:activeSolidId,local:faceLocalIndex(combinedScene(),selectedFace)}})()");
assert.equal(tapFromOther.selected,true,'touch a face of previously inactive extrusion');
assert.equal(tapFromOther.active,tapFromOther.owner,'touched extrusion becomes active');
assert.equal(tapFromOther.local>=0,true,'touched face index remapped correctly after switching active object');
assert.equal(evaluate('activateSceneOwner(storedSolids[0].id)'),true,'reselect second extrusion');
assert.equal(evaluate('moveActiveSolid(50,0,0)'),true,'move second extrusion to overlap first');
assert.equal(evaluate("Number.isInteger(addBooleanToScene('subtract'))"),true,'generate boolean result and select it');
assert.equal(evaluate('Math.round(meshOrientedVolume(selectedDerived().mesh))'),75000,'subtraction starting volume');
assert.equal(evaluate("(()=>{const s=combinedScene();selectedFace=s.owners.findIndex((id,i)=>id===selectedDerivedId&&facePlaneInfo(selectedDerived().mesh,faceLocalIndex(s,i)).axis===2&&facePlaneInfo(selectedDerived().mesh,faceLocalIndex(s,i)).sign===1);return selectedFace>=0})()"),true,'select planar upward face of boolean mesh');
assert.equal(evaluate('selectedDerivedFace().axis'),2,'selected face normal aligned with Z');
assert.equal(evaluate('editSelectedDerivedFace(5)'),true,'push top plane outward 5mm');
assert.equal(evaluate('Math.round(meshOrientedVolume(selectedDerived().mesh))'),90000,'face push adds correct volume');
assert.equal(evaluate('undoDerivedEdit()'),true,'undo last boolean face operation');
assert.equal(evaluate('Math.round(meshOrientedVolume(selectedDerived().mesh))'),75000,'undo restores prior boolean volume');
assert.equal(evaluate('redoDerivedEdit()'),true,'redo previously undone face operation');
assert.equal(evaluate('Math.round(meshOrientedVolume(selectedDerived().mesh))'),90000,'redo restores modified boolean volume');
assert.equal(evaluate('editSelectedDerivedFace(-100)'),false,'reject face passing through opposite solid plane');
assert.equal(evaluate('Math.round(meshOrientedVolume(selectedDerived().mesh))'),90000,'failed face edit does not destroy geometry');
assert.equal(evaluate('Math.round(meshOrientedVolume(model))'),150000,'source extrusion stays unchanged');
assert.equal(evaluate('loadProjectText(serializeProject()).faces.length'),12,'JSON v3 reload after face editing');
assert.equal(evaluate('Math.round(meshOrientedVolume(selectedDerived().mesh))'),90000,'edited boolean surface survives JSON roundtrip');
assert.equal(evaluate('undoDerivedEdit()'),false,'undo history is cleared on project import');
assert.equal(evaluate('activateSceneOwner(storedSolids[0].id)'),true,'touch-selected source can be restored');
assert.equal(evaluate('selectedDerivedId'),null,'switching to source clears boolean selection');


// Pointer-gesture regression. Simulate real registered pointer callbacks in the VM.
assert.equal(evaluate('toggleTools()'),false,'collapse mobile sidebar');
assert.equal(evaluate('toggleTools()'),true,'expand mobile sidebar');
assert.equal(evaluate("loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[100,0],[100,60],[0,60]],height:25})).faces.length"),12,'reset scene for gesture tests');
assert.equal(evaluate('moveHistory.length'),0,'loading a project clears stale movement history');
assert.equal(evaluate("projectedDragDelta(100,0,'XY',0,Math.PI/2,2)[1]"),50,'XY transform from pixel movement');
assert.equal(evaluate("projectedDragDelta(0,-30,'Z',0,0,2)[2]"),15,'constrained Z drag maps screen movement');
assert.equal(evaluate("(()=>{try{projectedDragDelta(10,10,'XY',0,0,2);return false}catch(e){return true}})()"),true,'prevent unstable XY drag when viewed edge-on');
assert.equal(evaluate("(()=>{try{projectedDragDelta(10,10,'Z',0,Math.PI/2,2);return false}catch(e){return true}})()"),true,'reject nearly invisible constrained axis');
const firstGesture=evaluate("(()=>{snap('top');const s=combinedScene(),f=s.faces[1],v=f.map(i=>makeProjection(s)(s.v[i]));const x=canvas.width/2+v.reduce((n,p)=>n+p.x,0)/3*zoom,y=canvas.height/2-v.reduce((n,p)=>n+p.y,0)/3*zoom;toggleMoveMode();const cameraAz=az,cameraEl=el;canvas.listeners.pointerdown({pointerId:33,clientX:x,clientY:y});canvas.listeners.pointermove({pointerId:33,clientX:x+24,clientY:y});canvas.listeners.pointerup({pointerId:33,clientX:x+24,clientY:y});return {offset:activeOffset.slice(),camStable:az===cameraAz&&el===cameraEl,history:moveHistory.length,mode:moveMode}})()");
assert.equal(firstGesture.mode,true,'pointer test begins in move mode');
assert.equal(firstGesture.camStable,true,'drag does not rotate camera');
assert.equal(firstGesture.offset.some(n=>Math.abs(n)>0.01),true,'drag really moves a 3D object');
assert.equal(firstGesture.history,1,'one pointer stroke creates one undo entry');
assert.equal(evaluate('undoMove()'),true,'undo complete pointer gesture');
assert.equal(evaluate('activeOffset[0]'),0,'undo X position');
assert.equal(evaluate('activeOffset[1]'),0,'undo Y position');
assert.equal(evaluate('redoMove()'),true,'redo complete pointer gesture');
assert.equal(evaluate('moveHistory.length'),1,'redo does not duplicate history');
assert.equal(evaluate("(()=>{captureMoveGesture(34,10,10,activeSolidId);updateMoveGesture(34,15,30,'XY',0);return finishMoveGesture(34,true)})()"),false,'cancelled gesture returns false');
assert.equal(evaluate('moveHistory.length'),1,'cancelled gesture makes no history entry');
assert.equal(evaluate("(()=>{document.getElementById('offsetX').value='30';document.getElementById('offsetY').value='60';document.getElementById('offsetZ').value='10';return applyOffset()})()"),true,'numeric XYZ moves are also undoable');
assert.equal(evaluate('moveHistory.length'),2,'numeric move creates exactly one history entry');
assert.equal(evaluate('activeOffset[2]'),10,'numeric move changes Z position');
assert.equal(evaluate('undoMove()'),true,'undo numeric XYZ move');
assert.equal(evaluate('activeOffset[2]'),0,'undo numeric move restores Z');
assert.equal(evaluate('redoMove()'),true,'redo numeric XYZ move');
assert.equal(evaluate('activeOffset[2]'),10,'redo numeric move restores Z');
assert.equal(evaluate('toggleFaceMode()'),true,'face selection mode can be enabled');
assert.equal(evaluate('moveMode'),false,'enabling face selection disables object move mode');
assert.equal(evaluate('loadProjectText(serializeProject()).faces.length'),12,'moving scene survives JSON save/load');
assert.equal(evaluate('moveHistory.length'),0,'load clears gesture history to prevent unrelated undo');


// Sensitivity, snapping and cancellation must not corrupt a solid or its history.
assert.equal(evaluate("loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[100,0],[100,60],[0,60]],height:25})).faces.length"),12,'reset for sensitivity tests');
assert.equal(evaluate("(()=>{snap('top');captureMoveGesture(55,100,100,activeSolidId);const normal=projectedDragDelta(10,0,'XY',az,el,zoom);updateMoveGesture(55,110,100,'XY',0,2);return Math.abs(activeOffset[0]-normal[0]*2)<1e-7&&Math.abs(activeOffset[1]-normal[1]*2)<1e-7})()"),true,'sensitivity doubles displacement on XY plane');
assert.equal(evaluate('finishMoveGesture(55)'),true,'sensitivity gesture saves one move');
assert.equal(evaluate('moveHistory.length'),1,'sensitivity gesture stored once');
assert.equal(evaluate("(()=>{const before=activeOffset.slice();captureMoveGesture(56,200,200,activeSolidId);return (()=>{try{updateMoveGesture(56,220,220,'XY',0,0.01);return false}catch(e){return activeOffset.every((x,i)=>Math.abs(x-before[i])<1e-9)}})()})()"),true,'out of range sensitivity rejected without moving');
assert.equal(evaluate('finishMoveGesture(56,true)'),false,'invalid move canceled without adding history');
assert.equal(evaluate('moveHistory.length'),1,'invalid gesture leaves undo history intact');
assert.equal(evaluate("(()=>{captureMoveGesture(57,100,100,activeSolidId);updateMoveGesture(57,120,100,'XY',5,1);return activeOffset.every(v=>Math.abs(v/5-Math.round(v/5))<1e-9)})()"),true,'5mm snapping locks moved XY coordinates to grid');
assert.equal(evaluate('finishMoveGesture(57)'),true,'snapped gesture confirmed');
assert.equal(evaluate('moveHistory.length'),2,'snapped gesture recorded once');
assert.equal(evaluate('toggleMoveMode()'),true,'enable move mode for interruption test');
assert.equal(evaluate("(()=>{captureMoveGesture(58,100,100,activeSolidId);updateMoveGesture(58,130,100,'XY',0,1);return !!moveGesture})()"),true,'unfinished drag exists before mode toggle');
const modeCancelOrigin=evaluate('moveGesture.origin.slice()');
assert.equal(evaluate('toggleMoveMode()'),false,'exit move mode');
assert.equal(evaluate('moveGesture'),null,'leaving move mode cancels ongoing drag');
assert.equal(evaluate('activeOffset[0]'),modeCancelOrigin[0],'interrupted drag restores X');
assert.equal(evaluate('activeOffset[1]'),modeCancelOrigin[1],'interrupted drag restores Y');
assert.equal(evaluate('moveHistory.length'),2,'interrupted drag does not create extra undo');


// Regression for the on-screen XYZ manipulator (CI must support drawing arcs).
const gizmoTrial=evaluate("(()=>{loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[100,0],[100,60],[0,60]],height:25}));snap('iso');if(moveMode)toggleMoveMode();toggleMoveMode();const g=gizmoGeometry(),axes=Object.keys(g.axes),[x,y]=g.axes.X.point,hit=hitGizmoAxis(x,y,g),centerHit=hitGizmoAxis(g.center[0],g.center[1],g),camera=cameraCenter.slice(),az0=az,el0=el;canvas.listeners.pointerdown({pointerId:75,clientX:x,clientY:y});const locked=moveGesture?.axis;canvas.listeners.pointermove({pointerId:75,clientX:x+20,clientY:y+20});const moved=activeOffset.slice(),cameraStable=az===az0&&el===el0&&camera.every((value,i)=>value===cameraCenter[i]);canvas.listeners.pointerup({pointerId:75,clientX:x+20,clientY:y+20});const count=moveHistory.length,undo=undoMove(),previous=activeOffset.slice(),redo=redoMove(),restored=activeOffset.slice();return {axes,hit,centerHit,locked,moved,cameraStable,count,undo,previous,redo,restored};})()");
assert.equal(gizmoTrial.axes.includes('X'),true,'X axis handle is visible');
assert.equal(gizmoTrial.axes.includes('Y'),true,'Y axis handle is visible');
assert.equal(gizmoTrial.axes.includes('Z'),true,'Z axis handle is visible');
assert.equal(gizmoTrial.hit,'X','X handle hit-test detects finger');
assert.equal(gizmoTrial.centerHit,'XY','yellow center hit-test selects planar move');
assert.equal(gizmoTrial.locked,'X','drag is locked to handle axis');
assert.equal(gizmoTrial.moved[0]>0,true,'gizmo moves object along X');
assert.equal(gizmoTrial.moved[1],0,'X handle does not move Y');
assert.equal(gizmoTrial.moved[2],0,'X handle does not move Z');
assert.equal(gizmoTrial.cameraStable,true,'gizmo movement keeps camera pivot and angles fixed');
assert.equal(gizmoTrial.count,1,'handle drag saves exactly one undo step');
assert.equal(gizmoTrial.undo,true,'gizmo movement can be undone');
assert.equal(gizmoTrial.previous[0],0,'undo gizmo restores X');
assert.equal(gizmoTrial.redo,true,'gizmo movement can be redone');
assert.equal(gizmoTrial.restored[0],gizmoTrial.moved[0],'redo restores gizmo displacement');


// Visual feedback and camera control: geometry stays fixed during gizmo drags,
// selected piece bounds highlight and XY handle is disabled edge-on.
assert.equal(evaluate("loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[100,0],[100,60],[0,60]],height:25})).faces.length"),12,'focus tests use a fresh scene');
if(evaluate('faceMode'))evaluate('toggleFaceMode()');
if(evaluate('moveMode'))evaluate('toggleMoveMode()');
assert.equal(evaluate('focusSelectedSolid()'),true,'focus selected solid works');
const firstFocus=evaluate('cameraCenter.slice()');
assert.equal(firstFocus[0],50,'focus centers source block X');
assert.equal(firstFocus[1],30,'focus centers source block Y');
assert.equal(firstFocus[2],12.5,'focus centers source block Z');
assert.equal(evaluate('createSceneSolid()'),true,'add another piece to focus');
const currentId=evaluate('activeSolidId');
assert.equal(evaluate('focusSelectedSolid()'),true,'focus independent solid');
const secondFocus=evaluate('cameraCenter.slice()');
assert.equal(secondFocus[0]>firstFocus[0],true,'focus follows other mesh to the right');
assert.equal(evaluate('gizmoGeometry()'),null,'gizmo unavailable when move mode is disabled');
assert.equal(evaluate('toggleMoveMode()'),true,'enable move mode and render manipulator');
const visual=evaluate("(()=>{const g=gizmoGeometry(),scene=combinedScene(),p=scene.v.map(makeProjection(scene));return {id:g.owner,bounds:drawActiveObjectBounds(ctx,scene,p,zoom),axes:Object.keys(g.axes)}})()");
assert.equal(visual.id,currentId,'manipulator follows active object');
assert.equal(visual.bounds.owner,currentId,'orange selection box follows active object');
assert.equal(visual.bounds.left<visual.bounds.right,true,'object selection box has positive width');
assert.equal(visual.bounds.top<visual.bounds.bottom,true,'object selection box has positive height');
assert.equal(visual.axes.includes('X'),true,'gizmo X handle exists');
assert.equal(visual.axes.includes('Y'),true,'gizmo Y handle exists');
assert.equal(visual.axes.includes('Z'),true,'gizmo Z handle exists');
assert.equal(evaluate("snap('front');gizmoGeometry().xyAvailable"),false,'unsafe XY handle disabled edge-on');
assert.equal(evaluate("hitGizmoAxis(...gizmoGeometry().center)"),null,'edge-on XY center cannot start a bad drag');
assert.equal(evaluate("snap('top');gizmoGeometry().xyAvailable"),true,'XY available from superior view');
assert.equal(evaluate("hitGizmoAxis(...gizmoGeometry().center)"),'XY','XY center activates in superior view');
assert.equal(evaluate("(()=>{const g=gizmoGeometry(),p=g.axes.Y.point;return movePointerDown(84,p[0],p[1],p[0],p[1])})()"),true,'grab visible Y axis handle');
assert.equal(evaluate('moveGesture.axis'),'Y','axis locked when finger grabs gizmo');
assert.equal(evaluate("(()=>{const before=moveGesture.origin[0],g=moveGesture;updateMoveGesture(84,g.startX+30,g.startY+10,'X',0,1);return activeOffset[0]-before})()"),0,'locked Y gesture ignores changed X toolbar setting');
assert.equal(evaluate("displacementDisplay().includes('Y:')"),true,'HUD reports selected Y axis');
assert.equal(evaluate("displacementDisplay().includes('mm')"),true,'HUD includes millimetre units');
assert.equal(evaluate('finishMoveGesture(84)'),true,'finish constrained gizmo drag');
assert.equal(evaluate('displacementDisplay()'),'','HUD clears after pointerup');
assert.equal(evaluate('undoMove()'),true,'new gizmo drag undo works');
assert.equal(evaluate('redoMove()'),true,'new gizmo drag redo works');
assert.equal(evaluate('toggleMoveMode()'),false,'exit move mode');
assert.equal(evaluate('gizmoGeometry()'),null,'no phantom gizmo when returning to camera mode');


// Direct face editing: real simulated canvas pointer events on a derived mesh.
assert.equal(evaluate("loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[100,0],[100,60],[0,60]],height:25})).faces.length"),12,'face-drag tests start from new scene');
assert.equal(evaluate('createSceneSolid()'),true,'create second source solid for face drag');
assert.equal(evaluate('moveActiveSolid(50,0,0)'),true,'intersect original extrusions');
assert.equal(evaluate("Number.isInteger(addBooleanToScene('subtract'))"),true,'create derived mesh for direct face edit');
assert.equal(evaluate('moveActiveSolid(300,0,0)'),true,'place edited boolean away from source objects');
assert.equal(evaluate("snap('iso');fit();if(moveMode)toggleMoveMode();if(faceMode)toggleFaceMode();toggleFaceDragMode()"),true,'enable direct face drag mode');
assert.equal(evaluate('moveMode'),false,'direct face editing excludes object movement');
assert.equal(evaluate('faceMode'),false,'direct face editing excludes face selection mode');
assert.equal(evaluate("document.getElementById('dragFaceButton').textContent"),'Arrastrar plano: ON','visible button reports direct edit mode');
const dragFaceTarget=evaluate("(()=>{const scene=combinedScene(),proj=makeProjection(scene),sc=zoom*(devicePixelRatio||1),id=selectedDerivedId;const idx=scene.owners.findIndex((owner,i)=>owner===id&&facePlaneInfo(selectedDerived().mesh,faceLocalIndex(scene,i)).axis===2&&facePlaneInfo(selectedDerived().mesh,faceLocalIndex(scene,i)).sign===1);if(idx<0)throw Error('No upper face');const v=scene.faces[idx].map(k=>proj(scene.v[k]));return {x:canvas.width/2+v.reduce((s,p)=>s+p.x,0)/3*sc,y:canvas.height/2-v.reduce((s,p)=>s+p.y,0)/3*sc,owner:id}})()");
assert.equal(evaluate("faceAtScenePoint("+dragFaceTarget.x+","+dragFaceTarget.y+",false)>=0"),true,'touch target projects to visible face');
assert.equal(evaluate("meshOrientedVolume(selectedDerived().mesh)"),75000,'unmodified boolean mesh volume');
evaluate("canvas.listeners.pointerdown({pointerId:202,clientX:"+dragFaceTarget.x+",clientY:"+dragFaceTarget.y+"})");
assert.equal(evaluate('faceGesture!=null'),true,'finger down starts editable face gesture');
assert.equal(evaluate('faceGesture.axis'),2,'touched horizontal face uses Z normal');
assert.equal(evaluate('faceGesture.id'),dragFaceTarget.owner,'finger gesture bound to derived solid');
const dragSlope=evaluate("faceDragWorldDistance(faceGesture,"+dragFaceTarget.x+","+(dragFaceTarget.y+1)+")");
assert.equal(Number.isFinite(dragSlope)&&Math.abs(dragSlope)>1e-8,true,'axis can be projected onto screen');
const dy=5/dragSlope;
evaluate("canvas.listeners.pointermove({pointerId:202,clientX:"+dragFaceTarget.x+",clientY:"+(dragFaceTarget.y+dy)+"})");
assert.equal(Math.round(evaluate('meshOrientedVolume(selectedDerived().mesh)')),90000,'drag preview increases boolean volume');
assert.equal(Math.round(evaluate('faceGesture.distance')),5,'drag previews signed 5 mm displacement');
draw.highlightCount=0;
evaluate('render()');
assert.equal(draw.highlightCount>=2,true,'all coplanar face triangles are highlighted');
evaluate("canvas.listeners.pointerup({pointerId:202,clientX:"+dragFaceTarget.x+",clientY:"+(dragFaceTarget.y+dy)+"})");
assert.equal(evaluate('faceGesture'),null,'finger release clears transient drag');
assert.equal(evaluate('derivedUndo.length'),1,'whole drag recorded as a single undo operation');
assert.equal(evaluate('undoDerivedEdit()'),true,'undo direct face drag');
assert.equal(evaluate('Math.round(meshOrientedVolume(selectedDerived().mesh))'),75000,'undo restores full prior volume');
assert.equal(evaluate('redoDerivedEdit()'),true,'redo direct face drag');
assert.equal(evaluate('Math.round(meshOrientedVolume(selectedDerived().mesh))'),90000,'redo restores dragged volume');
assert.equal(evaluate('Math.round(meshOrientedVolume(model))'),150000,'source extrusion geometry unchanged');
assert.equal(evaluate('beginFaceGesture(203,10,10)'),true,'begin second drag for cancellation test');
assert.equal(evaluate("previewFaceGesture(203,10,10+5/faceDragWorldDistance(faceGesture,10,11),1,0)"),true,'preview second drag');
assert.equal(evaluate('finishFaceGesture(203,true)'),false,'pointer cancellation does not commit');
assert.equal(evaluate('Math.round(meshOrientedVolume(selectedDerived().mesh))'),90000,'cancel restores committed mesh');
assert.equal(evaluate('derivedUndo.length'),1,'cancel adds no undo entries');
assert.equal(evaluate('beginFaceGesture(204,10,10)'),true,'begin third drag for mode cancellation');
assert.equal(evaluate("previewFaceGesture(204,10,10+4/faceDragWorldDistance(faceGesture,10,11),1,0)"),true,'preview before switch');
assert.equal(evaluate('toggleMoveMode()'),true,'switching to Move cancels direct face edit');
assert.equal(evaluate('faceDragMode'),false,'mode switch exits face drag');
assert.equal(evaluate("document.getElementById('dragFaceButton').textContent"),'Arrastrar plano: OFF','mode switch updates button immediately');
assert.equal(evaluate('faceGesture'),null,'mode switch clears face gesture');
assert.equal(evaluate('Math.round(meshOrientedVolume(selectedDerived().mesh))'),90000,'mode change cancels preview geometry');
assert.equal(evaluate('derivedUndo.length'),1,'mode change does not create false undo');
assert.equal(evaluate('loadProjectText(serializeProject()).faces.length'),12,'modified boolean persists through JSON v3');
assert.equal(evaluate('Math.round(meshOrientedVolume(derivedSolids[0].mesh))'),90000,'saved result retains face geometry');
assert.equal(evaluate('derivedUndo.length'),0,'loading project clears temporary undo history');


// Mesh vertex/edge inspection, constrained cuboid cotas, rejection and undo.
assert.equal(evaluate("loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[100,0],[100,60],[0,60]],height:25})).faces.length"),12,"reset studio before feature editing");
assert.equal(evaluate("createSceneSolid()"),true,"create second source piece");
assert.equal(evaluate("moveActiveSolid(0,0,0)"),true,"overlap two identical blocks");
assert.equal(evaluate("Number.isInteger(addBooleanToScene('union'))"),true,"boolean result is editable derived mesh");
assert.equal(evaluate("axisAlignedCuboid(selectedDerived().mesh)!=null"),true,"union is validated as a rectangular solid");
assert.equal(evaluate("meshFeatureEdges(selectedDerived().mesh).length"),12,"ignore six internal triangle diagonals");
assert.equal(evaluate("toggleGeometryMode('vertex')"),"vertex","turn on vertex mode");
assert.equal(evaluate("document.getElementById('vertexModeButton').textContent"),"Vértices: ON","visible vertex mode state");
assert.equal(evaluate("moveMode"),false,"vertex mode does not move objects");
assert.equal(evaluate("(()=>{const p=geometryFeatureProjection(selectedDerived().mesh,selectedDerived().offset)[0];canvas.listeners.pointerdown({pointerId:60,clientX:p[0],clientY:p[1]});return selectedGeometryFeature?.kind})()"),"vertex","pointer event selects mesh vertex");
assert.equal(evaluate("selectedGeometryFeature.indices.length"),1,"vertex selects a single vertex index");
assert.equal(evaluate("meshOrientedVolume(selectedDerived().mesh)"),150000,"starting derived volume");
assert.equal(evaluate("editSelectedGeometryFeature(1)"),true,"move vertex-associated exterior plane along X");
assert.equal(evaluate("meshOrientedVolume(selectedDerived().mesh)"),142500,"X slab change updates volume");
assert.equal(evaluate("meshOrientedVolume(model)"),150000,"original source extrusion is untouched");
assert.equal(evaluate("undoDerivedEdit()"),true,"undo vertex-guided dimension");
assert.equal(evaluate("meshOrientedVolume(selectedDerived().mesh)"),150000,"undo restores prior geometry");
assert.equal(evaluate("redoDerivedEdit()"),true,"redo vertex-guided dimension");
assert.equal(evaluate("meshOrientedVolume(selectedDerived().mesh)"),142500,"redo restores geometry");
assert.equal(evaluate("axisAlignedCuboid(selectedDerived().mesh)!=null"),true,"edited mesh is still a cuboid");
assert.equal(evaluate("loadProjectText(serializeProject()).faces.length"),12,"persist modified mesh in JSON v3");
assert.equal(evaluate("meshOrientedVolume(selectedDerived().mesh)"),142500,"JSON preserves vertex-guided dimension");
assert.equal(evaluate("geometryMode"),null,"loading clears transient selection mode");
assert.equal(evaluate("toggleGeometryMode('edge')"),"edge","enable edge mode");
assert.equal(evaluate("document.getElementById('edgeModeButton').textContent"),"Aristas: ON","edge mode button is updated");
assert.equal(evaluate("(()=>{const e=meshFeatureEdges(selectedDerived().mesh)[0],p=geometryFeatureProjection(selectedDerived().mesh,selectedDerived().offset);canvas.listeners.pointerdown({pointerId:61,clientX:(p[e[0]][0]+p[e[1]][0])/2,clientY:(p[e[0]][1]+p[e[1]][1])/2});return selectedGeometryFeature?.kind})()"),"edge","pointer event selects physical mesh edge");
assert.equal(evaluate("selectedGeometryFeature.indices.length"),2,"edge selection has two endpoints");
assert.equal(evaluate("(()=>{const v=selectedGeometryFeature.indices.map(i=>selectedDerived().mesh.v[i]),axis=document.getElementById('featureAxis').value;return ['X','Y','Z'].includes(axis)&&v.every(p=>Math.abs(p[['X','Y','Z'].indexOf(axis)]-v[0][['X','Y','Z'].indexOf(axis)])<1e-8)})()"),true,"edge selection chooses a compatible axis");
assert.equal(evaluate("editSelectedGeometryFeature(-1)"),true,"edge-associated exterior slab can move");
assert.equal(evaluate("axisAlignedCuboid(selectedDerived().mesh)!=null"),true,"edge edit preserves cuboid");
assert.equal(evaluate("(()=>{document.getElementById('featureDistance').value='200001';const volume=meshOrientedVolume(selectedDerived().mesh);return !editSelectedGeometryFeature(1)&&volume===meshOrientedVolume(selectedDerived().mesh)})()"),true,"too-large dimension edit rejected atomically");
assert.equal(evaluate("(()=>{document.getElementById('featureDistance').value='5';const v=selectedGeometryFeature.indices.map(i=>selectedDerived().mesh.v[i]);const axis=['X','Y','Z'].find((a,j)=>Math.abs(v[0][j]-v[1][j])>1e-8);document.getElementById('featureAxis').value=axis;const volume=meshOrientedVolume(selectedDerived().mesh);return !editSelectedGeometryFeature(1)&&volume===meshOrientedVolume(selectedDerived().mesh)})()"),true,"edge cannot be dragged along its own length");
assert.equal(evaluate("undoDerivedEdit()"),true,"undo edge-guided dimension");
assert.equal(evaluate("redoDerivedEdit()"),true,"redo edge-guided dimension");
assert.equal(evaluate("toggleMoveMode()"),true,"can switch back to object movement");
assert.equal(evaluate("geometryMode"),null,"mode switch clears topology selection");
assert.equal(evaluate("selectedGeometryFeature"),null,"no stale selected feature after mode change");
assert.equal(evaluate("loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[100,0],[100,60],[0,60]],height:25})).faces.length"),12,"reset studio for complex-mesh restrictions");
assert.equal(evaluate("createSceneSolid()"),true,"create second solid for L-shaped remainder");
assert.equal(evaluate("moveActiveSolid(50,25,0)"),true,"create partially overlapping XY footprint");
assert.equal(evaluate("Number.isInteger(addBooleanToScene('subtract'))"),true,"create nonrectangular boolean mesh");
assert.equal(evaluate("axisAlignedCuboid(selectedDerived().mesh)"),null,"noncuboid is correctly detected");
assert.equal(evaluate("toggleGeometryMode('vertex')"),"vertex","complex mesh can be inspected");
assert.equal(evaluate("(()=>{const p=geometryFeatureProjection(selectedDerived().mesh,selectedDerived().offset)[0];return selectGeometryFeatureAt(p[0],p[1])})()"),true,"vertex remains selectable on noncuboid");
assert.equal(evaluate("(()=>{document.getElementById('featureAxis').value='X';const volume=meshOrientedVolume(selectedDerived().mesh);return !editSelectedGeometryFeature(1)&&meshOrientedVolume(selectedDerived().mesh)===volume})()"),true,"noncuboid edit refused without damage");
assert.equal(evaluate("loadProjectText(serializeProject()).faces.length"),12,"complex derived mesh remains saveable");


// Safe affine X/Y/Z scaling for nonrectangular closed boolean meshes.
assert.equal(evaluate("loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[100,0],[100,60],[0,60]],height:25})).faces.length"),12,"reset studio for affine dimension test");
assert.equal(evaluate("createSceneSolid()"),true,"create a second source for complex boolean");
assert.equal(evaluate("moveActiveSolid(50,25,0)"),true,"create partially overlapped source profiles");
assert.equal(evaluate("Number.isInteger(addBooleanToScene('subtract'))"),true,"derive concave L-shaped solid");
assert.equal(evaluate("axisAlignedCuboid(selectedDerived().mesh)"),null,"complex L-shaped result is not a rectangular block");
assert.equal(evaluate("toggleGeometryMode('vertex')"),"vertex","activate vertex selection on complex mesh");
assert.equal(evaluate("(()=>{const m=selectedDerived().mesh,b=meshAxisBounds(m);const idx=m.v.findIndex(p=>Math.abs(p[0]-b.min[0])<1e-8);selectedGeometryFeature={kind:'vertex',owner:selectedDerivedId,indices:[idx]};return idx>=0})()"),true,"select an exterior minimum X vertex");
assert.equal(evaluate("Math.abs(meshOrientedVolume(selectedDerived().mesh)-106250)<1e-6"),true,"concave initial solid has exact expected volume");
assert.equal(evaluate("Math.abs(scaledFeatureMesh(selectedDerived().mesh,selectedGeometryFeature,'X',5).factor-0.95)<1e-9"),true,"min X change scales all X coordinates by 0.95");
assert.equal(evaluate("scaleSelectedGeometryFeature(1)"),true,"extend selected minimum coordinate inward via positive affine scale");
assert.equal(evaluate("Math.abs(meshOrientedVolume(selectedDerived().mesh)-100937.5)<1e-6"),true,"L-shaped volume scales by known factor");
assert.equal(evaluate("Math.abs(meshAxisBounds(selectedDerived().mesh).span[0]-95)<1e-7"),true,"X dimension becomes 95 mm");
assert.equal(evaluate("axisAlignedCuboid(selectedDerived().mesh)"),null,"scaled L remains nonrectangular");
assert.equal(evaluate("meshOrientedVolume(model)"),150000,"source extrusion remains untouched after scaling");
assert.equal(evaluate("undoDerivedEdit()"),true,"undo affine scaling");
assert.equal(evaluate("Math.abs(meshOrientedVolume(selectedDerived().mesh)-106250)<1e-6"),true,"undo restores original L volume");
assert.equal(evaluate("redoDerivedEdit()"),true,"redo affine scaling");
assert.equal(evaluate("Math.abs(meshOrientedVolume(selectedDerived().mesh)-100937.5)<1e-6"),true,"redo restores previous scaling");
assert.equal(evaluate("(()=>{const m=selectedDerived().mesh,b=meshAxisBounds(m);const idx=m.v.findIndex(p=>Math.abs(p[2]-b.min[2])<1e-8);selectedGeometryFeature={kind:'vertex',owner:selectedDerivedId,indices:[idx]};document.getElementById('featureAxis').value='Z';return idx>=0})()"),true,"choose minimum Z vertex for second axis");
assert.equal(evaluate("scaleSelectedGeometryFeature(-1)"),true,"scale entire complex mesh along Z anchored to far end");
assert.equal(evaluate("Math.abs(meshOrientedVolume(selectedDerived().mesh)-121125)<1e-5"),true,"multi-axis scaling preserves expected volume");
assert.equal(evaluate("Math.abs(meshAxisBounds(selectedDerived().mesh).span[2]-30)<1e-7"),true,"Z thickness becomes 30 mm");
assert.equal(evaluate("loadProjectText(serializeProject()).faces.length"),12,"JSON v3 reload after affine scaling");
assert.equal(evaluate("Math.abs(meshOrientedVolume(derivedSolids[0].mesh)-121125)<1e-5"),true,"complex edited solid survives JSON roundtrip");
assert.equal(evaluate("derivedUndo.length"),0,"undo history cleared after project load");
assert.equal(evaluate("toggleGeometryMode('vertex')"),"vertex","reenter vertex mode for rejected operations");
assert.equal(evaluate("(()=>{const m=selectedDerived().mesh,b=meshAxisBounds(m);const idx=m.v.findIndex(p=>p[0]>b.min[0]+1&&p[0]<b.max[0]-1);selectedGeometryFeature={kind:'vertex',owner:selectedDerivedId,indices:[idx]};document.getElementById('featureAxis').value='X';return idx>=0})()"),true,"locate interior X step vertex on L-shaped mesh");
assert.equal(evaluate("(()=>{const old=meshOrientedVolume(selectedDerived().mesh);return !scaleSelectedGeometryFeature(1)&&Math.abs(meshOrientedVolume(selectedDerived().mesh)-old)<1e-7})()"),true,"non-boundary feature cannot trigger global scale");
assert.equal(evaluate("(()=>{const m=selectedDerived().mesh,b=meshAxisBounds(m);const idx=m.v.findIndex(p=>Math.abs(p[0]-b.min[0])<1e-8);selectedGeometryFeature={kind:'vertex',owner:selectedDerivedId,indices:[idx]};return idx>=0})()"),true,"reselect exterior min X to test collapse prevention");
assert.equal(evaluate("(()=>{const b=meshAxisBounds(selectedDerived().mesh),m=meshOrientedVolume(selectedDerived().mesh);document.getElementById('featureDistance').value=String(b.span[0]);return !scaleSelectedGeometryFeature(1)&&Math.abs(meshOrientedVolume(selectedDerived().mesh)-m)<1e-7})()"),true,"refuse a dimension that collapses to zero");
assert.equal(evaluate("(()=>{const m=meshOrientedVolume(selectedDerived().mesh);document.getElementById('featureDistance').value='100001';return !scaleSelectedGeometryFeature(1)&&Math.abs(meshOrientedVolume(selectedDerived().mesh)-m)<1e-7})()"),true,"refuse oversized scaling input without replacing geometry");
assert.equal(evaluate("(()=>{const m=selectedDerived().mesh,e=meshFeatureEdges(m).find(edge=>Math.abs(m.v[edge[0]][0]-m.v[edge[1]][0])>1e-6);selectedGeometryFeature={kind:'edge',owner:selectedDerivedId,indices:e};document.getElementById('featureAxis').value='X';document.getElementById('featureDistance').value='5';return Array.isArray(e)})()"),true,"select an X-longitudinal edge for invalid axis test");
assert.equal(evaluate("(()=>{const m=meshOrientedVolume(selectedDerived().mesh);return !scaleSelectedGeometryFeature(1)&&Math.abs(meshOrientedVolume(selectedDerived().mesh)-m)<1e-7})()"),true,"reject scaling along selected edge's own direction");
assert.equal(evaluate("toggleMoveMode()"),true,"move mode can be enabled after topology editing");
assert.equal(evaluate("geometryMode"),null,"mode exit clears vertex/edge inspection");
assert.equal(evaluate("selectedGeometryFeature"),null,"no stale vertex references after changing tools");


// Topology integrity for multiple watertight shells and malformed meshes.
const topology=evaluate("(()=>{const square=[[0,0],[10,0],[10,10],[0,10]],r=(p,h=10,x=0,y=0,z=0)=>({id:1,profile:p,height:h,offset:[x,y,z],mesh:extrude(p,h)}),a=r(square),inner=r([[2,2],[8,2],[8,8],[2,8]],6,0,0,2),away=r(square,10,20),cube=booleanBoxMesh(a,a,'union'),cavity=booleanBoxMesh(a,inner,'subtract'),separate=booleanBoxMesh(a,away,'union');const valid={cube:inspectMeshTopology(cube),cavity:inspectMeshTopology(cavity),separate:inspectMeshTopology(separate)};const clone=m=>({v:m.v.map(p=>p.slice()),faces:m.faces.map(f=>f.slice())}),bad={};const flipped=clone(cube);[flipped.faces[0][1],flipped.faces[0][2]]=[flipped.faces[0][2],flipped.faces[0][1]];bad.flipped=flipped;const duplicate=clone(cube);duplicate.faces.push(duplicate.faces[0].slice());bad.duplicate=duplicate;const opened=clone(cube);opened.faces.pop();bad.opened=opened;const unused=clone(cube);unused.v.push([100,100,100]);bad.unused=unused;const degenerate=clone(cube);degenerate.v[degenerate.faces[0][1]]=degenerate.v[degenerate.faces[0][0]].slice();bad.degenerate=degenerate;const b=booleanBoxMesh(r(square,10,10,10,10),r(square,10,10,10,10),'union'),cornerA=cube.v.findIndex(p=>p.every(v=>v===10)),cornerB=b.v.findIndex(p=>p.every(v=>v===10)),index=k=>k===cornerB?cornerA:cube.v.length+k-(k>cornerB?1:0);bad.bowtie={v:cube.v.concat(b.v.filter((_,i)=>i!==cornerB)),faces:cube.faces.concat(b.faces.map(f=>f.map(index)))};const rejected={};for(const [name,m] of Object.entries(bad))try{inspectMeshTopology(m);rejected[name]=false}catch(e){rejected[name]=true}return {valid,rejected}})()");
assert.equal(topology.valid.cube.vertices,8,'solid box counts 8 vertices');
assert.equal(topology.valid.cube.edges,18,'triangulated box counts 18 edges');
assert.equal(topology.valid.cube.triangles,12,'solid box counts 12 triangles');
assert.equal(topology.valid.cube.shells,1,'solid box is one shell');
assert.equal(topology.valid.cube.euler,2,'solid box Euler characteristic');
assert.equal(Math.round(topology.valid.cube.signedVolume),1000,'solid box volume');
assert.equal(topology.valid.cavity.shells,2,'hollow block has two surfaces');
assert.equal(topology.valid.cavity.cavities,1,'hollow block preserves inward facing cavity surface');
assert.equal(Math.round(topology.valid.cavity.signedVolume),784,'outer volume minus inner cavity');
assert.equal(topology.valid.separate.shells,2,'disconnected watertight components are allowed');
assert.equal(topology.valid.separate.cavities,0,'two disconnected solid shells are not cavities');
assert.equal(Math.round(topology.valid.separate.signedVolume),2000,'sum of disjoint solids');
assert.equal(topology.rejected.flipped,true,'reversed triangle winding fails validation');
assert.equal(topology.rejected.duplicate,true,'duplicate triangle fails validation');
assert.equal(topology.rejected.opened,true,'open edge fails validation');
assert.equal(topology.rejected.unused,true,'orphan vertex fails validation');
assert.equal(topology.rejected.degenerate,true,'zero-area triangle fails validation');
assert.equal(topology.rejected.bowtie,true,'bowtie vertex fans fail validation');
assert.equal(evaluate('diagnoseSelectedMesh()?.shells>=1'),true,'diagnostic button analyzes selected valid mesh');
const beforeCorruptLoad=evaluate('serializeProject()');
assert.equal(evaluate("(()=>{const p=JSON.parse(serializeProject()),mesh=p.derivedSolids[0].mesh;[mesh.faces[0][1],mesh.faces[0][2]]=[mesh.faces[0][2],mesh.faces[0][1]];try{loadProjectText(JSON.stringify(p));return false}catch(e){return true}})()"),true,'JSON rejects derived solid with incoherently oriented faces');
assert.equal(evaluate('serializeProject()'),beforeCorruptLoad,'bad JSON import does not replace valid scene');
assert.equal(evaluate('selectExtrudedSolid()'),true,'can switch away from derived mesh');
assert.equal(evaluate('diagnoseSelectedMesh()'),null,'diagnostics reject missing derived selection');


// A2: definitely intersecting closed shells and folded closed surfaces are rejected.
const geometryCrossings=evaluate("(()=>{const sq=[[0,0],[10,0],[10,10],[0,10]],base=extrude(sq,10),mk=(x,y,z)=>{const mesh=extrude(sq,10);return {v:mesh.v.map(p=>p.map((v,i)=>v+[x,y,z][i])),faces:mesh.faces}},merge=(x,y,z)=>{const b=mk(x,y,z),n=base.v.length;return {v:base.v.concat(b.v),faces:base.faces.concat(b.faces.map(face=>face.map(i=>i+n)))}};const check=(m)=>{try{return {accepted:true,info:inspectMeshTopology(m)}}catch(e){return {accepted:false,message:e.message}}};const folded={v:base.v.map(p=>p.slice()),faces:base.faces};folded.v[0]=[15,5,5];const foldedOther={v:base.v.map(p=>p.slice()),faces:base.faces};foldedOther.v[2]=[5,5,-5];const invalid={overlap:check(merge(5,5,5)),identical:check(merge(0,0,0)),faceTouch:check(merge(10,0,0)),coplanarOverlap:check(merge(5,0,0)),folded:check(folded),foldedOther:check(foldedOther)};const valid={apart:check(merge(20,0,0)),verticalGap:check(merge(0,0,20)),topology:inspectMeshSelfIntersections(base)};const triA=[[0,0,0],[10,0,0],[0,10,0]],triPierce=[[3,3,-2],[3,3,2],[8,2,2]],triFar=[[30,30,0],[31,30,0],[30,31,0]],triCoplanar=[[2,2,0],[7,2,0],[2,7,0]];return {invalid,valid,piercing:triangleSurfaceIntersection3D(triA,triPierce),far:triangleSurfaceIntersection3D(triA,triFar),coplanar:triangleSurfaceIntersection3D(triA,triCoplanar),outsideAabb:inspectMeshSelfIntersections(merge(20,0,0)).intersectionPairs}})()");
assert.equal(geometryCrossings.invalid.overlap.accepted,false,'two solid shells interpenetrating at offset 5,5,5 are rejected');
assert.equal(geometryCrossings.invalid.identical.accepted,false,'coincident duplicated shells rejected');
assert.equal(geometryCrossings.invalid.faceTouch.accepted,false,'two shells touching on a full face rejected');
assert.equal(geometryCrossings.invalid.coplanarOverlap.accepted,false,'coplanar overlapping disconnected shells rejected');
assert.equal(geometryCrossings.invalid.folded.accepted,false,'deformed cuboid with crossing triangles rejected');
assert.equal(geometryCrossings.invalid.foldedOther.accepted,false,'second folded cube orientation rejected');
assert.equal(geometryCrossings.invalid.overlap.message.includes('Autointersección'),true,'self-intersection rejection is explicit');
assert.equal(geometryCrossings.valid.apart.accepted,true,'two disconnected non-touching shells accepted');
assert.equal(geometryCrossings.valid.verticalGap.accepted,true,'vertically separated solid shells accepted');
assert.equal(geometryCrossings.valid.apart.info.shells,2,'non-overlapping shells counted correctly');
assert.equal(geometryCrossings.valid.topology.intersectionPairs,0,'ordinary cuboid has zero intersections');
assert.equal(geometryCrossings.valid.topology.checkedPairs>0,true,'triangle candidate processing actually occurs');
assert.equal(geometryCrossings.piercing,true,'triangle-through-triangle intersection detected');
assert.equal(geometryCrossings.far,false,'separate non-near triangles do not intersect');
assert.equal(geometryCrossings.coplanar,true,'positive area coplanar triangle overlap detected');
assert.equal(geometryCrossings.outsideAabb,0,'broad phase does not report distant shells');
// Corrupted v3 project must be rejected transactionally with no scene change.
const savedBeforeCrossing=evaluate('serializeProject()');
assert.equal(evaluate("(()=>{const p=JSON.parse(serializeProject()),m=p.derivedSolids[0].mesh;const cube=extrude([[0,0],[10,0],[10,10],[0,10]],10),n=cube.v.length;const other={v:cube.v.map(point=>point.map((v,i)=>v+[5,5,5][i])),faces:cube.faces};p.derivedSolids[0].mesh={v:cube.v.concat(other.v),faces:cube.faces.concat(other.faces.map(f=>f.map(i=>i+n)))};try{loadProjectText(JSON.stringify(p));return false}catch(e){return e.message.includes('Autointersección')}})()"),true,'project import refuses internally intersecting manifold shells');
assert.equal(evaluate('serializeProject()'),savedBeforeCrossing,'invalid intersecting shell import preserves previous project');


// Nested shell parity: outward exterior, inward cavity, outward island.
const nestedShells=evaluate("(()=>{const box=(side,offset,reverse=false)=>{const m=extrude([[0,0],[side,0],[side,side],[0,side]],side);return {v:m.v.map(p=>p.map(x=>x+offset)),faces:reverse?m.faces.map(([a,b,c])=>[a,c,b]):m.faces}},merge=(...parts)=>{const r={v:[],faces:[]};for(const p of parts){const n=r.v.length;r.v.push(...p.v);r.faces.push(...p.faces.map(f=>f.map(i=>i+n)))}return r};const outer=box(10,0),cavity=box(6,2,true),island=box(2,4),wrong=box(6,2);const inspect=m=>{try{return {accepted:true,report:inspectMeshTopology(m)}}catch(e){return {accepted:false,error:e.message}}};return {nestedWrong:inspect(merge(outer,wrong)),hollow:inspect(merge(outer,cavity)),island:inspect(merge(outer,cavity,island)),nestedWrongThree:inspect(merge(outer,wrong,island))}})()");
assert.equal(nestedShells.nestedWrong.accepted,false,'nested duplicate solid material must not be accepted as cavity');
assert.equal(nestedShells.nestedWrong.error.includes('Orientación de cascarón'),true,'report explains bad nesting');
assert.equal(nestedShells.hollow.accepted,true,'correctly wound internal cavity remains valid');
assert.equal(nestedShells.hollow.report.cavities,1,'inward shell is recognized as cavity');
assert.equal(nestedShells.hollow.report.nestingDepths.join('/'),'0/1','one inner cavity has depth one');
assert.equal(Math.round(nestedShells.hollow.report.signedVolume),784,'nested cavity volume subtracts');
assert.equal(nestedShells.island.accepted,true,'nested solid island inside cavity is supported');
assert.equal(nestedShells.island.report.shells,3,'island creates third shell');
assert.equal(nestedShells.island.report.nestingDepths.join('/'),'0/1/2','shell containment reports parity 0,1,2');
assert.equal(Math.round(nestedShells.island.report.signedVolume),792,'island contributes positive material volume');
assert.equal(nestedShells.nestedWrongThree.accepted,false,'wrong internal shell winding rejected even with positive island');


// 125 offsets x 3 boolean operations: accept exact valid solids, refuse
// edge-only/point-only unions (non-manifold), and preserve empty intersections.
const boundaryMatrix=evaluate("(()=>{const p=[[0,0],[10,0],[10,10],[0,10]],a={id:1,profile:p,height:10,offset:[0,0,0],mesh:extrude(p,10)},offsets=[-10,-5,0,5,15],result={passed:0,expectedInvalid:0,empty:0,unexpected:[]};for(const x of offsets)for(const y of offsets)for(const z of offsets)for(const mode of ['union','subtract','intersect']){const b={id:2,profile:p,height:10,offset:[x,y,z],mesh:extrude(p,10)},common=[x,y,z].reduce((volume,d)=>volume*Math.max(0,10-Math.abs(d)),1),expected=mode==='union'?2000-common:mode==='subtract'?1000-common:common;if(!expected){result.empty++;continue}const boundary=[x,y,z].every(d=>Math.abs(d)<=10)&&[x,y,z].filter(d=>Math.abs(d)===10).length>=2,mustReject=mode==='union'&&boundary;try{const m=booleanBoxMesh(a,b,mode);inspectMeshTopology(m);const v=meshOrientedVolume(m);if(!mustReject&&Math.abs(v-expected)<1e-5)result.passed++;else result.unexpected.push({x,y,z,mode,v,expected,mustReject})}catch(e){if(mustReject)result.expectedInvalid++;else result.unexpected.push({x,y,z,mode,error:e.message})}}return result})()");
assert.equal(boundaryMatrix.passed,266,'266 nonempty manifold boolean geometries validated by position matrix');
assert.equal(boundaryMatrix.expectedInvalid,10,'reject all 10 non-manifold edge/vertex unions');
assert.equal(boundaryMatrix.empty,99,'zero-volume boolean results classified as empty');
assert.equal(boundaryMatrix.unexpected.length,0,'all 375 offset-operation cases match expected validity and volume');
assert.equal(evaluate("(()=>{loadProjectText(JSON.stringify({format:'cadcraft-android-3d',version:1,profile:[[0,0],[10,0],[10,10],[0,10]],height:10}));createSceneSolid();moveActiveSolid(10,10,0);return exportBooleanOBJ('union')})()"),false,'non-manifold edge-touch union cannot be exported to OBJ');
assert.equal(evaluate('status.textContent.includes("Booleana OBJ")'),true,'unsafe OBJ export produces a visible explanatory failure');
assert.equal(evaluate("(()=>{moveActiveSolid(10,0,0);return exportBooleanOBJ('union')})()"),true,'valid face-touch union can be exported to OBJ');
assert.equal(evaluate("(()=>{moveActiveSolid(5,5,5);return exportBooleanOBJ('subtract')})()"),true,'valid partial-volume subtraction can be exported to OBJ');


// A3 numeric stability: local reference points for distant closed components.
const numericStability=evaluate("(()=>{const rect=[[0,0],[10,0],[10,10],[0,10]],b=extrude(rect,10),offset=(m,shift)=>({v:m.v.map(p=>p.map(v=>v+shift)),faces:m.faces.map(f=>f.slice())}),merge=(a,c)=>({v:a.v.concat(c.v),faces:a.faces.concat(c.faces.map(f=>f.map(i=>i+a.v.length)))}),values=[1e3,1e6,1e7,9e7].map(shift=>{const shifted=offset(b,shift);return {shift,volume:meshOrientedVolume(shifted),report:inspectMeshTopology(shifted).signedVolume}}),disconnected=merge(b,offset(b,9e7)),cavity=extrude([[2,2],[8,2],[8,8],[2,8]],6),cavityShell={v:cavity.v.map(p=>p.map((v,i)=>v+(i===2?2:0))),faces:cavity.faces.map(([a,b,c])=>[a,c,b])},hollow=merge(b,cavityShell),farHollow=offset(hollow,9e7);return {values,disconnectedVolume:meshOrientedVolume(disconnected),disconnectedReport:inspectMeshTopology(disconnected),hollowVolume:meshOrientedVolume(farHollow),hollowReport:inspectMeshTopology(farHollow)}})()");
assert.equal(numericStability.values.every(item=>Math.abs(item.volume-1000)<1e-6),true,'distant single-solid volume remains stable at four scales');
assert.equal(numericStability.values.every(item=>Math.abs(item.report-1000)<1e-6),true,'distant manifold shell signed volume remains stable');
assert.equal(Math.abs(numericStability.disconnectedVolume-2000)<1e-6,true,'two shells 90 million mm apart retain their individual volumes');
assert.equal(Math.abs(numericStability.disconnectedReport.signedVolume-2000)<1e-6,true,'topology volume also handles distant shells');
assert.equal(numericStability.disconnectedReport.shells,2,'distant shells are independent');
assert.equal(Math.abs(numericStability.hollowVolume-784)<1e-6,true,'distant translated hollow solid keeps cavity subtraction');
assert.equal(Math.abs(numericStability.hollowReport.signedVolume-784)<1e-6,true,'hollow-shell validation remains stable far from origin');
assert.equal(numericStability.hollowReport.nestingDepths.join('/'),'0/1','far away internal cavity retains shell nesting');


// A3: local-origin 2D areas, clipping and measurement at distant CAD coordinates.
// Those profiles are physically 10 mm wide, yet lie 90 million mm from origin.
const worldAreaChecks=evaluate("(()=>{const L=[[0,0],[10,0],[10,4],[4,4],[4,10],[0,10]],square=[[0,0],[10,0],[10,10],[0,10]],shift=(p,x,y)=>p.map(q=>[q[0]+x,q[1]+y]),forward=extrude(shift(L,9e7,-9e7),7),reversed=extrude(shift(L,-9e7,9e7).reverse(),7),record=(x,y)=>({id:1,profile:square,height:10,offset:[x,y,0],mesh:extrude(square,10)}),overlap=prismOverlapMetrics(record(9e7,-9e7),record(9e7+5,-9e7+5)),degenerate=shift([[0,0],[1,1],[2,2]],9e7,-9e7);let reject=false;try{extrude(degenerate,7)}catch(e){reject=true}return {area:polygonArea(shift(L,9e7,-9e7)),triangles:forward.faces.length,measured:meshMeasurements(forward).area,volume:meshMeasurements(forward).volume,topology:inspectMeshTopology(forward).signedVolume,reverseArea:meshMeasurements(reversed).area,reverseVolume:inspectMeshTopology(reversed).signedVolume,overlap:overlap.intersectionVolume,union:overlap.unionVolume,reject}})()");
assert.equal(worldAreaChecks.area,64,'polygon area remains accurate for distant concave profiles');
assert.equal(worldAreaChecks.triangles,20,'distant concave sketch triangulates to a closed prism');
assert.equal(worldAreaChecks.measured,64,'2D area measurement uses translation-stable geometry');
assert.equal(worldAreaChecks.volume,448,'extruded volume remains correct at large absolute coordinates');
assert.equal(Math.abs(worldAreaChecks.topology-448)<1e-6,true,'distant concave mesh passes manifold validation');
assert.equal(worldAreaChecks.reverseArea,64,'reversed winding with negative offset retains area');
assert.equal(Math.abs(worldAreaChecks.reverseVolume-448)<1e-6,true,'reversed distant extrusion has outward winding');
assert.equal(worldAreaChecks.overlap,250,'remote 2D clipping computes box overlap correctly');
assert.equal(worldAreaChecks.union,1750,'remote 2D clipping computes exact union volume');
assert.equal(worldAreaChecks.reject,true,'remote collinear sketch still rejects zero-area profiles');


// A2: boundary-only contacts between faces with no topological shared vertices.
const boundaryTouch=evaluate("(()=>{const face=[[0,0,0],[4,0,0],[0,4,0]],touchVertex=[[4,0,0],[5,0,0],[4,1,0]],touchEdge=[[2,0,0],[5,0,0],[2,-3,0]],touchVertical=[[1,1,0],[1,1,3],[2,2,3]],box=extrude([[0,0],[10,0],[10,10],[0,10]],10),far={v:box.v.map(p=>p.map(v=>v+10)),faces:box.faces.map(f=>f.slice())},combined={v:box.v.concat(far.v),faces:box.faces.concat(far.faces.map(f=>f.map(i=>i+box.v.length)))},fakeSameShell=new Array(combined.faces.length).fill(0);let rejection=false;try{inspectMeshSelfIntersections(combined,fakeSameShell)}catch(e){rejection=e.message.includes('Autointersección')}return {defaultPoint:triangleSurfaceIntersection3D(face,touchVertex),point:triangleSurfaceIntersection3D(face,touchVertex,1e-8,true),edge:triangleSurfaceIntersection3D(face,touchEdge,1e-8,true),vertical:triangleSurfaceIntersection3D(face,touchVertical,1e-8,true),detectedWithoutShellDifference:rejection}})()");
assert.equal(boundaryTouch.defaultPoint,false,'zero-area point contact is not an interior crossing');
assert.equal(boundaryTouch.point,true,'inclusive predicate detects coplanar point-only contact');
assert.equal(boundaryTouch.edge,true,'inclusive predicate detects coplanar edge-only contact');
assert.equal(boundaryTouch.vertical,true,'inclusive predicate detects noncoplanar endpoint contact');
assert.equal(boundaryTouch.detectedWithoutShellDifference,true,'broad-phase catches disjoint-index point contact even within one labelled shell');


// A3: distant third shell must not expand tolerance between two almost-touching cubes.
const localPrecision=evaluate("(()=>{const sq=[[0,0],[10,0],[10,10],[0,10]],box=extrude(sq,10),copy=(dx,dy,dz)=>({v:box.v.map(p=>p.map((v,i)=>v+[dx,dy,dz][i])),faces:box.faces.map(f=>f.slice())}),join=(...meshes)=>{const out={v:[],faces:[]};for(const m of meshes){const base=out.v.length;out.v.push(...m.v);out.faces.push(...m.faces.map(f=>f.map(i=>i+base)))}return out},clear=join(box,copy(10.0005,0,0),copy(9e7,0,0)),touch=join(box,copy(10,0,0),copy(9e7,0,0)),nearPair=inspectMeshSelfIntersections(clear),ok=inspectMeshTopology(clear);let rejectedTouch=false;try{inspectMeshTopology(touch)}catch(e){rejectedTouch=true}return {shells:ok.shells,volume:ok.signedVolume,sweepEpsilon:nearPair.epsilon,rejectedTouch}})()");
assert.equal(localPrecision.shells,3,'three disconnected shells with 0.0005 mm air gap remain separate');
assert.equal(Math.abs(localPrecision.volume-3000)<1e-5,true,'thin air gap and remote body do not alter total volume');
assert.equal(localPrecision.sweepEpsilon<1e-5,true,'broad-phase precision no longer scales with full scene diagonal');
assert.equal(localPrecision.rejectedTouch,true,'true tangent face is still rejected with a remote shell present');


// A4: orthogonal concave profiles now produce genuine manifold CSG meshes.
const orthogonalBoolean=evaluate("(()=>{const L=[[0,0],[10,0],[10,4],[4,4],[4,10],[0,10]],rect=[[2,2],[6,2],[6,6],[2,6]],inner=[[1,1],[3,1],[3,3],[1,3]],rotated=[[0,5],[5,0],[10,5],[5,10]],rec=(p,h=10,x=0,y=0,z=0)=>({id:1,profile:p,height:h,offset:[x,y,z],mesh:extrude(p,h)}),a=rec(L),b=rec(rect),out={};for(const op of ['union','subtract','intersect']){const m=booleanBoxMesh(a,b,op);out[op]={volume:meshOrientedVolume(m),topology:inspectMeshTopology(m).signedVolume,faces:m.faces.length}}const cavity=booleanBoxMesh(a,rec(inner,5,0,0,2),'subtract');out.cavity={volume:meshOrientedVolume(cavity),shells:inspectMeshTopology(cavity).shells,cavities:inspectMeshTopology(cavity).cavities};let rejectsSlant=false;try{booleanBoxMesh(a,rec(rotated),'union')}catch(e){rejectsSlant=/ortogonales/.test(e.message)}return {...out,rejectsSlant}})()");
assert.equal(Math.abs(orthogonalBoolean.union.volume-680)<1e-6,true,'L-shaped union with an overlapping rectangle computes 680 mm3');
assert.equal(Math.abs(orthogonalBoolean.union.topology-680)<1e-6,true,'L-shaped union passes manifold topology checks');
assert.equal(Math.abs(orthogonalBoolean.subtract.volume-520)<1e-6,true,'L-shaped subtract computes exact concave remainder');
assert.equal(Math.abs(orthogonalBoolean.subtract.topology-520)<1e-6,true,'concave subtraction stays watertight');
assert.equal(Math.abs(orthogonalBoolean.intersect.volume-120)<1e-6,true,'L-shape and rectangle intersection is 120 mm3');
assert.equal(Math.abs(orthogonalBoolean.intersect.topology-120)<1e-6,true,'concave intersection passes topology validation');
assert.equal(Math.abs(orthogonalBoolean.cavity.volume-620)<1e-6,true,'submerged orthogonal cut produces correct void volume');
assert.equal(orthogonalBoolean.cavity.shells,2,'sealed interior cavity creates two shells');
assert.equal(orthogonalBoolean.cavity.cavities,1,'interior orthogonal cavity has reversed winding');
assert.equal(orthogonalBoolean.rejectsSlant,true,'non-orthogonal polygon continues to be explicitly rejected');


// Cross-verify orthogonal CSG results against independently clipped prism volumes.
const csgCrosscheck=evaluate("(()=>{const L=[[0,0],[10,0],[10,4],[4,4],[4,10],[0,10]],R=[[0,0],[6,0],[6,6],[0,6]],rec=(p,x=0,y=0,z=0,h=10)=>({id:1,profile:p,height:h,offset:[x,y,z],mesh:extrude(p,h)}),a=rec(L),positions=[[-3,-3,0],[1,1,0],[3,3,2],[12,12,0],[1,1,15]],output=[];for(const [x,y,z] of positions){const b=rec(R,x,y,z),m=prismOverlapMetrics(a,b);for(const mode of ['union','subtract','intersect']){const solid=booleanBoxMesh(a,b,mode),expected=mode==='union'?m.unionVolume:mode==='subtract'?m.differenceA:m.intersectionVolume,valid=solid.faces.length?inspectMeshTopology(solid).signedVolume:0;output.push({mode,expected,actual:meshOrientedVolume(solid),valid})}}const mesh=booleanBoxMesh(a,rec(R,1,1),'union');let rejected=false;try{assertBooleanVolume(mesh,0)}catch(e){rejected=e.message.includes('incoherente')}return {output,rejected}})()");
assert.equal(csgCrosscheck.output.length,15,'15 orthogonal CSG regression combinations');
assert.equal(csgCrosscheck.output.every(x=>Math.abs(x.actual-x.expected)<1e-5),true,'grid-generated surfaces match analytic clipping volumes');
assert.equal(csgCrosscheck.output.every(x=>Math.abs(x.valid-x.expected)<1e-5),true,'orthogonal CSG surfaces validate across offsets and Z gaps');
assert.equal(csgCrosscheck.rejected,true,'integrity guard blocks CSG mesh with contradictory volume');


// B3 incremental: explicitly regenerate a boolean result when a source sketch changes.
const regeneration=evaluate("(()=>{const rect=[[0,0],[10,0],[10,10],[0,10]],prj={format:'cadcraft-android-3d',version:1,profile:rect,height:10};loadProjectText(JSON.stringify(prj));duplicateSceneSolid();const created=addBooleanToScene('union'),oldVolume=meshOrientedVolume(selectedDerived().mesh),oldParentIds=selectedDerived().parents.slice(),oldOffset=selectedDerived().offset.slice();selectExtrudedSolid();const modified=changeHeight(5);cycleDerivedSolid();const untilRefresh=meshOrientedVolume(selectedDerived().mesh),refreshed=regenerateSelectedBoolean(),updated=meshOrientedVolume(selectedDerived().mesh),unchangedIds=selectedDerived().parents.join('/')===oldParentIds.join('/'),offsetIntact=selectedDerived().offset.join('/')===oldOffset.join('/'),storedJSON=serializeProject();loadProjectText(storedJSON);const persisted=meshOrientedVolume(selectedDerived().mesh);const active=selectedDerived();const originalId=active.parents[1];active.parents[1]=999999;const rejected=regenerateSelectedBoolean()===false&&meshOrientedVolume(active.mesh)===updated;active.parents[1]=originalId;return {created,modified,refreshed,oldVolume,untilRefresh,updated,persisted,rejected,unchangedIds,offsetIntact,button:!!document.querySelector('button[onclick=\"regenerateSelectedBoolean()\"]')}})()");
assert.equal(Number.isInteger(regeneration.created),true,'CSG result was created for regeneration scenario');
assert.equal(regeneration.oldVolume,2000,'result initially includes two separate 1000 mm3 cubes');
assert.equal(regeneration.modified,true,'source extrusion height can be edited while result is not selected');
assert.equal(regeneration.untilRefresh,2000,'derived mesh is not silently overwritten without user action');
assert.equal(regeneration.refreshed,true,'explicit refresh recomputes selected result from provenance');
assert.equal(regeneration.updated,2500,'refreshed mesh reflects updated height and other original solid');
assert.equal(regeneration.persisted,2500,'refreshed result remains valid after JSON roundtrip');
assert.equal(regeneration.unchangedIds&&regeneration.offsetIntact,true,'source references and independent result offset remain unchanged');
assert.equal(regeneration.rejected,true,'missing parent source refuses regeneration without destroying previous geometry');
assert.equal(regeneration.button,true,'regeneration command is exposed in 3D tooling');

console.log('3D studio tests passed');
