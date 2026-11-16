const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,nodes,find,fixture}=require('./helpers/excursoes.cjs');
const WIZ='src/components/excursoes/PlanejarExcursao.tsx',MODEL='src/components/excursoes/Planejamento.ts';
const baseProps=()=>({onClose(){},onPersisted(){},onSaved:async()=>{}});
const point={nome:'Destino de teste',latitude:-8,longitude:-35};
function prepareNew(h,p,mode='PORTA_A_PORTA') {
 let t=h.render('PlanejarExcursao',p);find(t,'Escolher destino no mapa').props.onPress();t=h.render('PlanejarExcursao',p);nodes(t).find(n=>n.type==='MapPicker').props.onChange(point);t=h.render('PlanejarExcursao',p);find(t,'Usar este ponto').props.onPress();
 t=h.render('PlanejarExcursao',p);find(t,'Título da excursão').props.onChangeText('Viagem nova');t=h.render('PlanejarExcursao',p);find(t,'Continuar').props.onPress();
 t=h.render('PlanejarExcursao',p);nodes(t).find(n=>n.type?.name==='DataViagem'&&n.props.label==='Partida').props.onChange(new Date(Date.now()+86400000*5).toISOString());find(t,'Capacidade').props.onChangeText('12');t=h.render('PlanejarExcursao',p);find(t,'Continuar').props.onPress();
 t=h.render('PlanejarExcursao',p);const label=mode==='PORTA_A_PORTA'?'Porta a porta':mode==='PARADA_UNICA'?'Um ponto de encontro':'Vários pontos de encontro';find(t,label).props.onPress();t=h.render('PlanejarExcursao',p);find(t,mode==='PORTA_A_PORTA'?'Revisar viagem':'Continuar para os pontos').props.onPress();
 if(mode!=='PORTA_A_PORTA'){
  for(let i=0;i<(mode==='PARADA_UNICA'?1:2);i++){t=h.render('PlanejarExcursao',p);find(t,'Adicionar ponto no mapa').props.onPress();t=h.render('PlanejarExcursao',p);nodes(t).find(n=>n.type==='MapPicker').props.onChange({...point,nome:'Ponto '+(i+1),latitude:-8.1-i/10});t=h.render('PlanejarExcursao',p);find(t,'Usar este ponto').props.onPress();}
  t=h.render('PlanejarExcursao',p);find(t,'Continuar').props.onPress();
 }
 return h.render('PlanejarExcursao',p);
}
test('new trip reveals one moment at a time and requires a confirmed destination before continuing',()=>{
 const h=harness(WIZ),p=baseProps();let t=h.render('PlanejarExcursao',p);
 assert.equal(nodes(t).filter(n=>n.type==='Input').length,0);assert.equal(nodes(t).filter(n=>n.type?.name==='DataViagem').length,0);find(t,'Continuar').props.onPress();t=h.render('PlanejarExcursao',p);assert.ok(JSON.stringify(t).includes('Escolha o destino'));
 find(t,'Escolher destino no mapa').props.onPress();t=h.render('PlanejarExcursao',p);assert.equal(find(t,'Usar este ponto').props.disabled,true);nodes(t).find(n=>n.type==='MapPicker').props.onChange(point);t=h.render('PlanejarExcursao',p);find(t,'Usar este ponto').props.onPress();t=h.render('PlanejarExcursao',p);assert.ok(find(t,'Título da excursão'));
});
test('planning validates all three boarding contracts and skips stop configuration for door-to-door',()=>{
 const {mod:m}=harness(MODEL);const d=m.rascunhoInicial(fixture());
 assert.doesNotThrow(()=>m.validarMomento(d,'Revisão'));assert.throws(()=>m.validarMomento({...d,modo:'MULTIPLAS_PARADAS',paradas:[d.paradas[0]]},'Pontos'),/2 a 50/);assert.throws(()=>m.validarMomento({...d,modo:'PARADA_UNICA'},'Pontos'),/único/);assert.doesNotThrow(()=>m.validarMomento({...d,modo:'PORTA_A_PORTA',paradas:[]},'Pontos'));
 const h=harness(WIZ),p=baseProps(),t=prepareNew(h,p);assert.equal(nodes(t).find(n=>n.type?.name==='ProgressoViagem').props.steps.includes('Pontos'),false);assert.ok(find(t,'Salvar viagem'));
});
test('Android back from map discards only an unconfirmed candidate, preserving the trip draft',()=>{
 const h=harness(WIZ),p={...baseProps(),initial:fixture()};let t=h.render('PlanejarExcursao',p);find(t,'Título da excursão').props.onChangeText('Meu rascunho');t=h.render('PlanejarExcursao',p);find(t,'Trocar destino').props.onPress();t=h.render('PlanejarExcursao',p);nodes(t).find(n=>n.type==='MapPicker').props.onChange({...point,nome:'Não confirmado'});assert.equal(h.back(),true);t=h.render('PlanejarExcursao',p);assert.equal(find(t,'Título da excursão').props.value,'Meu rascunho');assert.equal(nodes(t).find(n=>n.type?.name==='DestinoHero').props.destino,'Centro de eventos');h.unmount();assert.equal(h.back(),undefined);
});
test('creation saves travel data and boarding sequentially, without publishing or issuing invitations',async()=>{
 const calls=[],persisted=[];let actual,completed;
 const h=harness(WIZ,{services:{salvarExcursao:async(id,data)=>{calls.push(['data',id,data]);actual={...fixture(),...data,id:51,versao:0,estado:'RASCUNHO',modoColeta:'PORTA_A_PORTA',paradas:[]};return actual;},salvarColetaExcursao:async(id,mode,version,stops)=>{calls.push(['boarding',id,mode,version,stops]);return {...actual,versao:1,modoColeta:mode,paradas:stops.map((s,i)=>({...s,id:i+1}))};}}});
 const p={...baseProps(),onPersisted:e=>persisted.push(e.id),onSaved:async(_,e)=>completed=e};const t=prepareNew(h,p,'MULTIPLAS_PARADAS');await find(t,'Salvar viagem').props.action();assert.equal(calls.length,2);assert.equal(calls[0][1],null);assert.equal(calls[1][1],51);assert.equal(calls[1][3],0);assert.equal(calls[1][4].length,2);assert.equal(completed.estado,'RASCUNHO');assert.deepEqual(persisted,[51,51]);
});
test('boarding failure after creation retries the same ID and does not duplicate the trip',async()=>{
 let posts=0,puts=0,fail=true,actual;
 const h=harness(WIZ,{services:{salvarExcursao:async(_,data)=>{posts++;actual={...fixture(),...data,id:55,estado:'RASCUNHO',versao:0,modoColeta:'PORTA_A_PORTA',paradas:[]};return actual;},salvarColetaExcursao:async(id,mode,version,stops)=>{puts++;assert.equal(id,55);if(fail)throw Error('network failed');return {...actual,modoColeta:mode,versao:1,paradas:stops};}}}),p=baseProps();let t=prepareNew(h,p,'PARADA_UNICA');await assert.rejects(find(t,'Salvar viagem').props.action(),/network/);t=h.render('PlanejarExcursao',p);assert.ok(JSON.stringify(t).includes('mesma viagem'));fail=false;await find(t,'Salvar alterações').props.action();assert.equal(posts,1);assert.equal(puts,2);
});
test('unknown creation result cannot be retried as a second POST',async()=>{
 let posts=0;const h=harness(WIZ,{services:{salvarExcursao:async()=>{posts++;throw Object.assign(Error('timeout'),{status:503});}}}),p=baseProps();let t=prepareNew(h,p);await assert.rejects(find(t,'Salvar viagem').props.action(),/pode ter sido registrada/);t=h.render('PlanejarExcursao',p);assert.equal(find(t,'Salvar viagem').props.disabled,true);await assert.rejects(find(t,'Salvar viagem').props.action(),/resultado anterior/);assert.equal(posts,1);
});
test('newer server version prevents writes and preserves local fields for explicit reconciliation',async()=>{
 let writes=0;const h=harness(WIZ,{services:{salvarExcursao:async()=>{writes++;}}}),p={...baseProps(),initial:fixture(),initialMoment:'Revisão',latestVersion:2};const t=h.render('PlanejarExcursao',p);await assert.rejects(find(t,'Salvar alterações').props.action(),e=>e.status===409);assert.equal(writes,0);assert.ok(JSON.stringify(t).includes('mudou em outra sessão'));
});
test('same date with another UTC offset does not create a false unsaved change',()=>{
 const {mod:m}=harness(MODEL),e=fixture(),d=m.rascunhoInicial(e);d.partida=d.partida.replace('Z','+00:00');assert.equal(m.dadosMudaram(d,e),false);
});
test('trip overview is read-only and editing opens the requested moment without removing its draft',()=>{
 const e=fixture(),h=harness('src/app/editar-excursao.tsx',{resources:key=>({data:String(key).startsWith('excursao:')?e:[],error:'',reload(){}})}),p={id:'7',motorista:true};h.render('TelaExcursao',p);let t=h.render('TelaExcursao',p);assert.equal(nodes(t).filter(n=>n.type==='Input').length,0);assert.equal(nodes(t).find(n=>n.type?.name==='PlanejarExcursao').props.visible,false);
 nodes(t).find(n=>n.type?.name==='VisaoGeralViagem').props.onEdit('Datas');t=h.render('TelaExcursao',p);assert.equal(nodes(t).find(n=>n.type?.name==='PlanejarExcursao').props.initialMoment,'Datas');assert.equal(nodes(t).find(n=>n.type?.name==='PlanejarExcursao').props.visible,true);assert.equal(nodes(t).find(n=>n.type?.name==='PlanejarExcursao').props.initial,e);
});
test('list labels active journeys only from executions and never closes a journey because its departure passed',()=>{
 const active=fixture(),past={...fixture(),id:8,partidaEm:'2020-01-01T12:00:00Z'},closed={...fixture(),id:9,estado:'CONCLUIDA'};
 const h=harness('src/app/(tabs)/excursoes.tsx',{resources:key=>({data:String(key).startsWith('excursoes:')?{itens:[active,past,closed],totalPaginas:1}:String(key).startsWith('execucoes-lista:')?{active:[7],unavailable:[8]}:null,error:'',reload(){}})}),t=h.render('default');const cards=nodes(t).filter(n=>n.type?.name==='CartaoViagem');assert.equal(cards.find(n=>n.props.e.id===7).props.emAndamento,true);assert.equal(cards.find(n=>n.props.e.id===8).props.e.estado,'PUBLICADA');assert.equal(cards.find(n=>n.props.e.id===8).props.emAndamento,false);
});
test('execution read failure does not prevent opening the trip overview',()=>{
 const e=fixture(),h=harness('src/app/editar-excursao.tsx',{resources:key=>String(key).startsWith('excursao:')?{data:e,error:'',reload(){}}:{data:null,error:'Executions offline',reload(){}}}),p={id:'7',motorista:true};h.render('TelaExcursao',p);const t=h.render('TelaExcursao',p);assert.equal(nodes(t).find(n=>n.type?.name==='VisaoGeralViagem').props.e.destinoNome,e.destinoNome);assert.equal(typeof nodes(t).find(n=>n.type?.name==='VisaoGeralViagem').props.onSection,'function');
});

test('leaving a session during creation never follows up with boarding writes or exposes its late response',async()=>{
 let finish,boarding=0,shown=0;
 const h=harness(WIZ,{services:{salvarExcursao:()=>new Promise(r=>finish=r),salvarColetaExcursao:async()=>boarding++}}),p={...baseProps(),onPersisted:()=>shown++,onSaved:async()=>shown++};
 const t=prepareNew(h,p,'PARADA_UNICA'),pending=find(t,'Salvar viagem').props.action();h.unmount();finish(fixture());await pending;assert.equal(boarding,0);assert.equal(shown,0);
});

test('read-only overview adopts a newer server state but never replaces an unsaved plan',()=>{
 for(const dirty of [false,true]){
  let remote=fixture();const h=harness('src/app/editar-excursao.tsx',{resources:key=>({data:String(key).startsWith('excursao:')?remote:[],error:'',reload(){}})}),p={id:'7',motorista:true};h.render('TelaExcursao',p);let t=h.render('TelaExcursao',p);nodes(t).find(n=>n.type?.name==='PlanejarExcursao').props.onDirty(dirty);h.render('TelaExcursao',p);
  remote={...remote,versao:2,estado:'CONCLUIDA'};h.render('TelaExcursao',p);t=h.render('TelaExcursao',p);assert.equal(nodes(t).find(n=>n.type?.name==='VisaoGeralViagem').props.e.estado,dirty?'PUBLICADA':'CONCLUIDA');
 }
});
