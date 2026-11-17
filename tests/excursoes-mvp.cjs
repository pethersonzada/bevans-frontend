const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,nodes,find,fixture}=require('./helpers/excursoes.cjs');
const point={paradaId:null,tipo:'DESTINO',nome:'Destino de teste',latitude:-8,longitude:-35};
const execution=(patch={})=>({id:30,excursaoId:7,sentido:'IDA',estado:'EM_ANDAMENTO',pontos:[point],...patch});
function service(get){return harness('src/services/excursoes.ts',{extras:{'../config/api':{apiRequest:get}}}).mod;}

test('invitation emission reads the actual nested backend DTO and rejects missing metadata',async()=>{
 let result={convite:{id:41},token:'synthetic'},writes=0;
 const s=service(async()=>{writes++;return result;});
 const expiry=new Date(Date.now()+3600000).toISOString(),departure=new Date(Date.now()+7200000).toISOString();
 assert.equal((await s.criarConviteExcursao(7,expiry,departure)).id,41);
 result={id:41,token:'synthetic'};await assert.rejects(s.criarConviteExcursao(7,expiry,departure),/Convite não confirmado/);assert.equal(writes,2);
});

test('stop writes normalize clock/text and compare all persisted fields, including order and instructions',async()=>{
 const e=fixture(),stops=e.paradas.map(p=>({...p,nome:' '+p.nome+' ',horario:'09:30',instrucoes:' Encontrar na praça '}));
 let response,body;const s=service(async(_path,opts)=>{body=JSON.parse(opts.body);return response;});
 response={...e,paradas:stops.map(p=>({...p,nome:p.nome.trim(),horario:'09:30:00',instrucoes:p.instrucoes.trim()}))};
 await s.salvarColetaExcursao(7,'MULTIPLAS_PARADAS',1,stops);assert.equal(body.paradas[0].horario,'09:30:00');assert.equal(body.paradas[0].pontoConfirmado,true);
 response={...response,paradas:[{...response.paradas[0],instrucoes:'Diferente'},response.paradas[1]]};
 await assert.rejects(s.salvarColetaExcursao(7,'MULTIPLAS_PARADAS',1,stops),/dados das paradas/);
});

test('saving is confirmed only by a subsequent GET of the same version, locations, times and capacity',async()=>{
 const e=fixture();let read=e,paths=[];const s=service(async p=>{paths.push(p);return read;});
 assert.equal((await s.confirmarPersistenciaExcursao(7,e)).versao,1);assert.deepEqual(paths,['/excursoes/7']);
 for(const altered of [{versao:2},{capacidade:15},{retornoEm:new Date(Date.now()+86400000*7).toISOString()},{paradas:[...e.paradas].reverse()},{destinoLatitude:-9}]){
  read={...e,...altered};await assert.rejects(s.confirmarPersistenciaExcursao(7,e),/não corresponde/);
 }
});

test('failed read after an accepted stop write retries verification without duplicating the PUT',async()=>{
 const e=fixture();let writes=0,reads=0,fail=true,completed=0;
 const h=harness('src/components/excursoes/PlanejarExcursao.tsx',{services:{
  salvarColetaExcursao:async(_id,mode,_version,stops)=>{writes++;return {...e,versao:2,modoColeta:mode,paradas:stops};},
  confirmarPersistenciaExcursao:async(_id,expected)=>{reads++;if(fail)throw Error('Leitura indisponível');return expected;},
 }}),p={initial:e,initialMoment:'Pontos',onClose(){},onPersisted(){},onSaved:async()=>completed++};
 let t=h.render('PlanejarExcursao',p);find(t,'Mover ponto 1 abaixo').props.onPress();find(h.render('PlanejarExcursao',p),'Continuar').props.onPress();
 await assert.rejects(find(h.render('PlanejarExcursao',p),'Salvar alterações').props.action(),/Leitura/);assert.equal(completed,0);assert.equal(writes,1);
 fail=false;await find(h.render('PlanejarExcursao',p),'Conferir salvamento').props.action();assert.equal(writes,1);assert.equal(reads,2);assert.equal(completed,1);h.unmount();
});

test('execution validation rejects another excursion, direction, state, empty points or invalid coordinates',()=>{
 const s=service(async()=>{});
 assert.equal(s.validarExecucaoExcursao(execution(),7,'IDA').id,30);
 for(const patch of [{id:0},{excursaoId:8},{sentido:'VOLTA'},{estado:'INICIANDO'},{pontos:[]},{pontos:[{...point,latitude:NaN}]}])assert.throws(()=>s.validarExecucaoExcursao(execution(patch),7,'IDA'));
});

test('known start prerequisites distinguish drafts, ended states, missing return and sequential directions without requiring a future departure',()=>{
 const m=harness('src/services/excursaoValidacao.ts').mod,e=fixture();
 assert.equal(m.impedimentoInicioExcursao({...e,partidaEm:'2020-01-01T10:00:00Z'},'IDA',[]),null);
 for(const state of ['RASCUNHO','CANCELADA','CONCLUIDA'])assert.ok(m.impedimentoInicioExcursao({...e,estado:state},'IDA',[]));
 assert.match(m.impedimentoInicioExcursao(e,'VOLTA',[]).mensagem,/Finalize a ida/);
 assert.equal(m.impedimentoInicioExcursao(e,'VOLTA',[execution({estado:'FINALIZADA'})]).etapa,'Datas');
 assert.equal(m.impedimentoInicioExcursao({...e,retornoEm:new Date(Date.now()+86400000*7).toISOString()},'VOLTA',[execution({estado:'FINALIZADA'})]).etapa,'Destino');
 assert.equal(m.impedimentoInicioExcursao({...e,retornoEm:new Date(Date.now()+86400000*7).toISOString(),origemLatitude:-8.3,origemLongitude:-35.3},'VOLTA',[execution({estado:'FINALIZADA'})]),null);
 assert.ok(m.impedimentoInicioExcursao(e,'IDA',null));
});



test('HTTP 400, 401, 403, 409 and 500 are propagated from execution requests without announcing success',async()=>{
 for(const status of [400,401,403,409,500]){
  const error=Object.assign(Error('Motivo original'),{status,code:status===409?'EXECUCAO_ATIVA':undefined});const s=service(async()=>{throw error;});
  await assert.rejects(s.iniciarExcursao(7,'IDA'),e=>e===error);await assert.rejects(s.finalizarExcursao(7,30),e=>e===error);
 }
});

test('date validation rejects impossible calendar dates and preserves the local offset instant',()=>{
 const m=harness('src/services/excursaoFormulario.ts').mod,now=Date.parse('2026-01-01T00:00:00Z');
 for(const date of ['2026-02-30T10:00:00-03:00','2026-04-31T10:00:00Z','2026-13-01T10:00:00Z','2026-11-20T24:15:00Z'])assert.throws(()=>m.validarDatasExcursao(date,null,2,now));
 assert.doesNotThrow(()=>m.validarDatasExcursao('2026-11-20T09:00:00-03:00','2026-11-20T13:00:00Z',2,now));
 assert.throws(()=>m.validarDatasExcursao('2026-11-20T09:00:00-03:00','2026-11-20T11:00:00Z',2,now),/retorno/);
});

test('map selection identifies an actual intermediate point and opens its editor without adding coordinates',()=>{
 let edited;const camera=[];
 const mapbox={MapView:'NativeMap',Camera:'Camera',PointAnnotation:'Annotation',StyleURL:{Dark:'dark'},setAccessToken(){}};
 const h=harness('src/components/MapaPreviaPublica.tsx',{env:{EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN:'public-test'},extras:{'@rnmapbox/maps':{__esModule:true,default:mapbox}}}),points=[{...point,tipo:'ORIGEM'},{...point,tipo:'COLETA',paradaId:1},{...point,tipo:'DESTINO'}],p={pontos:points,onEditarPonto:(point,index)=>edited={point,index}};
 let t=h.render('default',p);nodes(t).find(n=>n.type==='Camera').props.ref.current={setCamera:position=>camera.push(position)};
 nodes(t).filter(n=>n.type==='Annotation')[1].props.onSelected();t=h.render('default',p);find(t,'Editar ponto selecionado').props.onPress();
 assert.equal(edited.point,points[1]);assert.equal(edited.index,1);assert.equal(camera[0].centerCoordinate[0],points[1].longitude);h.unmount();
});

test('changing wizard steps resets the scroll container while preserving the same draft',()=>{
 const h=harness('src/components/excursoes/PlanejarExcursao.tsx'),p={initial:fixture(),onClose(){},onPersisted(){},onSaved:async()=>{}};
 let t=h.render('PlanejarExcursao',p);const previous=t.key;find(t,'Título da excursão').props.onChangeText('Nome preservado');find(h.render('PlanejarExcursao',p),'Continuar').props.onPress();t=h.render('PlanejarExcursao',p);assert.notEqual(t.key,previous);find(t,'Etapa anterior').props.onPress();assert.equal(find(h.render('PlanejarExcursao',p),'Título da excursão').props.value,'Nome preservado');h.unmount();
});
