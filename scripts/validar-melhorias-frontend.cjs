// Recursos sintéticos próprios; credenciais apenas em variáveis de ambiente.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
require('dotenv').config({quiet:true});
const root=path.resolve('.expo/melhorias-frontend');fs.mkdirSync(root,{recursive:true});
const manifest=path.join(root,'recursos.json'),report=path.join(root,'http.json');
const results=fs.existsSync(report)?JSON.parse(fs.readFileSync(report,'utf8')):[];
const record=(step,info={})=>{const value={at:new Date().toISOString(),step,...info};results.push(value);fs.writeFileSync(report,JSON.stringify(results,null,2));console.log(JSON.stringify(value));};
const assert=(v,message)=>{if(!v)throw Error(message);};
const auth={currentUser:null,authStateReady:async()=>{}};const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
 const request=name=>{if(name.endsWith('/firebase'))return {auth};if(name==='expo-location')return {};if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name)+'.ts');throw Error('Dependência não permitida no runner');};
 const observedFetch=async(url,options)=>{const r=await fetch(url,options);const target=new URL(url);if(!/mapbox|geoapify/.test(target.hostname))record('HTTP',{method:options?.method||'GET',path:target.pathname.replace(/\/por-uid\/[^/]+/,'/por-uid/{uid}').replace(/\d+/g,'{id}'),status:r.status});return r;};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:request,process,fetch:observedFetch,Headers,Response,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,Date,Error,Number,Intl,__DEV__:false});return exports;
}
const api=load('src/config/api.ts'),notifications=load('src/services/notificacoes.ts'),rotas=load('src/services/rotasPublicas.ts'),embarques=load('src/services/embarques.ts'),turmas=load('src/services/turmas.ts'),solicitacoes=load('src/services/solicitacoes.ts'),inicio=load('src/services/inicioRotaPublica.ts'),viagens=load('src/services/viagens.ts'),operacoes=load('src/services/operacoes.ts');
const sessions={};let owner;
async function account(role){
 if(!sessions[role]){const email=process.env[role==='motorista'?'BEVANS_TEST_EMAIL':'BEVANS_TEST_PASSENGER_EMAIL'];assert(email&&process.env.BEVANS_TEST_PASSWORD,'Forneça as duas contas autorizadas por ambiente.');
  const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+process.env.EXPO_PUBLIC_FIREBASE_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:process.env.BEVANS_TEST_PASSWORD,returnSecureToken:true})});const s=await r.json();assert(r.ok&&s.idToken,'Falha ao autenticar conta autorizada.');sessions[role]={uid:s.localId,getIdToken:async()=>s.idToken};
 }
 auth.currentUser=sessions[role];owner=role;const profile=await api.apiRequest('/usuarios/por-uid/'+auth.currentUser.uid);assert(profile.tipo===(role==='motorista'?'MOTORISTA':'PASSAGEIRO')||role==='passageiro'&&profile.tipo==='ALUNO','Perfil da conta incompatível');return profile;
}
async function diagnostic(){
 for(const role of ['motorista','passageiro']){await account(role);const page=await notifications.listarNotificacoes(0),unread=await notifications.contarNaoLidas();await notifications.preferenciasNotificacao();record('central-oficial',{role,firstPage:page.itens.length,total:page.total,unread,types:[...new Set(page.itens.map(n=>n.contextoTipo))]});}
}
async function audit(){
 const driver=await account('motorista');
 const expect=async(task,status,label)=>{try{await task();throw Error('Permissão indevida em '+label);}catch(e){assert(e.status===status,'Status inesperado em '+label);record(label,{status});}};
 await expect(()=>embarques.meusEmbarques(),403,'motorista-nao-consulta-pedidos-de-passageiro');
 await account('passageiro');await expect(()=>rotas.listarMinhasRotas(),403,'passageiro-nao-gerencia-rotas');
 await expect(()=>turmas.listarTurmasMotorista(String(driver.id)),403,'passageiro-nao-lista-turmas-do-motorista');
 const config=load('src/config/config.ts'),r=await fetch(config.API_URL+'/notificacoes');assert(r.status===401,'Histórico sem sessão não foi recusado');record('central-sem-sessao',{status:r.status});
 await diagnostic();
}
let owned=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest,'utf8')):[];
const remember=entry=>{owned.push(entry);fs.writeFileSync(manifest,JSON.stringify(owned,null,2));};
async function prepare(){
 const driver=await account('motorista'),search=load('src/services/enderecoSearch.ts'),points=[];
 for(const query of ['Marco Zero Recife Pernambuco','Praça do Arsenal Recife Pernambuco','Parque Treze de Maio Recife Pernambuco']){
  const found=(await search.pesquisarEnderecos(query)).find(p=>p.tipo==='estabelecimento');assert(found,'Local público não confirmado; coordenadas não serão inventadas.');points.push(found);
 }
 for(const mode of ['FIXA','FLEXIVEL']){
  let entry=owned.find(e=>e.mode===mode);
  if(!entry){const turma=await turmas.criarTurma(String(driver.id),'TESTE MVP MELHORIAS '+mode+' '+Date.now(),'Teste',2);entry={turmaId:turma.id,mode,rotaId:null};remember(entry);}
  const turma=await turmas.buscarTurmaMotorista(String(driver.id),entry.turmaId);assert(turma.nome.startsWith('TESTE MVP MELHORIAS '+mode),'Turma fora do manifesto sintético.');
  let r=entry.rotaId?await rotas.buscarRotaPublica(entry.rotaId):(await rotas.listarMinhasRotas()).find(r=>r.turmaId===turma.id);
  if(!r)r=await rotas.salvarRotaPublica(null,{turmaId:turma.id,nome:'TESTE MVP MELHORIAS '+mode,cidade:'Recife',categoria:'OUTROS',modo:mode,origemNome:points[0].nome,origemLatitude:points[0].latitude,origemLongitude:points[0].longitude,destinoNome:points[1].nome,destinoLatitude:points[1].latitude,destinoLongitude:points[1].longitude,dias:['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'],horarioIda:'23:58',horarioVolta:'23:59',descricao:'Recurso sintético autorizado para validação do frontend',regiao:null,campus:null});
  assert(r.nome==='TESTE MVP MELHORIAS '+mode,'Rota fora do manifesto sintético.');
  entry.rotaId=r.id;fs.writeFileSync(manifest,JSON.stringify(owned,null,2));
  if(!r.paradas.length)r=await rotas.salvarParadasPublicas(r.id,[{id:null,nome:'Encontro público de teste',latitude:points[2].latitude,longitude:points[2].longitude,horario:null}]);if(!r.publicada)r=await rotas.publicarRota(r.id,true);await rotas.buscarRotaPublica(r.id);
  const passageiro=await account('passageiro');const aprovadas=await solicitacoes.minhasTurmasPassageiro(String(passageiro.id));
  let vaga;
  if(aprovadas.some(t=>t.id===turma.id))vaga={status:'APROVADO'};
  else{await account('motorista');const anterior=(await solicitacoes.listarVinculosPendentes(String(driver.id))).find(p=>p.turma.id===turma.id&&p.aluno?.id===passageiro.id);await account('passageiro');vaga=anterior?{id:anterior.id,status:'PENDENTE'}:await embarques.solicitarVagaRota(r.id);}
  assert(['PENDENTE','APROVADO'].includes(vaga.status),'Vínculo inesperado.');
  const hoje=load('src/services/dataOperacao.ts').dataLocal();entry.data=hoje;
  for(const sentido of ['IDA','VOLTA']){
   const p=await embarques.solicitarEmbarque(r.id,{dataOperacao:hoje,sentido,...(mode==='FIXA'?{paradaId:r.paradas[0].id}:{nomePonto:'Ponto público flexível de teste',latitude:points[2].latitude,longitude:points[2].longitude,pontoConfirmado:true})});assert(p.status==='PENDENTE','Pedido não ficou pendente.');entry[sentido]=p.id;
  }
  fs.writeFileSync(manifest,JSON.stringify(owned,null,2));await account('motorista');
  if(vaga.status==='PENDENTE'){const pendentes=await solicitacoes.listarVinculosPendentes(String(driver.id));assert(pendentes.some(p=>p.id===vaga.id&&p.turma.id===turma.id),'Vínculo não encontrado na coleção oficial.');await solicitacoes.analisarVinculo(vaga.id,'APROVADO');}
  for(const sentido of ['IDA','VOLTA']){await embarques.analisarEmbarque(entry[sentido],'APROVADO');const ps=await embarques.embarquesMotorista(r.id,hoje,sentido);assert(ps.some(p=>p.id===entry[sentido]&&p.status==='APROVADO'),'Aprovação não persistida.');}
  await account('passageiro');const meus=await embarques.meusEmbarques();assert(['IDA','VOLTA'].every(s=>meus.some(p=>p.id===entry[s]&&p.status==='APROVADO')),'Passageiro não recebeu estado aprovado.');
  await account('motorista');const revisao=await inicio.revisarInicioPublico(r,'IDA');assert(revisao.aprovados===1,'Revisão omitiu embarque aprovado.');record('rota-preparada',{mode,approved:2,previewPoints:revisao.pontos.length});
 }
}
async function complete(){
 assert(owned.length===2&&owned.every(e=>e.rotaId),'Prepare os recursos antes de operar.');
 for(const entry of owned){await account('motorista');const rota=await rotas.buscarRotaPublica(entry.rotaId);assert(rota.nome==='TESTE MVP MELHORIAS '+entry.mode,'O recurso não pertence a este runner.');
  for(const sentido of ['IDA','VOLTA']){
   let estado=await viagens.consultarEstadoViagem(rota.turmaId);
   if(estado.status==='ATIVA'){assert(estado.modalidade==='PUBLICA'&&estado.rotaPublicaId===rota.id&&estado.sentido===sentido,'Outra execução está ativa; nenhuma será alterada.');}
   else{const revisao=await inicio.revisarInicioPublico(rota,sentido);estado=await inicio.iniciarTrechoPublico(revisao);}
   const oficial=await inicio.confirmarExecucaoPublica(rota,sentido);assert(oficial.pontos.flatMap(p=>p.passageiros).length===1,'Snapshot não contém passageiro aprovado.');
   await account('passageiro');let registro=await operacoes.consultarOperacao('VIAGEM',String(estado.viagemId),false);assert(registro.estado==='AGUARDANDO','Pedido aprovado foi confundido com embarque físico.');registro=await operacoes.alterarEstadoOperacional('VIAGEM',String(estado.viagemId),registro,false,'EMBARCADO');
   await account('motorista');let painel=await operacoes.consultarOperacao('VIAGEM',String(estado.viagemId),true);assert(painel.contadores.naVan===1,'Contador não refletiu embarque.');await operacoes.alterarEstadoOperacional('VIAGEM',String(estado.viagemId),painel.registros[0],true,'DESEMBARCADO');await viagens.encerrarViagem(rota.turmaId);assert((await viagens.consultarEstadoViagem(rota.turmaId)).status==='INATIVA','Fim da viagem não confirmado.');record('trecho-publico-validado',{mode:entry.mode,sentido,points:oficial.pontos.length,passengers:1,finished:true});
  }
  await rotas.publicarRota(rota.id,false);record('recurso-retirado-catalogo',{mode:entry.mode});
 }
}
async function excursion(){
 await account('motorista');assert(owned[0]?.rotaId,'Prepare primeiro os locais públicos do teste.');
 const service=load('src/services/excursoes.ts'),start=load('src/services/inicioExcursao.ts'),file=path.join(root,'excursao.json');
 let e;
 if(fs.existsSync(file))e=await service.buscarExcursao(String(JSON.parse(fs.readFileSync(file,'utf8')).id));
 else{
  const r=await rotas.buscarRotaPublica(owned[0].rotaId);
  e=await service.salvarExcursao(null,{titulo:'TESTE MVP MELHORIAS IDA VOLTA',origemNome:r.origemNome,origemLatitude:r.origemLatitude,origemLongitude:r.origemLongitude,destinoNome:r.destinoNome,destinoLatitude:r.destinoLatitude,destinoLongitude:r.destinoLongitude,partidaEm:new Date(Date.now()+86400000).toISOString(),retornoEm:new Date(Date.now()+2*86400000).toISOString(),capacidade:2});fs.writeFileSync(file,JSON.stringify({id:e.id}));
  e=await service.salvarColetaExcursao(e.id,'PARADA_UNICA',e.versao,[{...r.paradas[0],id:null,instrucoes:'Local público para teste autorizado',pontoConfirmado:true}]);
  e=await service.acaoExcursao(e.id,'publicacao',e.versao);await service.confirmarPersistenciaExcursao(e.id,e);
  const invite=await service.criarConviteExcursao(e.id,new Date(Date.now()+3600000).toISOString(),e.partidaEm);
  const credentials=await api.apiRequest('/publico/excursoes/credenciais',{method:'POST',headers:{'X-Convite':invite.token}});
  const registration=await api.apiRequest('/publico/excursoes/inscricoes',{method:'POST',headers:{'Content-Type':'application/json','X-Convite':invite.token,'X-Inscricao':credentials.token},body:JSON.stringify({nome:'Participante fictício da rodada',contato:'melhorias-'+e.id+'@example.invalid',aceitePrivacidade:true,paradaId:e.paradas[0].id})});
  await service.confirmarParticipante(e.id,registration.id);await service.revogarConviteExcursao(e.id,invite.id);
 }
 assert(e.titulo==='TESTE MVP MELHORIAS IDA VOLTA','Excursão fora do manifesto.');
 for(const sentido of ['IDA','VOLTA']){
  const existentes=await service.listarExecucoes(e.id);let x=existentes.find(v=>v.sentido===sentido);
  if(x?.estado==='FINALIZADA'){record('excursao-trecho-ja-finalizado',{sentido});continue;}
  if(!x){const r=await start.revisarTrechoExcursao(e,sentido);assert(r.autorizados===1&&r.pontos.length>=2,'Revisão não confirmou roteiro e autorizado');await start.conferirRevisaoTrecho(e,r);x=await service.iniciarExcursao(e.id,sentido);}
  const confirmada=await service.buscarExecucaoExcursao(e.id,x.id);const painel=await operacoes.consultarOperacao('EXCURSAO',String(x.id),true);assert(painel.registros.length===1,'Inscrito não pertence ao snapshot.');
  let p=painel.registros[0];if(p.estado==='AGUARDANDO')p=await operacoes.alterarEstadoOperacional('EXCURSAO',String(x.id),p,true,'EMBARCADO');if(p.estado==='EMBARCADO')await operacoes.alterarEstadoOperacional('EXCURSAO',String(x.id),p,true,'DESEMBARCADO');
  await service.finalizarExcursao(e.id,x.id);assert((await service.buscarExecucaoExcursao(e.id,x.id)).estado==='FINALIZADA','Finalização não confirmada');record('excursao-trecho-validado',{sentido,points:confirmada.pontos.length,authorized:1,finished:true});e=await service.buscarExcursao(String(e.id));
 }
}
(async()=>{assert(process.env.BEVANS_TEST_WRITE==='CONFIRMADO','A execução exige autorização explícita por ambiente.');const phase=process.argv[2]||'diagnosticar';assert(['diagnosticar','preparar','completar','excursao','auditar'].includes(phase),'Fase inválida');if(phase==='diagnosticar')await diagnostic();else if(phase==='auditar')await audit();else if(phase==='preparar')await prepare();else if(phase==='excursao')await excursion();else await complete();record('fase-aprovada',{phase});})().catch(error=>{record('fase-falhou',{status:error.status||null,code:error.code||null,message:error.message});process.exitCode=1;});
