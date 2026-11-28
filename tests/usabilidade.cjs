const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Error,...globals,require:name=>{if(name.endsWith('/useThemeRevision'))return {useThemeRevision:()=> 'light'};if(name.endsWith('/themedStyles'))return {themedStyles:factory=>factory()};if(name.endsWith('/PreferenciaAparencia'))return {PreferenciaAparencia:'Appearance'};if(name.endsWith('/ThemeContext'))return {ThemeProvider:'ThemeProvider'};if(!(name in mocks))throw Error(name);return mocks[name];}});return exports;}
const nodes=t=>!t||typeof t!=='object'?[]:[t,...[t.props?.children].flat(Infinity).flatMap(nodes)];
const texts=t=>nodes(t).filter(n=>n.type==='Text').map(n=>[n.props.children].flat(Infinity).join('')).join(' ');
function painelHarness(motorista=true,{tipo='VIAGEM',snapshot=null,excursaoId}={}){
    const slots=[];let cursor=0,reloads=0,finish;const calls=[];
    const react={useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef:value=>{const i=cursor++;return slots[i]??(slots[i]={current:value});},useEffect:()=>{},useCallback:fn=>fn};
    const e=(type,props)=>({type,props}),theme={colors:{}};
    const real=load('src/services/operacoes.ts',{'../config/api':{},'./catalogo':{recursoId:Number}});
    const record={id:8,nome:'Ana',estado:'AGUARDANDO',versao:2,ordem:1};
    const data=motorista?{tipo:'VIAGEM',referenciaId:7,sentido:'IDA',contadores:{esperados:1,aguardando:1,naVan:0,naoEmbarcaram:0,desembarcados:0},registros:[record]}:record;
    const m=load('src/app/controle-viagem.tsx',{'react':react,'react/jsx-runtime':{jsx:e,jsxs:e},'expo-router':{useRouter:()=>({back(){}})},'react-native':{ScrollView:'Scroll',Text:'Text',Pressable:'Button',View:'View',TextInput:'Input',StyleSheet:{create:v=>v}},'react-native-safe-area-context':{SafeAreaView:'Safe'},'@expo/vector-icons':{Ionicons:'Icon'},'../contexts/AuthContext':{},'../hooks/useRemoteResource':{useRemoteResource:key=>({data:key===false?null:String(key).startsWith('snapshot-excursao:')?snapshot:data,error:'',reload:()=>reloads++})},'../services/excursoes':{},'../components/excursoes/RoteiroExecucaoExcursao':{RoteiroExecucaoExcursao:'Snapshot'},'../services/operacoes':{...real,alterarEstadoOperacional:(...args)=>{calls.push(args);return new Promise((resolve,reject)=>{finish={resolve,reject};});}},'../components/AsyncState':{AsyncState:'Async'},'../components/RastreamentoViagem':{RastreamentoViagem:'GPS'},'../styles/theme':{theme}});
    const render=()=>{cursor=0;return m.Painel({tipo,id:'7',motorista,excursaoId});};
    const press=(tree,label)=>{const n=nodes(tree).find(n=>n.type==='Button'&&texts(n)===label);assert.ok(n,label);return n.props.onPress();};
    return {render,press,calls,get finish(){return finish;},get reloads(){return reloads;}};
}
test('operational UI exposes separate accessible counters and readable states',()=>{const h=painelHarness(),t=h.render();assert.ok(texts(t).includes('Aguardando'));assert.ok(!texts(t).includes('AGUARDANDO'));for(const label of ['Na van: 0','Pendentes: 1','Desembarcados: 0'])assert.equal(nodes(t).filter(n=>n.props?.accessibilityLabel===label).length,1);assert.ok(nodes(t).filter(n=>n.type==='Button').every(n=>n.props.accessibilityRole==='button'));});
test('operational important actions require confirmation; conflicts reload official state',async()=>{const h=painelHarness();h.press(h.render(),'Não embarcou');assert.equal(h.calls.length,0);h.press(h.render(),'Sim, confirmar');assert.equal(h.calls.length,1);h.finish.reject({status:409});await new Promise(setImmediate);assert.equal(h.reloads,1);assert.match(texts(h.render()),/estado mudou/);});
test('boarding remains quick and duplicate taps make only one write',async()=>{const h=painelHarness(false);const t=h.render();assert.ok(!texts(t).includes('Ana'));h.press(t,'Embarquei');h.press(t,'Embarquei');assert.equal(h.calls.length,1);assert.equal(h.calls[0][4],'EMBARCADO');h.finish.resolve({});await new Promise(setImmediate);assert.equal(h.reloads,1);});
test('operational errors distinguish session, permission, conflict, timeout and offline',()=>{const m=load('src/services/operacoes.ts',{'../config/api':{},'./catalogo':{recursoId:Number}});assert.match(m.mensagemErroOperacao({status:401}),/sessão expirou/);assert.match(m.mensagemErroOperacao({status:403}),/permissão/);assert.match(m.mensagemErroOperacao({status:409}),/estado mudou/);assert.match(m.mensagemErroOperacao({kind:'timeout'}),/pode ter sido registrada/);assert.match(m.mensagemErroOperacao({kind:'network'}),/Sem conexão/);});

test('operational service rejects a panel from another execution or modality',async()=>{
 let payload={tipo:'VIAGEM',referenciaId:8,contadores:{},registros:[]};
 const m=load('src/services/operacoes.ts',{'../config/api':{apiRequest:async()=>payload},'./catalogo':{recursoId:Number}});
 await assert.rejects(m.consultarOperacao('VIAGEM','7',true),/inválido/);
 payload={...payload,referenciaId:7,tipo:'EXCURSAO'};await assert.rejects(m.consultarOperacao('VIAGEM','7',true),/inválido/);
});

test('excursion controls wait for the official active execution and block every mutation after finalization',()=>{
 for(const snapshot of [null,{estado:'FINALIZADA'}]){const h=painelHarness(true,{tipo:'EXCURSAO',excursaoId:'3',snapshot}),t=h.render();for(const label of ['Confirmar embarque','Confirmar desembarque','Não embarcou','Corrigir para aguardando']){const b=nodes(t).find(n=>n.type==='Button'&&texts(n)===label);assert.equal(b.props.disabled,true,label);}h.press(t,'Confirmar embarque');assert.equal(h.calls.length,0);}
 const h=painelHarness(true,{tipo:'EXCURSAO',excursaoId:'3',snapshot:{estado:'EM_ANDAMENTO'}});h.press(h.render(),'Confirmar embarque');assert.equal(h.calls.length,1);
});
