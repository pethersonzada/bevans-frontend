const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,nodes,find}=require('./helpers/excursoes.cjs');
const {fixture}=require('./helpers/rotasPublicas.cjs');

test('falha periódica preserva picker e escolha, bloqueando inclusive ação capturada antes da falha',async()=>{
 const rota=fixture({modo:'FLEXIVEL',publicada:true});
 let resource={data:rota,error:'',reload(){}},writes=0;
 const h=harness('src/app/detalhe-rota.tsx',{
  user:{id:'2',tipo:'PASSAGEIRO'},
  resources:key=>String(key).startsWith('rota:')?resource:{data:[],error:'',reload(){}},
  extras:{
   '../services/rotasPublicas':{},'../services/solicitacoes':{},'../services/viagens':{},
   '../services/embarques':{solicitarEmbarque:async()=>{writes++;return {status:'PENDENTE'};}},
   '../services/pedidoPublico':{validarPedidoPublico(){}},
   '../components/RastreamentoViagem':{RastreamentoViagem:'Tracking'},
   '../components/ContatoProtegido':{ContatoProtegido:'Contact'},
  },
 });
 const props={id:String(rota.id),usuarioId:'2',motorista:false};
 const render=()=>h.render('RotaPassageiro',props);
 find(render(),'Escolher ponto flexível').props.onPress();
 const picker=nodes(render()).find(n=>n.type==='MapPicker');
 picker.props.onChange({nome:'Praça de teste',latitude:-8,longitude:-35,precisao:'manual'});
 const send=find(render(),'Solicitar embarque').props.onPress;
 assert.equal(find(render(),'Solicitar embarque').props.disabled,false);
 resource={...resource,data:null,error:'O servidor demorou para responder.'};
 const failed=render();
 assert.ok(nodes(failed).some(n=>n.type==='MapPicker'),'o picker permanece montado durante o erro');
 assert.ok(JSON.stringify(failed).includes('Sua escolha foi preservada'));
 assert.equal(find(failed,'Solicitar embarque').props.disabled,true);
 assert.equal(find(failed,'Solicitar vínculo com esta rota').props.disabled,true);
 send();await new Promise(setImmediate);assert.equal(writes,0);
 resource={...resource,error:''};
 assert.ok(nodes(render()).some(n=>n.type==='MapPicker'),'retentativa também preserva a edição');
 assert.equal(find(render(),'Solicitar embarque').props.disabled,true);
 resource={...resource,data:rota};
 assert.equal(find(render(),'Solicitar embarque').props.disabled,false);
 resource={...resource,data:{...rota,publicada:false}};
 assert.equal(find(render(),'Solicitar embarque').props.disabled,true,'versão revalidada despublicada não permite enviar');
 h.unmount();
});
