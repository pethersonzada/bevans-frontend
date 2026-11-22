const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,nodes,find}=require('./helpers/excursoes.cjs');
const base='https://example.test/convite';
test('convite só pode abrir a página HTTPS configurada com token no fragmento',()=>{
 const {mod:{validarConvitePassageiro:validate}}=harness('src/services/convitePassageiro.ts');
 assert.equal(validate(base+'#segredo',base),base+'#segredo');
 for(const url of ['http://example.test/convite#t','https://outro.test/convite#t',base+'?token=t',base,base+'/outra#t','javascript:alert(1)','https://user:senha@example.test/convite#t',base+'#%0at'])assert.throws(()=>validate(url,base));
 assert.throws(()=>validate(base+'#t',undefined));
});
test('passageiro abre convite uma vez, não declara inscrição e não vaza erro nativo',async()=>{
 let calls=0,finish;const h=harness('src/components/excursoes/AcessoPassageiro.tsx',{user:{id:'2',tipo:'PASSAGEIRO'},extras:{'expo-web-browser':{openBrowserAsync:async()=>{calls++;await new Promise(r=>finish=r);}},'../ui/Primitives':require('./helpers/ui.cjs')}});
 const tree=()=>h.render('AcessoPassageiro');tree();nodes(tree()).find(n=>n.props.label==='Link do convite').props.onChangeText(base+'#secreto');
 const press=find(tree(),'Abrir convite').props.onPress;press();press();assert.equal(calls,1);finish();await new Promise(setImmediate);
 assert.ok(nodes(tree()).some(n=>typeof n.props.children==='string'&&n.props.children.includes('não confirma uma reserva')));
 assert.equal(nodes(tree()).find(n=>n.props.label==='Link do convite').props.value,'');
 const failed=harness('src/components/excursoes/AcessoPassageiro.tsx',{extras:{'expo-web-browser':{openBrowserAsync:async()=>{throw Error(base+'#secreto');}},'../ui/Primitives':require('./helpers/ui.cjs')}});
 const failtree=()=>failed.render('AcessoPassageiro');failtree();nodes(failtree()).find(n=>n.props.label==='Link do convite').props.onChangeText(base+'#secreto');find(failtree(),'Abrir convite').props.onPress();await new Promise(setImmediate);
 assert.equal(nodes(failtree()).find(n=>n.props.message)?.props.message,'Não foi possível abrir o convite. Tente novamente.');
});
test('sem configuração ou conexão a abertura fica bloqueada',()=>{
 for(const env of [{}, {EXPO_PUBLIC_CONVITE_WEB_URL:base}]){const h=harness('src/components/excursoes/AcessoPassageiro.tsx',{env,extras:{'../ui/Primitives':require('./helpers/ui.cjs')}});if(env.EXPO_PUBLIC_CONVITE_WEB_URL)h.connection.isConnected=false;const tree=()=>h.render('AcessoPassageiro');tree();nodes(tree()).find(n=>n.props.label==='Link do convite').props.onChangeText(base+'#secreto');assert.equal(find(tree(),'Abrir convite').props.disabled,true);}
});
