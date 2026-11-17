// Integration runner: uses real frontend services and only resources created by this run.
// Credentials stay in environment/memory. Reports contain statuses and counts, never pins/tokens.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
require('dotenv').config({quiet:true});
const output=path.resolve('.expo/mvp-excursoes');fs.mkdirSync(output,{recursive:true});
const resourcesFile=path.join(output,'recursos.json'),reportFile=path.join(output,'http.json');
const phase=process.argv[2]||'preparar';
const results=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):[];
const record=(step,details={})=>{const r={at:new Date().toISOString(),step,...details};results.push(r);fs.writeFileSync(reportFile,JSON.stringify(results,null,2));console.log(JSON.stringify(r));};
const assert=(value,message)=>{if(!value)throw Error(message);};
const auth={currentUser:null,authStateReady:async()=>{}};
const modules=new Map();
function load(file){
 file=path.resolve(file);if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);
 const requireLocal=name=>{
  if(name.endsWith('/firebase'))return {auth};
  if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name)+'.ts');
  throw Error('Unexpected dependency in integration runner');
 };
 const observedFetch=async(url,options)=>{
  const response=await fetch(url,options);
  const target=new URL(url);if(!target.hostname.endsWith('mapbox.com')&&!target.hostname.endsWith('geoapify.com'))record('HTTP',{method:options?.method||'GET',path:target.pathname.replace(/\d+/g,'{id}'),status:response.status});
  return response;
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:requireLocal,process,fetch:observedFetch,Headers,Response,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,Date,Number,Error,console,__DEV__:false});
 return exports;
}
const api=load('src/config/api.ts'),service=load('src/services/excursoes.ts'),operations=load('src/services/operacoes.ts');
let owned=[];
function remember(e){const index=owned.findIndex(x=>x.id===e.id);const entry={id:e.id,mode:e.modoColeta};if(index<0)owned.push(entry);else owned[index]=entry;fs.writeFileSync(resourcesFile,JSON.stringify(owned,null,2));}
async function verify(e,label){const read=await service.confirmarPersistenciaExcursao(e.id,e);record(label,{mode:read.modoColeta,stops:read.paradas.length,version:read.versao});remember(read);return read;}
async function conflict(task,label){try{await task();throw Error('Expected conflict was not returned');}catch(e){assert(e.status===409,'Expected HTTP 409: '+label);record(label,{status:e.status,code:e.code||null,message:e.message});}}
async function publicRequest(endpoint,headers,body){return api.apiRequest(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});}

async function prepare(){
 assert(!fs.existsSync(resourcesFile),'A run already exists. Use completar or inspect the existing test resources; no duplicate creation was attempted.');
 const search=load('src/services/enderecoSearch.ts');const points=[];
 for(const term of ['Marco Zero Recife Pernambuco','Praça do Arsenal Recife Pernambuco','Parque Treze de Maio Recife Pernambuco']){
  const found=await search.pesquisarEnderecos(term);const point=found.find(p=>p.tipo==='estabelecimento');
  assert(point,'A public POI was not confirmed by the search provider. No coordinate was fabricated.');
  points.push({nome:point.nome.slice(0,120),latitude:point.latitude,longitude:point.longitude});
 }
 const departure=new Date(Date.now()+3*86400000).toISOString(),returnAt=new Date(Date.now()+4*86400000).toISOString();
 for(const mode of ['PORTA_A_PORTA','PARADA_UNICA','MULTIPLAS_PARADAS']){
  let e=await service.salvarExcursao(null,{titulo:'TESTE MVP EXCURSOES '+mode+' '+Date.now(),origemNome:points[0].nome,origemLatitude:points[0].latitude,origemLongitude:points[0].longitude,destinoNome:points[1].nome,destinoLatitude:points[1].latitude,destinoLongitude:points[1].longitude,partidaEm:departure,retornoEm:returnAt,capacidade:2});
  remember(e);e=await verify(e,'criar-e-reabrir');
  await conflict(()=>service.iniciarExcursao(e.id,'IDA'),'inicio-rascunho');
  if(mode!=='PORTA_A_PORTA'){
   const stop=(i)=>({...points[i],id:null,horario:'09:30',instrucoes:'Ponto público para teste funcional',pontoConfirmado:true});
   e=await verify(await service.salvarColetaExcursao(e.id,'PARADA_UNICA',e.versao,[stop(0)]),'uma-parada-persistida');
   if(mode==='MULTIPLAS_PARADAS'){
    e=await verify(await service.salvarColetaExcursao(e.id,mode,e.versao,[e.paradas[0],stop(2)]),'adicionar-segunda-parada');
    e=await verify(await service.salvarColetaExcursao(e.id,mode,e.versao,[...e.paradas,stop(1)]),'adicionar-terceira-parada');
    e=await verify(await service.salvarColetaExcursao(e.id,mode,e.versao,[...e.paradas].reverse()),'reordenar-e-reabrir');
    e=await verify(await service.salvarColetaExcursao(e.id,mode,e.versao,e.paradas.map((p,i)=>i===0?{...p,nome:'Ponto público revisado de teste',instrucoes:'Descrição revisada',horario:'10:00'}:p)),'editar-nome-horario-instrucoes');
    e=await verify(await service.salvarColetaExcursao(e.id,mode,e.versao,e.paradas.slice(0,2)),'remover-e-reabrir');
   }else{
    e=await verify(await service.salvarColetaExcursao(e.id,'PORTA_A_PORTA',e.versao,[]),'troca-modo-sem-paradas-orfãs');
    e=await verify(await service.salvarColetaExcursao(e.id,mode,e.versao,[stop(2)]),'restaurar-parada-unica');
   }
  }
  const oldVersion=e.versao;e=await service.salvarExcursao(e.id,{...e,titulo:e.titulo+' revisado'});e=await verify(e,'atualizar-dados-e-reabrir');
  await conflict(()=>service.acaoExcursao(e.id,'publicacao',oldVersion),'versao-desatualizada');
  e=await verify(await service.acaoExcursao(e.id,'publicacao',e.versao),'publicar-e-reabrir');
  await conflict(()=>service.iniciarExcursao(e.id,'VOLTA'),'volta-antes-da-ida');
  const invite=await service.criarConviteExcursao(e.id,new Date(Date.now()+86400000).toISOString(),e.partidaEm);
  assert(Number.isSafeInteger(invite.id)&&!!invite.token,'The invitation response did not match the frontend contract');record('convite-servidor',{mode});
  const credentials=await publicRequest('/publico/excursoes/credenciais',{'X-Convite':invite.token});
  const payload={nome:'Participante fictício MVP',contato:'mvp-'+e.id+'@example.invalid',aceitePrivacidade:true,...(mode==='PORTA_A_PORTA'?{nomePonto:points[2].nome,latitude:points[2].latitude,longitude:points[2].longitude,pontoConfirmado:true}:{paradaId:e.paradas[0].id})};
  const registration=await publicRequest('/publico/excursoes/inscricoes',{'X-Convite':invite.token,'X-Inscricao':credentials.token},payload);
  assert(registration.estado==='SOLICITADA','The registration was not pending');await service.confirmarParticipante(e.id,registration.id);
  const participants=await service.participantesExcursao(e.id,0);assert(participants.itens.some(p=>p.id===registration.id&&p.estado==='CONFIRMADA'),'Participant confirmation was not persisted');record('participante-confirmado',{mode,count:participants.itens.length});
  const ida=await service.planejarExcursao(e.id,'IDA',false),volta=await service.planejarExcursao(e.id,'VOLTA',false);
  assert(ida[0].latitude===e.origemLatitude&&ida.at(-1).longitude===e.destinoLongitude,'Outbound endpoints differ from saved data');
  assert(volta[0].longitude===e.destinoLongitude&&volta.at(-1).latitude===e.origemLatitude,'Return endpoints differ from saved data');
  if(mode!=='PORTA_A_PORTA')assert(JSON.stringify(ida.filter(p=>p.paradaId!=null).map(p=>p.paradaId))===JSON.stringify(e.paradas.map(p=>p.id)),'Saved stop order differs from planning');
  record('planejamento-ida-volta',{mode,outbound:ida.length,inbound:volta.length,coordinatesValid:true});
  await service.revogarConviteExcursao(e.id,invite.id);const invites=await service.convitesExcursao(e.id);assert(invites.find(c=>c.id===invite.id)?.revogadoEm,'Invitation revocation was not persisted');record('convite-revogado',{mode});
 }
 record('preparacao-concluida',{newExcursions:owned.length});
}
async function complete(){
 owned=JSON.parse(fs.readFileSync(resourcesFile,'utf8'));
 for(const entry of owned.filter(x=>!process.env.BEVANS_TEST_MODES||process.env.BEVANS_TEST_MODES.split(',').includes(x.mode))){
  let e=await service.buscarExcursao(String(entry.id));assert(e.titulo.startsWith('TESTE MVP EXCURSOES '),'Resource is not owned by this test run');
  for(const direction of ['IDA','VOLTA']){
   const previous=(await service.listarExecucoes(e.id)).find(x=>x.sentido===direction);
   if(previous?.estado==='FINALIZADA'){record('execucao-ja-validada',{mode:entry.mode,direction});continue;}
   let x=previous;
   if(!x){const [a,b]=await Promise.all([service.iniciarExcursao(e.id,direction),service.iniciarExcursao(e.id,direction)]);assert(a.id===b.id,'Repeated start created different execution IDs');x=await service.buscarExecucaoExcursao(e.id,a.id);record('inicio-confirmado-e-idempotente',{mode:entry.mode,direction,points:x.pontos.length});}
   const operation=await operations.consultarOperacao('EXCURSAO',String(x.id),true);assert(operation.registros.length>0,'The operation has no authorized participant');
   for(let passenger of operation.registros){
    if(passenger.estado==='AGUARDANDO')passenger=await operations.alterarEstadoOperacional('EXCURSAO',String(x.id),passenger,true,'EMBARCADO');
    if(passenger.estado==='EMBARCADO'){
     await conflict(()=>service.finalizarExcursao(e.id,x.id),'finalizacao-com-pessoa-na-van');
     await operations.alterarEstadoOperacional('EXCURSAO',String(x.id),passenger,true,'DESEMBARCADO');
    }
   }
   const final=await operations.consultarOperacao('EXCURSAO',String(x.id),true);assert(final.contadores.naVan===0,'Someone is still onboard');
   await service.finalizarExcursao(e.id,x.id);assert((await service.buscarExecucaoExcursao(e.id,x.id)).estado==='FINALIZADA','The final state was not persisted');record('embarque-desembarque-finalizacao',{mode:entry.mode,direction,disembarked:final.contadores.desembarcados});
  }
  e=await service.buscarExcursao(String(e.id));assert(e.estado==='CONCLUIDA','The round trip is not completed');await conflict(()=>service.iniciarExcursao(e.id,'IDA'),'reinicio-apos-conclusao');record('ida-volta-concluidas',{mode:entry.mode});
 }
}
async function audit(){
 owned=JSON.parse(fs.readFileSync(resourcesFile,'utf8'));
 for(const entry of owned){
  const e=await service.buscarExcursao(String(entry.id));assert(e.titulo.startsWith('TESTE MVP EXCURSOES '),'Resource is not owned by this run');
  const executions=await service.listarExecucoes(e.id);
  for(const x of executions){const operation=await operations.consultarOperacao('EXCURSAO',String(x.id),true);record('auditoria-operacao',{mode:entry.mode,direction:x.sentido,state:x.estado,points:x.pontos.length,expected:operation.contadores.esperados,onboard:operation.contadores.naVan,disembarked:operation.contadores.desembarcados});}
  assert(e.estado==='CONCLUIDA'&&executions.length===2&&executions.every(x=>x.estado==='FINALIZADA'),'A test round trip is not finalized');record('estado-final-confirmado',{mode:entry.mode,state:e.estado});
 }
 const base=load('src/config/config.ts').API_URL;
 const anonymous=await fetch(base+'/excursoes/'+owned[0].id);assert(anonymous.status===401,'Unauthenticated access was not rejected');record('acesso-sem-sessao',{status:anonymous.status});
 if(process.env.BEVANS_TEST_PASSENGER_EMAIL){
  const login=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+process.env.EXPO_PUBLIC_FIREBASE_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.BEVANS_TEST_PASSENGER_EMAIL,password:process.env.BEVANS_TEST_PASSWORD,returnSecureToken:true})});
  const session=await login.json();assert(login.ok,'The authorized passenger account failed authentication');
  const forbidden=await fetch(base+'/excursoes/'+owned[0].id,{headers:{Authorization:'Bearer '+session.idToken}});assert(forbidden.status===403,'Passenger access to the private excursion was not rejected');record('acesso-passageiro',{status:forbidden.status});
 }
}
async function limits(){
 const manifest=path.join(output,'limites.json');
 assert(!fs.existsSync(manifest),'The limits run already exists; no duplicate excursion was created.');
 const seed=await service.buscarExcursao(String(JSON.parse(fs.readFileSync(resourcesFile,'utf8'))[0].id));
 assert(seed.titulo.startsWith('TESTE MVP EXCURSOES '),'The source is not owned by this run');
 let e=await service.salvarExcursao(null,{titulo:'TESTE MVP EXCURSOES LIMITES '+Date.now(),origemNome:seed.origemNome,origemLatitude:seed.origemLatitude,origemLongitude:seed.origemLongitude,destinoNome:seed.destinoNome,destinoLatitude:seed.destinoLatitude,destinoLongitude:seed.destinoLongitude,partidaEm:new Date(Date.now()+3*86400000).toISOString(),retornoEm:null,capacidade:1});
 fs.writeFileSync(manifest,JSON.stringify({id:e.id},null,2));
 await service.confirmarPersistenciaExcursao(e.id,e);
 e=await service.acaoExcursao(e.id,'publicacao',e.versao);await service.confirmarPersistenciaExcursao(e.id,e);
 const invite=await service.criarConviteExcursao(e.id,new Date(Date.now()+3600000).toISOString(),e.partidaEm);
 const credentials=async()=>publicRequest('/publico/excursoes/credenciais',{'X-Convite':invite.token});
 const register=(credential,payload)=>publicRequest('/publico/excursoes/inscricoes',{'X-Convite':invite.token,'X-Inscricao':credential.token},payload);
 const payload={nome:'Participante ficticio de limites',contato:'limites-'+e.id+'@example.invalid',aceitePrivacidade:true,nomePonto:seed.destinoNome.slice(0,120),latitude:seed.destinoLatitude,longitude:seed.destinoLongitude,pontoConfirmado:true};
 const expectStatus=async(task,status,label)=>{try{await task();throw Error('Expected HTTP '+status);}catch(error){assert(error.status===status,'Unexpected response for '+label);record(label,{status,code:error.code||null,message:error.message});}};
 const first=await credentials();
 await expectStatus(()=>register(first,{...payload,latitude:91}),400,'ponto-invalido-rejeitado');
 const registration=await register(first,payload);await service.confirmarParticipante(e.id,registration.id);
 const second=await credentials();
 await expectStatus(()=>register(second,{...payload,nome:'Segundo participante ficticio',contato:'segundo-'+e.id+'@example.invalid'}),409,'capacidade-respeitada');
 const list=await service.participantesExcursao(e.id,0);assert(list.itens.length===1&&list.itens[0].estado==='CONFIRMADA','Capacity or confirmation mismatch');
 record('capacidade-confirmacao',{capacity:1,confirmed:1});
 await service.revogarConviteExcursao(e.id,invite.id);
 await expectStatus(()=>credentials(),404,'convite-revogado-rejeitado');
 const short=await service.criarConviteExcursao(e.id,new Date(Date.now()+10000).toISOString(),e.partidaEm);
 await new Promise(resolve=>setTimeout(resolve,12000));
 await expectStatus(()=>publicRequest('/publico/excursoes/credenciais',{'X-Convite':short.token}),404,'convite-expirado-rejeitado');
 const read=await service.buscarExcursao(String(e.id));e=await service.acaoExcursao(e.id,'cancelamento',read.versao);await service.confirmarPersistenciaExcursao(e.id,e);
 await conflict(()=>service.iniciarExcursao(e.id,'IDA'),'inicio-cancelada');record('limites-concluidos',{state:e.estado});
}
(async()=>{
 assert(process.env.BEVANS_TEST_WRITE==='CONFIRMADO','Set BEVANS_TEST_WRITE=CONFIRMADO only for an explicitly authorized test environment/account.');
 assert(process.env.BEVANS_TEST_EMAIL&&process.env.BEVANS_TEST_PASSWORD,'Provide the authorized account in BEVANS_TEST_EMAIL and BEVANS_TEST_PASSWORD.');
 assert(['preparar','completar','auditar','limites'].includes(phase),'Choose preparar, completar, auditar or limites');
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+process.env.EXPO_PUBLIC_FIREBASE_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.BEVANS_TEST_EMAIL,password:process.env.BEVANS_TEST_PASSWORD,returnSecureToken:true})});
 const session=await response.json();assert(response.ok&&session.idToken,'Authorized account authentication failed');auth.currentUser={getIdToken:async()=>session.idToken};
 if(phase==='preparar')await prepare();else if(phase==='completar')await complete();else if(phase==='limites')await limits();else await audit();record('fase-aprovada',{phase});
})().catch(error=>{record('fase-falhou',{phase,status:error.status||null,code:error.code||null,message:error.message});process.exitCode=1;});
