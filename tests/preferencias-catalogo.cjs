const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,find}=require('./helpers/excursoes.cjs');
const tick=()=>new Promise(setImmediate),ui=require('./helpers/ui.cjs');
const filters=(cidade='Recife')=>({cidade,destino:'Campus',categoria:'UNIVERSITARIA',somenteFavoritas:true});
const payload=cidade=>JSON.stringify({versao:1,filtros:filters(cidade)});
function preferences(storage){return harness('src/services/preferenciasCatalogo.ts',{extras:{'@react-native-async-storage/async-storage':{__esModule:true,default:storage}}}).mod;}
test('filtros restaurados validam esquema e ficam isolados por conta',async()=>{
 const memory=new Map(),storage={getItem:async k=>memory.get(k)||null,setItem:async(k,v)=>{memory.set(k,v);}},m=preferences(storage);
 await m.salvarFiltrosCatalogo('2',filters());assert.equal((await m.lerFiltrosCatalogo('2')).cidade,'Recife');assert.equal((await m.lerFiltrosCatalogo('3')).cidade,'');
 assert.equal(m.normalizarFiltrosCatalogo({cidade:' X ',categoria:'ADMIN',somenteFavoritas:'true'}).somenteFavoritas,false);assert.equal(m.normalizarFiltrosCatalogo({cidade:'x'.repeat(200)}).cidade.length,160);
 memory.set('@bevans:catalogo:filtros:v1:2','{inválido');assert.equal((await m.lerFiltrosCatalogo('2')).cidade,'');memory.set('@bevans:catalogo:filtros:v1:2',JSON.stringify({versao:2,filtros:filters()}));assert.equal((await m.lerFiltrosCatalogo('2')).cidade,'');await assert.rejects(m.lerFiltrosCatalogo('../3'));
});
test('pesquisar e limpar preservam ordem de gravação e releitura espera escrita pendente',async()=>{
 const writes=[],memory=new Map();const m=preferences({getItem:async k=>memory.get(k)||null,setItem:(k,v)=>new Promise(resolve=>{writes.push({finish:()=>{memory.set(k,v);resolve();}});})});
 const first=m.salvarFiltrosCatalogo('2',filters()),last=m.salvarFiltrosCatalogo('2',m.filtrosIniciais);await tick();assert.equal(writes.length,1);
 let read=false;const reading=m.lerFiltrosCatalogo('2').then(r=>{read=true;return r;});writes[0].finish();await first;await tick();assert.equal(writes.length,2);assert.equal(read,false);writes[1].finish();await last;assert.equal((await reading).cidade,'');
});
test('falha de escrita não bloqueia próxima pesquisa',async()=>{
 let fail=true,value;const m=preferences({getItem:async()=>value,setItem:async(_,v)=>{if(fail)throw Error('Disco');value=v;}});await assert.rejects(m.salvarFiltrosCatalogo('2',filters()));fail=false;await m.salvarFiltrosCatalogo('2',filters('Olinda'));assert.equal((await m.lerFiltrosCatalogo('2')).cidade,'Olinda');
});
test('catálogo aguarda restauração e descarta resposta da conta anterior',async()=>{
 const reads=new Map(),user={id:'2',tipo:'PASSAGEIRO'},enabled=[];
 const h=harness('src/components/CatalogoRotas.tsx',{user,extras:{'./ui/Primitives':ui,'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:key=>new Promise(resolve=>reads.set(key,resolve))}},'../hooks/useFocusedPolling':{useFocusedPolling:(_,__,key)=>enabled.push(key)}}});
 h.render('CatalogoRotas');assert.equal(enabled.at(-1),false);user.id='3';h.render('CatalogoRotas');await tick();reads.get('@bevans:catalogo:filtros:v1:3')(payload('Olinda'));await tick();assert.equal(find(h.render('CatalogoRotas'),'Cidade de operação').props.value,'Olinda');reads.get('@bevans:catalogo:filtros:v1:2')(payload('Recife'));await tick();assert.equal(find(h.render('CatalogoRotas'),'Cidade de operação').props.value,'Olinda');h.unmount();
});
test('catálogo continua utilizável se armazenamento falha e distingue aviso local de erro da API',async()=>{
 let poll;const calls=[];const h=harness('src/components/CatalogoRotas.tsx',{user:{id:'2',tipo:'PASSAGEIRO'},extras:{'./ui/Primitives':ui,'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async()=>{throw Error('Disco');},setItem:async()=>{throw Error('Disco');}}},'../hooks/useFocusedPolling':{useFocusedPolling:fn=>{poll=fn;}},'../services/catalogo':{consultarCatalogo:async(f,p)=>{calls.push(f);return {itens:[],pagina:p,totalPaginas:1,total:0};}}}});
 const tree=()=>h.render('CatalogoRotas');tree();await tick();assert.ok(JSON.stringify(tree()).includes('recuperar sua última pesquisa'));find(tree(),'Cidade de operação').props.onChangeText('Recife');find(tree(),'Pesquisar').props.onPress();await tick();assert.ok(JSON.stringify(tree()).includes('não foi salva'));await poll(new AbortController().signal);assert.equal(calls.at(-1).cidade,'Recife');h.unmount();
});
