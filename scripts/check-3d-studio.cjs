const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2],'utf8');
const draw={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},clearRect(){},fillRect(){}};
const controls={width:{value:'100'},length:{value:'60'},height:{value:'25'},status:{textContent:''}};
const canvas={clientWidth:900,clientHeight:600,width:900,height:600,getContext(){return draw},addEventListener(){},setPointerCapture(){}};
const file={addEventListener(){},click(){}};
const document={
 getElementById(id){return id==='scene'?canvas:id==='file'?file:controls[id]},
 createElement(){return {click(){},style:{}}},
};
const window={addEventListener(){}};
const context=vm.createContext({document,window,devicePixelRatio:1,Math,Number,Error,Map,Blob,URL,console,setTimeout(){}});
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
console.log('3D studio tests passed');
