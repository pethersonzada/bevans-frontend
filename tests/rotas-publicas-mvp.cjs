const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {fixture}=require('./helpers/rotasPublicas.cjs'),{harness,nodes,find}=require('./helpers/excursoes.cjs');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Date,Error,Number,JSON,URLSearchParams,require:n=>{if(!(n in mocks))throw Error(n);return mocks[n];}});return exports;}
function startHarness(){
 const rota=fixture({publicada:true,horarioVolta:'23:59',dias:['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']});
 const data=load('src/services/dataOperacao.ts'),hoje=data.dataLocal();
 const points=[{tipo:'ORIGEM',paradaId:null,nome:rota.origemNome,latitude:rota.origemLatitude,longitude:rota.origemLongitude,passageiros:[]},{tipo:'PARADA',paradaId:21,nome:'Praça',latitude:-8.25,longitude:-35.95,passageiros:[{id:2,nome:'Pessoa teste',latitude:-8.25,longitude:-35.95}]},{tipo:'DESTINO',paradaId:null,nome:rota.destinoNome,latitude:rota.destinoLatitude,longitude:rota.destinoLongitude,passageiros:[]}];
 const state={rota,points,pedidos:[{id:3,rotaId:9,dataOperacao:hoje,sentido:'IDA',status:'APROVADO',paradaId:21}],status:{status:'INATIVA'},posts:0,calls:[],error:null};
 const roteiro=load('src/services/roteiroNavegacao.ts');
 const api={apiRequest:async(path,options)=>{state.calls.push({path,options});if(state.error)throw state.error;if(path.includes('/planejamento?'))return state.points.map(p=>({...p}));return {referenciaId:42,tipo:'VIAGEM',sentido:'IDA',contadores:{esperados:1},registros:[{alunoId:2,paradaId:21,ordem:1}]};}};
 const rotas={buscarRotaPublica:async()=>state.rota};
 const itinerary=load('src/services/itinerarioRotaPublica.ts',{'./rotasPublicas':rotas,'./enderecoReversoExcursao':{}});
 const m=load('src/services/inicioRotaPublica.ts',{'../config/api':api,'./rotasPublicas':rotas,'./embarques':{embarquesMotorista:async()=>state.pedidos},'./viagens':{consultarEstadoViagem:async()=>state.status,iniciarViagemPublica:async()=>{state.posts++;state.status={status:'ATIVA',viagemId:42,sentido:'IDA',modalidade:'PUBLICA',rotaPublicaId:9};}},'./roteiroOperacional':{consultarRoteiroOperacional:async()=>roteiro.validarRoteiroOperacional(state.points)},'./roteiroNavegacao':roteiro,'./itinerarioRotaPublica':itinerary,'./dataOperacao':data});
 return {m,state,rota};
}
test('revisão pública usa data, embarques aprovados e extremos públicos; início confirma identidade e snapshot',async()=>{
 const {m,state,rota}=startHarness();const r=await m.revisarInicioPublico(rota,'IDA');assert.equal(r.aprovados,1);assert.equal(r.pontos.length,3);const x=await m.iniciarTrechoPublico(r);assert.equal(x.viagemId,42);assert.equal(state.posts,1);assert.ok(state.calls.some(c=>c.path.includes('/embarques/planejamento?data=')));assert.ok(state.calls.every(c=>!c.path.includes('/rota/otimizar')));
});
test('aprovação ausente do roteiro, extremos trocados e estado ativo bloqueiam partida sem POST',async()=>{
 for(const mutate of [h=>h.state.points.splice(1,1),h=>h.state.points[0].latitude=-9,h=>h.state.status={status:'ATIVA',viagemId:5},h=>h.state.rota={...h.rota,nome:'Mudou'}]){
  const h=startHarness();mutate(h);await assert.rejects(h.m.revisarInicioPublico(h.rota,'IDA'));assert.equal(h.state.posts,0);
 }
});
test('mudança entre revisão e confirmação exige nova revisão e não inicia silenciosamente',async()=>{
 const h=startHarness(),r=await h.m.revisarInicioPublico(h.rota,'IDA');h.state.pedidos=[];await assert.rejects(h.m.iniciarTrechoPublico(r),/mudaram/);assert.equal(h.state.posts,0);
 r.data='2000-01-01';await assert.rejects(h.m.iniciarTrechoPublico(r),/dia operacional/);
});
test('snapshot público não aceita ID de outra publicação nem estado de viagem privada',async()=>{
 for(const patch of [{modalidade:'PRIVADA'},{rotaPublicaId:99},{sentido:'VOLTA'}]){
  const h=startHarness();h.state.status={status:'ATIVA',viagemId:42,sentido:'IDA',modalidade:'PUBLICA',rotaPublicaId:9,...patch};await assert.rejects(h.m.confirmarExecucaoPublica(h.rota,'IDA'));
 }
});
test('seleção do passageiro valida calendário, dia, horário, parada e pin permitido',()=>{
 const m=load('src/services/pedidoPublico.ts',{'./dataOperacao':load('src/services/dataOperacao.ts'),'./rotasPublicas':{pontoValido:(a,b)=>Number.isFinite(a)&&Math.abs(a)<=90&&Number.isFinite(b)&&Math.abs(b)<=180}}),rota=fixture({publicada:true});
 m.validarPedidoPublico(rota,'2026-11-20','IDA',21,null,new Date(2026,10,18));
 for(const [date,sentido,parada,pin] of [['2026-02-30','IDA',21,null],['2026-11-18','IDA',21,null],['2026-11-20','VOLTA',21,null],['2026-11-20','IDA',999,null],['2026-11-20','IDA',null,{nome:'Pin',latitude:1,longitude:2}]])assert.throws(()=>m.validarPedidoPublico(rota,date,sentido,parada,pin,new Date(2026,10,18)));
 m.validarPedidoPublico({...rota,modo:'FLEXIVEL'},'2026-11-20','IDA',null,{nome:'Ponto confirmado',latitude:-8,longitude:-35},new Date(2026,10,18));
});
test('cartão público exige revisão, serializa toques e navega com execução confirmada',async()=>{
 let writes=0,finish;const rota=fixture({publicada:true,horarioVolta:null}),review={rota,sentido:'IDA',data:'2026-11-18',pontos:[{nome:'Origem'},{nome:'Destino'}],aprovados:1};
 const h=harness('src/components/rotasPublicas/OperacaoRotaPublica.tsx',{resources:()=>({data:{status:'INATIVA'},reload(){}}),extras:{'../../services/inicioRotaPublica':{revisarInicioPublico:async()=>review,iniciarTrechoPublico:()=>{writes++;return new Promise(r=>finish=r);},confirmarExecucaoPublica:async()=>({viagemId:42,sentido:'IDA'})}}});
 const props={rota,bloqueada:false,offline:false};let t=h.render('OperacaoRotaPublica',props);assert.ok(JSON.stringify(t).includes('não tem horário'));assert.equal(find(t,'Confirmar início IDA'),undefined);find(t,'Revisar viagem IDA').props.onPress();await new Promise(setImmediate);t=h.render('OperacaoRotaPublica',props);const press=find(t,'Confirmar início IDA').props.onPress;press();press();assert.equal(writes,1);finish();await new Promise(setImmediate);assert.equal(h.paths[0].params.viagemId,'42');assert.equal(h.paths[0].params.modalidade,'PUBLICA');h.unmount();
});
test('início incerto bloqueia repetição até consulta oficial e mantém mensagem específica',async()=>{
 const rota=fixture({publicada:true}),review={rota,sentido:'IDA',pontos:[],aprovados:1};
 const h=harness('src/components/rotasPublicas/OperacaoRotaPublica.tsx',{resources:()=>({data:{status:'INATIVA'},reload(){}}),extras:{'../../services/inicioRotaPublica':{revisarInicioPublico:async()=>review,iniciarTrechoPublico:async()=>{throw Object.assign(Error('Resultado desconhecido'),{status:504});}}}});
 const props={rota,bloqueada:false,offline:false};find(h.render('OperacaoRotaPublica',props),'Revisar viagem IDA').props.onPress();await new Promise(setImmediate);find(h.render('OperacaoRotaPublica',props),'Confirmar início IDA').props.onPress();await new Promise(setImmediate);const t=h.render('OperacaoRotaPublica',props);assert.equal(find(t,'Confirmar início IDA').props.disabled,true);assert.ok(find(t,'Conferir início da rota'));assert.ok(JSON.stringify(t).includes('Resultado desconhecido'));h.unmount();
});
