const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URL,URLSearchParams,Error,...globals,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];}});return exports;}
const catalogo=()=>load('src/services/catalogo.ts',{'../config/api':{}});
test('four tabs preserve Home and Profile, with routes, excursions and Android history',()=>{
    const children=[];const Tabs=()=>{};Tabs.Screen='Tab';
    const m=load('src/app/(tabs)/_layout.tsx',{'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'@expo/vector-icons':{Ionicons:'Icon'},'expo-router':{Tabs},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:24})},'../../styles/theme':{theme:{colors:{}}}});
    const tree=m.default();assert.equal(tree.props.backBehavior,'history');assert.deepEqual(Array.from(tree.props.children,c=>c.props.name),['home','rotas','excursoes','perfil']);assert.equal(tree.props.screenOptions.tabBarStyle.paddingBottom,24);
});
test('catalogue combines filters using encoded parameters and rejects malformed pages',async()=>{
    let path;const m=load('src/services/catalogo.ts',{'../config/api':{apiRequest:async p=>{path=p;return {itens:[],pagina:2,totalPaginas:3,total:41};}}});
    await m.consultarCatalogo({cidade:'São Paulo',destino:'Campus & Centro',categoria:'UNIVERSITARIA',somenteFavoritas:true},2);
    const u=new URL(path,'https://example.test');assert.equal(u.searchParams.get('destino'),'Campus & Centro');assert.equal(u.searchParams.get('cidade'),'São Paulo');assert.equal(u.searchParams.get('pagina'),'2');assert.equal(u.searchParams.get('somenteFavoritas'),'true');
    assert.throws(()=>m.paginaValida({itens:[],pagina:0,totalPaginas:'1',total:0}));
});
test('favorites use the session identity and propagate authorization errors',async()=>{
    const calls=[];const m=load('src/services/catalogo.ts',{'../config/api':{apiFetch:async(...args)=>{calls.push(args);return {ok:false};},readApiError:async()=>Error('Acesso negado')}});
    await assert.rejects(m.alterarFavorito(7,true),/Acesso negado/);assert.equal(calls[0][0],'/rotas-publicas/7/favorito');assert.equal(calls[0][1].method,'PUT');await assert.rejects(m.alterarFavorito('../8',true));assert.equal(calls.length,1);
});
test('boarding requests retain direction, date and confirmed point without a passenger identity',async()=>{
    let body;const m=load('src/services/embarques.ts',{'./catalogo':catalogo(),'../config/api':{apiRequest:async(path,options)=>{body=JSON.parse(options.body);return {id:3,rotaId:8,status:'PENDENTE'};}}});
    const r=await m.solicitarEmbarque(8,{sentido:'VOLTA',dataOperacao:'2026-11-20',paradaId:4});assert.equal(r.status,'PENDENTE');assert.equal(body.sentido,'VOLTA');assert.equal(body.paradaId,4);assert.equal(body.alunoId,undefined);
});
test('excursion invitation uses only HTTPS web page and fragment; API token never appears in a query',()=>{
    const m=load('src/services/excursoes.ts',{'./excursaoFormulario':load('src/services/excursaoFormulario.ts',{}),'./catalogo':catalogo(),'../config/api':{}});assert.equal(m.linkConvite('https://example.test/convite','secret'),'https://example.test/convite#secret');
    for(const base of [undefined,'http://example.test/','https://example.test/?token=x','https://user:pass@example.test/'])assert.throws(()=>m.linkConvite(base,'secret'));
});
test('operational confirmation sends current version and preserves independent disembarkation',async()=>{
    const calls=[];const m=load('src/services/operacoes.ts',{'./catalogo':catalogo(),'../config/api':{apiRequest:async(path,opts)=>{const body=JSON.parse(opts.body);calls.push({path,body});return {id:6,estado:body.estado};}}});
    await m.alterarEstadoOperacional('VIAGEM','11',{id:6,versao:2},false,'EMBARCADO');await m.alterarEstadoOperacional('EXCURSAO','12',{id:6,versao:3},true,'DESEMBARCADO');
    assert.equal(calls[0].path,'/operacoes/VIAGEM/11/minha/estado');assert.equal(calls[0].body.versao,2);assert.equal(calls[0].body.correcao,false);assert.equal(calls[1].path,'/operacoes/EXCURSAO/12/passageiros/6/estado');assert.equal(calls[1].body.estado,'DESEMBARCADO');assert.throws(()=>m.prefixoOperacao('TURMA','11'));
});
test('environment isolation never falls back to development for staging or production',()=>{
    const {resolveApiUrl}=load('src/config/config.ts',{}, {process:{env:{}}});
    assert.equal(resolveApiUrl('development',{legacy:'https://dev.example.test/'}),'https://dev.example.test');
    assert.equal(resolveApiUrl('staging',{legacy:'https://dev.example.test'}),undefined);
    assert.equal(resolveApiUrl('production',{production:'http://example.test'}),undefined);
    assert.equal(resolveApiUrl('staging',{staging:'https://stage.example.test/'}),'https://stage.example.test');
    for(const url of ['https://user:pass@example.test','https://example.test?token=secret','ftp://example.test'])assert.equal(resolveApiUrl('staging',{staging:url}),undefined);
});
test('GPS expires by observed time, refuses future and invalid positions, and keeps modalities separate',()=>{
    const m=load('src/services/rastreamento.ts',{'./catalogo':catalogo(),'../config/api':{}});const now=Date.now();
    const p={estado:'ATUALIZADA',latitude:-8,longitude:-35,observadoEm:new Date(now-29000).toISOString()};assert.equal(m.posicaoRecente(p,now).latitude,-8);assert.equal(m.posicaoRecente(p,now+1001),null);
    assert.equal(m.posicaoRecente({...p,estado:'DESATUALIZADA'},now),null);assert.equal(m.posicaoRecente({...p,latitude:NaN},now),null);assert.equal(m.posicaoRecente({...p,observadoEm:new Date(now+6000).toISOString()},now),null);
    assert.equal(m.caminhoGps('VIAGEM',7),'/viagens/7/localizacao');assert.equal(m.caminhoGps('EXCURSAO',7),'/execucoes-excursao/7/localizacao');
});
test('private stop choices retain turma and direction and do not publish a residential address',async()=>{
    const calls=[];const m=load('src/services/coletaPrivada.ts',{'./catalogo':catalogo(),'../config/api':{apiRequest:async(path,options)=>{calls.push({path,options});return null;}}});
    await m.escolherParadaPrivada('7','VOLTA',3,9);assert.equal(calls[0].path,'/turmas/7/coleta/VOLTA/minha-parada');assert.deepEqual(JSON.parse(calls[0].options.body),{versao:3,paradaId:9});
    await assert.rejects(m.escolherParadaPrivada('7','INVALID',3,9));assert.equal(calls.length,1);
});
test('notification links distinguish executions from excursions and only use authorized context',()=>{
    const m=load('src/services/notificacoes.ts',{'./catalogo':catalogo(),'../config/api':{}});
    assert.equal(m.destinoNotificacao({contextoTipo:'EXECUCAO_EXCURSAO',contextoId:7}).params.tipo,'EXCURSAO');
    assert.equal(m.destinoNotificacao({contextoTipo:'EXCURSAO',contextoId:7}).pathname,'/editar-excursao');
    assert.equal(m.destinoNotificacao({contextoTipo:'VIAGEM',contextoId:7}).params.tipo,'VIAGEM');
    assert.equal(m.destinoNotificacao({contextoTipo:'DESCONHECIDO',contextoId:7}).pathname,'/(tabs)/home');
});
test('notification read and FCM device requests use only the current session and propagate errors',async()=>{
    const calls=[];const m=load('src/services/notificacoes.ts',{'./catalogo':catalogo(),'../config/api':{apiFetch:async(path,options)=>{calls.push({path,options});return {ok:true};}}});
    await m.lerNotificacao(9);await m.registrarDispositivo('instalacao_123456789','synthetic-token');await m.revogarDispositivo('instalacao_123456789');
    assert.equal(calls[0].options.method,'PUT');assert.equal(calls[1].path,'/notificacoes/dispositivos');assert.equal(JSON.parse(calls[1].options.body).consentePush,true);assert.equal(calls[2].options.method,'DELETE');
    await assert.rejects(m.registrarDispositivo('../invalid','token'));assert.equal(calls.length,3);
});
test('commercial contact accepts only the validated server WhatsApp link',async()=>{
    let data={telefoneComercial:'5581999998888',waMe:'https://wa.me/5581999998888'};
    const m=load('src/services/contatoMotorista.ts',{'./catalogo':catalogo(),'../config/api':{apiRequest:async()=>data}});
    assert.equal(await m.contatoAutorizado('turmas',8),data.waMe);data={...data,waMe:'https://attacker.example/'};await assert.rejects(m.contatoAutorizado('turmas',8),/indisponível/);
});
test('FCM permission denial never registers a token and iOS APNS is not sent as FCM',async()=>{
    let registrations=0,tokenCalls=0;const platform={OS:'android'};
    const m=load('src/services/push.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async()=>null}},'react-native':{Platform:platform},'expo-notifications':{AndroidImportance:{DEFAULT:3},setNotificationChannelAsync:async()=>{},requestPermissionsAsync:async()=>({status:'denied'}),getDevicePushTokenAsync:async()=>{tokenCalls++;}},'./notificacoes':{registrarDispositivo:async()=>registrations++}});
    await assert.rejects(m.ativarPushAndroid('25',()=>true),/não autorizado/);assert.equal(tokenCalls,0);assert.equal(registrations,0);platform.OS='ios';await assert.rejects(m.ativarPushAndroid('25',()=>true),/iOS/);
});
test('resource hook discards late results after account changes and cancellations',async()=>{
    const slots=[];let cursor=0,task,key,userId='25',finish;const react={useRef:value=>{const i=cursor++;return slots[i]??(slots[i]={current:value});},useState:value=>{const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];}};
    const m=load('src/hooks/useRemoteResource.ts',{'react':react,'../contexts/AuthContext':{useAuth:()=>({user:{id:userId}})},'./useFocusedPolling':{useFocusedPolling:(fn,interval,k)=>{task=fn;key=k;}},'../config/api':{errorMessage:e=>e.message}});
    const render=()=>{cursor=0;return m.useRemoteResource('same-id',()=>new Promise(resolve=>{finish=resolve;}));};render();const firstKey=key;const controller=new AbortController();const pending=task(controller.signal);userId='26';render();assert.notEqual(key,firstKey);finish({private:'old account'});await pending;assert.equal(render().data,null);
    const next=task(controller.signal);controller.abort();finish({private:'cancelled'});await next;assert.equal(render().data,null);
});
test('Android push registration persists an account-specific installation and revocation invalidates the native token',async()=>{
    const storage=new Map(),calls=[];
    const m=load('src/services/push.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:{getAllKeys:async()=>[...storage.keys()],getItem:async k=>storage.get(k)||null,setItem:async(k,v)=>storage.set(k,v),removeItem:async k=>storage.delete(k)}},'react-native':{Platform:{OS:'android'}},'expo-notifications':{AndroidImportance:{DEFAULT:3},setNotificationChannelAsync:async()=>{},requestPermissionsAsync:async()=>({status:'granted'}),getDevicePushTokenAsync:async()=>({type:'android',data:'synthetic-fcm'}),unregisterForNotificationsAsync:async()=>calls.push('delete-native-token')},'./notificacoes':{registrarDispositivo:async(id,token)=>calls.push({id,token}),revogarDispositivo:async id=>calls.push({revoke:id})}});
    const id=await m.ativarPushAndroid('25',()=>true);assert.equal(storage.get('@bevans:push:25'),id);assert.equal(calls[0].token,'synthetic-fcm');await m.desativarPush('25');assert.equal(calls[1].revoke,id);assert.equal(calls[2],'delete-native-token');assert.equal(storage.size,0);
});
test('passenger excursions never call the driver listing endpoint or display other participants',()=>{
    const element=(type,props)=>({type,props});let enabled;
    const m=load('src/app/(tabs)/excursoes.tsx',{'react':{useState:initial=>[initial,()=>{}]},'react/jsx-runtime':{jsx:element,jsxs:element},'expo-router':{useRouter:()=>({})},'react-native':{Button:'Button',ScrollView:'Scroll',Text:'Text',View:'View'},'react-native-safe-area-context':{SafeAreaView:'Safe'},'../../contexts/AuthContext':{useAuth:()=>({user:{tipo:'PASSAGEIRO',id:'25'}})},'../../hooks/useRemoteResource':{useRemoteResource:key=>{enabled=key;return {}; }},'../../services/excursoes':{listarExcursoes:()=>assert.fail('passenger must not list driver excursions')},'../../components/AsyncState':{AsyncState:'Async'},'../../styles/globalStyles':{globalStyles:{}}});
    const tree=m.default();assert.equal(enabled,false);assert.ok(JSON.stringify(tree).includes('Acesso por convite'));assert.ok(!JSON.stringify(tree).includes('Criar excursão'));
});
test('excursion collection requires the returned order and does not silently accept mismatched persistence',async()=>{
    const paradas=[{id:1,nome:'Praça A',latitude:-8,longitude:-35,horario:null,instrucoes:null},{id:2,nome:'Praça B',latitude:-8.1,longitude:-35.1,horario:null,instrucoes:null}];let body;
    const m=load('src/services/excursoes.ts',{'./excursaoFormulario':load('src/services/excursaoFormulario.ts',{}),'./catalogo':catalogo(),'../config/api':{apiRequest:async(path,options)=>{body=JSON.parse(options.body);return {id:7,titulo:'Evento',versao:2,modoColeta:'MULTIPLAS_PARADAS',paradas:[...paradas].reverse()};}}});
    await assert.rejects(m.salvarColetaExcursao(7,'MULTIPLAS_PARADAS',1,paradas),/ordem/);assert.equal(body.paradas[0].pontoConfirmado,true);assert.equal(body.versao,1);
});
test('GPS publishing throttles a fast native watcher and never queues skipped samples',async()=>{
    let now=10000;const points=[];const m=load('src/services/telemetria.ts',{'./viagens':{enviarPosicaoVan:async(id,latitude)=>points.push({id,latitude})}},{Date:{now:()=>now},AbortController});
    const context={userId:'25',turmaId:7,online:true,active:true,mounted:true};const sender=m.createPositionSender('25',()=>context);
    assert.equal(await sender.send({latitude:1,longitude:2}),true);now+=2000;assert.equal(await sender.send({latitude:3,longitude:4}),false);now+=4000;assert.equal(await sender.send({latitude:5,longitude:6}),true);assert.deepEqual(points,[{id:7,latitude:1},{id:7,latitude:5}]);
});
test('Firebase passenger never calls an invented own-excursion operation endpoint',async()=>{
    const m=load('src/services/operacoes.ts',{'./catalogo':catalogo(),'../config/api':{apiRequest:()=>assert.fail('anonymous excursion credential belongs to the web flow')}});
    await assert.rejects(m.consultarOperacao('EXCURSAO','7',false),/credencial individual/);
    await assert.rejects(m.alterarEstadoOperacional('EXCURSAO','7',{id:1,versao:0},false,'EMBARCADO'),/página da sua inscrição/);
});
