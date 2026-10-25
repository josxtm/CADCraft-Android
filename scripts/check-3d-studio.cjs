const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2],'utf8');
const draw={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},clearRect(){},fillRect(){},arc(){},fillText(){}};
const controls={width:{value:'100'},length:{value:'60'},height:{value:'25'},faceDistance:{value:'5'},moveAxis:{value:'XY'},moveSnap:{value:'0'},moveSensitivity:{value:'1'},toolsPanel:{classList:{toggle(){}}},toolsToggle:{textContent:''},moveModeButton:{textContent:''},selectFaceButton:{textContent:''},offsetX:{value:'0'},offsetY:{value:'0'},offsetZ:{value:'0'},status:{textContent:''}};
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

console.log('3D studio tests passed');
