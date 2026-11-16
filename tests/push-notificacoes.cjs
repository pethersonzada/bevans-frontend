const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Date,Error,URL,URLSearchParams,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];}});return exports;}
function harness(){
    const storage=new Map(),events=[];
    const state={permission:'granted',token:'synthetic-native-A',registerFailure:false,revokeFailure:false,deleteFailure:false,registerGate:null,tokenGate:null,prompts:0};
    const native={AndroidImportance:{DEFAULT:3},AndroidNotificationVisibility:{PRIVATE:0},
        setNotificationChannelAsync:async(name,config)=>events.push({channel:name,config}),
        requestPermissionsAsync:async()=>{state.prompts++;return {status:state.permission};},
        getPermissionsAsync:async()=>({status:state.permission}),
        getDevicePushTokenAsync:async()=>{events.push({getToken:true});return state.tokenGate?await state.tokenGate:{type:'android',data:state.token};},
        unregisterForNotificationsAsync:async()=>{events.push({deleteNative:true});if(state.deleteFailure)throw Error('native failure');state.token+='-rotated';},
        clearLastNotificationResponseAsync:async()=>{},dismissAllNotificationsAsync:async()=>{}};
    const service=load('src/services/push.ts',{'react-native':{Platform:{OS:'android'}},'expo-notifications':native,'@react-native-async-storage/async-storage':{__esModule:true,default:{getAllKeys:async()=>[...storage.keys()],getItem:async k=>storage.get(k)||null,setItem:async(k,v)=>storage.set(k,v),removeItem:async k=>storage.delete(k)}},'./notificacoes':{
        registrarDispositivo:async(id,token)=>{events.push({register:id,token});if(state.registerGate)await state.registerGate;if(state.registerFailure)throw Error('offline');},
        revogarDispositivo:async id=>{events.push({revoke:id});if(state.revokeFailure)throw Error('offline');}
    }});
    return {service,state,storage,events};
}
async function until(predicate){for(let i=0;i<20&&!predicate();i++)await new Promise(setImmediate);assert.ok(predicate(),'expected asynchronous stage');}
test('duplicate Android activation is single-flight and unchanged token is idempotent',async()=>{
    const h=harness();await h.service.prepararSessaoPush('25');const [a,b]=await Promise.all([h.service.ativarPushAndroid('25',()=>true),h.service.ativarPushAndroid('25',()=>true)]);assert.equal(a,b);assert.equal(h.events.filter(e=>e.register).length,1);await h.service.ativarPushAndroid('25',()=>true);assert.equal(h.events.filter(e=>e.register).length,1);assert.equal(h.events.find(e=>e.channel).channel,'operacional');
});
test('account change while obtaining a token never registers it to either account',async()=>{
    const h=harness();await h.service.prepararSessaoPush('25');let finish;h.state.tokenGate=new Promise(r=>finish=r);const pending=h.service.ativarPushAndroid('25',()=>true);const rejected=assert.rejects(pending,/sessão mudou/);await until(()=>h.events.some(e=>e.getToken));h.service.definirSessaoPush(null);const next=h.service.prepararSessaoPush('26');finish({type:'android',data:'old-token'});await rejected;await next;assert.equal(h.events.filter(e=>e.register).length,0);
});
test('logout drains an in-flight registration before revocation and invalidates native token',async()=>{
    const h=harness();await h.service.prepararSessaoPush('25');let finish;h.state.registerGate=new Promise(r=>finish=r);const pending=h.service.ativarPushAndroid('25',()=>true);const rejected=assert.rejects(pending,/sessão mudou/);await until(()=>h.events.some(e=>e.register));const logout=h.service.encerrarSessaoPush('25');finish();await rejected;await logout;assert.equal(h.events.filter(e=>e.register).length,1);assert.ok(h.events.findIndex(e=>e.revoke)>h.events.findIndex(e=>e.register));assert.ok(h.events.some(e=>e.deleteNative));assert.equal(h.storage.get('@bevans:push:consentimento:25'),undefined);await assert.rejects(h.service.ativarPushAndroid('25',()=>true),/sessão mudou/);
});
test('offline revocation still deletes native token and retains remote installation for retry',async()=>{
    const h=harness();await h.service.prepararSessaoPush('25');const id=await h.service.ativarPushAndroid('25',()=>true);h.state.revokeFailure=true;await assert.rejects(h.service.encerrarSessaoPush('25'),/servidor está pendente/);assert.equal(h.storage.get('@bevans:push:25'),id);assert.ok(h.events.some(e=>e.deleteNative));h.state.revokeFailure=false;await h.service.prepararSessaoPush('25');await h.service.desativarPush('25');assert.equal(h.storage.get('@bevans:push:25'),undefined);
});
test('native cleanup failure blocks another account until cleanup succeeds',async()=>{
    const h=harness();await h.service.prepararSessaoPush('25');await h.service.ativarPushAndroid('25',()=>true);h.state.deleteFailure=true;await assert.rejects(h.service.encerrarSessaoPush('25'),/limpeza do token/);assert.equal(h.storage.get('@bevans:push:limpeza-pendente'),'true');await assert.rejects(h.service.prepararSessaoPush('26'));assert.equal(h.events.filter(e=>e.register).length,1);h.state.deleteFailure=false;await h.service.prepararSessaoPush('26');await h.service.ativarPushAndroid('26',()=>true);const requests=h.events.filter(e=>e.register);assert.notEqual(requests[0].register,requests[1].register);assert.notEqual(requests[0].token,requests[1].token);
});
test('token renewal updates the same installation without prompting or duplicating writes',async()=>{
    const h=harness();await h.service.prepararSessaoPush('25');const id=await h.service.ativarPushAndroid('25',()=>true);const prompts=h.state.prompts;h.state.token='synthetic-new-native';await Promise.all([h.service.renovarPushAndroid('25',()=>true),h.service.renovarPushAndroid('25',()=>true)]);const requests=h.events.filter(e=>e.register);assert.equal(requests.length,2);assert.equal(requests[1].register,id);assert.equal(requests[1].token,h.state.token);assert.equal(h.state.prompts,prompts);
});
test('late revoke and logout from a previous account cannot delete the new native token',async()=>{
    const h=harness();await h.service.prepararSessaoPush('25');await h.service.ativarPushAndroid('25',()=>true);await h.service.encerrarSessaoPush('25');await h.service.prepararSessaoPush('26');const current=await h.service.ativarPushAndroid('26',()=>true);const deletions=h.events.filter(e=>e.deleteNative).length;await assert.rejects(h.service.desativarPush('25'),/conta atual não foi alterada/);await assert.rejects(h.service.encerrarSessaoPush('25'),/conta atual não foi alterada/);assert.equal(h.events.filter(e=>e.deleteNative).length,deletions);assert.equal(h.storage.get('@bevans:push:26'),current);
});
test('legacy installations rotate the unscoped token before exposing a different account',async()=>{
    const h=harness();h.storage.set('@bevans:push:25','legacy_installation_123456');await h.service.prepararSessaoPush('26');assert.ok(h.events.some(e=>e.deleteNative));await h.service.ativarPushAndroid('26',()=>true);assert.notEqual(h.events.find(e=>e.register).token,'synthetic-native-A');
});
test('revoked Android permission removes consent and revokes an existing device without another prompt',async()=>{
    const h=harness();await h.service.prepararSessaoPush('25');await h.service.ativarPushAndroid('25',()=>true);const prompts=h.state.prompts;h.state.permission='denied';await h.service.renovarPushAndroid('25',()=>true);assert.equal(h.state.prompts,prompts);assert.ok(h.events.some(e=>e.revoke));assert.equal(h.storage.get('@bevans:push:consentimento:25'),undefined);
});
test('permission denial, invalid token and offline registration never report a successful registration',async()=>{
    const denied=harness();denied.state.permission='denied';await assert.rejects(denied.service.ativarPushAndroid('25',()=>true),/não autorizado/);assert.equal(denied.events.filter(e=>e.register).length,0);
    const invalid=harness();invalid.state.token=' ';await assert.rejects(invalid.service.ativarPushAndroid('25',()=>true),/indisponível/);assert.equal(invalid.events.filter(e=>e.register).length,0);
    const offline=harness();offline.state.registerFailure=true;await assert.rejects(offline.service.ativarPushAndroid('25',()=>true),/offline/);const first=offline.events.find(e=>e.register);offline.state.registerFailure=false;await offline.service.ativarPushAndroid('25',()=>true);assert.equal(offline.events.filter(e=>e.register)[1].register,first.register);
});
test('push responses deduplicate by notification ID, reject invalid data and ignore detached sessions',()=>{
    const {criarAberturaPush}=load('src/services/aberturaPush.ts',{});const opened=[];let active=true;const handle=criarAberturaPush(()=>active,id=>opened.push(id));handle({notificacaoId:'7',contextoId:999});handle({notificacaoId:7});handle({notificacaoId:'../8'});handle({notificacaoId:'99999999999999999999'});active=false;handle({notificacaoId:'8'});assert.deepEqual(opened,['7']);
});
test('ended-trip notice retains historical execution; authorization failure never yields a route',async()=>{
    const paths=[];let denied=false;const cat=load('src/services/catalogo.ts',{'../config/api':{}});
    const m=load('src/services/notificacoes.ts',{'./catalogo':cat,'../config/api':{apiRequest:async path=>{paths.push(path);if(denied)throw {status:404};return {id:8,estado:'FINALIZADA'};}}});
    const notice={contextoTipo:'VIAGEM',contextoId:7,tipo:'VIAGEM_FINALIZADA'};const route=await m.destinoAutorizadoNotificacao(notice,false);assert.equal(route.params.id,'7');assert.deepEqual(paths,['/operacoes/VIAGEM/7/minha']);denied=true;await assert.rejects(m.destinoAutorizadoNotificacao(notice,false));assert.match(m.mensagemErroNotificacao({status:404}),/não está disponível/);await assert.rejects(m.destinoAutorizadoNotificacao({contextoTipo:'EXCURSAO',contextoId:8},false),/página da sua inscrição/);
});
