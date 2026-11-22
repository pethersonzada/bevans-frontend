const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,nodes,find}=require('./helpers/excursoes.cjs');
const point={nome:'Praça de teste',latitude:-8.2,longitude:-35.9};
const dados=()=>({nome:'Turma de teste',turno:'Manhã',capacidade:'12',origem:point,destino:{...point,nome:'Campus de teste',latitude:-8.3},etapa:2,turmaId:null,anteriores:null});
const turma=(d,id=7)=>({id,nome:d.nome.trim(),turno:d.turno.trim(),capacidade:Number(d.capacidade),origemNome:d.origem.nome,origemLatitude:d.origem.latitude,origemLongitude:d.origem.longitude,destinoNome:d.destino.nome,destinoLatitude:d.destino.latitude,destinoLongitude:d.destino.longitude});
function service({post=async()=>turma(dados()),list=async()=>[],get=async()=>turma(dados())}={}) {
 let posts=0;const bodies=[];
 const h=harness('src/services/cadastroTurma.ts',{extras:{'../config/api':{apiRequest:async(_path,options)=>{posts++;bodies.push(JSON.parse(options.body));return post();}},'./turmas':{listarTurmasMotorista:list,buscarTurmaMotorista:get,parseTurma:x=>x,lerAssentos:s=>{if(!/^[1-9]\d*$/.test(s)||Number(s)>2147483647)throw Error('Assentos inválidos');return Number(s);}}}});
 return {...h.mod,posts:()=>posts,bodies};
}
test('cadastro envia pontos juntos e só conclui após releitura exata',async()=>{
 const s=service();const saved=[];const d=dados();const result=await s.concluirCadastroTurma('1',d,async next=>saved.push(next),()=>{});
 assert.equal(result.id,7);assert.equal(s.posts(),1);assert.equal(s.bodies[0].origemLatitude,point.latitude);assert.equal(s.bodies[0].destinoNome,d.destino.nome);assert.equal(saved[0].anteriores.length,0);assert.equal(saved[1].turmaId,7);
 const failed=service({get:async()=>({...turma(d),capacidade:8})});await assert.rejects(failed.concluirCadastroTurma('1',d,async()=>{},()=>{}),/diferem/);
});
test('timeout após gravação é recuperado sem repetir POST, inclusive após restaurar rascunho',async()=>{
 let persisted;const s=service({post:async()=>{throw Error('Timeout');}});await assert.rejects(s.concluirCadastroTurma('1',dados(),async d=>persisted=d,()=>{}),/Timeout/);
 const d=s.restaurarCadastroTurma(JSON.stringify(persisted));const recovered=service({list:async()=>[turma(d)]});await recovered.concluirCadastroTurma('1',d,async()=>{},()=>{});assert.equal(recovered.posts(),0);
 const unknown=service();await assert.rejects(unknown.concluirCadastroTurma('1',d,async()=>{},()=>{}),/duplicada/);assert.equal(unknown.posts(),0);
});
test('falha de leitura após POST mantém ID e nova tentativa somente consulta',async()=>{
 let d;const s=service({get:async()=>{throw Error('Sem rede');}});await assert.rejects(s.concluirCadastroTurma('1',dados(),async next=>d=next,()=>{}),/Sem rede/);assert.equal(d.turmaId,7);
 const retry=service();await retry.concluirCadastroTurma('1',d,async()=>{},()=>{});assert.equal(retry.posts(),0);
});
test('validação, armazenamento indisponível e sessão trocada bloqueiam criação',async()=>{
 const s=service();for(const patch of [{nome:''},{turno:''},{capacidade:'0'},{origem:null},{destino:{...point,latitude:91}}])await assert.rejects(s.concluirCadastroTurma('1',{...dados(),...patch},async()=>{},()=>{}));
 await assert.rejects(s.concluirCadastroTurma('1',dados(),async()=>{throw Error('Disco');},()=>{}),/Disco/);assert.equal(s.posts(),0);
 let current=true;const changed=service({list:async()=>{current=false;return [];}});await assert.rejects(changed.concluirCadastroTurma('1',dados(),async()=>{},()=>{if(!current)throw Error('Sessão');}),/Sessão/);assert.equal(changed.posts(),0);
 assert.throws(()=>s.restaurarCadastroTurma('{"etapa":9}'));assert.equal(s.restaurarCadastroTurma(null).etapa,0);
});
test('rejeição HTTP libera correção; falha 500 conserva intenção e não fabrica sucesso',async()=>{
 for(const status of [400,403,409,500]){let d;const s=service({post:async()=>{throw Object.assign(Error('Recusado'),{status});}});await assert.rejects(s.concluirCadastroTurma('1',dados(),async next=>d=next,()=>{}),/Recusado/);assert.equal(d.anteriores===null,status<500);}
});
test('formulário preserva etapas, cancela mapa sem criar e impede duplo envio',async()=>{
 const memory=new Map();let creates=0,finish;
 const h=harness('src/components/turmas/CadastroTurma.tsx',{extras:{'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async k=>memory.get(k)||null,setItem:async(k,v)=>memory.set(k,v),removeItem:async k=>memory.delete(k)}},'../../services/cadastroTurma':{...service(),concluirCadastroTurma:async()=>{creates++;await new Promise(r=>finish=r);return {id:7};}},'../../contexts/AppAlertContext':{useAppAlert:()=>({alert(){}})},'../../components/excursoes/ViagemUI':{PaginaViagem:'Page',ProgressoViagem:'Progress',CabecalhoViagem:'Heading',BlocoViagem:'Section',AtalhoViagem:'Shortcut',ActionButton:'Button',trip:{}},'../../components/ui/Primitives':require('./helpers/ui.cjs')}});
 const props={userId:'1',offline:false,alert:{alert(){}},onExit(){},onColeta(){}};const tree=()=>h.render('FormularioTurma',props);tree();await new Promise(setImmediate);tree();
 nodes(tree()).find(n=>n.props.label==='Nome da turma').props.onChangeText('Turma de teste');nodes(tree()).find(n=>n.props.label==='Quantidade de assentos').props.onChangeText('12');nodes(tree()).find(n=>n.props.label==='Manhã').props.onPress();find(tree(),'Continuar').props.onPress();
 assert.equal(nodes(tree()).find(n=>n.type==='Progress').props.current,1);find(tree(),'Escolher origem').props.onPress();nodes(tree()).find(n=>n.type==='MapPicker').props.onChange(point);find(tree(),'Usar este ponto').props.onPress();
 find(tree(),'Escolher destino').props.onPress();nodes(tree()).find(n=>n.type==='Page').props.onBack();assert.equal(creates,0);find(tree(),'Escolher destino').props.onPress();nodes(tree()).find(n=>n.type==='MapPicker').props.onChange({...point,nome:'Campus de teste'});find(tree(),'Usar este ponto').props.onPress();find(tree(),'Continuar').props.onPress();
 const press=find(tree(),'Criar turma').props.onPress;press();press();await new Promise(setImmediate);assert.equal(creates,1);finish();await new Promise(setImmediate);assert.ok(find(tree(),'Configurar coleta'));h.unmount();
});
