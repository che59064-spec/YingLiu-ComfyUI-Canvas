// No network or generation: the 3D director stage normalizes safely and is wired into the canvas.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
const stageSource=fs.readFileSync(__dirname+'/stage.js','utf8');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const stageCss=fs.readFileSync(__dirname+'/stage.css','utf8');

function element(){const classes=new Set(),attrs=new Map();return {dataset:{},style:{},hidden:false,disabled:false,outerHTML:'',classList:{add:(...values)=>values.forEach(v=>classes.add(v)),remove:(...values)=>values.forEach(v=>classes.delete(v)),contains:v=>classes.has(v),toggle(v,on){if(on??!classes.has(v))classes.add(v);else classes.delete(v);}},setAttribute:(key,value)=>attrs.set(key,String(value)),getAttribute:key=>attrs.get(key)??null,removeAttribute:key=>attrs.delete(key),querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null};}
const context={window:{},console,URL,crypto:require('node:crypto').webcrypto,location:{origin:'http://127.0.0.1:8766'},document:{activeElement:null,querySelector:element,querySelectorAll:()=>[],createElement:element,documentElement:{classList:{add(){},remove(){}}}},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},localStorage:{setItem(){}}};
vm.createContext(context);
vm.runInContext(source.split('boot().catch')[0]+`
window.check={state,normalizeProject,renderCard,renderStageCard,isStage};`,context);
const c=context.window.check;

// Stage editor module loads without a DOM and normalizes hostile project data.
const stageContext={window:{},console};
vm.createContext(stageContext);
vm.runInContext(stageSource,stageContext);
const director=stageContext.window.StageDirector;
assert.ok(director,'stage module must expose StageDirector');
const defaults=director.defaultStage();
assert.equal(defaults.actors.length,1);
assert.equal(defaults.cameras.length,1);
assert.equal(defaults.activeCamera,'free');
assert.equal(defaults.aspect,'16:9');
assert.equal(defaults.environment.grid,true);
assert.equal(defaults.actors[0].pose,'stand');
assert.equal(defaults.environment.grid,true);
assert.ok(Array.isArray(defaults.props),'默认舞台必须带道具数组');
assert.equal(JSON.stringify(director.poses().sort()),JSON.stringify(['akimbo','cross','crouch','kneel','lean','point','run','sit','stand','think','tpose','walk','wave']));

const wild={actors:Array.from({length:20},(_,index)=>({id:index===1? 'dup':'dup',name:`角色${index}`,color:'red',x:99,z:-99,rotation:99,scale:9,pose:'nope'})),cameras:Array.from({length:10},(_,index)=>({id:'same',name:`机位${index}`,position:[100,0,0],target:'bad',fov:999})),activeCamera:'nope',aspect:'7:2'};
const normalized=director.normalize(wild);
assert.equal(normalized.actors.length,12,'最多 12 个角色');
assert.equal(normalized.cameras.length,8,'最多 8 个机位');
assert.equal(new Set(normalized.actors.map(actor=>actor.id)).size,12,'角色 ID 必须唯一');
assert.equal(new Set(normalized.cameras.map(camera=>camera.id)).size,8,'机位 ID 必须唯一');
normalized.actors.forEach(actor=>{assert.match(actor.color,/^#[0-9a-f]{6}$/i);assert.equal(actor.pose,'stand');assert.ok(actor.x>=-14&&actor.x<=14);assert.ok(actor.scale>=.6&&actor.scale<=1.4);});
normalized.cameras.forEach(camera=>{assert.ok(camera.fov>=18&&camera.fov<=85);assert.equal(camera.position.length,3);assert.equal(camera.target.length,3);});
assert.equal(normalized.activeCamera,'free');
assert.equal(normalized.aspect,'16:9');
assert.equal(JSON.stringify(director.normalize(normalized)),JSON.stringify(normalized),'归一化必须幂等');
const empty=director.normalize({actors:[],cameras:[],aspect:'1:1'});
assert.equal(empty.cameras.length,1,'空舞台补一个机位');
assert.equal(empty.cameras[0].id,'camera-default','补位机位 ID 必须稳定');
assert.equal(JSON.stringify(director.normalize(empty)),JSON.stringify(empty),'补位后仍须幂等');
const restored=director.normalize(JSON.parse(JSON.stringify(normalized)));
assert.equal(JSON.stringify(restored),JSON.stringify(normalized),'保存再读取不应改变舞台');
const hostile=director.normalize({actors:[],cameras:[],props:Array.from({length:30},()=>({id:'p',type:'nope',color:'bad',x:99,scale:99})),environment:{lightAngle:999,lightIntensity:-5,lightColor:'zzz',fog:9,quality:'ultra',grid:false,wireframe:true}});
assert.equal(hostile.props.length,16,'最多 16 个道具');
assert.equal(new Set(hostile.props.map(prop=>prop.id)).size,16,'道具 ID 必须唯一');
hostile.props.forEach(prop=>{assert.ok(['box','cylinder','table','wall','sphere'].includes(prop.type));assert.match(prop.color,/^#[0-9a-f]{6}$/i);assert.ok(prop.scale>=.4&&prop.scale<=3);});
assert.equal(hostile.environment.lightAngle,360);
assert.equal(hostile.environment.lightIntensity,0);
assert.equal(hostile.environment.lightColor,'#fff1de');
assert.equal(hostile.environment.fog,1);
assert.equal(hostile.environment.quality,'high');
assert.equal(hostile.environment.grid,false);
assert.equal(hostile.environment.wireframe,true);
assert.equal(JSON.stringify(director.normalize(hostile)),JSON.stringify(hostile),'环境与道具归一化必须幂等');

// Canvas integration: stage cards survive normalization even without the editor loaded.
const project=c.normalizeProject({name:'导演台测试',cards:[
  {id:'stage1',type:'stage',name:'3D 导演台',cover:'http://127.0.0.1:8766/api/assets/cover.png',stage:{actors:[{id:'a1',name:'角色1'}],cameras:[{id:'c1'}],activeCamera:'c1',aspect:'16:9'},x:10,y:20},
  {id:'shot1',type:'image',name:'截图 01',url:'http://127.0.0.1:8766/api/assets/shot.png',fromStage:{stageId:'stage1',cameraId:'c1'},x:400,y:20},
  {id:'bogus',type:'unknown',name:'bad'}
],edges:[],viewport:{}});
assert.equal(project.cards.length,2,'未知卡片类型必须过滤');
assert.equal(c.isStage(project.cards[0]),true);
assert.ok(project.cards[0].stage&&typeof project.cards[0].stage==='object');
assert.deepEqual(JSON.parse(JSON.stringify(project.cards[0].outputs)),[]);
assert.equal(project.cards[0].cover,'http://127.0.0.1:8766/api/assets/cover.png');
c.state.project=project;
const stageHtml=c.renderStageCard(project.cards[0]);
assert.match(stageHtml,/stage-card/);
assert.match(stageHtml,/data-stage-open="stage1"/);
assert.match(stageHtml,/1 角色/);
assert.match(stageHtml,/1 机位/);
assert.match(stageHtml,/1 素材/);
assert.match(c.renderCard(project.cards[0]),/stage-card/,'renderCard 必须路由导演台卡片');
const missing=c.normalizeProject({cards:[{id:'stage2',type:'stage',name:'空舞台'}],edges:[],viewport:{}});
assert.ok(missing.cards[0].stage&&typeof missing.cards[0].stage==='object','缺少 stage 数据时必须补对象');
context.window.StageDirector={normalize:value=>({...value,checked:true})};
const delegated=c.normalizeProject({cards:[{id:'stage3',type:'stage',name:'交给编辑器',stage:{actors:[]}}],edges:[],viewport:{}});
assert.equal(delegated.cards[0].stage.checked,true,'StageDirector 可用时必须交给它归一化');
delete context.window.StageDirector;

// Screenshot pipeline: capture uploads a PNG and creates a connectable image card.
const appSource=source;
assert.match(appSource,/type==='stage'\?'stage'/);
assert.match(appSource,/function addStageNode\(/);
assert.match(appSource,/function openStage\(/);
assert.match(appSource,/function captureStageImage\(/);
assert.match(appSource,/fromStage:\{stageId:stageCard\.id/);
assert.match(appSource,/headers:\{'X-Filename':encodeURIComponent\(name\),'Content-Type':'image\/png'\}/);
assert.match(appSource,/kind==='stage'\)addStageNode\(point\)/);
assert.match(appSource,/StageDirector\?\.close\?\.\(true\)/,'切换画布时必须关闭导演台');
assert.match(stageSource,/import\('\/vendor\/three\.module\.js'\)/,'Three.js 必须本地载入');
assert.match(stageSource,/WebGLRenderTarget/);
assert.match(stageSource,/readRenderTargetPixels/);
assert.match(stageSource,/forceContextLoss/,'关闭时必须释放显卡上下文');
assert.match(stageSource,/PMREMGenerator/,'环境贴图必须一次烘焙');
assert.match(stageSource,/shadowMap\.autoUpdate\s*=\s*false/,'阴影必须静态烘焙，拖动时不重算');
assert.match(stageSource,/orbitGoal/,'视角必须阻尼平滑');
assert.match(stageSource,/function geometries\(\)/,'几何体必须共享复用');
assert.match(stageSource,/function init2D\(\)/,'无 WebGL 时必须有 2D 兼容模式');
assert.match(stageSource,/data-stage-env/,'控制台必须实时调节环境');

// Markup: entry points, overlay, capture dialog and local assets are all present in order.
const stageScript=html.search(/\/stage\.js\?v=[\d.]+/),appScript=html.search(/\/app\.js\?v=[\d.]+/);
assert.ok(stageScript>0&&appScript>stageScript,'stage.js 必须先于 app.js 载入');
assert.match(html,/\/stage\.css\?v=[\d.]+/);
assert.match(html,/id="stage-quick"/);
assert.match(html,/data-create-node="stage"/);
assert.match(html,/id="stage-view"/);
assert.match(html,/id="stage-canvas"/);
assert.match(html,/id="stage-capture-modal"/);
assert.match(html,/id="stage-capture-size"/);
assert.match(html,/id="stage-capture-mode"/,'截图必须支持全部机位');
assert.match(html,/id="stage-dock"/,'必须有永久控制台');
assert.match(html,/id="stage-prop-type"/);
assert.match(html,/id="i-stage"/);
assert.match(html,/id="i-camera"/);
assert.match(html,/id="i-eye-off"/);
assert.match(html,/id="i-lock"/);
assert.match(html,/id="i-sun"/);
assert.match(html,/id="i-prop"/);
assert.ok(fs.existsSync(__dirname+'/stage.css'),'stage.css 必须存在');
assert.ok(fs.statSync(__dirname+'/vendor/three.module.js').size>1000000,'Three.js 必须已本地化');
// Exercise the private editor without changing its public API or starting a browser/GPU.
async function checkBehavior() {
  const {pathToFileURL}=require('node:url');
  const THREE=await import(pathToFileURL(__dirname+'/vendor/three.module.js').href);
  const nodes=new Map(),listeners=new Map(),timers=new Map(),confirmCalls=[];
  let now=0,nextTimer=0,confirmAnswer=true;
  const queryAll=selector=>{const value=nodes.get(selector);return value?(Array.isArray(value)?value:[value]):[];};
  const document={activeElement:null,hidden:false,documentElement:element(),querySelector:selector=>queryAll(selector)[0]||null,querySelectorAll:queryAll,createElement:element,
    addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);},
    removeEventListener(type,listener){listeners.get(type)?.delete(listener);}};
  const behaviorContext={window:{confirm(message){confirmCalls.push(message);return confirmAnswer;}},console,document,Blob,performance:{now:()=>now},
    setTimeout(callback,delay=0){const id=++nextTimer;timers.set(id,{callback,at:now+delay});return id;},
    clearTimeout(id){timers.delete(id);},cancelAnimationFrame(){},
    ImageData:class {constructor(data,width,height){Object.assign(this,{data,width,height});}}};
  function tick() {
    const pending=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
    assert.ok(pending,'fake clock must have a pending callback');
    timers.delete(pending[0]); now=pending[1].at; pending[1].callback();
  }
  async function settle(promise) {
    let done=false,value,failure;
    Promise.resolve(promise).then(result=>{done=true;value=result;},error=>{done=true;failure=error;});
    for(let i=0;i<2000&&!done;i++){await Promise.resolve();if(!done&&timers.size)tick();}
    assert.ok(done,'offline operation did not settle within 2000 fake ticks');
    if(failure)throw failure;
    return value;
  }
  vm.createContext(behaviorContext);
  const anchor='window.StageDirector = {';
  assert.equal(stageSource.split(anchor).length,2,'private test injection must have exactly one anchor');
  vm.runInContext(stageSource.replace(anchor,`window.check = {
    PROP_TYPES, POSES, geometries, buildProp, rebuildScene, applyActorTransform, applyPropTransform,
    positionFields, actorHtml, propHtml, cameraHtml, poseHtml, renderProps, renderDock, renderTools, activeShotCamera,
    syncTransformInputs, syncPropInputs, setActorPose, applyMotionPreset,
    updateActorField, updatePropField, updateCameraField, updateEnvField, onUiInput, onUiChange,
    addActor, addProp, duplicateSelected, resetHistory, pushHistory, undo, redo, snapshot,
    onPointerDown, onPointerMove, onPointerUp, onWheel, onKeyDown, syncShotCamera, pick2D, buildFrustums, applyFocal, focalLength,
    normalizeMotion, motionFrame, motionProblem, recordMotionEndpoint, loadMotionEndpoint,
    previewMotion, applyMotionFrame, stopMotionPreview, renderMotionControls, refreshMotionTargets,
    recordMotionVideo, exportMotion, captureSurface, cancelMotionExport, onUiClick,
    setCaptureSurface(value) { captureSurface = value; },
    setThree(value) { THREE = value; }, setEditor(value) { editor = value; }
  }; ${anchor}`),behaviorContext,{filename:'stage.js'});
  const api=behaviorContext.window.check;
  api.setThree(THREE);
  const plain=value=>JSON.parse(JSON.stringify(value));
  const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-5,`${label}: expected ${expected}, got ${actual}`);
  const sizes={box:[1,1,1],cylinder:[1,1,1],sphere:[1,1,1],table:[1.6,.8,.9],wall:[2.4,2.2,.12],chair:[.5,.9,.5],sofa:[2,.85,.85],doorway:[1.2,2.2,.18],stairs:[1.5,.8,1.6],platform:[3,.3,2]};
  const dimensions=['width','height','depth'];
  const input=(kind,key,value,extra={})=>({...element(),type:'number',value:String(value),validity:{valid:true},hasAttribute:()=>false,dataset:{[`stage${kind}Field`]:key},...extra});
  const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,name,value])=>[name,value]));
  const field=(markup,kind,key,axis,type='number')=>{
    const matches=[...markup.matchAll(/<input\b[^>]*>/g)].map(([tag])=>attributes(tag))
      .filter(attrs=>attrs.type===type&&attrs[`data-stage-${kind}-field`]===key&&(axis===undefined||attrs['data-axis']===String(axis)));
    assert.equal(matches.length,1,`${kind}.${key}${axis===undefined?'':'.'+axis} must have one ${type} input`);
    return matches[0];
  };
  const clickData=(kind,value)=>api.onUiClick({target:{closest:selector=>selector===`[data-stage-${kind}]`?{dataset:{['stage'+kind[0].toUpperCase()+kind.slice(1)]:value}}:null},preventDefault(){}});
  function session(data={},mode2d=true) {
    nodes.clear(); document.activeElement=null;confirmCalls.length=0;confirmAnswer=true;
    for(const id of ['stage-dock','stage-props-body','stage-undo','stage-redo']) nodes.set('#'+id,element());
    const stage=director.normalize({actors:[],props:[],cameras:[{id:'camera-one'}],...data});
    const notifications=[];
    const state={stage,card:{id:'stage-test',stage},host:{onChange(){notifications.push('change');},toast(message){notifications.push(message);}},
      selected:null,tab:'props',viewMode:'free',topDown:false,transformMode:'move',history:[],historyIndex:0,dirty:false,gesture:null,
      mode2d,labels:new Map(),helpers:{},actorGroup:new THREE.Group(),propGroup:new THREE.Group(),camera:null};
    api.setEditor(state); api.resetHistory();
    return {state,notifications};
  }
  let passed=0;
  const failures=[];
  function check(name,run) {
    try {run();passed++;}
    catch(error) {failures.push(name);console.error(`FAIL: ${name}\n${error.stack}`);}
  }

  check('private injection leaves the public API and saved stage schema unchanged',()=>{
    const keys=['open','close','normalize','defaultStage','isOpen','poses','_snapshot'].sort();
    assert.deepEqual(Object.keys(director).sort(),keys);assert.deepEqual(Object.keys(behaviorContext.window.StageDirector).sort(),keys);
    const stage=director.defaultStage();
    assert.deepEqual(Object.keys(stage).sort(),['version','actors','cameras','activeCamera','aspect','props','motion','environment'].sort());
    assert.deepEqual(Object.keys(stage.motion).sort(),['duration','easing','start','end'].sort());
    assert.deepEqual(Object.keys(stage.actors[0]).sort(),['id','name','color','x','y','z','rotation','scale','pose','visible','locked'].sort());
    assert.deepEqual(Object.keys(stage.cameras[0]).sort(),['id','name','position','target','fov'].sort());
  });
  check('all ten prop defaults preserve legacy scale and round-trip',()=>{
    assert.deepEqual(Object.keys(api.PROP_TYPES).sort(),Object.keys(sizes).sort());
    assert.equal(defaults.actors[0].y,0);
    const original={actors:[{id:'legacy-actor'}],props:Object.keys(sizes).map(type=>({id:type,type,scale:2}))};
    const before=plain(original),stage=director.normalize(original);
    for(const prop of stage.props) {
      assert.equal(prop.y,0); assert.equal(prop.scale,2);
      assert.deepEqual(dimensions.map(key=>prop[key]),sizes[prop.type],`${prop.type} intrinsic dimensions`);
      assert.deepEqual(plain(api.PROP_TYPES[prop.type].size),sizes[prop.type]);
    }
    assert.deepEqual(original,before,'normalization must not mutate saved input');
    assert.deepEqual(plain(director.normalize(stage)),plain(stage));
    assert.deepEqual(plain(director.normalize(plain(stage))),plain(stage));
  });
  check('hostile heights, dimensions, rotations and camera coordinates clamp safely',()=>{
    const stage=director.normalize({actors:[
      {id:'a',x:-99,y:99,z:99,rotation:99,scale:99},
      {id:'a',y:-1,rotation:-99,scale:-1},
      {id:'bad id',y:'2.345',rotation:NaN},null
    ],props:[
      {id:'p',type:'chair',x:99,y:99,z:-99,width:0,height:999,depth:'2.345',rotation:99,scale:99},
      {id:'p',type:'sofa',y:-99,width:Infinity,height:NaN,depth:'bad',rotation:-99,scale:-1},
      {id:'<invalid>',type:'doorway',y:Infinity,width:'0.25',height:'1.75',depth:undefined},null
    ],cameras:[{id:'camera',position:['1.2345',Infinity,-99,123],target:[99,'-2.3456',NaN],fov:-1}]});
    assert.deepEqual(plain(stage.actors.map(a=>a.y)),[10,0,2.345,0]);
    assert.deepEqual(plain(stage.props.map(p=>p.y)),[10,0,0,0]);
    assert.deepEqual(dimensions.map(key=>stage.props[0][key]),[.1,10,2.345]);
    assert.deepEqual(dimensions.map(key=>stage.props[1][key]),sizes.sofa);
    assert.deepEqual(dimensions.map(key=>stage.props[2][key]),[.25,1.75,.18]);
    for(const list of [stage.actors,stage.props]) {
      assert.equal(list[0].rotation,Math.PI*4); assert.equal(list[1].rotation,-Math.PI*4);
      assert.equal(new Set(list.map(item=>item.id)).size,list.length);
      list.forEach(item=>assert.match(item.id,/^[a-zA-Z0-9_-]{1,80}$/));
    }
    assert.equal(stage.actors[0].x,-14); assert.equal(stage.actors[0].z,14);
    assert.equal(stage.props[0].x,14); assert.equal(stage.props[0].z,-14);
    assert.equal(stage.actors[0].scale,1.4); assert.equal(stage.actors[1].scale,.6);
    assert.equal(stage.props[0].scale,3); assert.equal(stage.props[1].scale,.4);
    assert.deepEqual(plain(stage.cameras[0].position),[1.2345,0,-40]);
    assert.deepEqual(plain(stage.cameras[0].target),[40,-2.3456,0]);
    assert.equal(stage.cameras[0].fov,18);
    assert.deepEqual(plain(director.normalize(stage)),plain(stage));
    assert.deepEqual(plain(director.normalize(plain(stage))),plain(stage));
  });
  check('prototype property names are not valid prop types',()=>{
    for(const type of ['constructor','toString','__proto__']) {
      const stage=director.normalize({props:[{id:'hostile-type',type}]});
      assert.equal(stage.props[0].type,'box');
      assert.deepEqual(dimensions.map(key=>stage.props[0][key]),sizes.box);
    }
  });

  for(const [type,size] of Object.entries(sizes)) check(`${type}: real geometry, ground contact, rebuild and live transforms`,()=>{
    const {state}=session({props:[{id:'prop-test',type,scale:2}]},false);
    const prop=state.stage.props[0],root=api.buildProp(prop),other=api.buildProp(prop);
    assert.ok(root instanceof THREE.Group); assert.equal(root.userData.propId,prop.id);
    const bounds=new THREE.Box3().setFromObject(root),actual=bounds.getSize(new THREE.Vector3()).toArray();
    actual.forEach((value,index)=>near(value,size[index],`${type} base ${dimensions[index]}`));
    near(bounds.min.y,0,`${type} rests on ground`);
    const shared=new Set(Object.values(api.geometries()));
    root.children.forEach((mesh,index)=>{
      assert.ok(shared.has(mesh.geometry),'mesh must use cached geometry');
      assert.equal(mesh.geometry,other.children[index].geometry);
      assert.equal(mesh.material,root.userData.bodyMaterials[0]);
    });
    api.rebuildScene();
    const live=state.propGroup.children[0];
    const scaled=new THREE.Box3().setFromObject(live).getSize(new THREE.Vector3()).toArray();
    scaled.forEach((value,index)=>near(value,size[index]*2,`${type} legacy scaled ${dimensions[index]}`));
    Object.assign(prop,{x:1.25,y:2.75,z:-3.5,width:2.3,height:1.7,depth:.9,scale:1.6,rotation:Math.PI/2,visible:false});
    api.applyPropTransform(prop);
    assert.deepEqual(live.position.toArray(),[1.25,2.75,-3.5]);
    assert.equal(live.visible,false); assert.equal(live.rotation.y,Math.PI/2);
    const transformed=new THREE.Box3().setFromObject(live),extent=transformed.getSize(new THREE.Vector3()).toArray();
    [prop.depth,prop.height,prop.width].forEach((value,index)=>near(extent[index],value*prop.scale,`${type} transformed axis ${index}`));
    near(transformed.min.y,prop.y,`${type} elevated base`);
    api.rebuildScene();
    const rebuilt=new THREE.Box3().setFromObject(state.propGroup.children[0]);
    ['min','max'].forEach(key=>rebuilt[key].toArray().forEach((value,index)=>near(value,transformed[key].toArray()[index],`${type} rebuild ${key}.${index}`)));
    assert.equal(state.propGroup.children[0].visible,false);
    root.userData.bodyMaterials.forEach(material=>material.dispose());
    other.userData.bodyMaterials.forEach(material=>material.dispose());
  });
  check('actor elevation survives pose offsets, live transforms and rebuilds',()=>{
    const {state}=session({actors:[{id:'elevated',pose:'sit',x:1.25,y:2.75,z:-3.5,scale:1.3,rotation:.234}]},false);
    api.rebuildScene();
    const actor=state.stage.actors[0],root=state.actorGroup.children[0];
    near(root.position.y,actor.y+api.POSES.sit.rootY,'elevated sit pose');
    Object.assign(actor,{x:-1.234,y:4.567,z:3.456,scale:.7,rotation:-.321,visible:false});
    api.applyActorTransform(actor);
    assert.deepEqual(root.position.toArray(),[actor.x,actor.y+api.POSES.sit.rootY,actor.z]);
    assert.deepEqual(root.scale.toArray(),[.7,.7,.7]); assert.equal(root.rotation.y,-.321); assert.equal(root.visible,false);
    api.rebuildScene();
    assert.deepEqual(state.actorGroup.children[0].position.toArray(),root.position.toArray());
  });

  check('XYZ and dimension controls use numeric actual-world units',()=>{
    const {state}=session({actors:[{id:'a',x:1.23,y:2.34,z:-3.45}],props:[{id:'p',type:'table',x:-1.23,y:3.45,z:2.34,scale:2}]});
    for(const kind of ['actor','prop']) {
      const item=state.stage[kind==='actor'?'actors':'props'][0],markup=kind==='actor'?api.actorHtml(item):api.propHtml(item);
      for(const axis of ['x','y','z']) {
        const control=field(markup,kind,axis);
        assert.equal(control.type,'number'); assert.equal(control.step,'0.01');
        assert.equal(Number(control.value),item[axis]);
        assert.equal(Number(control.min),axis==='y'?0:-14); assert.equal(Number(control.max),axis==='y'?10:14);
      }
      const rotation=field(markup,kind,'rotationDeg');
      assert.equal(Number(rotation.min),-720); assert.equal(Number(rotation.max),720);
      assert.match(markup,/data-stage-action="duplicate"/);
    }
    const prop=state.stage.props[0];
    dimensions.forEach(key=>{
      const control=field(api.propHtml(prop),'prop',key);
      assert.equal(Number(control.value),prop[key]*prop.scale);
      assert.equal(Number(control.min),.1*prop.scale); assert.equal(Number(control.max),10*prop.scale);
    });
    state.selected={type:'prop',id:prop.id};
    dimensions.forEach((key,index)=>{
      api.onUiInput({target:input('Prop',key,[3.26,2.48,1.62][index])});
      near(prop[key],[3.26,2.48,1.62][index]/2,`stored ${key} divides actual units by scale`);
      const node=input('Prop',key,0); nodes.set(`[data-stage-prop-field="${key}"]`,node);
    });
    api.updatePropField(input('Prop','scalePct',150,{type:'range'}));
    assert.equal(prop.scale,1.5);
    dimensions.forEach(key=>{
      const node=nodes.get(`[data-stage-prop-field="${key}"]`);
      near(Number(node.value),prop[key]*1.5,`displayed ${key} after rescaling`);
      near(Number(node.min),.15,'rescaled dimension min'); near(Number(node.max),15,'rescaled dimension max');
    });
  });
  for(const kind of ['Actor','Prop']) check(`${kind}: exact numeric edits, validation, locking and rotation clamps`,()=>{
    const {state}=session({actors:[{id:'a'}],props:[{id:'p',type:'sofa',scale:2}]});
    const item=state.stage[kind==='Actor'?'actors':'props'][0];
    state.selected={type:kind.toLowerCase(),id:item.id};
    const update=api[`update${kind}Field`];
    for(const axis of ['x','y','z']) {
      api.onUiInput({target:input(kind,axis,1.2345)}); assert.equal(item[axis],1.2345);
      api.onUiInput({target:input(kind,axis,'')}); assert.equal(item[axis],1.2345,'empty input must not reset coordinates');
      api.onUiInput({target:input(kind,axis,99,{validity:{valid:false}})}); assert.equal(item[axis],1.2345,'invalid partial input must not edit');
      update(input(kind,axis,99)); assert.equal(item[axis],axis==='y'?10:14);
      update(input(kind,axis,-99)); assert.equal(item[axis],axis==='y'?0:-14);
    }
    for(const [value,expected] of [[450.25,450.25],[999,720],[-999,-720],[-450.25,-450.25]]) {
      update(input(kind,'rotationDeg',value)); near(item.rotation,expected*Math.PI/180,'rotation in radians');
    }
    if(kind==='Prop') dimensions.forEach(key=>{
      update(input(kind,key,99)); assert.equal(item[key],10);
      update(input(kind,key,-99)); assert.equal(item[key],.1);
    });
    item.locked=true;
    const before=plain(item);
    for(const key of ['x','y','z','rotationDeg','width','height','depth']) update(input(kind,key,4));
    update(input(kind,'scalePct',100,{type:'range'}));
    assert.deepEqual(plain(item),before,'locked transform controls must not mutate the object');
    update(input(kind,'locked','',{type:'checkbox',checked:false})); assert.equal(item.locked,false);
    assert.deepEqual(plain(director.normalize(plain(state.stage))),plain(state.stage));
  });
  for(const kind of ['actor','prop']) check(`${kind}: quick ranges and precise numbers synchronize without replacing focused typing`,()=>{
    const {state}=session({actors:[{id:'a',y:1.25,rotation:.2}],props:[{id:'p',type:'table',scale:2,y:1.25,rotation:.2}]},false);
    const item=state.stage[kind==='actor'?'actors':'props'][0],markup=api[kind+'Html'](item),controls={};
    state.selected={type:kind,id:item.id};api.rebuildScene();
    const precise=markup.match(/<details\b[^>]*data-stage-precise[^>]*>([\s\S]*?)<\/details>/);
    assert.ok(precise);assert.doesNotMatch(precise[0].split('>')[0],/\sopen\b/);
    for(const key of ['y','rotationDeg','scalePct']) {
      const attrs=field(markup,kind,key,undefined,'range');
      assert.equal(Number(attrs.value),key==='y'?item.y:key==='rotationDeg'?11.5:item.scale*100);
      assert.deepEqual([Number(attrs.min),Number(attrs.max)],key==='y'?[0,10]:key==='rotationDeg'?[-720,720]:kind==='actor'?[60,140]:[40,300]);
      assert.equal(Number(attrs.step),key==='y'?.01:1);
      assert.doesNotMatch(precise[1],new RegExp(`type="range"[^>]*data-stage-${kind}-field="${key}"`));
      const types=key==='scalePct'?['range']:['range','number'];
      controls[key]=types.map(type=>{
        if(type==='number')field(precise[1],kind,key);
        const output=element(),node=input(kind[0].toUpperCase()+kind.slice(1),key,attrs.value,{type,output,closest:selector=>selector==='label'?{querySelector:selector=>selector==='output'?output:null}:null});
        return node;
      });
      nodes.set(`[data-stage-${kind}-field="${key}"]`,controls[key]);
    }
    const sync=()=>kind==='actor'?api.syncTransformInputs(item):api.syncPropInputs(item);
    for(const [key,value,display,unit] of [['y','1.2345','1.23','m'],['rotationDeg','450.20','450.2','°']]) {
      const [range,number]=controls[key];number.value=value;document.activeElement=number;
      api.onUiInput({target:number});
      near(key==='y'?item.y:item.rotation*180/Math.PI,Number(value),'full precision stored');
      assert.equal(number.value,value,'focused number retains typed text');assert.equal(String(range.value),display);
      for(const node of [range,number])assert.equal(node.output.textContent,display+unit);
      range.value=key==='y'?'2.75':'-90';document.activeElement=range;api.onUiInput({target:range});
      near(Number(number.value),Number(range.value),'range edits synchronize precise number');
      document.activeElement=number;number.value='-';number.validity.valid=false;
      const before=plain(item);api.onUiInput({target:number});sync();
      assert.equal(number.value,'-');assert.deepEqual(plain(item),before,'invalid typing cannot reset transform');
    }
    const scale=controls.scalePct[0];scale.value=kind==='actor'?'125':'150';document.activeElement=scale;api.onUiInput({target:scale});
    assert.equal(item.scale,Number(scale.value)/100);assert.equal(scale.output.textContent,scale.value+'%');
    const root=(kind==='actor'?state.actorGroup:state.propGroup).children[0];
    near(root.position.y,item.y+(kind==='actor'?(api.POSES[item.pose].rootY||0):0),'live elevation');near(root.rotation.y,item.rotation,'live rotation');
    if(kind==='prop') {
      const width=input('Prop','width','3.000');document.activeElement=width;nodes.set('[data-stage-prop-field="width"]',width);sync();
      assert.equal(width.value,'3.000');near(width.min,.15,'focused dimension minimum');near(width.max,15,'focused dimension maximum');
      document.activeElement=null;sync();near(Number(width.value),item.width*item.scale,'world width after scaling');
      const extent=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());near(extent.y,item.height*item.scale,'real scaled height');
    } else assert.deepEqual(root.scale.toArray(),[1.25,1.25,1.25]);
    item.locked=true;const locked=plain(item);controls.y[0].value='9';api.onUiInput({target:controls.y[0]});assert.deepEqual(plain(item),locked);
    state.preciseOpen=true;assert.match(api[kind+'Html'](item),/<details\b[^>]*data-stage-precise open>/);
  });
  for(const kind of ['actor','prop']) check(`${kind}: invalid focused number commits restore actual values without an undo entry`,()=>{
    const {state}=session({actors:[{id:'a',x:1.25,y:2.75,rotation:Math.PI/2}],props:[{id:'p',x:1.25,y:2.75,rotation:Math.PI/2,width:2,scale:1.5}]});
    const item=state.stage[kind==='actor'?'actors':'props'][0],before=plain(state.stage),history=JSON.stringify(state.history);
    state.selected={type:kind,id:item.id};
    for(const key of ['x','y','rotationDeg',...(kind==='prop'?['width']:[])]) {
      const expected=key==='rotationDeg'?90:key==='width'?item.width*item.scale:item[key];
      const number=input(kind==='actor'?'Actor':'Prop',key,expected),controls=[number];
      if(['y','rotationDeg'].includes(key))controls.push(input(kind==='actor'?'Actor':'Prop',key,expected,{type:'range'}));
      nodes.set(`[data-stage-${kind}-field="${key}"]`,controls);document.activeElement=number;
      for(const invalid of ['99999','-','']) {
        number.value=invalid;number.validity.valid=false;api.onUiInput({target:number});
        assert.equal(number.value,invalid);assert.deepEqual(plain(state.stage),before);
        api.onUiChange({target:number});
        assert.equal(document.activeElement,number);controls.forEach(node=>near(Number(node.value),expected,`${kind}.${key} committed display`));
        assert.deepEqual(plain(state.stage),before);assert.equal(JSON.stringify(state.history),history);
      }
    }
  });
  for(const pose of ['stand','walk','sit','wave']) check(`quick pose ${pose} uses real joints, one undo and locked guards`,()=>{
    const {state,notifications}=session({actors:[{id:'a',pose:'kneel',x:1,y:2,z:3,rotation:.4,scale:1.2}]},false);
    state.selected={type:'actor',id:'a'};api.rebuildScene();
    const before=plain(state.stage),actor=state.stage.actors[0],root=state.actorGroup.children[0];
    clickData('pose',pose);
    assert.deepEqual(plain(state.stage),{...before,actors:[{...before.actors[0],pose}]});
    assert.equal(state.history.length,2);assert.equal(notifications.filter(value=>value==='change').length,1);
    assert.deepEqual(root.position.toArray(),[1,2+(api.POSES[pose].rootY||0),3]);assert.equal(root.rotation.y,.4);assert.deepEqual(root.scale.toArray(),[1.2,1.2,1.2]);
    for(const [key,joint] of Object.entries(root.userData.joints))for(let axis=0;axis<3;axis++)near(joint.rotation.toArray()[axis],(api.POSES[pose][key]?.[axis]||0)*Math.PI/180,`${pose}.${key}.${axis}`);
    const quick=[...api.actorHtml(actor).matchAll(/<button\b[^>]*data-stage-pose="([^"]+)"[^>]*>/g)];
    assert.deepEqual(quick.map(match=>match[1]),['stand','walk','sit','wave']);
    for(const [tag,key] of quick)assert.equal(attributes(tag)['aria-pressed'],String(key===pose));
    const after=plain(state.stage);state.mode2d=true;api.undo();assert.deepEqual(plain(state.stage),before);api.redo();assert.deepEqual(plain(state.stage),after);
    state.selected={type:'actor',id:'a'};const invalidHistory=JSON.stringify(state.history),invalidCount=notifications.length;
    for(const name of ['invalid','constructor','__proto__'])api.setActorPose(name);
    assert.deepEqual(plain(state.stage),after);assert.equal(JSON.stringify(state.history),invalidHistory);assert.equal(notifications.length,invalidCount);
    state.stage.actors[0].locked=true;const locked=plain(state.stage),history=JSON.stringify(state.history),count=notifications.length;
    for(const name of [...Object.keys(api.POSES),'invalid','constructor']){clickData('pose',name);api.setActorPose(name);}
    assert.deepEqual(plain(state.stage),locked);assert.equal(JSON.stringify(state.history),history);assert.equal(notifications.length,count);
    for(const markup of [api.actorHtml(state.stage.actors[0]),api.poseHtml(state.stage.actors[0])]) {
      const buttons=[...markup.matchAll(/<button\b[^>]*data-stage-pose="[^"]+"[^>]*>/g)];
      assert.equal(buttons.length,markup.includes('stage-pose-grid')?13:4);buttons.forEach(([tag])=>assert.match(tag,/\sdisabled(?:\s|>)/));
    }
    assert.deepEqual(plain(director.normalize(locked)),locked,'poses still serialize only the preset name');
  });
  check('changing prop type resets intrinsic dimensions but keeps placement and scale',()=>{
    const {state}=session({props:[{id:'p',type:'table',width:4,height:3,depth:2,x:1.23,y:2.34,z:3.45,scale:2}]});
    const prop=state.stage.props[0]; state.selected={type:'prop',id:prop.id};
    const target=input('Prop','type','chair',{type:'select-one'});
    api.onUiChange({target});
    assert.equal(prop.type,'chair'); assert.deepEqual(dimensions.map(key=>prop[key]),sizes.chair);
    assert.deepEqual([prop.x,prop.y,prop.z,prop.scale],[1.23,2.34,3.45,2]);
    assert.equal(prop.color,api.PROP_TYPES.chair.color);
    assert.equal(state.history.length,2);
    prop.locked=true; target.value='platform'; api.onUiChange({target});
    assert.equal(prop.type,'chair','locked props cannot change type');
  });

  for(const kind of ['actor','prop']) for(const [x,z] of [[0,0],[14,14],[-14,-14],[13.5,13.5],[13.75,-13.75]]) check(`${kind}: copy/undo/redo at (${x}, ${z})`,()=>{
    const key=kind==='actor'?'actors':'props';
    const {state,notifications}=session({[key]:[{id:'original',name:'长名称'.repeat(8),type:'chair',pose:'kneel',x,y:2.345,z,scale:1.25,width:1.2,height:2.3,depth:3.4,rotation:-1.234,color:'#abcdef',visible:false,locked:true}]});
    state.selected={type:kind,id:'original'};
    const before=plain(state.stage),original=state.stage[key][0];
    api.duplicateSelected();
    const copy=state.stage[key][1];
    assert.notEqual(copy.id,original.id); assert.match(copy.id,new RegExp(`^${kind}-[a-zA-Z0-9_-]+$`));
    assert.notEqual(copy.name,original.name); assert.ok(copy.name.length<=24); assert.equal(copy.locked,false);
    assert.deepEqual(plain(copy),{...plain(original),id:copy.id,name:copy.name,locked:false,x:x>13.5?x-.5:x+.5,z:z>13.5?z-.5:z+.5});
    assert.deepEqual(plain(original),before[key][0],'copy must not modify source');
    assert.deepEqual(plain(state.selected),{type:kind,id:copy.id});
    assert.equal(state.card.stage,state.stage); assert.equal(state.history.length,2); assert.equal(state.historyIndex,1);
    assert.ok(notifications.includes('change')); assert.equal(state.dirty,true);
    const after=plain(state.stage);
    assert.deepEqual(plain(director.normalize(after)),after,'copy must survive saving unchanged');
    api.undo(); assert.deepEqual(plain(state.stage),before); assert.equal(state.selected,null); assert.equal(state.card.stage,state.stage);
    api.undo(); assert.deepEqual(plain(state.stage),before,'undo at first snapshot is a no-op');
    api.redo(); assert.deepEqual(plain(state.stage),after); assert.equal(state.card.stage,state.stage);
    api.redo(); assert.deepEqual(plain(state.stage),after,'redo at last snapshot is a no-op');
    state.stage[key][1].y=7;
    assert.equal(state.history[1][key][1].y,2.345,'history must be a deep snapshot');
  });
  for(const kind of ['actor','prop']) check(`${kind}: copies have unique names/IDs, respect caps and branch history`,()=>{
    const key=kind==='actor'?'actors':'props',limit=kind==='actor'?12:16;
    const {state}=session({[key]:[{id:'original',name:'源',type:'stairs',y:1.234}]});
    for(let i=1;i<limit;i++) {state.selected={type:kind,id:'original'};api.duplicateSelected();}
    assert.equal(state.stage[key].length,limit);
    assert.equal(new Set(state.stage[key].map(item=>item.id)).size,limit);
    assert.equal(new Set(state.stage[key].map(item=>item.name)).size,limit);
    const full=plain(state.stage),historyLength=state.history.length;
    api.duplicateSelected();
    if(kind==='actor') api.addActor(); else api.addProp('platform');
    assert.deepEqual(plain(state.stage),full); assert.equal(state.history.length,historyLength,'blocked adds must not create undo entries');
    api.undo(); state.selected={type:kind,id:'original'}; api.duplicateSelected();
    assert.equal(state.historyIndex,state.history.length-1,'new edit discards redo branch');
    const branched=plain(state.stage); api.redo(); assert.deepEqual(plain(state.stage),branched);
    assert.notEqual(state.stage[key].at(-1).id,full[key].at(-1).id);
  });
  check('add commands initialize elevation and all ten intrinsic sizes',()=>{
    const {state}=session();
    api.addActor(); assert.equal(state.stage.actors[0].y,0);
    for(const [type,size] of Object.entries(sizes)) {
      api.addProp(type); const prop=state.stage.props.at(-1);
      assert.equal(prop.type,type); assert.equal(prop.y,0); assert.equal(prop.scale,1);
      assert.deepEqual(dimensions.map(key=>prop[key]),size);
    }
    assert.deepEqual(plain(director.normalize(plain(state.stage))),plain(state.stage));
  });
  check('duplicate action and keyboard shortcut ignore camera/empty selection and typing',()=>{
    const {state}=session({actors:[{id:'a'}]});
    for(const selected of [null,{type:'camera',id:'camera-one'}]) {state.selected=selected;api.duplicateSelected();}
    assert.equal(state.history.length,1);
    state.selected={type:'actor',id:'a'};
    let prevented=0;
    const event={key:'d',ctrlKey:true,preventDefault(){prevented++;},stopPropagation(){}};
    document.activeElement={tagName:'INPUT'}; api.onKeyDown(event); assert.equal(state.stage.actors.length,1); assert.equal(prevented,0);
    document.activeElement=null; api.onKeyDown(event); assert.equal(state.stage.actors.length,2); assert.equal(prevented,1);
    api.onKeyDown({...event,key:'z'}); assert.equal(state.stage.actors.length,1);
    api.onKeyDown({...event,key:'z',shiftKey:true}); assert.equal(state.stage.actors.length,2);
  });

  check('selected camera edits keep precision, enter that shot and leave other cameras unchanged',()=>{
    const {state}=session({cameras:[
      {id:'active',name:'Active',position:[4,2,6],target:[0,1,0],fov:40},
      {id:'selected',name:'Selected <B>',position:[1.2345,3.4567,5.6789],target:[-.2345,1.3456,-2.4567],fov:55}
    ],activeCamera:'active'},false);
    state.viewMode='camera'; state.camera=new THREE.PerspectiveCamera();
    state.selected={type:'camera',id:'selected'};
    api.syncShotCamera();
    const activeBefore=plain(state.stage.cameras[0]),activePosition=state.camera.position.toArray();
    const selected=state.stage.cameras[1];
    assert.equal(api.activeShotCamera(),selected);
    api.renderProps(); api.renderDock();
    for(const key of ['position','target']) for(let axis=0;axis<3;axis++) {
      const control=field(nodes.get('#stage-props-body').innerHTML,'camera',key,axis);
      assert.equal(control.type,'number'); assert.equal(control.step,'0.01');
      assert.equal(control.min,'-40'); assert.equal(control.max,'40');
      assert.equal(Number(control.value),selected[key][axis],'camera editor must not round stored coordinates');
      const other=selected[key].slice(),value=axis+.12345;
      const target=input('Camera',key,value,{dataset:{stageCameraField:key,axis:String(axis)}});
      api.onUiInput({target});
      assert.equal(selected[key][axis],value);
      other.forEach((old,index)=>{if(index!==axis)assert.equal(selected[key][index],old);});
      api.onUiChange({target});
    }
    assert.deepEqual(plain(state.stage.cameras[0]),activeBefore,'selected camera edits cannot mutate active camera');
    assert.notDeepEqual(state.camera.position.toArray(),activePosition,'editing another camera now gives immediate viewport feedback');
    assert.deepEqual(state.camera.position.toArray(),plain(selected.position));
    assert.equal(state.viewMode,'camera');assert.equal(state.stage.activeCamera,selected.id);
    assert.match(nodes.get('#stage-dock').innerHTML,/镜头 · Selected &lt;B&gt;/);
    assert.match(nodes.get('#stage-dock').innerHTML,/data-dock-out="camHeight">1\.1m/);
    api.updateCameraField(input('Camera','position',999,{dataset:{stageCameraField:'position',axis:'0'}})); assert.equal(selected.position[0],40);
    api.updateCameraField(input('Camera','target',-999,{dataset:{stageCameraField:'target',axis:'2'}})); assert.equal(selected.target[2],-40);
    api.updateCameraField(input('Camera','fov',999,{type:'range'})); assert.equal(selected.fov,85);
    api.updateCameraField(input('Camera','fov',-999,{type:'range'})); assert.equal(selected.fov,18);
    api.updateEnvField({dataset:{stageEnv:'camHeight'},value:'4.2'});
    assert.equal(selected.position[1],4.2); assert.equal(state.stage.cameras[0].position[1],2);
    state.stage.activeCamera=selected.id; api.syncShotCamera();
    api.updateCameraField(input('Camera','position','2.34567',{dataset:{stageCameraField:'position',axis:'1'}}));
    assert.equal(state.camera.position.y,2.34567,'editing active shot syncs the real camera at full precision');
    api.pushHistory();
    const after=plain(state.stage);
    assert.deepEqual(plain(director.normalize(after)),after);
    state.mode2d=true; api.undo(); api.redo(); assert.deepEqual(plain(state.stage),after,'camera coordinates survive undo/redo');
    state.selected=null; state.stage.activeCamera='active'; api.renderDock();
    assert.equal(api.activeShotCamera(),state.stage.cameras[0]); assert.match(nodes.get('#stage-dock').innerHTML,/镜头 · Active/);
    state.stage.activeCamera='free'; assert.equal(api.activeShotCamera(),state.stage.cameras[0]);
  });

  check('adding a prop refreshes the dock to the camera it will actually edit',()=>{
    const {state}=session({cameras:[
      {id:'active',name:'Active',position:[4,2,6]},
      {id:'selected',name:'Selected',position:[4,5,6]}
    ],activeCamera:'active'});
    state.selected={type:'camera',id:'selected'};
    api.renderDock();
    assert.match(nodes.get('#stage-dock').innerHTML,/镜头 · Selected/);
    api.addProp('sofa');
    assert.equal(state.selected.type,'prop');
    assert.match(nodes.get('#stage-dock').innerHTML,/镜头 · Active/);
    assert.match(nodes.get('#stage-dock').innerHTML,/data-dock-out="camHeight">2m/);
    api.updateEnvField({dataset:{stageEnv:'camHeight'},value:'3.4'});
    assert.equal(state.stage.cameras[0].position[1],3.4);
    assert.equal(state.stage.cameras[1].position[1],5);
  });

  for(const kind of ['actor','prop']) for(const mode of ['move','rotate']) for(const level of (mode==='move'?[false,true]:[false])) check(`${kind}: real pointerdown starts elevated ${mode}${level?' at camera height':''} and commits undo/save on release`,()=>{
    const key=kind==='actor'?'actors':'props';
    const {state,notifications}=session({[key]:[{id:'dragged',type:'platform',y:2.5}]},false);
    const item=state.stage[key][0],before=plain(state.stage);
    nodes.set('#stage-canvas',{clientWidth:800,clientHeight:800,getBoundingClientRect:()=>({left:0,top:0,width:800,height:800})});
    state.pointer=new THREE.Vector2(); state.labelVector=new THREE.Vector3();
    state.raycaster=new THREE.Raycaster(); state.camera=new THREE.PerspectiveCamera(40,1,.1,100);
    const aimHeight=item.y+(kind==='actor'?1:.15);
    state.camera.position.set(4,level?aimHeight:1.5,6);
    state.camera.lookAt(0,aimHeight,0);
    state.camera.updateMatrixWorld(true);
    api.rebuildScene();
    state.actorGroup.updateMatrixWorld(true); state.propGroup.updateMatrixWorld(true);
    if(mode==='rotate'&&kind==='actor') state.transformMode='rotate';
    const start={button:0,clientX:400,clientY:400,altKey:mode==='rotate'&&kind==='prop',preventDefault(){}};
    api.onPointerDown(start);
    assert.equal(state.gesture?.type,mode,'pointerdown must start the intended gesture above the camera');
    assert.deepEqual(plain(state.selected),{type:kind,id:item.id});
    api.onPointerUp();
    assert.equal(state.history.length,1,'a click without dragging must not create history');
    assert.equal(notifications.length,0,'a click without dragging must not save');
    api.onPointerDown(start);
    const hit=state.raycaster.intersectObjects([...state.actorGroup.children,...state.propGroup.children],true)[0].point.clone();
    if(level) near(hit.y,state.camera.position.y,'the selected surface is level with the camera');
    else assert.ok(hit.y>state.camera.position.y,'the selected surface must be above the camera');
    const end={clientX:440,clientY:392,shiftKey:false};
    if(mode==='move') {
      const raycaster=new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(end.clientX/400-1,1-end.clientY/400),state.camera);
      const normal=level?state.camera.getWorldDirection(new THREE.Vector3()):new THREE.Vector3(0,1,0);
      const next=raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit),new THREE.Vector3());
      assert.ok(next);
      api.onPointerMove(end);
      near(item.x,next.x-hit.x,'drag preserves the clicked surface x offset');
      near(item.z,next.z-hit.z,'drag preserves the clicked surface z offset');
      assert.ok(Math.hypot(item.x,item.z)>.01,'raised object must move with the pointer');
    } else {
      api.onPointerMove(end);
      near(item.rotation,-.4,'rotation follows the pointer');
    }
    assert.equal(item.y,2.5);
    assert.equal(state.history.length,1,'drag is not committed until release');
    api.onPointerUp();
    assert.equal(state.gesture,null); assert.equal(state.history.length,2);
    assert.equal(notifications.filter(value=>value==='change').length,1,'release must save once');
    const after=plain(state.stage);
    nodes.delete('#stage-canvas'); state.mode2d=true;
    api.undo(); assert.deepEqual(plain(state.stage),before);
    api.redo(); assert.deepEqual(plain(state.stage),after);
  });

  for(const kind of ['actor','prop']) for(const mode of ['move','move2d']) check(`${kind}: ${mode} Shift snapping, precision, boundaries and gesture history`,()=>{
    const key=kind==='actor'?'actors':'props';
    const {state}=session({[key]:[{id:'moving',type:'chair',y:2.345}]},mode==='move2d');
    const item=state.stage[key][0]; state.selected={type:kind,id:item.id};
    const canvas={...element(),getBoundingClientRect:()=>({left:0,top:0,width:800,height:800})};
    nodes.set('#stage-canvas',canvas);
    state.pointer=new THREE.Vector2();
    let point={x:1.2345,z:-2.3456};
    state.raycaster={setFromCamera(){},ray:{intersectPlane(plane,target){return target.set(point.x,0,point.z);}}};
    state.gesture={type:mode,kind,id:item.id,startX:0,startY:0,plane:new THREE.Plane(new THREE.Vector3(0,1,0),0),offsetX:0,offsetZ:0,moved:false};
    const move=shiftKey=>api.onPointerMove({clientX:400+point.x*50,clientY:400+point.z*50,shiftKey});
    move(false); near(item.x,1.2345,'unsnapped x'); near(item.z,-2.3456,'unsnapped z'); assert.equal(state.history.length,1);
    move(true); near(item.x,1.2,'snapped x'); near(item.z,-2.3,'snapped z'); assert.equal(item.y,2.345);
    point={x:99,z:-99}; move(true); assert.equal(item.x,14); assert.equal(item.z,-14);
    api.onPointerUp(); assert.equal(state.gesture,null); assert.equal(state.history.length,2); assert.equal(state.historyIndex,1);
    api.onPointerUp(); assert.equal(state.history.length,2,'pointerup must commit once');
    nodes.delete('#stage-canvas'); state.mode2d=true;
    api.undo(); assert.deepEqual([state.stage[key][0].x,state.stage[key][0].z],[0,0]);
    api.redo(); assert.deepEqual([state.stage[key][0].x,state.stage[key][0].z],[14,-14]);
  });
  for(const kind of ['actor','prop']) check(`${kind}: Shift rotation snaps to 15 degrees and clamps to two turns`,()=>{
    const key=kind==='actor'?'actors':'props';
    const {state}=session({[key]:[{id:'rotating',type:'box',y:1.25}]});
    const item=state.stage[key][0];
    state.gesture={type:'rotate',kind,id:item.id,startX:0,startY:0,startRotation:0,moved:false};
    api.onPointerMove({clientX:40,clientY:0,shiftKey:false}); near(item.rotation,-.4,'unsnapped rotation');
    api.onPointerMove({clientX:40,clientY:0,shiftKey:true}); near(item.rotation,-Math.PI/6,'15 degree snap');
    api.onPointerMove({clientX:99999,clientY:0,shiftKey:true}); near(item.rotation,-Math.PI*4,'lower rotation clamp');
    api.onPointerMove({clientX:-99999,clientY:0,shiftKey:true}); near(item.rotation,Math.PI*4,'upper rotation clamp');
    assert.equal(item.y,1.25); api.onPointerUp(); assert.equal(state.history.length,2);
  });

  check('camera helper faces its target and focal presets remain representable',()=>{
    const {state}=session({cameras:[{id:'shot',position:[4,2,6],target:[-2,1,-1],fov:40}],activeCamera:'shot'});
    state.helpers.frustums=new THREE.Group();
    api.buildFrustums();
    const holder=state.helpers.frustums.children[0];
    holder.updateMatrixWorld(true);
    const actual=new THREE.Vector3(0,0,-1).transformDirection(holder.matrixWorld);
    const camera=state.stage.cameras[0];
    const expected=new THREE.Vector3().fromArray(camera.target).sub(new THREE.Vector3().fromArray(camera.position)).normalize();
    near(actual.dot(expected),1,'helper forward direction');
    for(const mm of [18,24,35,50,75]) {
      api.applyFocal(mm);
      assert.equal(api.focalLength(camera.fov),mm);
      assert.ok(camera.fov>=18&&camera.fov<=85);
    }
  });
  check('2D selection follows resized rotated footprints and visible stacking',()=>{
    const {state}=session({props:[{id:'large',type:'wall',width:4,depth:.2,rotation:Math.PI/2}]});
    nodes.set('#stage-canvas',{getBoundingClientRect:()=>({left:0,top:0,width:800,height:800})});
    const pick=(x,z)=>api.pick2D({clientX:400+x*50,clientY:400+z*50}).hit;
    assert.equal(pick(0,1.8).item.id,'large');
    assert.equal(pick(1.8,0),null);
    state.stage.props[0].visible=false;
    assert.equal(pick(0,1.8),null);
    state.stage.props[0].visible=true;
    Object.assign(state.stage.props[0],{type:'sphere',width:4,depth:1,rotation:0});
    assert.equal(pick(1.8,0).item.id,'large');
    assert.equal(pick(1.8,.45),null);
  });
  check('dock defaults to lens, toggles five accessible panels and never edits the scene',()=>{
    const {state,notifications}=session(),before=JSON.stringify(state.stage),history=JSON.stringify(state.history);
    const sections=['lens','light','atmosphere','display','actions'];
    function verify(active) {
      const markup=nodes.get('#stage-dock').innerHTML;
      const panels=[...markup.matchAll(/<div\b[^>]*data-stage-dock-panel="([^"]+)"[^>]*>/g)];
      assert.deepEqual(panels.map(match=>match[1]).sort(),sections.slice().sort());
      for(const [tag,key] of panels){assert.equal(/\shidden(?:\s|>)/.test(tag),key!==active);assert.equal(attributes(tag).id,'stage-dock-'+key);}
      const toolbar=markup.slice(markup.indexOf('<div class="dock-toolbar">'),markup.indexOf(panels[0][0]));
      assert.doesNotMatch(toolbar,/\shidden(?:\s|>)/);assert.match(toolbar,/class="dock-sections" role="group"/);
      for(const action of ['undo','redo','capture-open'])assert.match(toolbar,new RegExp(`data-stage-action="${action}"`));
      const buttons=[...toolbar.matchAll(/<button\b[^>]*data-stage-dock="([^"]+)"[^>]*>/g)];assert.equal(buttons.length,5);
      for(const [tag,key] of buttons){const attrs=attributes(tag);assert.equal(attrs['aria-pressed'],String(key===active));assert.equal(attrs['aria-expanded'],String(key===active));assert.equal(attrs['aria-controls'],'stage-dock-'+key);}
    }
    api.renderDock();verify('lens');clickData('dock','lens');assert.equal(state.dockSection,null);verify(null);
    for(const key of sections) {
      const button={...element(),focus(){document.activeElement=this;}};nodes.set(`[data-stage-dock="${key}"]`,button);
      clickData('dock',key);assert.equal(state.dockSection,key);verify(key);assert.equal(document.activeElement,button);
      clickData('dock',key);verify(null);
    }
    clickData('dock','invalid');assert.equal(state.dockSection,null);
    assert.equal(JSON.stringify(state.stage),before);assert.equal(JSON.stringify(state.history),history);assert.equal(state.dirty,false);assert.deepEqual(notifications,[]);
  });
  check('move/rotate tools leave stage/history unchanged, exit shot view and block during preview/jobs',()=>{
    const {state}=session({activeCamera:'camera-one'},false),before=JSON.stringify(state.stage),history=JSON.stringify(state.history);
    state.camera=new THREE.PerspectiveCamera();state.orbit={target:new THREE.Vector3(1,2,3),radius:8,phi:1,theta:.5};
    const buttons=['move','rotate'].map(key=>({...element(),dataset:{stageTool:key}})),body=element();
    nodes.set('[data-stage-tool]',buttons);nodes.set('.stage-body',body);nodes.set('#stage-tool-hint',element());
    const verify=active=>buttons.forEach(button=>{assert.equal(button.classList.contains('active'),button.dataset.stageTool===active);assert.equal(button.getAttribute('aria-pressed'),String(button.dataset.stageTool===active));});
    api.renderTools();verify('move');clickData('tool','rotate');verify('rotate');assert.equal(state.transformMode,'rotate');
    state.viewMode='camera';api.syncShotCamera();api.renderTools();verify(null);
    for(const key of ['move','rotate']) {
      state.viewMode='camera';api.syncShotCamera();clickData('tool',key);assert.equal(state.viewMode,'free');assert.equal(state.transformMode,key);verify(key);
      assert.ok(state.camera.position.toArray().every(Number.isFinite));assert.equal(state.camera.fov,45);
    }
    clickData('tool','invalid');assert.equal(state.transformMode,'rotate');
    for(const blocked of ['motionPreview','motionJob']) {
      state[blocked]={time:0};api.renderMotionControls();assert.equal(body.inert,true,'tool container is inert while previewing/exporting');
      clickData('tool','move');clickData('dock','light');assert.equal(state.transformMode,'rotate');assert.equal(state.dockSection,undefined);
      state[blocked]=null;api.renderMotionControls();assert.equal(body.inert,false);
    }
    assert.equal(JSON.stringify(state.stage),before);assert.equal(JSON.stringify(state.history),history);
  });
  for(const action of ['reset-view','reset-scene','wheel','orbit']) check(`${action}: leaving top-down resets the visible button and view badge`,()=>{
    const {state}=session({},false),top=element(),badge=element();
    nodes.set('[data-stage-action="top-down"]',top);nodes.set('#stage-badge',badge);
    state.camera=new THREE.PerspectiveCamera();
    state.orbit={theta:.5,phi:1,radius:8,target:new THREE.Vector3(1,2,3)};
    state.orbitGoal={...state.orbit,target:state.orbit.target.clone()};
    if(action==='reset-scene') {
      state.scene=new THREE.Scene();state.scene.fog=new THREE.Fog(0,1,10);
      state.renderer={shadowMap:{needsUpdate:false},setPixelRatio(){}};
      state.helpers={key:new THREE.DirectionalLight(),hemi:{},rim:{},fill:{},shaft:Object.assign(new THREE.Object3D(),{material:{color:new THREE.Color()}}),floorMat:{},pool:{material:{}},grid:new THREE.Group()};
      state.particles={geometry:new THREE.BufferGeometry(),material:{}};
    }
    clickData('action','top-down');assert.equal(state.topDown,true);assert.equal(top.disabled,false);
    assert.equal(top.classList.contains('active'),true);assert.equal(top.getAttribute('aria-pressed'),'true');assert.match(badge.textContent,/俯视/);
    if(action==='wheel')api.onWheel({deltaY:100,preventDefault(){}});
    else if(action==='orbit') {
      state.gesture={type:'orbit',startX:0,startY:0,theta:state.orbitGoal.theta,phi:state.orbitGoal.phi,moved:false};
      api.onPointerMove({clientX:40,clientY:20});api.onPointerUp();
    } else clickData('action',action);
    assert.equal(state.topDown,false);assert.equal(top.classList.contains('active'),false);assert.equal(top.getAttribute('aria-pressed'),'false');assert.match(badge.textContent,/自由视角/);
    if(action.startsWith('reset-')) {near(state.orbit.phi,Math.PI*.42,'reset pitch');near(state.orbit.radius,4.6,'reset distance');}
    state.particles?.geometry.dispose();
  });
  for(const edit of ['position','fov','camHeight','camPitch']) check(`${edit}: camera feedback preserves focused controls and does not edit other shots`,()=>{
    const {state}=session({cameras:[{id:'other',position:[7,4,8]},{id:'edited',position:[4,2,6],target:[0,1,0]}],activeCamera:'other'},false);
    state.camera=new THREE.PerspectiveCamera();state.viewMode=edit==='position'?'free':'camera';state.topDown=true;state.selected={type:'camera',id:'edited'};
    const other=plain(state.stage.cameras[0]),camera=state.stage.cameras[1],body=nodes.get('#stage-props-body'),dock=nodes.get('#stage-dock');
    api.renderProps();api.renderDock();let propsWrites=0,dockWrites=0;
    Object.defineProperty(body,'innerHTML',{configurable:true,set(){propsWrites++;}});Object.defineProperty(dock,'innerHTML',{configurable:true,set(){dockWrites++;}});
    const env=edit.startsWith('cam'),target=env?{...element(),dataset:{stageEnv:edit},type:'range',value:edit==='camHeight'?'4.2':'15'}:input('Camera',edit,edit==='position'?'3.12345':'57',{type:edit==='fov'?'range':'number',dataset:{stageCameraField:edit,axis:'1'}});
    document.activeElement=target;const value=target.value;api.onUiInput({target});
    assert.equal(state.viewMode,'camera');assert.equal(state.stage.activeCamera,'edited');assert.equal(state.topDown,false);
    assert.equal(document.activeElement,target);assert.equal(target.value,value);assert.equal(propsWrites,0,'syncView(false) must not rebuild the sidebar');
    if(env)assert.equal(dockWrites,0,'focused dock slider must survive camera switching');
    assert.deepEqual(plain(state.stage.cameras[0]),other);assert.deepEqual(state.camera.position.toArray(),plain(camera.position));assert.equal(state.camera.fov,camera.fov);
    const direction=new THREE.Vector3().fromArray(camera.target).sub(state.camera.position).normalize();near(state.camera.getWorldDirection(new THREE.Vector3()).dot(direction),1,'edited shot target');
    assert.equal(state.history.length,1);api.onUiChange({target});assert.equal(state.history.length,2);
    assert.doesNotMatch(api.cameraHtml(camera).match(/<details\b[^>]*>/)[0],/\sopen\b/);
  });
  for(const kind of ['actor','prop']) for(const mode of ['move','rotate','alt']) check(`${kind}: 2D pointer ${mode} honors tools, preserves height and refuses locked objects`,()=>{
    const key=kind==='actor'?'actors':'props',{state,notifications}=session({[key]:[{id:'picked',y:2.5,rotation:.2}]});
    nodes.set('#stage-canvas',{getBoundingClientRect:()=>({left:0,top:0,width:800,height:800})});
    const item=state.stage[key][0],before=plain(state.stage),start={button:0,clientX:400,clientY:400,altKey:mode==='alt',preventDefault(){}};
    state.transformMode=mode==='rotate'?'rotate':'move';api.onPointerDown(start);assert.equal(state.gesture?.type,mode==='move'?'move2d':'rotate');
    api.onPointerMove({clientX:440,clientY:400,shiftKey:false});assert.equal(item.y,2.5);assert.equal(state.history.length,1);
    if(mode==='move'){near(item.x,.8,'2D move x');near(item.rotation,.2,'unchanged heading');}else{near(item.rotation,-.2,'2D rotation');assert.equal(item.x,0);assert.equal(item.z,0);}
    api.onPointerUp();assert.equal(state.history.length,2);assert.equal(notifications.filter(value=>value==='change').length,1);
    api.undo();assert.deepEqual(plain(state.stage),before);state.stage[key][0].locked=true;
    const locked=plain(state.stage),history=JSON.stringify(state.history);api.onPointerDown(start);assert.equal(state.gesture,null);api.onPointerMove({clientX:450,clientY:410});api.onPointerUp();
    assert.deepEqual(plain(state.stage),locked);assert.equal(JSON.stringify(state.history),history);
  });
  check('static director markup keeps motion/manual/binding closed and selectors wired consistently',()=>{
    const tags=[...html.matchAll(/<[a-z][\w-]*\b[^>]*>/g)].map(([tag])=>({tag,attrs:attributes(tag)}));
    const ids=tags.filter(({attrs})=>attrs.id?.startsWith('stage-')).map(({attrs})=>attrs.id);
    assert.equal(new Set(ids).size,ids.length,'director IDs must remain unique');
    for(const id of ['stage-motion','stage-motion-manual','stage-motion-binding']) {
      const tag=tags.find(item=>item.attrs.id===id)?.tag;assert.ok(tag,id);assert.match(tag,/^<details\b/);assert.doesNotMatch(tag,/\sopen(?:\s|=|>)/);
    }
    const scopes=new Map(),stack=[];
    for(const [tag] of html.matchAll(/<\/?details\b[^>]*>|<(?:button|select|input)\b[^>]*>/g)) {
      if(tag.startsWith('</')){assert.ok(stack.length,'unmatched details close');stack.pop();}
      else {const attrs=attributes(tag);if(tag.startsWith('<details'))stack.push(attrs.id||'');else scopes.set(attrs.id||attrs['data-stage-action'],stack.slice());}
    }
    assert.equal(stack.length,0,'details must be balanced');
    for(const key of ['preset','strength','duration','easing','time','format'])assert.deepEqual(scopes.get('stage-motion-'+key),['stage-motion']);
    for(const action of ['motion-preset','motion-play','motion-stop','motion-export','motion-cancel'])assert.deepEqual(scopes.get(action),['stage-motion'],'primary action cannot be buried in manual/binding details');
    for(const action of ['motion-start','motion-end','motion-load-start','motion-load-end'])assert.deepEqual(scopes.get(action),['stage-motion','stage-motion-manual']);
    for(const key of ['target','first-field','last-field'])assert.deepEqual(scopes.get('stage-motion-'+key),['stage-motion','stage-motion-binding']);
    for(const [id,values] of [['preset',['push','pull','left','right','rise']],['strength',['0.15','0.3','0.5']]]) {
      const select=html.match(new RegExp(`<select\\b[^>]*id="stage-motion-${id}"[^>]*>([\\s\\S]*?)</select>`));assert.ok(select);
      assert.deepEqual([...select[1].matchAll(/<option\b[^>]*value="([^"]*)"/g)].map(match=>match[1]),values);
      assert.ok(stageSource.includes(`$('#stage-motion-${id}')`),`${id} selector must have a JS consumer`);
    }
    const tools=tags.filter(({attrs})=>attrs['data-stage-tool']);assert.deepEqual(tools.map(({attrs})=>attrs['data-stage-tool']),['move','rotate']);
    tools.forEach(({attrs})=>assert.equal(attrs['aria-pressed'],String(attrs['data-stage-tool']==='move')));
    for(const {attrs} of tags.filter(({attrs})=>attrs['data-stage-action']?.startsWith('motion-'))) {
      assert.ok(stageSource.includes(`case '${attrs['data-stage-action']}'`),`missing handler for ${attrs['data-stage-action']}`);
      for(const key of ['aria-controls','aria-describedby'])if(attrs[key])assert.ok(ids.includes(attrs[key]),`missing ${key} target`);
    }
    for(const selector of ['.stage-tools','.stage-quick-poses','.stage-precise','.dock-toolbar','.dock-sections','.stage-motion-preset','.stage-motion-manual-content','.stage-motion-binding-fields'])assert.ok(stageCss.includes(selector),`missing CSS selector ${selector}`);
    assert.match(stageCss,/\.dock-cluster\[hidden\]\s*\{[^}]*display:\s*none/,'hidden dock panels must not be forced visible by layout CSS');
  });
  const legacyPassed=passed,legacyFailed=failures.length;
  async function checkAsync(name,run) {
    try {await run();passed++;}
    catch(error) {failures.push(name);console.error(`FAIL: ${name}\n${error.stack}`);}
    finally {api.setCaptureSurface(api.captureSurface);document.createElement=element;}
  }
  function motionData() {
    const start=director.normalize({actors:[
      {id:'a',x:-2,y:1,z:3,rotation:-3*Math.PI,scale:.8,pose:'sit',color:'#ff0000'},
      {id:'b',x:6,pose:'run'}
    ],props:[
      {id:'p',type:'table',rotation:-4*Math.PI,width:1,height:2,depth:3,scale:.6,color:'#ff0000'},
      {id:'q',type:'chair',x:5}
    ],cameras:[{id:'start-shot',position:[4,2,6],target:[0,1,0],fov:30}]});
    const end=plain(start);
    Object.assign(end.actors[0],{x:6,y:3,z:-5,rotation:3*Math.PI,scale:1.2,pose:'wave',color:'#0000ff',visible:false});
    end.actors[1].x=-2;
    Object.assign(end.props[0],{x:4,y:2,z:-4,rotation:4*Math.PI,width:3,height:4,depth:5,scale:1.4,color:'#00ff00'});
    end.props[1].x=-3;
    end.actors.reverse();end.props.reverse();
    end.cameras[0]={id:'end-shot',position:[-4,6,2],target:[2,3,-2],fov:70};
    const endpoint=stage=>({actors:plain(stage.actors),props:plain(stage.props),camera:plain(stage.cameras[0])});
    return {actors:plain(start.actors),props:plain(start.props),motion:{duration:4,easing:'linear',start:endpoint(start),end:endpoint(end)}};
  }
  function motionSession(data={}) {
    timers.clear();listeners.clear();now=0;document.hidden=false;
    const result=session({...motionData(),...data},false),{state}=result;
    state.camera=new THREE.PerspectiveCamera(45,1.5,.1,100);
    state.camera.position.set(9,8,7);state.camera.lookAt(1,2,3);state.camera.updateMatrixWorld(true);
    state.orbit={target:new THREE.Vector3(1,2,3)};
    state.renderer={shadowMap:{needsUpdate:false}};
    state.helpers={grid:new THREE.Group(),ring:new THREE.Group(),frustums:new THREE.Group()};
    state.helpers.ring.material={color:new THREE.Color()};
    const labels={...element(),appendChild(){}};
    nodes.set('#stage-labels',labels);
    for(const key of ['status','start-state','end-state','duration','easing','format','target','first-field','last-field','time','readout','first-label','last-slot','preset','strength']) nodes.set('#stage-motion-'+key,{...element(),value:''});
    nodes.get('#stage-motion-preset').value='push';nodes.get('#stage-motion-strength').value='0.3';
    for(const key of ['start','end','load-start','load-end','play','stop','export','cancel','preset']) nodes.set(`[data-stage-action="motion-${key}"]`,element());
    state.view={...element(),querySelector:document.querySelector};
    api.rebuildScene();api.renderMotionControls();
    return result;
  }
  const motionNode=key=>nodes.get('#stage-motion-'+key);
  const motionButton=key=>nodes.get(`[data-stage-action="motion-${key}"]`);
  const click=name=>clickData('action',name);
  const serialized=state=>JSON.stringify(state.stage);
  function liveScene(state) {
    return [state.actorGroup,state.propGroup].map(group=>group.children.map(root=>({
      id:root.userData.actorId||root.userData.propId,position:root.position.toArray(),rotation:root.rotation.toArray(),scale:root.scale.toArray(),visible:root.visible,
      joints:Object.fromEntries(Object.entries(root.userData.joints||{}).map(([key,joint])=>[key,joint.rotation.toArray()])),
      colors:root.userData.bodyMaterials.map(material=>material.color.toArray())
    })));
  }

  for(const view of ['free','camera']) for(const preset of ['push','pull','left','right','rise']) for(const strength of [.15,.5]) check(`preset ${preset} ${strength}: ${view} source, geometry and single history entry`,()=>{
    const {state,notifications}=motionSession({motion:{duration:7.25,easing:'linear'},cameras:[
      {id:'shot',position:[-5,3,7],target:[2,1,-3],fov:61},{id:'selected',position:[12,8,4],target:[3,2,1],fov:25}
    ],activeCamera:'shot'});
    state.viewMode=view;state.selected={type:'camera',id:'selected'};state.orbitGoal={target:new THREE.Vector3(-9,-8,-7)};
    if(view==='camera')api.syncShotCamera();
    const before=plain(state.stage),live=liveScene(state),position=state.camera.position.clone(),target=view==='camera'?new THREE.Vector3().fromArray(state.stage.cameras[0].target):state.orbit.target.clone(),fov=state.camera.fov;
    motionNode('preset').value=preset;motionNode('strength').value=String(strength);click('motion-preset');
    const {start,end}=state.stage.motion;
    assert.equal(confirmCalls.length,0,'empty endpoints need no confirmation');assert.ok(start&&end);
    assert.deepEqual(plain(start.camera.position),position.toArray());assert.deepEqual(plain(start.camera.target),target.toArray());assert.equal(start.camera.fov,fov);assert.equal(end.camera.fov,fov);
    if(view==='camera') {
      assert.equal(start.camera.id,'shot','selected camera must not replace the active rendered shot');
      assert.notEqual(start.camera,state.stage.cameras[0]);assert.notEqual(start.camera.position,state.stage.cameras[0].position);assert.notEqual(start.camera.target,state.stage.cameras[0].target);
    }
    const offset=position.clone().sub(target),distance=offset.length();
    let endPosition=position.clone(),endTarget=target.clone();
    if(preset==='push'||preset==='pull')endPosition=target.clone().addScaledVector(offset,preset==='push'?1-strength:1+strength);
    else {
      const shift=preset==='rise'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,1,0).cross(offset).normalize().multiplyScalar(preset==='left'?-1:1);
      shift.multiplyScalar(distance*strength);endPosition.add(shift);endTarget.add(shift);
    }
    for(const [key,expected] of [['position',endPosition],['target',endTarget]])end.camera[key].forEach((value,i)=>near(value,expected.toArray()[i],`${preset}.${key}.${i}`));
    for(const kind of ['actors','props']) {
      assert.deepEqual(plain(start[kind]),before[kind]);assert.deepEqual(plain(end[kind]),before[kind]);
      assert.notEqual(start[kind],state.stage[kind]);assert.notEqual(start[kind],end[kind]);assert.notEqual(start[kind][0],end[kind][0]);
    }
    assert.notEqual(start.camera,end.camera);assert.notEqual(start.camera.position,end.camera.position);assert.notEqual(start.camera.target,end.camera.target);
    assert.deepEqual(plain(state.stage),{...before,motion:{...before.motion,start:plain(start),end:plain(end)}});
    assert.equal(state.history.length,2);assert.equal(state.historyIndex,1);assert.equal(state.dirty,true);assert.deepEqual(notifications,['change']);
    assert.equal(state.motionPreview.playing,true);assert.equal(state.motionPreview.time,0);assert.equal(state.motionPreview.startedAt,0);
    assert.deepEqual(state.motionPreview.camera.position.toArray(),position.toArray());assert.notEqual(state.motionPreview.camera,state.camera);
    api.applyMotionFrame(state.stage.motion.duration);assert.deepEqual(state.motionPreview.camera.position.toArray(),plain(end.camera.position));
    const after=plain(state.stage);click('motion-stop');assert.deepEqual(liveScene(state),live);assert.deepEqual(plain(state.stage),after);assert.deepEqual(state.camera.position.toArray(),position.toArray());assert.equal(state.history.length,2);
    assert.deepEqual(plain(director.normalize(after)),after);
  });
  for(const existing of ['start','end','both']) for(const accept of [false,true]) check(`preset overwrite ${existing}: ${accept?'accept, stop, undo/redo':'cancel without side effects'}`,()=>{
    const motion=motionData().motion;if(existing!=='both')motion[existing==='start'?'end':'start']=null;
    const {state,notifications}=motionSession({motion,aspect:'1:1',environment:{fog:.23,grid:false},cameras:[{id:'one',fov:33},{id:'two',fov:62}]});
    const before=plain(state.stage),live=liveScene(state),camera=state.camera.clone(),orbit=state.orbit.target.toArray();
    confirmAnswer=accept;click('motion-preset');assert.equal(confirmCalls.length,1);assert.match(confirmCalls[0],/起终点/);
    if(!accept) {
      assert.deepEqual(plain(state.stage),before);assert.deepEqual(liveScene(state),live);assert.equal(state.history.length,1);assert.equal(state.historyIndex,0);assert.equal(state.dirty,false);assert.deepEqual(notifications,[]);assert.equal(state.motionPreview,undefined);
    } else {
      const after=plain(state.stage),start=state.stage.motion.start,end=state.stage.motion.end;
      assert.deepEqual(after,{...before,motion:{...before.motion,start:plain(start),end:plain(end)}});assert.equal(state.history.length,2);assert.deepEqual(notifications,['change']);
      api.applyMotionFrame(2);click('motion-stop');assert.deepEqual(liveScene(state),live);
      assert.deepEqual(state.camera.position.toArray(),camera.position.toArray());assert.deepEqual(state.camera.quaternion.toArray(),camera.quaternion.toArray());assert.equal(state.camera.fov,camera.fov);assert.deepEqual(state.orbit.target.toArray(),orbit);
      state.mode2d=true;click('undo');assert.deepEqual(plain(state.stage),before);assert.equal(state.historyIndex,0);assert.equal(state.card.stage,state.stage);
      click('redo');assert.deepEqual(plain(state.stage),after);assert.equal(state.historyIndex,1);assert.equal(state.history.length,2);assert.equal(state.card.stage,state.stage);
      state.stage.motion.end.actors[0].x=12;state.stage.motion.end.props[0].width=9;state.stage.motion.end.camera.position[0]=39;
      assert.deepEqual(plain(state.stage.motion.start),after.motion.start);assert.deepEqual(plain(state.history[1]),after,'endpoints/history must be detached deep copies');
      assert.deepEqual(plain(state.stage.actors),before.actors);assert.deepEqual(plain(state.stage.props),before.props);assert.deepEqual(plain(state.stage.cameras),before.cameras);
    }
  });
  check('recording and presets share normalized live endpoints, including locked actors/props',()=>{
    const {state}=motionSession({motion:{duration:5,easing:'smooth'}});
    state.camera.position.set(99,2,6);state.camera.fov=100;state.orbit.target.set(0,1,0);
    state.stage.actors[0].locked=true;state.stage.actors[0].x=99;state.stage.props[0].locked=true;state.stage.props[0].width=99;
    api.recordMotionEndpoint('start');const recorded=plain(state.stage.motion.start),before=plain(state.stage);
    assert.deepEqual(recorded.camera.position,[40,2,6]);assert.equal(recorded.camera.fov,85);assert.equal(recorded.actors[0].x,14);assert.equal(recorded.props[0].width,10);
    click('motion-preset');assert.equal(confirmCalls.length,1);
    const start=plain(state.stage.motion.start);assert.deepEqual({...start,camera:{...start.camera,id:recorded.camera.id}},recorded);
    assert.equal(start.actors[0].locked,true);assert.equal(start.props[0].locked,true);
    assert.deepEqual(plain(state.stage.actors),before.actors);assert.deepEqual(plain(state.stage.props),before.props);
    click('motion-stop');
  });
  check('preset controls reject invalid selections, missing nodes and unready/preview/job states',()=>{
    const {state,notifications}=motionSession(),before=serialized(state),history=JSON.stringify(state.history),live=liveScene(state);
    const unchanged=()=>{assert.equal(serialized(state),before);assert.equal(JSON.stringify(state.history),history);assert.equal(state.dirty,false);assert.deepEqual(notifications,[]);assert.equal(confirmCalls.length,0);assert.deepEqual(liveScene(state),live);};
    for(const [preset,strength] of [['','0.3'],['orbit','0.3'],['constructor','0.3'],['push',''],['push','0'],['push','0.2'],['push','-0.15'],['push','NaN'],['push','Infinity'],['push','0.5001']]) {
      motionNode('preset').value=preset;motionNode('strength').value=strength;click('motion-preset');assert.match(motionNode('status').textContent,/请选择/);unchanged();
    }
    motionNode('preset').value='push';motionNode('strength').value='0.3';
    for(const key of ['preset','strength']) {const node=motionNode(key);nodes.delete('#stage-motion-'+key);api.applyMotionPreset();unchanged();nodes.set('#stage-motion-'+key,node);}
    const controls=[motionNode('preset'),motionNode('strength'),motionButton('preset')];api.renderMotionControls();controls.forEach(node=>assert.equal(node.disabled,false));
    for(const unavailable of ['mode2d','camera','motionPreview','motionJob']) {
      const previous=state[unavailable];state[unavailable]=unavailable==='camera'?null:unavailable==='mode2d'?true:{time:0};
      api.renderMotionControls();controls.forEach(node=>assert.equal(node.disabled,true));api.applyMotionPreset();click('motion-preset');unchanged();
      state[unavailable]=previous;api.renderMotionControls();controls.forEach(node=>assert.equal(node.disabled,false));
    }
    api.setEditor(null);api.applyMotionPreset();click('motion-preset');unchanged();api.setEditor(state);
  });
  check('preset distance and coordinate boundaries reject atomically, including translated targets',()=>{
    for(const [preset,position,target,accepted] of [
      ['push',[0,0,0],[0,0,0],false],['push',[0,0,.1999],[0,0,0],false],['push',[0,0,.2],[0,0,0],true],
      ['pull',[40,0,0],[0,0,0],false],['pull',[-40,0,0],[0,0,0],false],['pull',[20,0,0],[-20,0,0],true],
      ['right',[39,0,10],[39,0,0],false],['left',[-39,0,10],[-39,0,0],false],
      ['right',[35,0,10],[39,0,0],false],['rise',[0,39,10],[0,39,0],false],['rise',[0,35,0],[0,39,0],false],
      ['rise',[0,35,10],[0,35,0],true]
    ]) {
      const {state,notifications}=motionSession();state.camera.position.fromArray(position);state.orbit.target.fromArray(target);
      motionNode('preset').value=preset;motionNode('strength').value='0.5';const before=plain(state.stage);click('motion-preset');
      if(accepted) {assert.equal(confirmCalls.length,1);assert.equal(state.history.length,2);assert.ok(state.motionPreview);click('motion-stop');}
      else {assert.equal(confirmCalls.length,0,'validate before asking to replace endpoints');assert.deepEqual(plain(state.stage),before);assert.equal(state.history.length,1);assert.equal(state.dirty,false);assert.deepEqual(notifications,[]);assert.equal(state.motionPreview,undefined);assert.match(motionNode('status').textContent,preset==='push'?/太近/:/超出场景范围/);}
    }
  });
  check('vertical cameras use a finite horizontal fallback for left/right presets',()=>{
    for(const preset of ['left','right']) {
      const {state}=motionSession({motion:{duration:5}});state.camera.position.set(0,10,0);state.orbit.target.set(0,0,0);motionNode('preset').value=preset;motionNode('strength').value='0.3';click('motion-preset');
      const camera=state.stage.motion.end.camera,shift=preset==='left'?-3:3;assert.deepEqual(plain(camera.position),[shift,10,0]);assert.deepEqual(plain(camera.target),[shift,0,0]);click('motion-stop');
    }
  });
  check('motion normalization bounds duration, sanitizes endpoints and round-trips without aliases',()=>{
    assert.deepEqual(plain(api.normalizeMotion(null)),{duration:5,easing:'smooth',start:null,end:null});
    for(const [value,expected] of [[undefined,5],[-9,1],[0,1],[.5,1],[1,1],['7.25',7.25],[30,30],[999,30],[NaN,5],[Infinity,5]]) {
      const motion=api.normalizeMotion({duration:value,easing:'bogus',start:{actors:[],props:[]},end:42});
      assert.equal(motion.duration,expected);assert.equal(motion.easing,'smooth');assert.equal(motion.start,null);assert.equal(motion.end,null);
    }
    const data=motionData();
    Object.assign(data.motion.start.actors[0],{x:999,y:-99,rotation:999,pose:'invalid'});
    Object.assign(data.motion.end.props[0],{width:999,height:-1,depth:'2.25'});
    data.motion.start.camera.position=[999,-999,'2.5'];data.motion.start.camera.fov=999;
    const before=plain(data),stage=director.normalize(data),motion=stage.motion;
    assert.deepEqual(data,before);
    assert.equal(motion.start.actors[0].x,14);assert.equal(motion.start.actors[0].y,0);
    assert.equal(motion.start.actors[0].rotation,Math.PI*4);assert.equal(motion.start.actors[0].pose,'stand');
    assert.deepEqual(dimensions.map(key=>motion.end.props[0][key]),[10,.1,2.25]);
    assert.deepEqual(plain(motion.start.camera.position),[40,-40,2.5]);assert.equal(motion.start.camera.fov,85);
    assert.deepEqual(plain(director.normalize(plain(stage))),plain(stage));
    assert.deepEqual(plain(api.normalizeMotion(plain(motion))),plain(motion));
    data.motion.start.actors[0].x=0;assert.equal(motion.start.actors[0].x,14,'normalized endpoints must be detached');
  });
  for(const easing of ['linear','smooth']) check(`motion ${easing}: ID interpolation preserves multiple turns, pose endpoints, dimensions and camera`,()=>{
    const motion=api.normalizeMotion({...motionData().motion,easing}),before=JSON.stringify(motion);
    for(const [time,u] of [[-1,0],[0,0],[1,easing==='linear'?.25:.15625],[2,.5],[4,1],[9,1]]) {
      const frame=api.motionFrame(motion,time);near(frame.amount,u,'clamped/eased amount');
      for(const kind of ['actors','props']) for(const a of motion.start[kind]) {
        const b=motion.end[kind].find(item=>item.id===a.id),actual=frame[kind].find(item=>item.id===a.id);
        for(const key of ['x','y','z','rotation','scale',...(kind==='props'?dimensions:[])]) near(actual[key],a[key]+(b[key]-a[key])*u,`${a.id}.${key}`);
        assert.equal(actual.visible,u===1?b.visible:a.visible);
        if(kind==='actors')assert.equal(actual.pose,u===1?b.pose:a.pose);
      }
      for(const key of ['position','target']) frame.camera[key].forEach((value,i)=>near(value,motion.start.camera[key][i]+(motion.end.camera[key][i]-motion.start.camera[key][i])*u,`camera.${key}.${i}`));
      near(frame.camera.fov,30+40*u,'camera fov');
    }
    assert.equal(JSON.stringify(motion),before,'interpolation must not mutate endpoints');
  });
  check('endpoint record is detached, undoable, and load preserves motion and camera identity',()=>{
    const {state,notifications}=motionSession({motion:{duration:4,easing:'linear'}});
    const before=plain(state.stage);
    api.recordMotionEndpoint('start');
    const start=plain(state.stage.motion.start);
    assert.deepEqual(start.actors,before.actors);assert.deepEqual(start.props,before.props);
    assert.deepEqual(start.camera.position,[9,8,7]);assert.deepEqual(start.camera.target,[1,2,3]);assert.equal(start.camera.fov,45);
    state.stage.actors[0].x=8;state.stage.props[0].width=7;
    state.viewMode='camera';state.stage.activeCamera='camera-one';
    Object.assign(state.stage.cameras[0],{position:[-6,4,2],target:[1,0,2],fov:60});
    api.recordMotionEndpoint('end');
    assert.deepEqual(plain(state.stage.motion.start),start);
    assert.deepEqual(plain(state.stage.motion.end.camera),plain(state.stage.cameras[0]));
    assert.equal(state.history.length,3);assert.equal(notifications.filter(value=>value==='change').length,2);
    const recorded=plain(state.stage);
    state.mode2d=true;api.undo();assert.equal(state.stage.motion.end,null);api.redo();state.mode2d=false;
    assert.deepEqual(plain(state.stage),recorded);
    state.selected={type:'camera',id:'camera-one'};api.loadMotionEndpoint('start');
    assert.deepEqual(plain(state.stage.actors),start.actors);assert.deepEqual(plain(state.stage.props),start.props);
    assert.equal(state.stage.cameras[0].id,'camera-one');assert.equal(state.stage.activeCamera,'camera-one');assert.equal(state.viewMode,'camera');assert.equal(state.selected,null);
    for(const key of ['position','target','fov'])assert.deepEqual(plain(state.stage.cameras[0][key]),start.camera[key]);
    assert.deepEqual(plain(state.stage.motion),recorded.motion);assert.deepEqual(plain(state.stage.environment),recorded.environment);
    assert.equal(state.history.length,4);
    state.stage.actors[0].x=3;assert.equal(state.stage.motion.start.actors[0].x,-2,'loading must not alias endpoints');
  });
  for(const mismatch of ['actor-id','prop-type','added-object','removed-object']) check(`motion rejects ${mismatch} without loading or previewing stale endpoints`,()=>{
    const {state,notifications}=motionSession();
    if(mismatch==='actor-id')state.stage.actors[0].id='replacement';
    if(mismatch==='prop-type')state.stage.props[0].type='wall';
    if(mismatch==='added-object')state.stage.actors.push({...state.stage.actors[0],id:'new'});
    if(mismatch==='removed-object')state.stage.props.pop();
    const before=serialized(state),history=JSON.stringify(state.history);
    assert.match(api.motionProblem(),/对象已变化/);
    api.loadMotionEndpoint('start');assert.match(motionNode('status').textContent,/对象已变化/);
    assert.equal(api.previewMotion(2),false);assert.equal(state.motionPreview,undefined);
    assert.equal(serialized(state),before);assert.equal(JSON.stringify(state.history),history);assert.deepEqual(notifications,[]);
    api.renderMotionControls();assert.equal(motionButton('play').disabled,true);assert.equal(motionButton('export').disabled,true);
  });
  check('preview applies real joints, transforms and camera without saving, and stop restores everything',()=>{
    const {state,notifications}=motionSession();
    state.stage.actors[0].x=7;state.stage.actors[0].pose='walk';state.stage.props[0].width=2.5;
    api.rebuildScene();state.helpers.grid.visible=true;state.helpers.ring.visible=true;state.helpers.frustums.visible=false;
    const before=serialized(state),live=liveScene(state),camera=state.camera.clone(),history=JSON.stringify(state.history);
    state.gesture={type:'move'};
    assert.equal(api.previewMotion(2,true),true);assert.equal(state.gesture,null);
    assert.equal(state.motionPreview.playing,true);assert.equal(state.motionPreview.startedAt,-2000);
    for(const key of ['grid','ring','frustums'])assert.equal(state.helpers[key].visible,false);
    assert.equal(nodes.get('#stage-labels').hidden,true);assert.notEqual(state.motionPreview.camera,state.camera);
    const a=state.actorGroup.children.find(root=>root.userData.actorId==='a'),p=state.propGroup.children.find(root=>root.userData.propId==='p');
    near(a.position.x,2,'actor x');near(a.position.y,2+api.POSES.sit.rootY/2,'pose root elevation');near(a.position.z,-1,'actor z');
    near(a.rotation.y,0,'multi-turn actor midpoint');assert.deepEqual(a.scale.toArray(),[1,1,1]);
    for(const [key,joint] of Object.entries(a.userData.joints))for(let axis=0;axis<3;axis++)near(joint.rotation.toArray()[axis],((api.POSES.sit[key]?.[axis]||0)+(api.POSES.wave[key]?.[axis]||0))/2*Math.PI/180,`${key}.${axis}`);
    assert.deepEqual(p.position.toArray(),[2,1,-2]);near(p.rotation.y,0,'multi-turn prop midpoint');
    [2/1.6,3/.8,4/.9].forEach((value,i)=>near(p.scale.toArray()[i],value,'interpolated intrinsic size times scale'));
    const color=new THREE.Color('#ff0000').lerp(new THREE.Color('#0000ff'),.5);
    a.userData.bodyMaterials[0].color.toArray().forEach((value,i)=>near(value,color.toArray()[i],'actor color'));
    const shot=state.motionPreview.camera;assert.deepEqual(shot.position.toArray(),[0,4,4]);assert.equal(shot.fov,50);near(shot.aspect,16/9,'preview aspect');
    const direction=new THREE.Vector3(1,2,-1).sub(shot.position).normalize();near(shot.getWorldDirection(new THREE.Vector3()).dot(direction),1,'interpolated camera target');
    api.applyMotionFrame(4);assert.equal(a.visible,false);near(a.rotation.y,3*Math.PI,'actor end rotation');near(p.rotation.y,4*Math.PI,'prop end rotation');
    assert.equal(serialized(state),before);assert.equal(JSON.stringify(state.history),history);assert.deepEqual(notifications,[]);assert.equal(state.dirty,false);
    api.stopMotionPreview();assert.equal(state.motionPreview,null);assert.deepEqual(liveScene(state),live);
    assert.deepEqual(state.camera.position.toArray(),camera.position.toArray());assert.deepEqual(state.camera.quaternion.toArray(),camera.quaternion.toArray());assert.equal(state.camera.fov,camera.fov);
    assert.equal(state.helpers.grid.visible,true);assert.equal(state.helpers.ring.visible,true);assert.equal(state.helpers.frustums.visible,false);assert.equal(nodes.get('#stage-labels').hidden,false);
    api.stopMotionPreview();assert.equal(serialized(state),before);assert.equal(JSON.stringify(state.history),history);assert.deepEqual(notifications,[]);
  });
  check('motion controls guard unavailable, preview, recording and saving states',()=>{
    const {state,notifications}=motionSession();
    for(const unavailable of ['mode2d','camera','end']) {
      const old=unavailable==='end'?state.stage.motion.end:state[unavailable];
      if(unavailable==='end')state.stage.motion.end=null;else state[unavailable]=unavailable==='mode2d'?true:null;
      api.renderMotionControls();assert.ok(api.motionProblem());assert.equal(motionButton('play').disabled,true);assert.equal(motionButton('export').disabled,true);assert.equal(motionNode('time').disabled,true);
      assert.equal(api.previewMotion(0),false);
      if(unavailable!=='end'){
        const before=serialized(state);api.recordMotionEndpoint('start');api.loadMotionEndpoint('end');assert.equal(serialized(state),before);
        assert.equal(motionButton('start').disabled,true);assert.equal(motionButton('load-start').disabled,true);
      }
      if(unavailable==='end')state.stage.motion.end=old;else state[unavailable]=old;
    }
    const duration=motionNode('duration');duration.value='typing';document.activeElement=duration;
    api.renderMotionControls();assert.equal(duration.value,'typing');document.activeElement=null;
    api.onUiChange({target:{...element(),id:'stage-motion-duration',value:'999'}});assert.equal(state.stage.motion.duration,30);
    api.onUiChange({target:{...element(),id:'stage-motion-duration',value:'-5'}});assert.equal(state.stage.motion.duration,1);
    api.onUiChange({target:{...element(),id:'stage-motion-easing',value:'unknown'}});assert.equal(state.stage.motion.easing,'smooth');
    const before=serialized(state),count=notifications.length,history=JSON.stringify(state.history);
    api.previewMotion(.5,true);assert.equal(motionButton('play').textContent,'暂停');assert.equal(duration.disabled,true);assert.equal(motionButton('start').disabled,true);assert.equal(motionButton('stop').disabled,false);assert.equal(nodes.get('#stage-dock').inert,true);
    state.selected={type:'actor',id:'a'};
    const blocked=()=>{
      api.onUiInput({target:input('Actor','x',12)});api.onUiChange({target:{...element(),id:'stage-motion-duration',value:'10'}});
      click('duplicate');api.onKeyDown({key:'Delete',preventDefault(){},stopPropagation(){}});api.onPointerDown({button:0});api.recordMotionEndpoint('start');
      assert.equal(serialized(state),before);assert.equal(JSON.stringify(state.history),history);assert.equal(notifications.length,count);
    };
    blocked();click('motion-play');assert.equal(state.motionPreview.playing,false);
    api.onUiInput({target:{id:'stage-motion-time',value:'.75'}});near(state.motionPreview.time,.75,'scrub preview');
    click('motion-stop');assert.equal(state.motionPreview,null);assert.equal(nodes.get('#stage-dock').inert,false);
    let cancelled=0;state.motionJob={saving:false,cancel(){cancelled++;}};api.renderMotionControls();blocked();
    api.loadMotionEndpoint('end');assert.equal(serialized(state),before);
    assert.equal(motionButton('cancel').hidden,false);assert.equal(motionButton('cancel').disabled,false);
    for(const key of ['format','target','first-field','last-field','duration','time'])assert.equal(motionNode(key).disabled,true);
    click('motion-cancel');assert.equal(cancelled,1);state.motionJob.saving=true;api.renderMotionControls();click('motion-cancel');assert.equal(cancelled,1);assert.equal(motionButton('cancel').disabled,true);
  });
  check('motion workflow targets filter types, escape labels and refuse occupied inputs',()=>{
    const {state}=motionSession(),summary=element();nodes.set('#stage-motion-binding-summary',summary);
    Object.defineProperty(summary,'innerHTML',{set(){assert.fail('workflow names must only be assigned as text');}});
    state.host.workflows=()=>[
      {id:'video',name:'Video <unsafe>',fields:[{id:'clip',type:'video',label:'Clip'}]},
      {id:'image',name:'Images',fields:[{id:'first',type:'image',label:'First <frame>'},{id:'busy',type:'image',occupied:true},{id:'last',type:'image'}]},
      {id:'text',name:'Text',fields:[{id:'prompt',type:'text'}]}
    ];
    motionNode('format').value='video';motionNode('target').value='video';api.refreshMotionTargets();
    assert.equal(summary.textContent,'连接到：Video <unsafe>（展开检查输入）');
    assert.match(motionNode('target').innerHTML,/Video &lt;unsafe&gt;/);assert.doesNotMatch(motionNode('target').innerHTML,/value="(?:image|text)"/);
    assert.equal(motionNode('first-field').value,'clip');assert.equal(motionNode('last-slot').hidden,true);
    motionNode('format').value='frames';api.refreshMotionTargets();assert.equal(motionNode('target').value,'');assert.equal(motionNode('first-field').value,'');assert.equal(summary.textContent,'连接工作流（可选）');
    motionNode('target').value='image';motionNode('first-field').value='busy';motionNode('last-field').value='last';api.refreshMotionTargets();assert.equal(summary.textContent,'连接到：Images（展开检查输入）');
    assert.equal(motionNode('first-field').value,'');assert.equal(motionNode('last-field').value,'last');assert.match(motionNode('first-field').innerHTML,/value="busy" disabled/);assert.match(motionNode('first-field').innerHTML,/First &lt;frame&gt;/);assert.equal(motionNode('last-slot').hidden,false);
  });

  // All recording events and time are synthetic; no browser, codecs, I/O or host persistence.
  function recorderFixture(scenario='success',mime='video/webm;codecs=vp8') {
    const {state,notifications}=motionSession();state.stage.motion.duration=1;
    assert.equal(api.previewMotion(0),true);state.motionJob={cancelled:false,saving:false};
    const stats={stops:0,draws:[],drawTimes:[],stopAt:null,recorder:null,streams:0};
    const stream={getTracks:()=>[{stop(){stats.stops++;}}]};
    behaviorContext.window.MediaRecorder=class {
      static isTypeSupported(type){return scenario!=='unsupported'&&type===mime;}
      constructor(actual,options){
        assert.equal(actual,stream);assert.equal(options.mimeType,mime);assert.equal(options.videoBitsPerSecond,6000000);
        if(scenario==='constructor-error')throw new Error('fake constructor failure');
        stats.recorder=this;this.mimeType=mime;this.state='inactive';
      }
      start(timeslice){assert.equal(timeslice,500);if(scenario==='start-error')throw new Error('fake start failure');this.state='recording';}
      stop(){
        assert.equal(this.state,'recording');this.state='inactive';stats.stopAt=now;
        behaviorContext.setTimeout(()=>{
          this.ondataavailable({data:new Blob([])});
          if(scenario!=='empty')this.ondataavailable({data:new Blob(['offline-video'])});
          this.onstop();
        });
      }
    };
    const surface={canvas:{captureStream(fps){assert.equal(fps,24);stats.streams++;return stream;}},draw(camera){
      if(scenario==='draw-error')throw new Error('fake draw failure');
      assert.equal(camera,state.motionPreview.camera);stats.draws.push(state.motionPreview.time);stats.drawTimes.push(now);
    }};
    return {state,notifications,stats,surface};
  }
  for(const scenario of ['success','cancel','encoder-error','hidden','draw-error','constructor-error','start-error','unsupported','empty','editor-replaced']) await checkAsync(`offline recorder: ${scenario} settles and cleans tracks, timers and listeners`,async()=>{
    const {state,notifications,stats,surface}=recorderFixture(scenario),before=serialized(state);
    const result=Promise.resolve().then(()=>api.recordMotionVideo(state,surface));
    const expected={cancel:/已取消/, 'encoder-error':/fake encoder failure/,hidden:/窗口已隐藏/,'draw-error':/fake draw failure/,'constructor-error':/fake constructor failure/,'start-error':/fake start failure/,unsupported:/不支持视频编码/,empty:/没有录制到视频画面/,'editor-replaced':/已取消/};
    const outcome=scenario==='success'?result:assert.rejects(result,expected[scenario]);
    await Promise.resolve();
    if(scenario==='cancel')api.cancelMotionExport();
    if(scenario==='encoder-error')stats.recorder.onerror({error:new Error('fake encoder failure')});
    if(scenario==='hidden'){document.hidden=true;for(const listener of listeners.get('visibilitychange')||[])listener();}
    if(scenario==='editor-replaced')api.setEditor(null);
    const blob=await settle(outcome);
    if(scenario==='success'){
      assert.ok(blob instanceof Blob);assert.equal(blob.type,'video/webm;codecs=vp8');assert.equal(await blob.text(),'offline-video');
      assert.equal(stats.draws[0],0);assert.equal(stats.draws.at(-1),1);assert.ok(stats.draws.length>=24);
      assert.ok(stats.draws.every((time,i)=>i===0||time>=stats.draws[i-1]));
      assert.ok(stats.drawTimes.at(-1)<1000,'draw endpoint before the last recording interval');
      assert.ok(stats.stopAt-stats.drawTimes.at(-1)>=1000/24-.001,'allow asynchronous capture before stopping');
    }
    assert.equal(stats.stops,scenario==='unsupported'?0:1,'every acquired track must stop exactly once');
    assert.equal(timers.size,0);assert.equal(listeners.get('visibilitychange')?.size||0,0);assert.equal(state.motionJob.cancel==null,true);
    assert.equal(serialized(state),before);assert.deepEqual(notifications,[]);
    api.setEditor(state);api.stopMotionPreview();
  });
  for(const scenario of ['success','render-error','read-error','closed']) check(`capture surface: ${scenario}, target restoration, Y flip and disposal`,()=>{
    const {state}=motionSession();
    const originalCreate=document.createElement,previous={name:'existing target'};let current=previous,captured,disposed=0,puts=0;
    const bytes=Uint8Array.from({length:16},(_,i)=>i+1);
    document.createElement=tag=>{
      assert.equal(tag,'canvas');return {getContext:kind=>{assert.equal(kind,'2d');return {putImageData(image,x,y){assert.equal(x,0);assert.equal(y,0);captured=Array.from(image.data);puts++;}};}};
    };
    state.renderer={getRenderTarget:()=>current,setRenderTarget(target){current=target;if(target!==previous&&!target.userData){target.userData={};target.addEventListener('dispose',()=>disposed++);}},
      render(scene,camera){assert.equal(camera,state.camera);if(scenario==='render-error')throw new Error('fake render failure');},
      readRenderTargetPixels(target,x,y,width,height,buffer){assert.equal(target,current);assert.equal(width,2);assert.equal(height,2);assert.equal(target.texture.colorSpace,THREE.SRGBColorSpace);if(scenario==='read-error')throw new Error('fake read failure');buffer.set(bytes);}};
    try {
      const surface=api.captureSurface(state,2,2);assert.equal(surface.canvas.width,2);assert.equal(surface.canvas.height,2);
      try {
        if(scenario==='closed')api.setEditor(null);
        if(scenario==='success'){surface.draw(state.camera);assert.deepEqual(captured,[9,10,11,12,13,14,15,16,1,2,3,4,5,6,7,8]);assert.equal(puts,1);}
        else {assert.throws(()=>surface.draw(state.camera),scenario==='closed'?/导演台已关闭/:/fake (render|read) failure/);assert.equal(puts,0);}
        assert.equal(current,previous,'renderer must restore its preexisting target even on failure');
      } finally {surface.dispose();}
      if(scenario!=='closed')assert.equal(disposed,1);
    } finally {document.createElement=originalCreate;api.setEditor(state);}
  });
  for(const scenario of ['frames','video','cancel','hidden','hidden-before-record','encoder-error','first-blob-error','last-blob-error','surface-error','save-error']) await checkAsync(`offline export: ${scenario} preserves stage and cleans preview/surface/job`,async()=>{
    const {state,stats,surface}=recorderFixture(scenario==='encoder-error'?'success':scenario);
    api.stopMotionPreview();state.motionJob=null;
    motionNode('format').value=['video','hidden','hidden-before-record','encoder-error'].includes(scenario)?'video':'frames';
    state.stage.aspect='9:16';motionNode('target').value='workflow';motionNode('first-field').value='first';motionNode('last-field').value='last';
    const before=serialized(state),live=liveScene(state),history=JSON.stringify(state.history);let disposed=0,blobs=0,saved=0;
    surface.dispose=()=>{disposed++;};
    surface.canvas.toBlob=(callback,type)=>{
      assert.equal(type,'image/png');blobs++;
      const endpoint=blobs===1?state.stage.motion.start:state.stage.motion.end;
      assert.equal(state.motionPreview.time,blobs===1?0:1,'PNG must capture the requested endpoint');
      assert.deepEqual(state.motionPreview.camera.position.toArray(),plain(endpoint.camera.position));
      assert.equal(state.motionPreview.camera.fov,endpoint.camera.fov);
      if(scenario==='cancel')api.cancelMotionExport();
      if(scenario==='hidden-before-record')document.hidden=true;
      callback((scenario==='first-blob-error'||scenario==='last-blob-error'&&blobs===2)?null:new Blob([`frame-${blobs}`],{type}));
    };
    api.setCaptureSurface((actual,width,height)=>{
      assert.equal(actual,state);assert.equal(width,720);assert.equal(height,1280);
      if(scenario==='surface-error')throw new Error('fake surface failure');
      return surface;
    });
    state.host.workflows=()=>[{id:'workflow',name:'Target',fields:(motionNode('format').value==='video'?[{id:'first',type:'video'}]:[{id:'first',type:'image'},{id:'last',type:'image'}]).map(field=>({...field,occupied:saved>0}))}];
    state.host.motionCapture=async(items,options)=>{
      saved++;assert.equal(disposed,1,'release render target before host handoff');assert.equal(state.motionPreview,null);assert.equal(state.motionJob.saving,true);
      assert.equal(motionButton('cancel').disabled,true);api.cancelMotionExport();assert.equal(state.motionJob.cancelled,false,'saving cannot be cancelled');
      const video=scenario==='video';assert.deepEqual(plain(items.map(item=>item.role)),video?['start','video']:['start','end']);
      assert.equal(items[0].blob.type,'image/png');assert.equal(await items[0].blob.text(),'frame-1');
      assert.equal(items[1].blob.type,video?'video/webm;codecs=vp8':'image/png');
      assert.deepEqual(plain(options),{format:video?'video':'frames',width:720,height:1280,duration:1,fps:24,targetWorkflow:'workflow',firstField:'first',lastField:video?'':'last'});
      if(scenario==='save-error')throw new Error('fake save failure');
    };
    const result=api.exportMotion();
    if(scenario==='hidden'||scenario==='encoder-error'){
      for(let i=0;i<10&&!stats.recorder;i++)await Promise.resolve();
      assert.ok(stats.recorder,'export must reach the recorder');
      if(scenario==='hidden'){document.hidden=true;for(const listener of listeners.get('visibilitychange')||[])listener();}
      else stats.recorder.onerror({error:new Error('fake encoder failure')});
    }
    await settle(result);
    assert.equal(saved,['frames','video','save-error'].includes(scenario)?1:0);
    assert.equal(disposed,scenario==='surface-error'?0:1);assert.equal(state.motionPreview,null);assert.equal(state.motionJob,null);
    assert.equal(serialized(state),before);assert.equal(JSON.stringify(state.history),history);assert.deepEqual(liveScene(state),live);
    assert.equal(timers.size,0);assert.equal(listeners.get('visibilitychange')?.size||0,0);
    if(['video','hidden','encoder-error'].includes(scenario))assert.equal(stats.stops,1);
    if(scenario==='frames')assert.deepEqual(stats.draws,[0,1],'render both endpoints before host handoff');
    if(scenario==='video'){assert.equal(stats.draws[0],0);assert.equal(stats.draws.at(-1),1);assert.ok(stats.draws.length>=25);}
    const status=motionNode('status').textContent;
    if(['frames','video'].includes(scenario)){
      assert.match(status,/已输出到画布/);assert.equal(motionNode('first-field').value,'');assert.equal(motionNode('last-field').value,'');
      assert.match(motionNode('first-field').innerHTML,/value="first" disabled/,'refresh occupancy after binding');
      await api.exportMotion();assert.equal(saved,1);assert.equal(disposed,1,'repeat export stops before recording into an occupied input');
    }
    else assert.match(status,{
      cancel:/^已取消视频输出/,
      hidden:/^输出已取消：窗口已隐藏/,
      'hidden-before-record':/^视频输出失败：窗口已隐藏/,
      'encoder-error':/^输出已取消：fake encoder failure$/,
      'first-blob-error':/^视频输出失败：无法生成首帧$/,
      'last-blob-error':/^视频输出失败：无法生成尾帧$/,
      'surface-error':/^视频输出失败：fake surface failure$/,
      'save-error':/^视频输出失败：fake save failure$/
    }[scenario]);
  });
  for(const format of ['frames','video']) await checkAsync(`preset ${format}: staged output captures generated endpoints and preserves scene/history`,async()=>{
    const {state,stats,surface}=recorderFixture();api.stopMotionPreview();state.motionJob=null;
    state.stage.motion=api.normalizeMotion({duration:1,easing:'linear'});api.resetHistory();motionNode('preset').value='rise';click('motion-preset');click('motion-stop');
    const before=serialized(state),history=JSON.stringify(state.history),live=liveScene(state);let blobs=0,saved=0,disposed=0;
    motionNode('format').value=format;motionNode('target').value='workflow';motionNode('first-field').value='first';motionNode('last-field').value=format==='frames'?'last':'';
    surface.dispose=()=>{disposed++;};surface.canvas.toBlob=(callback,type)=>{
      const endpoint=blobs++===0?state.stage.motion.start:state.stage.motion.end;
      assert.equal(type,'image/png');assert.deepEqual(state.motionPreview.camera.position.toArray(),plain(endpoint.camera.position));
      assert.equal(state.motionPreview.camera.fov,endpoint.camera.fov);callback(new Blob(['preset-frame'],{type}));
    };
    api.setCaptureSurface((actual,width,height)=>{assert.equal(actual,state);assert.deepEqual([width,height],[1280,720]);return surface;});
    state.host.workflows=()=>[{id:'workflow',name:'Target',fields:(format==='video'?['first']:['first','last']).map(id=>({id,type:format==='video'?'video':'image',occupied:saved>0}))}];
    state.host.motionCapture=async(items,options)=>{
      saved++;assert.equal(disposed,1);assert.equal(state.motionPreview,null);assert.equal(state.motionJob.saving,true);
      assert.deepEqual(plain(items.map(item=>item.role)),format==='video'?['start','video']:['start','end']);
      assert.equal(items[0].blob.type,'image/png');assert.equal(items[1].blob.type,format==='video'?'video/webm;codecs=vp8':'image/png');
      assert.deepEqual(plain(options),{format,width:1280,height:720,duration:1,fps:24,targetWorkflow:'workflow',firstField:'first',lastField:format==='frames'?'last':''});
    };
    await settle(api.exportMotion());assert.equal(saved,1);assert.equal(disposed,1);assert.equal(state.motionPreview,null);assert.equal(state.motionJob,null);
    assert.equal(serialized(state),before);assert.equal(JSON.stringify(state.history),history);assert.deepEqual(liveScene(state),live);assert.equal(confirmCalls.length,0);
    assert.equal(stats.draws[0],0);assert.equal(stats.draws.at(-1),1);assert.equal(stats.stops,format==='video'?1:0);assert.equal(timers.size,0);assert.equal(listeners.get('visibilitychange')?.size||0,0);
    assert.match(motionNode('status').textContent,/已输出到画布/);assert.match(motionNode('first-field').innerHTML,/value="first" disabled/);
  });
  await checkAsync('closing during PNG encoding restores shared labels and never publishes late output',async()=>{
    const {state,surface,stats}=recorderFixture();api.stopMotionPreview();state.motionJob=null;
    motionNode('format').value='video';let release,disposed=0,saved=0;
    surface.canvas.toBlob=callback=>{release=callback;};surface.dispose=()=>{disposed++;};
    api.setCaptureSurface(()=>surface);state.host.motionCapture=async()=>{saved++;};
    state.renderer.dispose=()=>{};state.labels.forEach(label=>{label.remove=()=>{};});
    const before=serialized(state),result=api.exportMotion(),labels=nodes.get('#stage-labels');
    assert.equal(labels.hidden,true);assert.ok(release);click('close');
    assert.equal(labels.hidden,false);assert.equal(state.view.hidden,true);assert.equal(state.view.classList.contains('previewing'),false);
    release(new Blob(['png'],{type:'image/png'}));await settle(result);
    assert.equal(saved,0);assert.equal(stats.streams,0);assert.equal(disposed,1);assert.equal(serialized(state),before);
  });
  await checkAsync('export input guards never allocate a surface or call the host',async()=>{
    const {state}=motionSession();let allocations=0,saves=0;
    api.setCaptureSurface(()=>{allocations++;throw new Error('guard missed');});state.host.motionCapture=async()=>{saves++;};
    motionNode('format').value='frames';motionNode('first-field').value='same';motionNode('last-field').value='same';
    await api.exportMotion();assert.match(motionNode('status').textContent,/不同输入/);
    motionNode('first-field').value='';motionNode('last-field').value='';motionNode('target').value='workflow';
    await api.exportMotion();assert.match(motionNode('status').textContent,/请选择实际参考输入/);
    motionNode('target').value='';state.captureBusy=true;await api.exportMotion();state.captureBusy=false;
    state.motionJob={saving:true};await api.exportMotion();state.motionJob=null;
    state.mode2d=true;await api.exportMotion();assert.match(motionNode('status').textContent,/3D 模式/);
    assert.equal(allocations,0);assert.equal(saves,0);
  });
  api.setEditor(null);
  Object.values(api.geometries()).forEach(geometry=>geometry.dispose());
  for(const [file,loaded] of [['stage.js',stageSource],['index.html',html],['stage.css',stageCss]])assert.equal(fs.readFileSync(__dirname+'/'+file,'utf8'),loaded,`${file} changed during the checks; rerun against the finished source`);
  const stageHash=require('node:crypto').createHash('sha256').update(stageSource).digest('hex').slice(0,12);
  console.log(`Offline behavior checks: ${passed} passed, ${failures.length} failed, ${passed+failures.length} total; motion: ${passed-legacyPassed} passed, ${failures.length-legacyFailed} failed. Existing static checks passed. stage.js SHA256: ${stageHash}.`);
  assert.equal(failures.length,0,`${passed} behavior checks passed; failed: ${failures.join('; ')}`);
}
checkBehavior().catch(error=>{console.error(error);process.exitCode=1;});
