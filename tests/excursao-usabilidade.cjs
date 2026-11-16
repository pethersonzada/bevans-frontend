const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Error,Intl,...globals,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];}});return exports;}
const form=load('src/services/excursaoFormulario.ts',{});
const nodes=t=>!t||typeof t!=='object'?[]:[t,...[t.props?.children].flat(Infinity).flatMap(nodes)];
function harness(file,mocks={}){
 const slots=[],deps=[];let cursor=0,effects=[];const lock={current:false};
 const react={useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef:value=>{const i=cursor++;return slots[i]??(slots[i]={current:value});},useContext:()=>lock,useEffect:(fn,next)=>{const i=cursor++;if(!deps[i]||next.some((v,j)=>v!==deps[i][j]))effects.push(fn);deps[i]=next;}};
 const el=(type,props)=>({type,props});
 const mod=load(file,{'../components/PontoFormulario':{PontoFormulario:'PointField'},'../components/ui/Primitives':require('./helpers/ui.cjs'),'./ui/Primitives':require('./helpers/ui.cjs'),'react':react,'react/jsx-runtime':{jsx:el,jsxs:el},'expo-router':{},'react-native':{Button:'Button',Text:'Text',View:'View',TextInput:'Input',Platform:{OS:'android'},Share:{sharedAction:'shared',share:async()=>({action:'dismissed'})}},'expo-clipboard':{},'../services/convitesCompartilhamento':{estadoConviteCompartilhamento:()=>null,onConvitesChanged:()=>()=>{}},'react-native-safe-area-context':{},'../hooks/useRemoteResource':{},'../services/excursoes':{},'../contexts/AuthContext':{},'../components/AsyncState':{},'../components/EnderecoMapaPicker':{__esModule:true,default:'Map'},'../config/api':{errorMessage:e=>e.message},'../styles/globalStyles':{globalStyles:{}},'../components/GestaoExcursao':{},'../components/SeletorDataHora':{SeletorDataHora:'DatePicker'},'../services/excursaoFormulario':form,'../components/ExcursaoActionContext':{ExcursaoActionContext:{}},...mocks},{process:{env:{EXPO_PUBLIC_CONVITE_WEB_URL:'https://example.test/convite'}}});
 return {render:(name,props)=>{cursor=0;effects=[];const t=mod[name](props);effects.forEach(f=>f());return t;},lock};
}
test('date and time selection preserves local calendar and emits an ISO instant without manual input',()=>{
 const original=new Date(2027,4,10,9,35),chosen=new Date(2027,5,12,17,45);
 const date=new Date(form.selecionarDataHora(original.toISOString(),chosen,'date'));assert.equal(date.getMonth(),5);assert.equal(date.getDate(),12);assert.equal(date.getHours(),9);
 const time=new Date(form.selecionarDataHora(original.toISOString(),chosen,'time'));assert.equal(time.getMonth(),4);assert.equal(time.getHours(),17);assert.equal(time.getMinutes(),45);assert.equal(time.toISOString().endsWith('Z'),true);
});
test('form rejects past start, reverse return, fractional seats and incoherent invitation expiry',()=>{
 const now=Date.parse('2026-11-15T12:00:00-03:00');
 assert.throws(()=>form.validarDatasExcursao('2026-11-15T11:59:00-03:00',null,10,now),/futura/);
 assert.throws(()=>form.validarDatasExcursao('2026-11-16T12:00:00-03:00','2026-11-16T11:00:00-03:00',10,now),/retorno/);
 assert.throws(()=>form.validarDatasExcursao('2026-11-16T12:00:00-03:00',null,1.5,now),/inteira/);
 form.validarDatasExcursao('2026-11-16T12:00:00-03:00','2026-11-17T12:00:00-03:00',10,now);
 for(const expiry of ['invalid','2026-11-14T12:00:00Z','2026-11-18T12:00:00Z'])assert.throws(()=>form.validarValidadeConvite(expiry,'2026-11-17T12:00:00Z',now));
 form.validarValidadeConvite('2026-11-16T12:00:00-03:00','2026-11-17T12:00:00Z',now);
});
test('sharing cancellation, failure and shared result never claim message delivery',async()=>{
 assert.match(await form.compartilharConviteSeguro('secret',async()=>({action:'dismissed'}),'shared'),/cancelado/);
 assert.match(await form.compartilharConviteSeguro('secret',async()=>{throw Error('native error');},'shared'),/tente compartilhar novamente/);
 assert.match(await form.compartilharConviteSeguro('secret',async()=>({action:'shared'}),'shared'),/entrega.*não foi confirmada/);
});
const excursion={id:7,titulo:'Original',versao:1,estado:'PUBLICADA',partidaEm:'2027-05-10T12:00:00Z',retornoEm:null,capacidade:10,modoColeta:'MULTIPLAS_PARADAS',destinoNome:'Evento',destinoLatitude:-8,destinoLongitude:-35,paradas:[{id:1,nome:'Praça A',latitude:-8,longitude:-35},{id:2,nome:'Praça B',latitude:-9,longitude:-36}]};
test('editor keeps unrelated drafts and stop order across stages and version updates',()=>{
 const h=harness('src/app/editar-excursao.tsx');let props={excursao:excursion,etapa:'Dados',versaoAtual:1,onSaved:async()=>{}};
 let t=h.render('Editor',props);nodes(t).find(n=>n.type==='Input'&&n.props.accessibilityLabel==='Título da excursão').props.onChangeText('Meu rascunho');
 props={...props,etapa:'Embarques',versaoAtual:2};t=h.render('Editor',props);assert.equal(nodes(t).find(n=>n.type==='Input'&&n.props.accessibilityLabel==='Título da excursão').props.value,'Meu rascunho');assert.ok(JSON.stringify(t).includes('rascunho foi preservado'));
 props={...props,excursao:{...excursion,versao:2}};h.render('Editor',props);t=h.render('Editor',props);assert.equal(nodes(t).find(n=>n.type==='Input'&&n.props.accessibilityLabel==='Título da excursão').props.value,'Meu rascunho');assert.equal(nodes(t).filter(n=>n.type==='Input'&&n.props.accessibilityLabel?.startsWith('Nome da parada')).map(n=>n.props.value).join(','),'Praça A,Praça B');
});
test('created invitation is retained after dismissed share, so retry does not issue a second token',async()=>{
 let issued=0;
 const recovered=load('src/services/convitesCompartilhamento.ts',{'../config/firebase':{auth:{currentUser:{uid:'synthetic-driver'}}},'./excursaoFormulario':form,'./excursoes':{criarConviteExcursao:async()=>{issued++;return {id:4,token:'synthetic'};},validarPaginaConvite:()=>{},linkConvite:()=> 'https://example.test/#synthetic',buscarExcursao:async()=>excursion,convitesExcursao:async()=>[{id:4,expiraEm:new Date(Date.now()+3600000).toISOString(),revogadoEm:null}]}});
 const h=harness('src/app/editar-excursao.tsx',{'../services/convitesCompartilhamento':recovered});
 const props={excursao:excursion,etapa:'Convites',versaoAtual:1,onSaved:async()=>{}};
 let t=h.render('Editor',props);nodes(t).find(n=>n.type==='DatePicker'&&n.props.label==='Validade do convite').props.onChange(new Date(Date.now()+3600000).toISOString());
 t=h.render('Editor',props);await nodes(t).find(n=>n.props?.title==='Gerar e compartilhar convite').props.action();t=h.render('Editor',props);assert.ok(JSON.stringify(t).includes('Compartilhamento cancelado'));await nodes(t).find(n=>n.props?.title==='Compartilhar convite criado novamente').props.action();assert.equal(issued,1);
});
test('irreversible action requires confirmation and rejects double taps while pending',async()=>{
 let calls=0,finish;const h=harness('src/app/editar-excursao.tsx');const props={title:'Finalizar execução',confirmMessage:'Encerrar?',action:()=>{calls++;return new Promise(resolve=>finish=resolve);}};
 let t=h.render('AsyncAction',props);nodes(t).find(n=>n.type==='Button'&&n.props.title==='Finalizar execução').props.onPress();assert.equal(calls,0);
 t=h.render('AsyncAction',props);const button=nodes(t).find(n=>n.type==='Button'&&n.props.title==='Confirmar: Finalizar execução');button.props.onPress();button.props.onPress();assert.equal(calls,1);finish();await new Promise(setImmediate);assert.equal(h.lock.current,false);
});

test('date picker dismissal does not mutate a draft and confirmed selection emits ISO',()=>{
 const h=harness('src/components/SeletorDataHora.tsx',{'@react-native-community/datetimepicker':{__esModule:true,default:'NativeDatePicker'}});const values=[];const props={label:'Partida',value:'2027-05-10T12:00:00Z',onChange:v=>values.push(v)};
 let t=h.render('SeletorDataHora',props);nodes(t).find(n=>n.props?.title==='Escolher data: Partida').props.onPress();t=h.render('SeletorDataHora',props);nodes(t).find(n=>n.type==='NativeDatePicker').props.onChange({type:'dismissed'},new Date(2027,6,11));assert.equal(values.length,0);
 t=h.render('SeletorDataHora',props);nodes(t).find(n=>n.props?.title==='Escolher data: Partida').props.onPress();t=h.render('SeletorDataHora',props);nodes(t).find(n=>n.type==='NativeDatePicker').props.onChange({type:'set'},new Date(2027,6,11));assert.equal(new Date(values[0]).getMonth(),6);
});
test('a failed background refresh keeps the mounted editor snapshot instead of unmounting it',()=>{
 let resource={data:{excursao:excursion,execucoes:[]},error:'',reload:()=>{}};
 const h=harness('src/app/editar-excursao.tsx',{'expo-router':{useRouter:()=>({})},'../hooks/useRemoteResource':{useRemoteResource:()=>resource}});
 h.render('TelaExcursao',{id:'7',motorista:true});let t=h.render('TelaExcursao',{id:'7',motorista:true});const editor=nodes(t).find(n=>typeof n.type==='function'&&n.type.name==='Editor');assert.equal(editor.props.excursao,excursion);
 resource={data:null,error:'offline',reload:()=>{}};t=h.render('TelaExcursao',{id:'7',motorista:true});assert.equal(nodes(t).find(n=>typeof n.type==='function'&&n.type.name==='Editor').props.excursao,excursion);
});

test('publication reviews saved excursion data and blocks publishing an unrelated unsaved draft',()=>{
 const h=harness('src/app/editar-excursao.tsx');const original={...excursion,origemNome:null,origemLatitude:null,origemLongitude:null};
 let props={excursao:original,etapa:'Dados',versaoAtual:1,onSaved:async()=>{}};
 let t=h.render('Editor',props);nodes(t).find(n=>n.type==='Input'&&n.props.accessibilityLabel==='Título da excursão').props.onChangeText('Ainda não salvo');
 props={...props,etapa:'Publicação'};t=h.render('Editor',props);
 assert.equal(nodes(t).find(n=>n.props?.title==='Publicar excursão').props.disabled,true);
 assert.ok(nodes(t).some(n=>n.type==='Section'&&n.props.description==='Confira a versão salva no servidor.'));
 const review=nodes(t).find(n=>n.type==='Section'&&n.props.title==='Revisão e publicação');
 assert.ok(JSON.stringify(review).includes('Original'));assert.ok(!JSON.stringify(review).includes('Ainda não salvo'));
});

test('saving boarding points adopts server IDs without leaving publication blocked by an already-saved draft',async()=>{
 const original={...excursion,origemNome:null,origemLatitude:null,origemLongitude:null};
 const saved={...original,versao:2,paradas:[{...original.paradas[0],nome:'Praça revisada'}]};
 const h=harness('src/app/editar-excursao.tsx',{'../services/excursoes':{salvarColetaExcursao:async()=>saved}});
 let props={excursao:original,etapa:'Embarques',versaoAtual:1,onSaved:async()=>{}};
 let t=h.render('Editor',props);nodes(t).find(n=>n.type==='Input'&&n.props.accessibilityLabel==='Nome da parada 1').props.onChangeText('Praça revisada');
 t=h.render('Editor',props);await nodes(t).find(n=>n.props?.title==='Salvar modo e paradas').props.action();
 props={...props,excursao:saved,etapa:'Publicação',versaoAtual:2};h.render('Editor',props);t=h.render('Editor',props);
 assert.equal(nodes(t).find(n=>n.props?.title==='Publicar excursão').props.disabled,false);
});
