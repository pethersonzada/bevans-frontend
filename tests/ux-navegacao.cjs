const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const ui=require('./helpers/ui.cjs');
const themeExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/styles/theme.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:themeExports});
const nodes=t=>!t||typeof t!=='object'?[]:[t,...[t.props?.children,t.props?.action].flat(Infinity).flatMap(nodes)];
test('trip shortcut rejects invalid execution identifiers and distinguishes status errors from loading',()=>{
 for(const viagemId of [-1,0,1.5,'7',null,7]){
  const h=harness('src/components/AtalhosTurma.tsx',{'../hooks/useRemoteResource':{useRemoteResource:()=>({data:{status:'ATIVA',viagemId},error:''})}});
  const t=h.render('AtalhosTurma',{turmaId:7});assert.equal(nodes(t).some(n=>n.props?.title==='Acompanhar viagem'),viagemId===7);
 }
 const h=harness('src/components/AtalhosTurma.tsx',{'../hooks/useRemoteResource':{useRemoteResource:()=>({data:null,error:'offline'})}});
 assert.ok(JSON.stringify(h.render('AtalhosTurma',{turmaId:7})).includes('Não foi possível confirmar a viagem'));
});
function harness(file,overrides={}){
    const slots=[],deps=[],cleanups=[];let cursor=0,effects=[];
    const react={useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef:value=>{const i=cursor++;return slots[i]??(slots[i]={current:value});},useEffect:(fn,next=[])=>{const i=cursor++;if(!deps[i]||next.some((v,j)=>v!==deps[i][j]))effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});deps[i]=next;},useCallback:fn=>fn,useContext:()=>({current:false})};
    const paths=[],keys=[],router={push:p=>paths.push(p),back:()=>paths.push('back'),replace:p=>paths.push(p)};
    const mocks={react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'react-native':{Platform:{OS:'android'},Text:'Text',View:'View',Switch:'Switch',TextInput:'Input',TouchableOpacity:'Button',Pressable:'Pressable',StyleSheet:{create:x=>x}},'expo-router':{useRouter:()=>router,useLocalSearchParams:()=>({}),useFocusEffect:fn=>react.useEffect(fn,[])},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},'@react-native-community/netinfo':{useNetInfo:()=>({isConnected:true})},'@expo/vector-icons':{Ionicons:'Icon'},'../components/ui/Primitives':ui,'./ui/Primitives':ui,'../styles/theme':{theme:{colors:{primary:'#14253A',surface:'#fff'}}},'../styles/globalStyles':{globalStyles:{}},'../contexts/AuthContext':{useAuth:()=>({user:{id:'1',tipo:'MOTORISTA'},isLoading:false})},'../hooks/useRemoteResource':{useRemoteResource:key=>{keys.push(key);return {data:null,error:'',reload(){}};}},'../hooks/useNotificacoesRevision':{useNotificacoesRevision:()=>0},'../components/AsyncState':{AsyncState:'Async'},'./AsyncState':{AsyncState:'Async'},'../components/PreferenciaPush':{PreferenciaPush:'Push'},'../services/notificacoes':{},'../config/api':{errorMessage:e=>e.message},'../components/EnderecoMapaPicker':{default:'Map',__esModule:true},'../components/MapaPreviaPublica':{default:'MapPreview',__esModule:true},'../components/PedidosRota':{PedidosRota:'Pedidos'},'../services/rotasPublicas':{},'../services/turmas':{},'../services/viagens':{},'./ContatoProtegido':{ContatoProtegido:'Contact'},'./MapaPreviaPublica':{default:'MapPreview',__esModule:true},'../services/excursoes':{},'../services/convitesCompartilhamento':{onConvitesChanged:()=>()=>{}},'./ExcursaoActionContext':{ExcursaoActionContext:{}},...overrides};
    mocks['../styles/theme']=themeExports;
    for(const [name,value] of Object.entries(mocks))if(name.startsWith('../'))mocks['../'+name]=value;
    const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Error,JSON,Number,process:{env:{}},require:name=>{assert.ok(name in mocks,'Unexpected import '+name);return mocks[name];}});
    return {paths,keys,render:(name='default',props={})=>{cursor=0;effects=[];const tree=exports[name](props);effects.forEach(f=>f());return tree;},unmount:()=>cleanups.forEach(f=>f?.())};
}
test('central has one settings destination and does not fetch device or preference configuration',()=>{
    const h=harness('src/app/notificacoes.tsx');const t=h.render('Central',{motorista:true});
    assert.ok(!h.keys.includes('notificacoes:preferencias'));
    assert.equal(nodes(t).filter(n=>n.type==='Push'||n.type==='Switch').length,0);
    nodes(t).find(n=>n.type==='IconButton').props.onPress();assert.deepEqual(h.paths,['/configuracoes-notificacoes']);
    nodes(t).find(n=>n.type==='Screen').props.onBack();assert.equal(h.paths.at(-1),'back');
});
test('notification preferences stay separate, block network writes offline and keep device revocation reachable',()=>{
    const prefs={pushOperacional:true,pushInformativo:false};let writes=0;
    const h=harness('src/app/configuracoes-notificacoes.tsx',{'@react-native-community/netinfo':{useNetInfo:()=>({isConnected:false})},'../hooks/useRemoteResource':{useRemoteResource:()=>({data:prefs,reload(){}})},'../services/notificacoes':{salvarPreferenciasNotificacao:()=>{writes++;}}});
    const t=h.render('Preferencias');const switches=nodes(t).filter(n=>n.type==='Switch');assert.equal(switches.length,2);assert.ok(switches.every(n=>n.props.disabled));switches[0].props.onValueChange(false);assert.equal(writes,0);assert.equal(nodes(t).filter(n=>n.type==='Push').length,1);
});
test('driver and passenger turma shortcuts expose different destinations',()=>{
    for(const role of ['MOTORISTA','PASSAGEIRO']){
        const h=harness('src/components/AtalhosTurma.tsx',{'../contexts/AuthContext':{useAuth:()=>({user:{tipo:role}})}});
        const t=h.render('AtalhosTurma',{turmaId:7}),row=nodes(t).find(n=>n.type==='MenuRow');if(role==='MOTORISTA'){assert.equal(row,undefined);continue;}row.props.onPress();
        assert.equal(h.paths[0].pathname,'/coleta-privada');
        assert.equal(h.paths[0].params.turmaId,'7');assert.equal(nodes(t).some(n=>n.props?.title==='Configurações da turma'),role==='MOTORISTA');
    }
});
test('passenger cannot load or enter the driver settings menu',()=>{
    const h=harness('src/app/configuracoes-turma.tsx',{'../contexts/AuthContext':{useAuth:()=>({user:{id:'1',tipo:'PASSAGEIRO'}})}});
    const t=h.render();assert.deepEqual(h.keys,[false]);assert.equal(nodes(t).filter(n=>n.type==='MenuRow').length,0);
});
test('public route creation starts at its identity without selecting or creating a private turma',async()=>{
    const routes=require('./helpers/rotasPublicas.cjs');let bases=0;
    const h=routes.harness({extras:{'../../services/turmas':{listarTurmasMotorista:async()=>{bases++;return [];}}}});
    let t=h.tree();assert.equal(t.props.title,'Nova rota pública');assert.equal(bases,0);
    routes.input(h,'Nome da rota','Rascunho de teste');routes.press(h,'Continuar');
    assert.equal(h.writes.length,0);assert.equal(bases,0);
    assert.equal(routes.find(h.tree(),'Nome da rota').props.value,'Rascunho de teste');
    assert.ok(JSON.stringify(h.tree()).includes('Informe nome e cidade'));h.unmount();
});
test('route list offers creation without a turma-first chooser or automatic entity creation',async()=>{
    const h=harness('src/app/rotas-publicas.tsx',{'../services/rotasPublicas':{listarMinhasRotas:async()=>[]}});
    h.render();await new Promise(setImmediate);const t=h.render();nodes(t).find(n=>n.props?.title==='Criar rota pública').props.onPress();assert.deepEqual(h.paths,['/editar-rota-publica']);assert.ok(!JSON.stringify(t).includes('Criar uma turma'));h.unmount();
});
test('excursion management sections load only their own resource',()=>{
    for(const section of ['participantes','convites','roteiro']){
        const h=harness('src/components/GestaoExcursao.tsx',{'./excursoes/ViagemUI':{trip:{}}});const t=h.render('GestaoExcursao',{id:7,secao:section});
        assert.equal(h.keys.filter(Boolean).length,section==='roteiro'?0:1);
        if(section!=='roteiro')assert.ok(h.keys.find(Boolean).startsWith(section+'-excursao:'));
        const titles=nodes(t).filter(n=>n.type==='Button').map(n=>n.props.title);
        assert.equal(titles.some(x=>x.includes('Otimizar prévia')),section==='roteiro');
    }
});
test('notification bell routes to the central with an accessible unread count',()=>{
    const h=harness('src/components/AtalhoNotificacoes.tsx',{'../hooks/useRemoteResource':{useRemoteResource:()=>({data:12})}});
    const t=h.render('AtalhoNotificacoes');assert.equal(t.props.accessibilityRole,'button');assert.match(t.props.accessibilityLabel,/12 não lidas/);t.props.onPress();assert.deepEqual(h.paths,['/notificacoes']);
});

test('profile keeps commercial contact driver-only and logout behind confirmation without notification shortcuts',()=>{
    for(const role of ['MOTORISTA','PASSAGEIRO']){
        let loggedOut=0;
        const h=harness('src/app/(tabs)/perfil.tsx',{'../contexts/AuthContext':{useAuth:()=>({user:{id:'1',tipo:role,nome:'Pessoa de teste'},signOut:()=>{loggedOut++;}})},'../contexts/AppAlertContext':{useAppAlert:()=>({alert(){}})},'../components/AppModal':{AppModal:'Modal'},'../services/conta':{},'../components/FormFeedback':{FormFeedback:'Feedback'},'../components/LogoutConfirmation':{LogoutConfirmation:'Logout'},'../config/firebase':{auth:{currentUser:{email:'test@example.test'}}},'firebase/auth':{}});
        let t=h.render();assert.equal(nodes(t).some(n=>n.props?.title==='Contato comercial'),role==='MOTORISTA');
        assert.ok(!JSON.stringify(t).includes('Preferências de notificações'));
        if(role==='MOTORISTA'){nodes(t).find(n=>n.props?.title==='Contato comercial').props.onPress();assert.equal(h.paths.at(-1),'/contato-comercial');}
        nodes(t).find(n=>n.props?.title==='Sair da conta').props.onPress();t=h.render();assert.equal(loggedOut,0);assert.ok(nodes(t).some(n=>n.type==='Logout'));
    }
});

test('shared buttons and form fields expose native accessibility, wrapping height and readable labels',()=>{
    const h=harness('src/components/ui/Primitives.tsx');
    const t=h.render('ActionButton',{title:'Uma ação longa que pode ocupar mais de uma linha',busy:true,onPress(){}});
    assert.equal(t.props.disabled,true);assert.equal(t.props.accessibilityState.busy,true);assert.equal(t.props.accessibilityRole,'button');
    const field=h.render('Field',{label:'Telefone comercial',value:''});assert.equal(nodes(field).find(n=>n.type==='Input').props.accessibilityLabel,'Telefone comercial');
});

test('commercial contact requires fresh consent and serializes double taps without changing the API payload',async()=>{
    const calls=[];let finish,saved=0;
    const h=harness('src/app/contato-comercial.tsx',{'../services/contatoMotorista':{salvarContatoComercial:async payload=>{calls.push(payload);await new Promise(r=>finish=r);}}});
    const props={data:{telefone:'5581999998888',habilitado:true,versao:3},onSaved:()=>saved++,onEditing(){}};
    let t=h.render('Formulario',props);let button=nodes(t).find(n=>n.props?.title==='Salvar contato');assert.equal(button.props.disabled,true);button.props.onPress();assert.equal(calls.length,0);
    nodes(t).find(n=>n.type==='Switch'&&n.props.accessibilityLabel==='Aceite de divulgação comercial').props.onValueChange(true);
    t=h.render('Formulario',props);button=nodes(t).find(n=>n.props?.title==='Salvar contato');button.props.onPress();button.props.onPress();assert.equal(calls.length,1);assert.equal(calls[0].versao,3);assert.equal(calls[0].aceiteDivulgacao,true);finish();await new Promise(setImmediate);assert.equal(saved,1);
});

test('remote read placeholders show reconnection instead of indefinite loading when offline',()=>{
    const h=harness('src/components/ui/Primitives.tsx',{'@react-native-community/netinfo':{useNetInfo:()=>({isConnected:false})}});
    const t=h.render('RemoteLoading');assert.ok(JSON.stringify(t).includes('Sem conexão'));assert.ok(!JSON.stringify(t).includes('ActivityIndicator'));
});

test('optional excursion origin opens its map only after an explicit action and ignores an unconfirmed point',()=>{
    const selected=[];
    const h=harness('src/components/PontoFormulario.tsx',{'./EnderecoMapaPicker':{default:'Map',__esModule:true}});
    const props={label:'Origem operacional',value:null,optional:true,onChange:v=>selected.push(v)};
    let t=h.render('PontoFormulario',props);assert.equal(nodes(t).filter(n=>n.type==='Map').length,0);t.props.onPress();
    t=h.render('PontoFormulario',props);const map=nodes(t).find(n=>n.type==='Map');map.props.onChange(null);assert.equal(selected.length,0);
    map.props.onChange({nome:'Ponto de teste',latitude:-8,longitude:-35});assert.equal(selected.length,1);t=h.render('PontoFormulario',props);assert.equal(nodes(t).filter(n=>n.type==='Map').length,0);
});
