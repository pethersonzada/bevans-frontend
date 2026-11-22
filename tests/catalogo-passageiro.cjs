const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,find,nodes}=require('./helpers/excursoes.cjs');
const tick=()=>new Promise(setImmediate);
test('catálogo combina filtros, pagina e limpa todos os critérios para a primeira página',async()=>{
 let poll;const reads=[];
 const h=harness('src/components/CatalogoRotas.tsx',{user:{id:'2',tipo:'PASSAGEIRO'},extras:{'./ui/Primitives':require('./helpers/ui.cjs'),'../hooks/useFocusedPolling':{useFocusedPolling:fn=>{poll=fn;}},'../services/catalogo':{consultarCatalogo:async(f,p)=>{reads.push({f,p});return {itens:[],pagina:p,totalPaginas:3,total:0};}}}});
 const tree=()=>h.render('CatalogoRotas');tree();find(tree(),'Cidade de operação').props.onChangeText('Recife');nodes(tree()).find(n=>n.props.label==='Destino').props.onChangeText('Campus');nodes(tree()).find(n=>n.props.label==='Universitária').props.onPress();nodes(tree()).find(n=>n.props.accessibilityLabel==='Somente favoritas').props.onValueChange(true);find(tree(),'Pesquisar').props.onPress();tree();await poll(new AbortController().signal);await tick();
 assert.equal(reads.at(-1).f.categoria,'UNIVERSITARIA');assert.equal(reads.at(-1).f.somenteFavoritas,true);
 nodes(tree()).find(n=>n.type==='Pagination').props.onChange(2);tree();await poll(new AbortController().signal);assert.equal(reads.at(-1).p,2);
 find(tree(),'Limpar filtros').props.onPress();tree();await poll(new AbortController().signal);assert.equal(reads.at(-1).p,0);assert.equal(reads.at(-1).f.cidade,'');assert.equal(reads.at(-1).f.destino,'');assert.equal(reads.at(-1).f.categoria,'');assert.equal(reads.at(-1).f.somenteFavoritas,false);h.unmount();
});
test('favorito bloqueia toque repetido, atualiza pela API e não aplica erro depois de sair',async()=>{
 let poll,calls=0,finish;const item={id:7,nome:'Rota teste',cidade:'Recife',destino:'Campus',modo:'FIXA',vagas:{disponiveis:2},favorita:false};
 const h=harness('src/components/CatalogoRotas.tsx',{user:{id:'2',tipo:'PASSAGEIRO'},extras:{'./ui/Primitives':require('./helpers/ui.cjs'),'../hooks/useFocusedPolling':{useFocusedPolling:fn=>{poll=fn;}},'../services/catalogo':{consultarCatalogo:async()=>({itens:[item],pagina:0,totalPaginas:1,total:1}),alterarFavorito:async()=>{calls++;await new Promise((r,j)=>{finish={r,j};});}}}});
 const tree=()=>h.render('CatalogoRotas');tree();await poll(new AbortController().signal);const press=find(tree(),'Favoritar').props.onPress;press();press();assert.equal(calls,1);assert.equal(find(tree(),'Salvando…').props.disabled,true);h.unmount();finish.j(Error('Falha tardia'));await tick();assert.equal(nodes(tree()).some(n=>n.props.message==='Falha tardia'),false);
});
