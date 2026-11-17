const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,nodes,find,fixture}=require('./helpers/excursoes.cjs');
const turn=()=>new Promise(setImmediate);
const point={paradaId:null,tipo:'DESTINO',nome:'Destino de teste',latitude:-8,longitude:-35};
const execution=(patch={})=>({id:30,excursaoId:7,sentido:'IDA',estado:'EM_ANDAMENTO',pontos:[point],...patch});

test('start waits for the official execution read, ignores repeated taps and never navigates on an uncertain result',async()=>{
 let finish,writes=0,controls=[];const x=execution();
 const h=harness('src/components/excursoes/OperacaoExcursao.tsx',{services:{iniciarExcursao:async()=>{writes++;return x;},buscarExecucaoExcursao:()=>new Promise(r=>finish=r)}});
 const p={e:fixture(),execucoes:[],offline:false,dirty:false,onRefresh(){},onEdit(){},onPublicar(){},onControle:id=>controls.push(id)};
 let t=h.render('OperacaoExcursao',p),action=find(t,'Iniciar execução IDA').props.action;
 const first=action();await turn();await action();assert.equal(writes,1);assert.equal(controls.length,0);finish(x);await first;assert.deepEqual(controls,[30]);h.unmount();
 const failed=harness('src/components/excursoes/OperacaoExcursao.tsx',{services:{iniciarExcursao:async()=>{throw Object.assign(Error('timeout'),{status:504});}}});
 await assert.rejects(find(failed.render('OperacaoExcursao',p),'Iniciar execução IDA').props.action(),/timeout/);
 t=failed.render('OperacaoExcursao',p);assert.equal(find(t,'Iniciar execução IDA').props.disabled,true);assert.ok(find(t,'Conferir início da execução'));failed.unmount();
});

test('the execution map uses the persisted snapshot and keeps its operational endpoint roles',()=>{
 const x=execution({pontos:[{...point,tipo:'ORIGEM'},{...point,tipo:'COLETA',paradaId:1},{...point,tipo:'DESTINO'}]});
 const h=harness('src/components/excursoes/RoteiroExecucaoExcursao.tsx'),t=h.render('RoteiroExecucaoExcursao',{execucao:x});
 assert.equal(nodes(t).find(n=>n.type==='MapPreview').props.pontos,x.pontos);assert.match(JSON.stringify(t),/registrados pelo servidor/);
});

test('an accepted publication resets the hidden editor to the new server version',async()=>{
 const e={...fixture(),estado:'RASCUNHO'},published={...e,estado:'PUBLICADA',versao:2},p={id:'7',motorista:true};const h=harness('src/app/editar-excursao.tsx',{services:{acaoExcursao:async()=>published},resources:key=>({data:String(key).startsWith('excursao:')?e:[],error:'',reload(){}})});h.render('TelaExcursao',p);let t=h.render('TelaExcursao',p);const previous=nodes(t).find(n=>n.type?.name==='PlanejarExcursao');nodes(t).find(n=>n.type?.name==='VisaoGeralViagem').props.onSection('publicacao');await find(h.render('TelaExcursao',p),'Publicar excursão').props.action();t=h.render('TelaExcursao',p);const editor=nodes(t).find(n=>n.type?.name==='PlanejarExcursao');assert.equal(editor.props.initial.versao,2);assert.notEqual(editor.key,previous.key);h.unmount();
});
