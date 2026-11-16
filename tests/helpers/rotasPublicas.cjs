const {harness:base,nodes,find}=require('./excursoes.cjs');
const tick=()=>new Promise(setImmediate);
const fixture=(patch={})=>({id:9,turmaId:7,nome:'Campus',cidade:'Caruaru',categoria:'UNIVERSITARIA',modo:'FIXA',origemNome:'Terminal',origemLatitude:-8.2,origemLongitude:-35.9,destinoNome:'Campus principal',destinoLatitude:-8.3,destinoLongitude:-36,dias:['MONDAY','FRIDAY'],horarioIda:'07:00',horarioVolta:null,descricao:'Descrição existente',regiao:'Centro',campus:'Sede',publicada:false,ativa:true,paradas:[{id:21,nome:'Praça',latitude:-8.25,longitude:-35.95,horario:'07:15'}],vagas:{configurada:true,capacidade:12,ocupados:0,disponiveis:12},...patch});
function harness({initial,publicas={},extras={},entry='src/components/rotasPublicas/PlanejarRotaPublica.tsx'}={}){
 const reads=[],writes=[],published=[],storage={current:initial||null};let exits=0;
 const api={
  listarMinhasRotas:async()=>storage.current?[storage.current]:[],
  buscarRotaPublica:async id=>{reads.push(id);return storage.current;},
  salvarRotaPublica:async(id,data)=>{writes.push({kind:'dados',id,data});return storage.current=fixture({...data,paradas:storage.current?.paradas||[]});},
  salvarParadasPublicas:async(id,paradas)=>{writes.push({kind:'paradas',id,paradas});return storage.current={...storage.current,paradas:paradas.map((p,i)=>({...p,id:p.id||100+i}))};},
  publicarRota:async(id,value)=>{published.push(value);return storage.current={...storage.current,publicada:value};},
  planejarRotaPublica:async()=>[],...publicas,
 };
 const h=base(entry,{extras:{'../../services/rotasPublicas':api,'./rotasPublicas':api,'../services/rotasPublicas':api,'../../services/turmas':{listarTurmasMotorista:async()=>[{id:7,nome:'Turma operacional',turno:'MANHA'}]},'../../services/viagens':{iniciarViagem:async()=>{}},'../PedidosRota':{PedidosRota:'Pedidos'},'./MapaItinerario':{MapaItinerario:'ItineraryMap'},...extras}});
 api.pontoValido=h.load('src/services/rotasPublicas.ts').pontoValido;
 const props={initial,motoristaId:'1',onExit:()=>exits++};
 return {...h,api,storage,reads,writes,published,props,exits:()=>exits,tree:()=>h.render('PlanejarRotaPublica',props)};
}
const press=(h,title)=>{const n=find(h.tree(),title);if(!n)throw Error('Missing action '+title);return n.props.onPress();};
const input=(h,label,value)=>find(h.tree(),label).props.onChangeText(value);
function point(h,title,nome,latitude,longitude){press(h,title);nodes(h.tree()).find(n=>n.type==='MapPicker').props.onChange({nome,latitude,longitude,precisao:'manual'});press(h,'Usar este ponto');}
module.exports={harness,nodes,find,fixture,tick,press,input,point};
