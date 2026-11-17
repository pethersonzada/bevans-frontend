const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,nodes,find,fixture}=require('./helpers/excursoes.cjs');
const tick=()=>new Promise(setImmediate);
const management='src/components/GestaoExcursao.tsx';
const preview=t=>nodes(t).find(n=>n.type==='MapPreview');
const model=()=>harness('src/services/mapaExcursao.ts').mod;

test('saved locations respect each collection mode and invert endpoints on return without inventing a passenger pin',()=>{
 const m=model(),e={...fixture(),origemNome:'Saída',origemLatitude:-8.3,origemLongitude:-35.3};
 for(const mode of ['MULTIPLAS_PARADAS','PARADA_UNICA','PORTA_A_PORTA']){
  const trip={...e,modoColeta:mode,paradas:mode==='PARADA_UNICA'?e.paradas.slice(0,1):e.paradas};
  const outbound=m.pontosSalvosExcursao(trip,'IDA'),inbound=m.pontosSalvosExcursao(trip,'VOLTA');
  assert.equal(outbound.length,mode==='PORTA_A_PORTA'?2:mode==='PARADA_UNICA'?3:4);
  assert.equal(outbound[0].latitude,e.origemLatitude);assert.equal(inbound[0].latitude,e.destinoLatitude);
  assert.equal(inbound.at(-1).tipo,'DESTINO');assert.equal(inbound.at(-1).latitude,e.origemLatitude);
 }
 assert.equal(m.pontosSalvosExcursao({...e,origemLatitude:null,origemLongitude:null,modoColeta:'PORTA_A_PORTA'},'IDA').length,1);
});

test('planning rejects malformed or out-of-range coordinates and strips private participants',()=>{
 const m=model(),p={paradaId:1,nome:'Ponto',latitude:-8,longitude:-35,tipo:'COLETA',participantes:[{nome:'privado'}]};
 for(const invalid of [null,{},[null],[{...p,latitude:NaN}],[{...p,longitude:Infinity}],[{...p,latitude:'-8'}],[{...p,latitude:91}],[{...p,longitude:181}],[{...p,latitude:0,longitude:0}],[{...p,nome:''}],[{...p,paradaId:-1}]])assert.throws(()=>m.validarPontosPlanejamento(invalid));
 assert.equal(m.validarPontosPlanejamento([p])[0].participantes,undefined);
 assert.equal(m.validarPontosPlanejamento([]).length,0);
 assert.equal(m.coordenadasMapaValidas(0,-35),true);assert.equal(m.coordenadasMapaValidas(-8,0),true);
});

test('the map is mounted before planning, during loading, after a 409 and after an empty response',async()=>{
 let finish,reject;let calls=0;
 const h=harness(management,{services:{planejarExcursao:()=>{calls++;return new Promise((resolve,fail)=>{finish=resolve;reject=fail;});}}});
 const p={id:7,secao:'roteiro',excursao:fixture()};
 let t=h.render('GestaoExcursao',p);assert.equal(calls,0);assert.equal(preview(t).props.pontos.length,3);
 find(t,'Ver sequência dos pontos').props.onPress();t=h.render('GestaoExcursao',p);assert.equal(preview(t).props.pontos.length,3);assert.ok(nodes(t).some(n=>n.props?.title==='Consultando planejamento…'));
 reject(Object.assign(Error('Há participante confirmado sem parada ativa.'),{status:409,code:'ROTEIRO_INCONSISTENTE'}));await tick();
 t=h.render('GestaoExcursao',p);assert.equal(preview(t).props.pontos.length,3);assert.match(JSON.stringify(t),/ROTEIRO_INCONSISTENTE/);assert.match(JSON.stringify(t),/HTTP 409/);assert.match(JSON.stringify(t),/participante confirmado sem parada/);
 find(t,'Ver sequência dos pontos').props.onPress();finish([]);await tick();t=h.render('GestaoExcursao',p);assert.equal(preview(t).props.pontos.length,3);assert.match(JSON.stringify(t),/Nenhum ponto retornado/);
 h.unmount();
});

test('server points replace saved locations only on success and a version change invalidates that preview',async()=>{
 const server=[{paradaId:null,nome:'Destino',latitude:-8,longitude:-35,tipo:'DESTINO'}];
 const h=harness(management,{services:{planejarExcursao:async()=>server}}),e=fixture(),p={id:7,secao:'roteiro',excursao:e};
 let t=h.render('GestaoExcursao',p);find(t,'Ver sequência dos pontos').props.onPress();await tick();t=h.render('GestaoExcursao',p);assert.equal(preview(t).props.pontos,server);
 t=h.render('GestaoExcursao',{...p,excursao:{...e,versao:2}});assert.equal(preview(t).props.pontos.length,3);assert.match(JSON.stringify(t),/ainda não foi confirmado/);h.unmount();
});

test('independent native preview initializes its token and renders with zero or invalid points; loading failures can retry',()=>{
 let initialized;
 const mapbox={MapView:'NativeMap',Camera:'Camera',PointAnnotation:'Annotation',StyleURL:{Dark:'dark'},setAccessToken:v=>initialized=v};
 const h=harness('src/components/MapaPreviaPublica.tsx',{env:{EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN:'public-test'},extras:{'@rnmapbox/maps':{__esModule:true,default:mapbox}}});
 let t=h.render('default',{pontos:[]});assert.equal(initialized,'public-test');let map=nodes(t).find(n=>n.type==='NativeMap');assert.ok(map);assert.equal(nodes(t).filter(n=>n.type==='Annotation').length,0);
 map.props.onMapLoadingError();t=h.render('default',{pontos:[]});assert.ok(find(t,'Recarregar mapa'));find(t,'Recarregar mapa').props.onPress();t=h.render('default',{pontos:[]});map=nodes(t).find(n=>n.type==='NativeMap');map.props.onDidFinishLoadingMap();map.props.onDidFinishRenderingMapFully();
 t=h.render('default',{pontos:[{nome:'Inválido',latitude:200,longitude:0},{nome:'Destino',latitude:-8,longitude:-35,paradaId:null,tipo:'DESTINO'}]});assert.equal(nodes(t).filter(n=>n.type==='Annotation').length,1);assert.match(JSON.stringify(t),/coordenadas inválidas/);assert.equal(find(t,'Recarregar mapa'),undefined);h.unmount();
});

test('missing token is reported separately from the absence of points',()=>{
 const h=harness('src/components/MapaPreviaPublica.tsx',{env:{}}),t=h.render('default',{pontos:[]});
 assert.match(JSON.stringify(t),/token do Mapbox/);assert.match(JSON.stringify(t),/Nenhum ponto/);assert.equal(nodes(t).some(n=>n.type==='NativeMap'),false);h.unmount();
});

test('camera bounds are applied after native loading and update for changed and single saved points',()=>{
 const mapbox={MapView:'NativeMap',Camera:'Camera',PointAnnotation:'Annotation',StyleURL:{Dark:'dark'},setAccessToken(){}};
 const h=harness('src/components/MapaPreviaPublica.tsx',{env:{EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN:'public-test'},extras:{'@rnmapbox/maps':{__esModule:true,default:mapbox}}});
 const points=[{paradaId:null,nome:'Origem',latitude:-8.3,longitude:-35.3},{paradaId:null,nome:'Destino',latitude:-8,longitude:-35}];
 let t=h.render('default',{pontos:points}),bounds=[],centers=[];
 nodes(t).find(n=>n.type==='Camera').props.ref.current={fitBounds:(...args)=>bounds.push(args),setCamera:args=>centers.push(args)};
 assert.equal(bounds.length,0);nodes(t).find(n=>n.type==='NativeMap').props.onDidFinishLoadingMap();assert.equal(bounds.length,1);
 assert.equal(bounds[0][0][0],-35);assert.equal(bounds[0][1][1],-8.3);
 t=h.render('default',{pontos:[points[1]]});assert.equal(centers.length,1);assert.equal(centers[0].centerCoordinate[0],-35);h.unmount();
});

test('planning transport sends the direction, optimization flag and cancellation signal, validating the actual response',async()=>{
 let response,request;
 const h=harness('src/services/excursoes.ts',{extras:{'../config/api':{
  apiFetch:async(path,options)=>{request={path,options};return {status:200};},
  readApiJson:async()=>response,
 }}}),controller=new AbortController();
 response=[{tipo:'ORIGEM',paradaId:null,nome:'Saída',latitude:-8.3,longitude:-35.3},{tipo:'COLETA',paradaId:1,nome:'Parada',latitude:-8.2,longitude:-35.2},{tipo:'DESTINO',paradaId:null,nome:'Destino',latitude:-8,longitude:-35}];
 const points=await h.mod.planejarExcursao(7,'IDA',false,controller.signal);
 assert.equal(request.path,'/excursoes/7/planejamento?sentido=IDA&otimizar=false');assert.equal(request.options.method,'POST');assert.equal(request.options.signal,controller.signal);assert.equal(points.length,3);
 response=[{nome:'Inválido',latitude:null,longitude:-35}];await assert.rejects(h.mod.planejarExcursao(7,'VOLTA',true),/pontos inválidos/);
 assert.equal(request.path,'/excursoes/7/planejamento?sentido=VOLTA&otimizar=true');
});

test('a request cancelled after leaving and returning to the same excursion cannot replace current locations',async()=>{
 let finish,signal;const h=harness(management,{services:{planejarExcursao:(_id,_direction,_optimize,s)=>{signal=s;return new Promise(r=>finish=r);}}}),p={id:7,secao:'roteiro',excursao:fixture()};
 find(h.render('GestaoExcursao',p),'Ver sequência dos pontos').props.onPress();
 h.render('GestaoExcursao',{...p,id:8,excursao:{...p.excursao,id:8}});assert.equal(signal.aborted,true);
 h.render('GestaoExcursao',p);finish([{nome:'Resposta antiga',latitude:-8,longitude:-35,paradaId:null}]);await tick();
 assert.equal(preview(h.render('GestaoExcursao',p)).props.pontos.length,3);h.unmount();
});
