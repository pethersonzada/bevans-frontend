const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function harness(entry,{services={},resources=()=>({data:null,error:'',reload(){}}),user={id:'1',tipo:'MOTORISTA'},env={EXPO_PUBLIC_CONVITE_WEB_URL:'https://example.test/convite'},extras={}}={}) {
 const slots=[],deps=[],cleanups=[],cache=new Map(),paths=[],keys=[],backHandlers=new Set();let cursor=0,effects=[];
 const lock={current:false},connection={isConnected:true},firebase={currentUser:{uid:'driver-test'}},share={sharedAction:'shared',share:async()=>({action:'dismissed'})};
 const react={createContext:()=>({Provider:'Provider'}),useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef:initial=>{const i=cursor++;return slots[i]??(slots[i]={current:initial});},useEffect:(fn,next)=>{const i=cursor++;if(!next||!deps[i]||next.some((v,j)=>!Object.is(v,deps[i][j])))effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});deps[i]=next;},useCallback:(fn,next)=>{const i=cursor++;if(!deps[i]||next.some((v,j)=>!Object.is(v,deps[i][j])))slots[i]=fn;deps[i]=next;return slots[i];},useContext:()=>lock};
 const jsx=(type,props)=>({type,props});
 const rn={Text:'Text',TextInput:'Input',View:'View',ScrollView:'Scroll',Pressable:'Button',ActivityIndicator:'Spinner',Platform:{OS:'android'},Share:share,StyleSheet:{create:x=>x},BackHandler:{addEventListener:(_,fn)=>{backHandlers.add(fn);return {remove:()=>backHandlers.delete(fn)};}}};
 function load(file){
  file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
  function request(name){
   if(name in extras)return extras[name];
   if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name==='react-native')return rn;
   if(name==='expo-router')return {useLocalSearchParams:()=>({}),useRouter:()=>({push:p=>paths.push(p),replace:p=>paths.push(p),back:()=>paths.push('back')}),useFocusEffect:fn=>react.useEffect(fn,[fn])};
   if(name==='@expo/vector-icons')return {Ionicons:'Icon'};
   if(name==='@react-native-community/netinfo')return {useNetInfo:()=>connection};
   if(name==='react-native-safe-area-context')return {SafeAreaView:'Safe'};
   if(name==='@react-native-community/datetimepicker')return {default:'NativeDatePicker',__esModule:true};
   if(name==='expo-clipboard')return {setStringAsync:async()=>{}};
   if(name.includes('contexts/AuthContext'))return {useAuth:()=>({user})};
   if(name.includes('hooks/useRemoteResource'))return {useRemoteResource:(key,fn)=>{keys.push(key);return resources(key,fn);}};
   if(name.includes('config/api'))return {errorMessage:e=>e.message||'Falha na conexão'};
   if(name.includes('config/firebase'))return {auth:firebase};
   if(name.endsWith('services/excursoes')||(name.startsWith('.')&&path.resolve(path.dirname(file),name)===path.resolve('src/services/excursoes')))return services;
   if(name.includes('EnderecoMapaPicker'))return {default:'MapPicker',__esModule:true};
   if(name.includes('MapaPreviaPublica'))return {default:'MapPreview',__esModule:true};
   if(name.endsWith('AppModal'))return {AppModal:'Modal'};
   if(name.endsWith('AsyncState'))return {AsyncState:'Async'};
   if(name.endsWith('GestaoExcursao'))return {GestaoExcursao:'Management'};
   if(name.startsWith('.')){const target=path.resolve(path.dirname(file),name);for(const ext of ['.ts','.tsx'])if(fs.existsSync(target+ext))return load(target+ext);}
   throw Error('Unexpected import '+name+' in '+file);
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:request,process:{env},Date,Error,Number,JSON,Intl,URL,console});return exports;
 }
 const mod=load(entry);
 return {mod,paths,keys,lock,connection,firebase,share,load,render:(name,props={})=>{cursor=0;effects=[];const tree=mod[name](props);effects.forEach(fn=>fn());return tree;},back:()=>[...backHandlers].at(-1)?.(),unmount:()=>cleanups.forEach(fn=>fn?.())};
}
const nodes=t=>!t||typeof t!=='object'?[]:[t,...[t.props?.children,t.props?.footer,t.props?.action].flat(Infinity).flatMap(nodes)];
const find=(t,label)=>nodes(t).find(n=>n.props?.title===label||n.props?.accessibilityLabel===label);
const fixture=()=>({id:7,titulo:'Passeio de teste',destinoNome:'Centro de eventos',destinoLatitude:-8,destinoLongitude:-35,origemNome:null,origemLatitude:null,origemLongitude:null,partidaEm:new Date(Date.now()+86400000*5).toISOString(),retornoEm:null,capacidade:12,modoColeta:'MULTIPLAS_PARADAS',estado:'PUBLICADA',versao:1,paradas:[{id:1,nome:'Praça A',latitude:-8.1,longitude:-35.1,horario:null,instrucoes:null},{id:2,nome:'Praça B',latitude:-8.2,longitude:-35.2,horario:null,instrucoes:null}]});
module.exports={harness,nodes,find,fixture};
