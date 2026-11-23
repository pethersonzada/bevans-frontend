const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Error,Number,Map,Set,JSON,URLSearchParams,AbortController,...globals,require:name=>{if(name.endsWith('/useThemeRevision'))return {useThemeRevision:()=> 'light'};if(name.endsWith('/themedStyles'))return {themedStyles:factory=>factory()};if(name.endsWith('/PreferenciaAparencia'))return {PreferenciaAparencia:'Appearance'};if(name.endsWith('/ThemeContext'))return {ThemeProvider:'ThemeProvider'};if(!(name in mocks))throw Error(name);return mocks[name];}});return exports;}
const notice=(patch={})=>({id:7,tipo:'NOVA_SOLICITACAO',contextoTipo:'SOLICITACAO_VAGA',contextoId:12,titulo:'Atualização da viagem',mensagem:'Uma nova solicitação aguarda análise.',criadaEm:'2026-11-18T12:00:00Z',lidaEm:null,...patch});
function service(api){return load('src/services/notificacoes.ts',{'../config/api':api,'./catalogo':load('src/services/catalogo.ts',{'../config/api':api})});}
test('histórico aceita Spring e página própria, preserva metadados e remove IDs repetidos',async()=>{
 let response={content:[notice(),notice()],number:0,totalPages:2,totalElements:21};const calls=[];
 const m=service({apiRequest:async(path,options)=>{calls.push({path,options});return response;}});
 assert.equal((await m.listarNotificacoes(0)).itens.length,1);
 response={itens:[notice({id:8,lidaEm:'2026-11-18T13:00:00Z'})],pagina:1,totalPaginas:2,total:21};
 const signal=new AbortController().signal;const page=await m.listarNotificacoes(1,signal);assert.equal(page.pagina,1);assert.equal(page.total,21);assert.equal(calls[1].options.signal,signal);
 assert.match(calls[1].path,/pagina=1/);response={itens:[],pagina:0,totalPaginas:0,total:0};assert.equal((await m.listarNotificacoes(0)).itens.length,0);
});
test('página e avisos malformados são falha explícita, nunca histórico vazio',async()=>{
 for(const response of [null,{}, {content:[notice({id:-1})],number:0,totalPages:1,totalElements:1},{content:[notice({criadaEm:'inválida'})],number:0,totalPages:1,totalElements:1},{content:[notice({lidaEm:'inválida'})],number:0,totalPages:1,totalElements:1},{content:[],number:2,totalPages:3,totalElements:40}]){
  await assert.rejects(service({apiRequest:async()=>response}).listarNotificacoes(0));
 }
});
test('contagem usa o total oficial e rejeita valores não inteiros sem simular zero',async()=>{
 for(const count of [0,1,120])assert.equal(await service({apiRequest:async()=>count}).contarNaoLidas(),count);
 for(const count of [null,-1,2.3,'2',{},NaN])await assert.rejects(service({apiRequest:async()=>count}).contarNaoLidas());
});
test('localização por push percorre páginas autorizadas e para ao encontrar o aviso',async()=>{
 const paths=[];const m=service({apiRequest:async path=>{paths.push(path);const page=paths.length-1;return {content:[notice({id:page?8:7})],number:page,totalPages:3,totalElements:41};}});
 assert.equal((await m.localizarNotificacao('8')).id,8);assert.equal(paths.length,2);await assert.rejects(m.localizarNotificacao('../8'));assert.equal(paths.length,2);
});
test('leitura avisa o contador somente após confirmação e erros mantêm seu significado',async()=>{
 let ok=true,changes=0;const m=service({apiFetch:async()=>({ok}),readApiError:async()=>({status:403})});const stop=m.onNotificacoesChanged(()=>changes++);
 await m.lerNotificacao(7);assert.equal(changes,1);ok=false;await assert.rejects(m.lerNotificacao(7));assert.equal(changes,1);stop();
 assert.match(m.mensagemErroNotificacao({status:401}),/sessão expirou/);assert.match(m.mensagemErroNotificacao({status:403}),/permissão/);assert.match(m.mensagemErroNotificacao({kind:'network'}),/Sem conexão/);
});
test('eventos diferenciam vínculo, autorização de embarque e confirmação física',()=>{
 const m=service({});assert.equal(m.tituloEvento(notice()),'Novo pedido de vínculo');assert.equal(m.tituloEvento(notice({contextoTipo:'EMBARQUE'})),'Novo pedido de embarque');assert.equal(m.tituloEvento(notice({tipo:'SOLICITACAO_APROVADA',contextoTipo:'EMBARQUE'})),'Embarque autorizado');assert.equal(m.tituloEvento(notice({tipo:'EMBARQUE_CONFIRMADO'})),'Embarque confirmado');
});
test('motorista e passageiro consultam suas coleções antes de abrir solicitações sem confundir IDs',async()=>{
 for(const driver of [true,false]){
  const calls=[];const m=service({apiRequest:async path=>{calls.push(path);return [{id:3}];}});
  for(const contextoTipo of ['EMBARQUE','SOLICITACAO_VAGA']){const target=await m.destinoAutorizadoNotificacao(notice({contextoTipo}),driver,'25');assert.equal(target.pathname,'/solicitacoes');assert.equal(target.params.avisoId,'12');assert.equal(target.params.contexto,contextoTipo);}
  assert.ok(calls.every(p=>p===(driver?'/turmas/motorista/25':'/turmas/usuario/25/todas')));
  await assert.rejects(m.destinoAutorizadoNotificacao(notice({contextoTipo:'TURMA'}),driver,'25'),/não está disponível/);
 }
});
test('autorização e rede recusadas não devolvem destino; passageiro não abre edição de excursão',async()=>{
 for(const error of [{status:401},{status:403},{kind:'network'}]){const m=service({apiRequest:async()=>{throw error;}});await assert.rejects(m.destinoAutorizadoNotificacao(notice(),true,'25'));await assert.rejects(m.listarNotificacoes(0));}
 const m=service({apiRequest:async()=>assert.fail('não consultar operação de motorista')});for(const contextoTipo of ['EXCURSAO','EXECUCAO_EXCURSAO'])await assert.rejects(m.destinoAutorizadoNotificacao(notice({contextoTipo}),false,'25'));
 await assert.rejects(m.destinoAutorizadoNotificacao(notice({contextoTipo:'INVENTADO'}),true,'25'),/tipo de aviso/);
});
test('preferências inválidas e falhas remotas não são anunciadas como salvas',async()=>{
 let value={pushOperacional:true,pushInformativo:false};const m=service({apiRequest:async()=>value,apiFetch:async()=>({ok:false}),readApiError:async()=>({status:403})});assert.equal((await m.preferenciasNotificacao()).pushInformativo,false);value={pushOperacional:'true'};await assert.rejects(m.preferenciasNotificacao());await assert.rejects(m.salvarPreferenciasNotificacao({pushOperacional:false,pushInformativo:false}));
});
test('data operacional mantém dia local e rejeita calendário impossível',()=>{
 const m=load('src/services/dataOperacao.ts');assert.equal(m.dataLocal(new Date(2026,10,18,0,30)),'2026-11-18');assert.equal(m.dataLocal(m.lerDataLocal('2028-02-29')),'2028-02-29');for(const value of ['2026-02-29','2026-11-31','2026-13-01','18/11/2026'])assert.throws(()=>m.lerDataLocal(value));
});
test('aprovação de vínculo aceita confirmação HTTP textual sem tentar interpretar JSON',async()=>{
 const calls=[];const m=load('src/services/solicitacoes.ts',{'../config/api':{apiFetch:async(path,options)=>{calls.push({path,options});return {ok:true};},apiRequest:async()=>assert.fail('Não interpretar texto como JSON')},'./catalogo':{recursoId:Number},'./turmas':{}});
 await m.analisarVinculo(12,'APROVADO');assert.equal(calls[0].path,'/turmas/analisar/12?status=APROVADO');assert.equal(calls[0].options.method,'PUT');
});
test('recebimento em foreground e toque por background usam deduplicação independente por conta',async()=>{
 let user={id:'25'},effectCleanup,previousDeps,ref,changes=0,renewals=0,last={notification:{request:{content:{data:{notificacaoId:'7'}}}}};const paths=[],listeners={},removed=[];
 const router={push:p=>paths.push(p)};
 const react={useRef:value=>ref??(ref={current:value}),useEffect:(fn,deps)=>{if(!previousDeps||deps.some((d,i)=>d!==previousDeps[i])){effectCleanup?.();effectCleanup=fn();previousDeps=deps;}}};
 const subscribe=(name,fn)=>{listeners[name]=fn;return {remove:()=>removed.push(name)};};
 const native={addNotificationResponseReceivedListener:fn=>subscribe('response',fn),addNotificationReceivedListener:fn=>subscribe('received',fn),addPushTokenListener:fn=>subscribe('token',fn),clearLastNotificationResponseAsync:async()=>{},getLastNotificationResponseAsync:async()=>last};
 const m=load('src/components/AberturaPush.tsx',{'react':react,'react-native':{Platform:{OS:'android'},AppState:{currentState:'active',addEventListener:(_name,fn)=>subscribe('state',fn)}},'expo-router':{useRouter:()=>router},'expo-notifications':native,'@react-native-community/netinfo':{__esModule:true,default:{addEventListener:fn=>{listeners.network=fn;return ()=>removed.push('network');}}},'../contexts/AuthContext':{useAuth:()=>({user})},'../services/push':{renovarPushAndroid:async()=>{renewals++;}},'../services/aberturaPush':load('src/services/aberturaPush.ts'),'../services/notificacoes':{avisarNotificacoesChanged:()=>changes++}});
 m.AberturaPush();await new Promise(setImmediate);assert.equal(paths.length,1);assert.equal(paths[0].params.notificacaoId,'7');
 const response=last;listeners.received(response.notification);listeners.received(response.notification);assert.equal(changes,1);listeners.response(response);assert.equal(paths.length,1);
 const old= listeners.received;user={id:'26'};m.AberturaPush();await new Promise(setImmediate);assert.equal(paths.length,1);old({request:{content:{data:{notificacaoId:'8'}}}});assert.equal(changes,1);
 listeners.received(response.notification);assert.equal(changes,2);listeners.state('active');listeners.network({isConnected:true});assert.ok(renewals>=3);effectCleanup();assert.ok(removed.length>=10);
});
test('rajada de avisos atualiza revisão uma vez e desmontagem cancela o trabalho pendente',()=>{
 let listener,cleanup,updates=0,id=0;const timers=new Map();
 const m=load('src/hooks/useNotificacoesRevision.ts',{'react':{useState:()=>[0,()=>updates++],useEffect:fn=>cleanup=fn()},'../services/notificacoes':{onNotificacoesChanged:fn=>{listener=fn;return ()=>{listener=null;};}}},{setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 m.useNotificacoesRevision();listener();listener();listener();assert.equal(timers.size,1);timers.values().next().value();assert.equal(updates,1);timers.clear();listener();cleanup();assert.equal(timers.size,0);assert.equal(listener,null);
});
