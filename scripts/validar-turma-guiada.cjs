// Integration runner for a turma created by the Android wizard. No credentials,
// tokens, names or coordinates are written to its evidence file.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
require('dotenv').config({quiet:true});
const out=path.resolve('.expo/turma-guiada-2211');fs.mkdirSync(out,{recursive:true});
const manifest=path.join(out,'recursos.json'),evidence=path.join(out,'http.json');
const resources=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest,'utf8')):{};
const events=fs.existsSync(evidence)?JSON.parse(fs.readFileSync(evidence,'utf8')):[];
const record=(step,data={})=>{const event={at:new Date().toISOString(),step,...data};events.push(event);fs.writeFileSync(evidence,JSON.stringify(events,null,2));console.log(JSON.stringify(event));};
const check=(condition,message)=>{if(!condition)throw Error(message);};
const save=()=>fs.writeFileSync(manifest,JSON.stringify(resources,null,2));
const config={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/config/config.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:config,URL,process});
const base=config.API_URL;check(base,'API não configurada.');
const sessions={};
async function account(role){
 if(sessions[role])return sessions[role];
 const email=process.env[role==='motorista'?'BEVANS_TEST_EMAIL':'BEVANS_TEST_PASSENGER_EMAIL'],password=process.env.BEVANS_TEST_PASSWORD;
 check(email&&password,'Forneça as credenciais autorizadas por ambiente.');
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+process.env.EXPO_PUBLIC_FIREBASE_API_KEY,{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
 const data=await response.json();check(response.ok&&data.idToken,'Autenticação de teste recusada.');
 const profileResponse=await fetch(base+'/usuarios/por-uid/'+encodeURIComponent(data.localId),{signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+data.idToken}});
 const profile=await profileResponse.json();check(profileResponse.ok&&profile.id,'Perfil de teste indisponível.');
 check(role==='motorista'?profile.tipo==='MOTORISTA':['PASSAGEIRO','ALUNO'].includes(profile.tipo),'Perfil incompatível.');
 sessions[role]={token:data.idToken,id:profile.id};return sessions[role];
}
async function call(role,endpoint,method='GET',body){
 const session=await account(role),response=await fetch(base+endpoint,{method,signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 record('HTTP',{role,method,path:endpoint.split('?')[0].replace(/\d+/g,'{id}'),status:response.status});
 const text=await response.text();if(!response.ok)throw Object.assign(Error('A API recusou a etapa de teste.'),{status:response.status});
 try{return text?JSON.parse(text):null;}catch{return text;}
}
async function turma(){
 const driver=await account('motorista'),list=await call('motorista','/turmas/motorista/'+driver.id);
 const found=list.filter(t=>t.nome==='VALIDACAO_GUIADA_2211');check(found.length===1,'A turma exclusiva criada no Android não foi identificada de forma única.');
 check(!resources.turmaId||resources.turmaId===found[0].id,'O recurso de teste mudou.');resources.turmaId=found[0].id;save();return found[0];
}
async function prepare(){
 const t=await turma(),passenger=await account('passageiro');
 const members=await call('motorista',`/turmas/${t.id}/passageiros`);
 check(members.every(r=>r.id===passenger.id),'A turma contém pessoas fora deste teste.');
 const state=await call('motorista',`/rota/status-atual?turmaId=${t.id}`);
 check(state.status==='INATIVA','Encerre a execução de teste antes de preparar outra presença.');
 const linked=await call('passageiro','/turmas/usuario/'+passenger.id+'/todas');
 if(!linked.some(x=>x.id===t.id)){
  const pending=await call('motorista',`/turmas/${t.id}/pendentes`);
  if(!pending.some(x=>x.aluno?.id===passenger.id))await call('passageiro',`/turmas/entrar/${passenger.id}?codigo=${encodeURIComponent(t.codigoConvite)}`,'POST');
  const requests=await call('motorista',`/turmas/${t.id}/pendentes`),request=requests.find(x=>x.aluno?.id===passenger.id);
  check(request?.id,'Solicitação própria não encontrada.');await call('motorista',`/turmas/analisar/${request.id}?status=APROVADO`,'PUT');
 }
 const addresses=await call('passageiro','/enderecos/usuario/'+passenger.id);
 for(const [field,prefix]of [['ida','origem'],['volta','destino']]){
  if(!resources[field]){
   const alias='VALIDACAO_GUIADA_2211_'+field,existing=addresses.filter(a=>a.apelido===alias);check(existing.length<=1,'Endereço de teste ambíguo.');
   const a=existing[0]||await call('passageiro','/enderecos/usuario/'+passenger.id,'POST',{apelido:alias,rua:t[prefix+'Nome'],numero:'S/N',bairro:'Local público de teste',latitude:t[prefix+'Latitude'],longitude:t[prefix+'Longitude']});
   check(a?.id,'Endereço de teste não confirmado.');resources[field]=a.id;save();
  }
 }
 await call('passageiro',`/rota/confirmar?usuarioId=${passenger.id}&turmaId=${t.id}&status=AMBOS&enderecoIda=${resources.ida}&enderecoVolta=${resources.volta}`,'POST');
 const confirmation=await call('passageiro',`/rota/minha-confirmacao?usuarioId=${passenger.id}&turmaId=${t.id}`);
 check(confirmation.status==='AMBOS','Presença não confirmada.');
 // Only public locations already confirmed by the Android wizard are used for simulated emulator GPS.
 fs.writeFileSync(path.join(out,'gps-publico.json'),JSON.stringify({latitude:t.origemLatitude,longitude:t.origemLongitude}));
 record('preparacao-confirmada',{turmaId:t.id,status:confirmation.status,enderecosDistintos:resources.ida!==resources.volta});
}
async function inspect(){
 const t=await turma(),passenger=await account('passageiro');
 const members=await call('motorista',`/turmas/${t.id}/passageiros`);
 record('vinculo-conferido',{turmaId:t.id,total:members.length,passageiroAutorizado:members.some(r=>r.id===passenger.id),confirmados:members.filter(r=>r.status==='AMBOS'||r.status==='IDA'||r.status==='VOLTA').length});
 const driver=await call('motorista',`/rota/status-atual?turmaId=${t.id}`),own=await call('passageiro',`/rota/status-atual?turmaId=${t.id}`);
 check(driver.status===own.status&&driver.viagemId===own.viagemId,'Sessões discordam sobre a viagem.');
 if(driver.status==='ATIVA'){
  resources.viagemId=driver.viagemId;save();
  const points=await call('motorista',`/operacoes/VIAGEM/${driver.viagemId}/roteiro`),panel=await call('motorista',`/operacoes/VIAGEM/${driver.viagemId}`),self=await call('passageiro',`/operacoes/VIAGEM/${driver.viagemId}/minha`);
  const included=panel.registros.some(r=>r.alunoId===passenger.id);check(included,'Passageiro não consta no snapshot.');
  record('execucao-conferida',{turmaId:t.id,viagemId:driver.viagemId,sentido:driver.sentido,pontos:points.length,esperados:panel.contadores.esperados,passageiroIncluido:included,estadoProprio:self.estado});
  const location=await call('passageiro',`/viagens/${driver.viagemId}/localizacao`);
  record('gps-autorizado',{viagemId:driver.viagemId,estado:location?.estado||'SEM_RESPOSTA',observadoEm:location?.observadoEm||null});
 }else record('viagem-inativa-confirmada',{turmaId:t.id});
}
async function end(){const t=await turma(),passenger=await account('passageiro');const members=await call('motorista',`/turmas/${t.id}/passageiros`);check(members.every(r=>r.id===passenger.id),'A turma contém pessoas fora deste teste.');await call('motorista',`/rota/encerrar?turmaId=${t.id}`,'POST');await inspect();}
async function presence(){
 const t=await turma(),passenger=await account('passageiro');let saved;
 try{saved=await call('passageiro',`/rota/minha-confirmacao?usuarioId=${passenger.id}&turmaId=${t.id}`);}
 catch(error){if(error.status!==404)throw error;}
 record('presenca-propria-conferida',{turmaId:t.id,status:saved?.status||'LIMPA',idaDeTeste:saved?.enderecoIda?.id===resources.ida,voltaDeTeste:saved?.enderecoVolta?.id===resources.volta,enderecosDistintos:!!saved?.enderecoIda&&!!saved?.enderecoVolta&&saved.enderecoIda.id!==saved.enderecoVolta.id});
}
async function main(){const mode=process.argv[2];if(mode==='preparar')await prepare();else if(mode==='conferir')await inspect();else if(mode==='presenca')await presence();else if(mode==='encerrar')await end();else throw Error('Use preparar, conferir, presenca ou encerrar.');}
main().catch(error=>{record('impedimento',{status:error.status||null});process.exitCode=1;});
