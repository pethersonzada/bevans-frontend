const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URL,URLSearchParams,Error,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];}});return exports;}
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
    const m=load('src/services/excursoes.ts',{'./catalogo':catalogo(),'../config/api':{}});assert.equal(m.linkConvite('https://example.test/convite','secret'),'https://example.test/convite#secret');
    for(const base of [undefined,'http://example.test/','https://example.test/?token=x','https://user:pass@example.test/'])assert.throws(()=>m.linkConvite(base,'secret'));
});
test('operational confirmation sends current version and preserves independent disembarkation',async()=>{
    const calls=[];const m=load('src/services/operacoes.ts',{'./catalogo':catalogo(),'../config/api':{apiRequest:async(path,opts)=>{const body=JSON.parse(opts.body);calls.push({path,body});return {id:6,estado:body.estado};}}});
    await m.alterarEstadoOperacional('VIAGEM','11',{id:6,versao:2},false,'EMBARCADO');await m.alterarEstadoOperacional('EXCURSAO','12',{id:6,versao:3},true,'DESEMBARCADO');
    assert.equal(calls[0].path,'/operacoes/VIAGEM/11/minha/estado');assert.equal(calls[0].body.versao,2);assert.equal(calls[0].body.correcao,false);assert.equal(calls[1].path,'/operacoes/EXCURSAO/12/passageiros/6/estado');assert.equal(calls[1].body.estado,'DESEMBARCADO');assert.throws(()=>m.prefixoOperacao('TURMA','11'));
});
