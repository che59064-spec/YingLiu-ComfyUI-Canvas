// VM-only director exports: no browser, network, engine, or persisted canvas writes.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/app.js','utf8').split('boot().catch')[0];
const nodes=new Map();
function element(){return {dataset:{},style:{},innerHTML:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},querySelector:()=>null,querySelectorAll:()=>[]};}
const context={window:{},console,URL,Blob,crypto:require('node:crypto').webcrypto,location:{origin:'http://127.0.0.1:8766'},document:{activeElement:null,querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);},querySelectorAll:()=>[]},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},localStorage:{setItem(){throw new Error('Real persistence is forbidden');}}};
let calls=[],effects={},host;
context.fakeAPI=(path,options)=>{
  assert.ok(['/api/assets','/api/stage/video'].includes(path),'Only media uploads are allowed; never run/generate');
  assert.equal(options.method,'POST');assert.equal(options.timeoutMs,path==='/api/stage/video'?240000:120000);
  if(path==='/api/stage/video')assert.equal(options.headers['X-Duration'],'3');
  else assert.equal(options.headers['X-Duration'],undefined);
  const call={path,options};calls.push(call);
  return new Promise((resolve,reject)=>Object.assign(call,{resolve,reject}));
};
context.record=(name,value)=>{effects[name]=(effects[name]||0)+1;if(name==='select')context.window.check.state.selected=value;};
vm.createContext(context);
vm.runInContext(source+`\nwindow.check={state,openStage,captureStageImage,captureStageMotion,stageShotCards,renderStageCard,renderCard,drawInspector,normalizeProject,referenceSlotsHtml,clearReferenceInput,stageFieldOccupied};
api=fakeAPI;renderCards=()=>record('render');renderSingleCard=()=>record('single');renderInspector=()=>record('inspector');
selectCard=id=>record('select',id);projectChanged=()=>record('change');refreshMedia=()=>{record('refresh');return Promise.resolve();};toast=()=>record('toast');`,context,{filename:'app.js'});
const c=context.window.check,plain=value=>JSON.parse(JSON.stringify(value));
const png=()=>new Blob(['png'],{type:'image/png'}),video=(type='video/webm;codecs=vp9')=>new Blob(['video'],{type});
const frameItems=()=>[{blob:png(),role:'start'},{blob:png(),role:'end'}];
const videoItems=(type)=>[{blob:png(),role:'start'},{blob:video(type),role:'video'}];
const metadata=(extra={})=>({format:'frames',width:1280,height:720,duration:3,fps:24,targetWorkflow:'workflow',firstField:'first',lastField:'last',...extra});
function fixture(){
  calls=[];effects={};nodes.clear();host=null;
  const stage={id:'stage',type:'stage',name:'导演台',cover:'/api/assets/old.png',stage:{actors:[],cameras:[]},x:0,y:0};
  const workflow={id:'workflow',type:'workflow',name:'参考工作流',x:750,y:0,workflow:{nodes:[{id:1,widgets_values:[720,123456]}],links:[]},values:{duration:720,seed:123456},fields:[
    {id:'motion',label:'动作',nodeTitle:'视频输入',key:'video',type:'video',editable:true},
    {id:'first',label:'首帧',nodeTitle:'首帧输入',key:'image',type:'image',editable:true},
    {id:'last',label:'尾帧',nodeTitle:'尾帧输入',key:'image',type:'image'},
    {id:'locked',label:'只读',key:'image',type:'image',editable:false},
    {id:'duration',label:'时长',key:'duration',type:'integer',value:720}
  ]};
  const project={id:'canvas',cards:[stage,workflow],edges:[],viewport:{x:0,y:0,zoom:1}};
  Object.assign(c.state,{project,selected:null,canvasBusy:false,importing:false,jobs:[]});
  context.window.StageDirector={open(card,callbacks){assert.equal(card,stage);host=callbacks;}};
  return {project,stage,workflow};
}
function assetFor(index){
  const normalized=calls[index].path==='/api/stage/video';
  const filename=decodeURIComponent(calls[index].options.headers['X-Filename']),name=normalized?filename.replace(/\.(mp4|webm)$/i,'.mp4'):filename,extension=name.split('.').at(-1);
  return {id:`asset-${index}.${extension}`,url:`/api/assets/asset-${index}.${extension}`,name,type:extension==='png'?'image':'video'};
}
async function release(index,asset=assetFor(index)){calls[index].resolve(asset);await new Promise(setImmediate);return asset;}
async function complete(promise){await release(0);await release(1);return promise;}
function unchanged(project,snapshot){assert.equal(JSON.stringify(project),snapshot,'failed or pending export must not change cards, cover, values, or edges');assert.deepEqual(effects,{});}
let passed=0;
async function check(name,run){await run();passed++;console.log(`PASS ${name}`);}
async function run(){
  await check('host exposes editable field metadata, occupancy, and both capture callbacks',async()=>{
    const {stage,workflow,project}=fixture();workflow.values.first='existing.png';
    project.edges.push({id:'existing',from:'unavailable-source',to:workflow.id,fieldId:'motion'});
    project.cards.push({id:'image',type:'image',url:'/api/assets/a.png'},{id:'join',type:'join'});
    c.openStage(stage.id);
    assert.equal(typeof host.capture,'function');assert.equal(typeof host.motionCapture,'function');
    assert.deepEqual(plain(host.workflows()),[{id:'workflow',name:'参考工作流',fields:[
      {id:'motion',label:'动作',nodeTitle:'视频输入',type:'video',occupied:true},
      {id:'first',label:'首帧',nodeTitle:'首帧输入',type:'image',occupied:true},
      {id:'last',label:'尾帧',nodeTitle:'尾帧输入',type:'image',occupied:false}
    ]}]);
    project.edges=[];workflow.values.first='';assert.ok(host.workflows()[0].fields.every(field=>!field.occupied),'callback reads current occupancy');
    project.edges.push({id:'legacy',from:'image',to:workflow.id});
    assert.ok(host.workflows()[0].fields.every(field=>field.occupied),'unassigned legacy links cannot be silently displaced');
    c.state.project={...project,cards:[]};assert.deepEqual(plain(host.workflows()),[]);host.onChange();assert.deepEqual(effects,{});
    await assert.rejects(host.motionCapture(frameItems(),metadata()),/原画布或导演台/);assert.equal(calls.length,0);
  });
  for(const mime of ['video/mp4','video/webm;codecs=vp9'])await check(`${mime}: atomic upload, video-only binding, PNG cover, provenance and rendering`,async()=>{
    const {stage,workflow,project}=fixture(),original=JSON.stringify(project),workflowBefore=JSON.stringify(workflow);
    c.openStage(stage.id);const items=videoItems(mime),meta=metadata({format:'video',firstField:'motion',lastField:''});
    const promise=host.motionCapture(items,meta);
    assert.equal(calls.length,1);assert.equal(calls[0].options.body,items[0].blob);unchanged(project,original);
    const cover=await release(0);assert.equal(calls.length,2);unchanged(project,original);
    assert.equal(calls[1].options.body,items[1].blob);assert.equal(calls[1].options.headers['Content-Type'],mime);
    assert.ok(decodeURIComponent(calls[1].options.headers['X-Filename']).endsWith(mime==='video/mp4'?'.mp4':'.webm'));
    await release(1,{...assetFor(1),type:'stage'});const cards=await promise;
    assert.deepEqual(plain(cards.map(card=>card.type)),['image','video'],'server metadata cannot turn media into the stage itself');
    assert.equal(stage.type,'stage');assert.equal(project.cards[0],stage);assert.equal(stage.cover,cover.url);
    assert.equal(calls[0].path,'/api/assets');assert.equal(calls[1].path,'/api/stage/video');
    assert.match(cards[1].url,/\.mp4$/);assert.equal(cards[1].poster,cover.url);assert.equal(project.edges.length,1);
    assert.deepEqual(plain(project.edges[0]),{id:project.edges[0].id,from:cards[1].id,to:workflow.id,fieldId:'motion'});
    assert.ok(!project.edges.some(edge=>edge.from===cards[0].id),'video cover is never bound');
    for(const card of cards){assert.notEqual(card.id,stage.id);assert.deepEqual(plain(card.fromStage),{stageId:stage.id,role:card.type==='video'?'video':'start',width:1280,height:720,duration:3,fps:24});}
    assert.notDeepEqual([cards[0].x,cards[0].y],[cards[1].x,cards[1].y]);
    assert.equal(JSON.stringify(workflow),workflowBefore,'duration units, seed and original graph are untouched');
    assert.deepEqual(effects,{render:1,select:1,change:1,toast:1,refresh:1});
    assert.equal(c.state.selected,workflow.id);assert.match(c.renderStageCard(stage),/2 素材/);
    const cardHtml=c.renderCard(cards[1]);assert.match(cardHtml,/<video[^>]+poster=/);assert.doesNotMatch(cardHtml,/<img/);
    c.state.selected=stage.id;c.drawInspector();const inspector=nodes.get('#inspector').innerHTML;
    assert.match(inspector,/2 份素材/);assert.match(inspector,/<video/);assert.ok(!inspector.includes(`<img src="${cards[1].url}"`));
    c.state.selected=cards[1].id;c.drawInspector();assert.match(nodes.get('#inspector').innerHTML,/<video[^>]+poster=/);assert.doesNotMatch(nodes.get('#inspector').innerHTML,/<img/);
    const restored=c.normalizeProject(plain(project));assert.deepEqual(plain(restored.cards.at(-1).fromStage),plain(cards[1].fromStage));assert.equal(restored.cards.at(-1).poster,cover.url);
    project.cards.push({id:'not-media',type:'stage',fromStage:{stageId:stage.id}});assert.equal(c.stageShotCards(stage).length,2);
  });
  for(const [firstField,lastField,targetWorkflow] of [['first','last','workflow'],['first','','workflow'],['','last','workflow'],['','','workflow'],['','','']])await check(`frames optional bindings: ${firstField||'-'} / ${lastField||'-'} / ${targetWorkflow||'-'}`,async()=>{
    const {stage,project,workflow}=fixture(),before=JSON.stringify(workflow),items=frameItems().reverse();
    const cards=await complete(c.captureStageMotion(stage,items,metadata({firstField,lastField,targetWorkflow})));
    assert.equal(calls[0].options.body,items[1].blob,'roles, not array order, determine the cover and bindings');
    assert.deepEqual(plain(cards.map(card=>card.fromStage.role)),['start','end']);
    assert.deepEqual(plain(project.edges.map(edge=>[cards.find(card=>card.id===edge.from).fromStage.role,edge.fieldId])),[...(firstField?[['start',firstField]]:[]),...(lastField?[['end',lastField]]:[])]);
    assert.equal(stage.cover,cards[0].url);assert.equal(JSON.stringify(workflow),before);
    assert.equal(c.state.selected,firstField||lastField?'workflow':cards[1].id);
  });
  await check('unbound video still creates independent media and a PNG cover',async()=>{
    const {stage,project}=fixture();const cards=await complete(c.captureStageMotion(stage,videoItems(),metadata({format:'video',targetWorkflow:'',firstField:'',lastField:''})));
    assert.equal(project.edges.length,0);assert.equal(stage.cover,cards[0].url);assert.equal(cards[1].type,'video');
  });
  await check('import drops external or active video posters but preserves local covers',async()=>{
    const {project}=fixture();
    for(const poster of ['https://external.example/track.png','javascript:alert(1)',{url:'/assets/a.png'}]){
      const restored=c.normalizeProject({...plain(project),cards:[{id:'video',type:'video',url:'/assets/a.mp4',poster}]});
      assert.equal(restored.cards[0].poster,undefined);
    }
  });
  await check('explicitly clearing a template reference allows binding without changing the graph or files',async()=>{
    const {workflow,project}=fixture();c.state.selected=workflow.id;
    workflow.fields[1].value='template.png';const graph=JSON.stringify(workflow.workflow);
    assert.match(c.referenceSlotsHtml(workflow),/data-reference-clear="first"/);
    assert.equal(c.stageFieldOccupied(workflow,workflow.fields[1]),true);
    c.clearReferenceInput('first');assert.equal(workflow.values.first,'');
    assert.equal(workflow.fields[1].value,'template.png');assert.equal(c.stageFieldOccupied(workflow,workflow.fields[1]),false);
    assert.equal(JSON.stringify(workflow.workflow),graph);assert.equal(project.cards.length,2);assert.equal(calls.length,0);
    assert.deepEqual(effects,{single:1,inspector:1,change:1});assert.doesNotMatch(c.referenceSlotsHtml(workflow),/data-reference-clear="first"/);
    project.edges.push({id:'edge',from:'stage',to:'workflow',fieldId:'first'});
    assert.equal(c.stageFieldOccupied(workflow,workflow.fields[1]),true,'clearing input never removes an existing edge');
  });
  await check('clear input ignores unknown, read-only, empty and switching states',async()=>{
    const {workflow,project}=fixture();c.state.selected=workflow.id;workflow.fields[3].value='locked.png';
    const before=JSON.stringify(project);for(const id of ['missing','locked','first'])c.clearReferenceInput(id);unchanged(project,before);
    workflow.values.first='existing.png';const filled=JSON.stringify(project);
    c.state.canvasBusy=true;c.clearReferenceInput('first');c.state.canvasBusy=false;
    c.state.importing=true;c.clearReferenceInput('first');unchanged(project,filled);
  });
  const invalidCases=[
    ['missing target',()=>metadata({targetWorkflow:'missing'}),frameItems,/目标工作流/],
    ['stage as target',()=>metadata({targetWorkflow:'stage'}),frameItems,/目标工作流/],
    ['non-string target',()=>metadata({targetWorkflow:0}),frameItems,/目标工作流/],
    ['field without target',()=>metadata({targetWorkflow:''}),frameItems,/先选择目标工作流/],
    ['duplicate frame field',()=>metadata({lastField:'first'}),frameItems,/首帧和尾帧不能/],
    ['unknown field',()=>metadata({firstField:'missing'}),frameItems,/参考字段/],
    ['read-only field',()=>metadata({firstField:'locked'}),frameItems,/不可编辑/],
    ['wrong image type',()=>metadata({firstField:'motion'}),frameItems,/类型不匹配/],
    ['wrong video type',()=>metadata({format:'video',firstField:'first',lastField:''}),videoItems,/类型不匹配/],
    ['video tail binding',()=>metadata({format:'video',firstField:'motion'}),videoItems,/尾帧字段/],
    ['non-string field',()=>metadata({firstField:{id:'first'}}),frameItems,/参考字段无效/],
    ['unsupported format',()=>metadata({format:'gif'}),frameItems,/导出参数/],
    ['invalid width',()=>metadata({width:0}),frameItems,/导出参数/],
    ['fractional height',()=>metadata({height:12.5}),frameItems,/导出参数/],
    ['oversized width',()=>metadata({width:1282}),frameItems,/导出参数/],
    ['odd height',()=>metadata({height:719}),frameItems,/导出参数/],
    ['subsecond duration',()=>metadata({duration:.5}),frameItems,/导出参数/],
    ['excessive duration',()=>metadata({duration:30.1}),frameItems,/导出参数/],
    ['invalid duration',()=>metadata({duration:NaN}),frameItems,/导出参数/],
    ['zero duration',()=>metadata({duration:0}),frameItems,/导出参数/],
    ['unsupported fps',()=>metadata({fps:30}),frameItems,/帧率/],
    ['missing items',metadata,()=>[],/素材不完整/],
    ['duplicate roles',metadata,()=>[{role:'start',blob:png()},{role:'start',blob:png()}],/素材不完整/],
    ['wrong frame role',metadata,videoItems,/素材不完整/],
    ['missing end blob',metadata,()=>[{role:'start',blob:png()},{role:'end'}],/非空 PNG/],
    ['empty image',metadata,()=>[{role:'start',blob:new Blob([],{type:'image/png'})},{role:'end',blob:png()}],/非空 PNG/],
    ['JPEG frame',metadata,()=>[{role:'start',blob:new Blob(['jpg'],{type:'image/jpeg'})},{role:'end',blob:png()}],/非空 PNG/],
    ['fake blob',metadata,()=>[{role:'start',blob:{type:'image/png',size:3}},{role:'end',blob:png()}],/非空 PNG/],
    ['unsupported video MIME',()=>metadata({format:'video',firstField:'motion',lastField:''}),()=>videoItems('video/quicktime'),/MP4 或 WebM/],
    ['empty video',()=>metadata({format:'video',firstField:'motion',lastField:''}),()=>[{role:'start',blob:png()},{role:'video',blob:new Blob([],{type:'video/mp4'})}],/MP4 或 WebM/]
  ];
  for(const [label,meta,items,error] of invalidCases)await check(`pre-upload rejection: ${label}`,async()=>{
    const {stage,project}=fixture(),before=JSON.stringify(project);
    await assert.rejects(c.captureStageMotion(stage,items(),meta()),error);assert.equal(calls.length,0);unchanged(project,before);
  });
  for(const type of ['image','video','join'])await check(`target must not be ${type}`,async()=>{
    const {stage,project}=fixture();project.cards.push({id:'invalid',type});const before=JSON.stringify(project);
    await assert.rejects(c.captureStageMotion(stage,frameItems(),metadata({targetWorkflow:'invalid',firstField:'',lastField:''})),/目标工作流/);assert.equal(calls.length,0);unchanged(project,before);
  });
  for(const occupy of [
    ({project})=>project.edges.push({id:'existing',from:'missing-source',to:'workflow',fieldId:'first'}),
    ({project})=>project.edges.push({id:'legacy',from:'missing-source',to:'workflow'}),
    ({workflow})=>{workflow.values.last='already.png';},
    ({workflow})=>{workflow.fields[1].value='original.png';}
  ])await check('occupied references reject without replacing edges or values',async()=>{
    const f=fixture();occupy(f);const before=JSON.stringify(f.project);
    await assert.rejects(c.captureStageMotion(f.stage,frameItems(),metadata()),/已占用.*不会覆盖/);assert.equal(calls.length,0);unchanged(f.project,before);
  });
  for(const failAt of [0,1])await check(`upload ${failAt+1} failure leaves no partial canvas content`,async()=>{
    const {stage,project}=fixture(),before=JSON.stringify(project),pending=c.captureStageMotion(stage,frameItems(),metadata());
    const rejected=assert.rejects(pending,/上传失败/);
    if(failAt)await release(0);calls[failAt].reject(new Error('上传失败'));await rejected;
    assert.equal(calls.length,failAt+1);unchanged(project,before);
  });
  const mutations=[
    ['same-ID project replacement',f=>{c.state.project=plain(f.project);},/原画布或导演台/],
    ['stage removal',f=>{f.project.cards=f.project.cards.filter(card=>card!==f.stage);},/原画布或导演台/],
    ['same-ID stage replacement',f=>{f.project.cards[0]={...f.stage};},/原画布或导演台/],
    ['stage type change',f=>{f.stage.type='image';},/原画布或导演台/],
    ['stage ID change',f=>{f.stage.id='changed-stage';},/原画布或导演台/],
    ['canvas switch in progress',()=>{c.state.canvasBusy=true;},/原画布或导演台/],
    ['canvas import in progress',()=>{c.state.importing=true;},/原画布或导演台/],
    ['target removal',f=>{f.project.cards=f.project.cards.filter(card=>card!==f.workflow);},/目标工作流/],
    ['same-ID target replacement',f=>{f.project.cards[1]=plain(f.workflow);},/目标工作流/],
    ['target type change',f=>{f.workflow.type='stage';},/目标工作流/],
    ['field removal',f=>{f.workflow.fields=f.workflow.fields.filter(field=>field.id!=='last');},/参考字段/],
    ['field becomes read-only',f=>{f.workflow.fields[1].editable=false;},/不可编辑/],
    ['field type change',f=>{f.workflow.fields[2].type='video';},/类型不匹配/],
    ['field identity changes',f=>{f.workflow.fields[1].id='other';},/参考字段/],
    ['field becomes bound',f=>{f.project.edges.push({id:'new-edge',from:'other',to:'workflow',fieldId:'last'});},/已占用/],
    ['field value filled',f=>{f.workflow.values.first='new.png';},/已占用/]
  ];
  for(const after of [0,1])for(const [label,mutate,error] of mutations)await check(`revalidate after upload ${after+1}: ${label}`,async()=>{
    const f=fixture(),pending=c.captureStageMotion(f.stage,frameItems(),metadata()),rejected=assert.rejects(pending,error);
    if(after)await release(0);mutate(f);
    const before=JSON.stringify(f.project),activeBefore=JSON.stringify(c.state.project);
    await release(after);await rejected;
    assert.equal(calls.length,after+1,'abort before any further upload');unchanged(f.project,before);assert.equal(JSON.stringify(c.state.project),activeBefore);
  });
  await check('caller mutations cannot redirect an in-flight export',async()=>{
    const {stage,project}=fixture(),items=frameItems(),meta=metadata(),lastBlob=items[1].blob;
    const pending=c.captureStageMotion(stage,items,meta);Object.assign(meta,{targetWorkflow:'stage',firstField:'motion',width:1});items[1].role='video';items[1].blob=video();
    const cards=await complete(pending);assert.equal(calls[1].options.body,lastBlob);assert.equal(cards[0].fromStage.width,1280);
    assert.deepEqual(plain(project.edges.map(edge=>[edge.to,edge.fieldId])),[['workflow','first'],['workflow','last']]);
  });
  await check('concurrent exports revalidate occupancy rather than overwrite a winner',async()=>{
    const {stage,project}=fixture();const first=c.captureStageMotion(stage,frameItems(),metadata());
    const second=c.captureStageMotion(stage,frameItems(),metadata()),rejected=assert.rejects(second,/已占用/);
    await release(0);await release(2);await first;const before=JSON.stringify(project),beforeEffects={...effects};
    await release(1);await rejected;assert.equal(calls.length,3);assert.equal(JSON.stringify(project),before);assert.deepEqual(effects,beforeEffects);
  });
  await check('legacy screenshot callback still uploads PNG and binds the first image field',async()=>{
    const {stage,workflow,project}=fixture(),before=JSON.stringify(workflow);c.openStage(stage.id);
    const pending=host.capture(png(),{width:640,height:360,cameraId:'camera',targetWorkflow:'workflow'});assert.equal(calls.length,1);
    assert.equal(calls[0].options.headers['Content-Type'],'image/png');await release(0);const card=await pending;
    assert.equal(card.type,'image');assert.equal(card.fromStage.cameraId,'camera');assert.equal(stage.cover,card.url);
    assert.equal(project.edges[0].fieldId,'first');assert.equal(JSON.stringify(workflow),before);assert.equal(c.state.selected,'workflow');
  });
  await check('legacy screenshot without target remains independent',async()=>{
    const {stage,project}=fixture();const pending=c.captureStageImage(stage,png());await release(0);const card=await pending;
    assert.equal(project.edges.length,0);assert.equal(c.state.selected,card.id);
  });
  for(const [label,mutate,error] of mutations)await check(`legacy screenshot revalidation: ${label}`,async()=>{
    const f=fixture(),pending=c.captureStageImage(f.stage,png(),{targetWorkflow:'workflow'});
    // The screenshot binds only the first image field, so mutate that field for these cases.
    if(label==='field removal')f.workflow.fields=f.workflow.fields.filter(field=>field.id!=='first');
    else if(label==='field type change')f.workflow.fields[1].type='video';
    else if(label==='field becomes bound')f.project.edges.push({id:'new-edge',from:'other',to:'workflow',fieldId:'first'});
    else mutate(f);
    const rejected=assert.rejects(pending,error),before=JSON.stringify(f.project),activeBefore=JSON.stringify(c.state.project);
    await release(0);await rejected;unchanged(f.project,before);assert.equal(JSON.stringify(c.state.project),activeBefore);
  });
  await check('legacy screenshot rejects occupied input before uploading',async()=>{
    const {stage,project}=fixture();project.edges.push({id:'existing',from:'old',to:'workflow',fieldId:'first'});const before=JSON.stringify(project);
    await assert.rejects(c.captureStageImage(stage,png(),{targetWorkflow:'workflow'}),/已占用/);assert.equal(calls.length,0);unchanged(project,before);
  });
  console.log(`Stage media regression passed: ${passed} checks; VM only, no browser/network/generation/persistence.`);
}
run().catch(error=>{console.error(error);process.exitCode=1;});
