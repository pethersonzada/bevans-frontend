const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,nodes}=require('./helpers/excursoes.cjs');

const find=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&nodes(n).some(child=>child.type==='Text'&&child.props.children===label));

test('rastreamento avisa encerramento oficial, sem confundir GPS ausente ou leitura cancelada',async()=>{
 let load,ended=0,state='SEM_LOCALIZACAO';
 const h=harness('src/components/RastreamentoViagem.tsx',{
  resources:(key,fn)=>{if(key)load=fn;return {data:null,error:''};},
  extras:{'expo-router/react-navigation':{useIsFocused:()=>false},'../hooks/useFocusedPolling':{useFocusedPolling(){}},'../services/rastreamento':{consultarGps:async()=>({estado:state}),posicaoRecente:()=>null}},
 });
 h.render('RastreamentoViagem',{tipo:'VIAGEM',id:'76',motorista:false,onFinalizada:()=>ended++});
 await load(new AbortController().signal);assert.equal(ended,0);
 state='FINALIZADA';const aborted=new AbortController();aborted.abort();await load(aborted.signal);assert.equal(ended,0);
 await load(new AbortController().signal);assert.equal(ended,1);h.unmount();
});

test('viagem encerrada bloqueia embarque e callbacks anteriores sem apagar o registro próprio',async()=>{
 let writes=0;
 const record={id:9,estado:'AGUARDANDO',versao:0,autor:null};
 const h=harness('src/app/controle-viagem.tsx',{
  resources:key=>({data:String(key).startsWith('operacao:')?record:null,error:'',reload(){}}),
  extras:{'../components/RastreamentoViagem':{RastreamentoViagem:'GPS'},'../services/operacoes':{consultarOperacao:async()=>record,alterarEstadoOperacional:async()=>{writes++;return record;},rotulosEstado:{AGUARDANDO:'Aguardando'},mensagemErroOperacao:e=>e.message}},
 });
 const props={tipo:'VIAGEM',id:'76',motorista:false};
 let tree=h.render('Painel',props),oldAction=find(tree,'Embarquei').props.onPress;
 const gps=nodes(tree).find(n=>n.type==='GPS');
 assert.equal(typeof gps.props.onFinalizada,'function');
 gps.props.onFinalizada();
 oldAction();
 tree=h.render('Painel',props);
 assert.equal(find(tree,'Embarquei').props.disabled,true);
 assert.equal(find(tree,'Desembarquei').props.disabled,true);
 assert.match(JSON.stringify(tree),/Meu embarque/);
 find(tree,'Embarquei').props.onPress();
 await new Promise(setImmediate);assert.equal(writes,0);
 h.unmount();
});

test('encerramento fecha confirmação de desembarque e impede confirmar uma ação antiga',async()=>{
 let writes=0;
 const record={id:9,estado:'EMBARCADO',versao:1,autor:null};
 const h=harness('src/app/controle-viagem.tsx',{
  resources:key=>({data:String(key).startsWith('operacao:')?record:null,error:'',reload(){}}),
  extras:{'../components/RastreamentoViagem':{RastreamentoViagem:'GPS'},'../services/operacoes':{consultarOperacao:async()=>record,alterarEstadoOperacional:async()=>{writes++;},rotulosEstado:{EMBARCADO:'Embarcado',DESEMBARCADO:'Desembarcado'},mensagemErroOperacao:e=>e.message}},
 });
 const props={tipo:'VIAGEM',id:'76',motorista:false};
 let tree=h.render('Painel',props);find(tree,'Desembarquei').props.onPress();tree=h.render('Painel',props);
 const confirm=find(tree,'Confirmar alteração').props.onPress;
 nodes(tree).find(n=>n.type==='GPS').props.onFinalizada();
 confirm();tree=h.render('Painel',props);
 assert.ok(!nodes(tree).some(n=>n.props?.children==='Confirmar alteração'));
 await new Promise(setImmediate);assert.equal(writes,0);h.unmount();
});

test('controle do motorista destaca embarcados e explica bloqueio de cancelamento sem misturar pendências',async()=>{
 const registros=[{id:1,nome:'Rafaela',estado:'AGUARDANDO',versao:0,ordem:1},{id:2,nome:'Miguel',estado:'EMBARCADO',versao:1,ordem:2},{id:3,nome:'Vitória',estado:'DESEMBARCADO',versao:2,ordem:3}];
 let writes=0;
 const operacao={referenciaId:76,tipo:'VIAGEM',modalidade:'PRIVADA',sentido:'IDA',registros,contadores:{esperados:3,aguardando:1,naVan:1,naoEmbarcaram:0,desembarcados:1}};
 const h=harness('src/app/controle-viagem.tsx',{
  resources:key=>({data:String(key).startsWith('operacao:')?operacao:null,error:'',reload(){}}),
  extras:{'../components/RastreamentoViagem':{RastreamentoViagem:'GPS'},'../services/operacoes':{consultarOperacao:async()=>operacao,alterarEstadoOperacional:async(_tipo,_id,r,_motorista,estado)=>{writes++;r.estado=estado;operacao.contadores.naVan=0;operacao.contadores.desembarcados=2;return r;},rotulosEstado:{AGUARDANDO:'Aguardando',EMBARCADO:'Embarcado',DESEMBARCADO:'Desembarcado'},mensagemErroOperacao:e=>e.message}},
 });
 const props={tipo:'VIAGEM',id:'76',motorista:true,finalidade:'cancelar'};
 let tree=h.render('Painel',props);
 assert.match(JSON.stringify(tree),/cancelamento fica bloqueado/);
 assert.ok(find(tree,'Confirmar desembarque'));
 assert.equal(find(tree,'Confirmar embarque'),undefined);
 assert.equal(find(tree,'Voltar para cancelar a viagem'),undefined);
 assert.equal(nodes(tree).some(n=>n.type==='Input'),false);
 find(tree,'Confirmar desembarque').props.onPress();
 tree=h.render('Painel',props);
 assert.match(JSON.stringify(tree),/O passageiro já saiu da van/);
 find(tree,'Sim, confirmar').props.onPress();await new Promise(setImmediate);
 tree=h.render('Painel',props);
 assert.equal(writes,1);
 assert.ok(find(tree,'Voltar para cancelar a viagem'));
 assert.equal(find(tree,'Confirmar desembarque'),undefined);
 h.unmount();
});
