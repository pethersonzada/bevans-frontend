const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,nodes,find,fixture,tick,press,input,point}=require('./helpers/rotasPublicas.cjs');
const SERVICE='src/services/edicaoRotaPublica.ts',PLAN='src/services/itinerarioRotaPublica.ts';
const clone=v=>JSON.parse(JSON.stringify(v));
test('public route preserves specific server conflicts instead of replacing them with version errors',async()=>{
 const h=harness({initial:fixture(),publicas:{publicarRota:async()=>{throw Object.assign(Error('Configure a capacidade antes de publicar.'),{status:409});}}});
 review(h);press(h,'Abrir gestão da versão salva');press(h,'Publicar rota');press(h,'Confirmar publicação');await tick();
 assert.ok(JSON.stringify(h.tree()).includes('Configure a capacidade antes de publicar.'));h.unmount();
});
function service(options={}){const h=harness(options),p=h.load(PLAN),s=h.load(SERVICE);return {...h,p,s};}
function review(h){for(let i=0;i<4;i++)press(h,'Continuar');h.tree();}
test('starting an unscheduled public direction is disabled with a concrete explanation',()=>{
 const h=harness({initial:fixture()});review(h);press(h,'Abrir gestão da versão salva');
 const operacao=nodes(h.tree()).find(n=>n.props?.rota?.id===9&&'bloqueada'in n.props);
 assert.ok(operacao);assert.equal(operacao.props.rota.horarioVolta,null);assert.equal(operacao.props.bloqueada,false);h.unmount();
});

test('public route planner reuses excursion layout, headings, progress, cards and footer controls',()=>{
 const h=harness(),t=h.tree(),ui=h.load('src/components/excursoes/ViagemUI.tsx');
 assert.equal(t.type,ui.PaginaViagem);assert.equal(t.props.title,'Nova rota pública');assert.ok(nodes(t).some(n=>n.type===ui.ProgressoViagem));assert.ok(nodes(t).some(n=>n.type===ui.EscolhaEmbarque));assert.ok(nodes(t).some(n=>n.type===ui.CabecalhoViagem));assert.ok(find(t,'Continuar'));assert.equal(h.writes.length,0);h.unmount();
});
test('editing is prefilled, retains optional contract fields and preserves changes when going back',()=>{
 const h=harness({initial:fixture()});assert.equal(find(h.tree(),'Nome da rota').props.value,'Campus');input(h,'Nome da rota','Campus novo');press(h,'Continuar');assert.ok(JSON.stringify(h.tree()).includes('Terminal'));press(h,'Etapa anterior');assert.equal(find(h.tree(),'Nome da rota').props.value,'Campus novo');assert.equal(nodes(h.tree()).find(n=>n.props?.label==='Descrição').props.value,'Descrição existente');assert.equal(h.writes.length,0);h.unmount();
});
test('map selection requires confirmation and uses the same real-address resolver as excursions',()=>{
 const h=harness({initial:fixture()});press(h,'Continuar');press(h,'Terminal');let t=h.tree();assert.equal(find(t,'Usar este ponto').props.disabled,true);const picker=nodes(t).find(n=>n.type==='MapPicker');assert.equal(picker.props.localizacaoInicial.nome,'Terminal');assert.equal(picker.props.resolverEndereco,h.load('src/services/enderecoReversoExcursao.ts').resolverEnderecoExcursao);
 picker.props.onChange({nome:'Rua real, Centro',latitude:-8.11,longitude:-35.11});press(h,'Usar este ponto');assert.ok(JSON.stringify(h.tree()).includes('Rua real, Centro'));assert.equal(h.writes.length,0);h.unmount();
});
test('multiple stops can be added, renamed, reordered, repositioned and removed without individual writes',()=>{
 const h=harness({initial:fixture()});press(h,'Continuar');press(h,'Continuar');
 point(h,'Adicionar parada no mapa','Ponto B',-8.21,-35.91);point(h,'Adicionar parada no mapa','Ponto C',-8.22,-35.92);
 press(h,'Ajustar parada 2');input(h,'Nome da parada 2','Ponto B revisado');press(h,'Subir parada 2');
 const map=nodes(h.tree()).find(n=>n.type==='ItineraryMap');assert.equal(map.props.pontos[1].nome,'Ponto B revisado');
 press(h,'Ajustar parada 2');point(h,'Reposicionar parada 2','Praça reposicionada',-8.27,-35.97);
 const ps=nodes(h.tree()).find(n=>n.type==='ItineraryMap').props.pontos;assert.equal(ps[2].nome,'Praça reposicionada');assert.equal(ps[2].chave,'parada-21');assert.equal(ps[2].latitude,-8.27);
 press(h,'Ajustar parada 3');press(h,'Remover parada 3');assert.equal(nodes(h.tree()).find(n=>n.type==='ItineraryMap').props.pontos.length,4);assert.equal(h.writes.length,0);h.unmount();
});
test('selecting a map marker opens the corresponding draft stop and keeps its stable local identity',()=>{
 const h=harness({initial:fixture()});press(h,'Continuar');press(h,'Continuar');const map=nodes(h.tree()).find(n=>n.type==='ItineraryMap');map.props.onSelect('parada-21');assert.equal(find(h.tree(),'Nome da parada 1').props.value,'Praça');press(h,'Etapa anterior');press(h,'Continuar');assert.equal(find(h.tree(),'Nome da parada 1').props.value,'Praça');h.unmount();
});
test('hardware back traverses steps, exits a pin without applying it and asks before discarding a draft',()=>{
 let h=harness();input(h,'Nome da rota','Rascunho');h.tree();h.back();assert.ok(find(h.tree(),'Continuar planejando'));press(h,'Continuar planejando');assert.equal(find(h.tree(),'Nome da rota').props.value,'Rascunho');h.back();h.tree();press(h,'Sair e descartar rascunho');assert.equal(h.exits(),1);h.unmount();
 h=harness({initial:fixture()});press(h,'Continuar');press(h,'Terminal');h.tree();h.back();assert.equal(h.tree().props.title,'Editar rota pública');h.back();assert.ok(find(h.tree(),'Nome da rota'));h.unmount();
});
test('days and native time selection preserve the chosen contract values through review and back',()=>{
 const h=harness({initial:fixture()});for(let i=0;i<3;i++)press(h,'Continuar');find(h.tree(),'Terça').props.onPress();nodes(h.tree()).find(n=>n.props?.label==='Horário de volta').props.onChange('18:35');press(h,'Continuar');h.tree();press(h,'Etapa anterior');assert.equal(find(h.tree(),'Terça').props.accessibilityState.checked,true);assert.equal(nodes(h.tree()).find(n=>n.props?.label==='Horário de volta').props.value,'18:35');h.unmount();
});
test('review keeps turma immutable for editing, saving does not publish and explicit publication needs confirmation',async()=>{
 const h=harness({initial:fixture()});input(h,'Nome da rota','Campus editado');review(h);press(h,'Salvar alterações');await tick();assert.equal(h.storage.current.nome,'Campus editado');assert.equal(h.published.length,0);assert.equal(h.tree().props.title,'Sua rota pública');press(h,'Publicar rota');assert.equal(h.published.length,0);press(h,'Confirmar publicação');await tick();assert.deepEqual(h.published,[true]);h.unmount();
});
test('offline planning remains editable while save and publication are unavailable',()=>{
 const h=harness({initial:fixture()});h.connection.isConnected=false;input(h,'Nome da rota','Planejada offline');review(h);assert.equal(find(h.tree(),'Salvar alterações').props.disabled,true);assert.equal(h.writes.length,0);assert.ok(JSON.stringify(h.tree()).includes('Sem conexão'));h.unmount();
});
test('public route validation rejects generic pins, invalid hours and missing operational association',()=>{
 const {p}=service(),d=p.rascunhoDaRota(fixture());assert.throws(()=>p.validarRascunhoRota({...d,origemNome:'Ponto marcado no mapa'}),/Confirme origem/);assert.throws(()=>p.validarRascunhoRota({...d,paradas:[{...d.paradas[0],nome:'Ponto marcado no mapa'}]}),/endereços/);assert.throws(()=>p.validarRascunhoRota({...d,horarioIda:'25:70'}),/HH:mm/);assert.throws(()=>p.validarRascunhoRota({...d,turmaId:null}),/associação operacional/);
});
test('save round-trip persists exact names, coordinates and ordered IDs then reopens the same planning',async()=>{
 const h=service({initial:fixture()}),state=h.s.estadoEdicaoRota(h.storage.current),d=h.p.rascunhoDaRota(h.storage.current);
 d.origemNome='Rua A, Centro';d.origemLatitude=-8.12345;d.paradas.push(h.p.paradaLocal({id:null,nome:'Rua B',latitude:-8.2222,longitude:-35.2222,horario:'07:40'}));
 const saved=await h.s.salvarPlanejamentoRota(state,d,()=>true);assert.equal(saved.origemNome,d.origemNome);assert.equal(saved.origemLatitude,-8.12345);assert.equal(saved.paradas[0].id,21);assert.equal(saved.paradas[1].nome,'Rua B');assert.ok(saved.paradas[1].id);assert.ok(!JSON.stringify(h.writes).includes('chaveLocal'));assert.equal(h.p.mesmosDados(saved,h.p.dadosParaApi(d)),true);
 const reopened=harness({initial:clone(saved)});press(reopened,'Continuar');press(reopened,'Continuar');const points=nodes(reopened.tree()).find(n=>n.type==='ItineraryMap').props.pontos;assert.deepEqual(Array.from(points,p=>p.nome),['Rua A, Centro','Praça','Rua B','Campus principal']);h.unmount();reopened.unmount();
});
test('partial stop failure keeps the created route ID and retries only the remaining write',async()=>{
 let fail=true;const h=service({publicas:{salvarParadasPublicas:async(id,ps)=>{if(fail){fail=false;throw Object.assign(Error('blocked'),{status:409});}return h.storage.current={...h.storage.current,paradas:ps.map((p,i)=>({...p,id:p.id||200+i}))};}}}),d=h.p.rascunhoDaRota(fixture()),state=h.s.estadoEdicaoRota();
 await assert.rejects(h.s.salvarPlanejamentoRota(state,d,()=>true));assert.equal(state.salva.id,9);assert.equal(state.parcial,true);await h.s.salvarPlanejamentoRota(state,d,()=>true);assert.equal(h.writes.filter(w=>w.kind==='dados').length,1);assert.equal(state.parcial,false);h.unmount();
});
test('unknown creation result is read back before retry and never blindly issues another POST',async()=>{
 let posts=0;const h=service({publicas:{salvarRotaPublica:async(id,d)=>{posts++;h.storage.current=fixture({...d,paradas:[]});throw Error('lost response');}}}),state=h.s.estadoEdicaoRota(),d=h.p.rascunhoDaRota(fixture());
 await assert.rejects(h.s.salvarPlanejamentoRota(state,d,()=>true));assert.equal(state.incerta,'criacao');await h.s.salvarPlanejamentoRota(state,d,()=>true);assert.equal(posts,1);assert.equal(state.salva.id,9);h.unmount();
});
test('lost stop response is reconciled by a read without duplicating new null-ID stops',async()=>{
 let writes=0;const initial=fixture({paradas:[]}),h=service({initial,publicas:{salvarParadasPublicas:async(id,ps)=>{writes++;h.storage.current={...h.storage.current,paradas:ps.map((p,i)=>({...p,id:200+i}))};throw Error('lost');}}}),state=h.s.estadoEdicaoRota(initial),d=h.p.rascunhoDaRota(initial);
 d.paradas=[h.p.paradaLocal({id:null,nome:'Novo ponto',latitude:-8.11,longitude:-35.11,horario:null})];const result=await h.s.salvarPlanejamentoRota(state,d,()=>true);assert.equal(result.paradas[0].id,200);assert.equal(writes,1);assert.equal(state.incerta,null);h.unmount();
});
test('changed server data blocks overwriting and keeps the local draft intact',async()=>{
 const initial=fixture(),h=service({initial}),state=h.s.estadoEdicaoRota(initial),d=h.p.rascunhoDaRota(initial);d.nome='Meu rascunho';h.storage.current={...initial,nome:'Outra sessão'};await assert.rejects(h.s.salvarPlanejamentoRota(state,d,()=>true),e=>e.status===409);assert.equal(d.nome,'Meu rascunho');assert.equal(h.writes.length,0);h.unmount();
});
test('saving twice immediately does not duplicate asynchronous operations',async()=>{
 let finish;const initial=fixture(),h=harness({initial,publicas:{buscarRotaPublica:()=>new Promise(resolve=>finish=resolve)}});input(h,'Nome da rota','Nome novo');review(h);press(h,'Salvar alterações');press(h,'Salvar alterações');assert.equal(h.writes.length,0);h.unmount();finish(initial);await tick();assert.equal(h.writes.length,0);
});
test('native time picker applies only explicit selections and never manufactures a schedule',()=>{
 const h=harness({entry:'src/components/rotasPublicas/HoraRota.tsx'}),values=[],props={label:'Ida',value:null,onChange:v=>values.push(v)};
 let t=h.render('HoraRota',props);find(t,'Ida').props.onPress();t=h.render('HoraRota',props);let native=nodes(t).find(n=>n.type==='NativeDatePicker');native.props.onChange({type:'dismissed'},new Date());assert.equal(values.length,0);
 find(h.render('HoraRota',props),'Ida').props.onPress();native=nodes(h.render('HoraRota',props)).find(n=>n.type==='NativeDatePicker');const date=new Date();date.setHours(18,35,0,0);native.props.onChange({type:'set'},date);assert.deepEqual(values,['18:35']);h.unmount();
});

test('itinerary map draws exact origin, destination and stable numbered stops in their draft order',()=>{
 const h=harness({entry:'src/components/rotasPublicas/MapaItinerario.tsx',extras:{react:{useRef:v=>({current:v}),useState:v=>[v,()=>{}],useEffect:()=>{}},'@rnmapbox/maps':{__esModule:true,default:{MapView:'NativeMap',Camera:'Camera',PointAnnotation:'Pin',ShapeSource:'Shape',LineLayer:'Line',StyleURL:{Dark:'dark'}}}}}),p=h.load(PLAN),d=p.rascunhoDaRota(fixture()),selected=[];
 d.paradas.push(p.paradaLocal({id:null,nome:'Segundo ponto',latitude:-8.27,longitude:-35.97,horario:null}));
 const t=h.render('MapaItinerario',{pontos:p.pontosItinerario(d),selecionado:null,onSelect:key=>selected.push(key)}),pins=nodes(t).filter(n=>n.type==='Pin');
 assert.equal(pins.length,4);assert.equal(pins[0].props.title,'Origem: Terminal');assert.equal(pins[1].props.title,'Parada 1: Praça');assert.equal(pins[2].props.title,'Parada 2: Segundo ponto');assert.equal(pins[3].props.title,'Destino: Campus principal');
 assert.deepEqual(clone(pins.map(n=>n.props.coordinate)),[[-35.9,-8.2],[-35.95,-8.25],[-35.97,-8.27],[-36,-8.3]]);
 pins[1].props.onSelected();assert.deepEqual(selected,['parada-21']);
 const line=nodes(t).find(n=>n.type==='Shape');assert.deepEqual(clone(line.props.shape.geometry.coordinates),clone(pins.map(n=>n.props.coordinate)));
 const empty=h.render('MapaItinerario',{pontos:[],selecionado:null,onSelect(){}});assert.ok(JSON.stringify(empty).includes('Nenhum ponto é escolhido automaticamente'));h.unmount();
});
test('a route without stops still has distinct origin and destination markers',()=>{
 const {p}=service(),d=p.rascunhoDaRota(fixture({paradas:[]}));const points=p.pontosItinerario(d);
 assert.equal(points.length,2);assert.equal(points[0].papel,'origem');assert.equal(points[1].papel,'destino');assert.equal(points[0].latitude,-8.2);assert.equal(points[1].latitude,-8.3);
});
test('unknown creation that is not proven cannot issue another create request',async()=>{
 let posts=0;const h=service({publicas:{salvarRotaPublica:async()=>{posts++;throw Error('timeout');}}}),state=h.s.estadoEdicaoRota(),d=h.p.rascunhoDaRota(fixture());
 await assert.rejects(h.s.salvarPlanejamentoRota(state,d,()=>true));await assert.rejects(h.s.salvarPlanejamentoRota(state,d,()=>true),/criação anterior/);assert.equal(posts,1);assert.equal(state.incerta,'criacao');h.unmount();
});
test('failed server reload does not discard the unsaved edit',async()=>{
 let fail=false;
 const h=harness({initial:fixture(),publicas:{buscarRotaPublica:async()=>{if(fail)throw Error('offline');return {...h.storage.current,nome:'Outra sessão'};}}});
 assert.equal(find(h.tree(),'Conferir versão do servidor'),undefined);
 input(h,'Nome da rota','Meu planejamento');review(h);press(h,'Salvar alterações');await tick();
 press(h,'Conferir versão do servidor');assert.equal(find(h.tree(),'Continuar'),undefined);assert.equal(find(h.tree(),'Salvar alterações'),undefined);
 fail=true;press(h,'Descartar e carregar versão salva');await tick();assert.ok(JSON.stringify(h.tree()).includes('offline'));
 press(h,'Manter meu rascunho');for(let i=0;i<4;i++)press(h,'Etapa anterior');assert.equal(find(h.tree(),'Nome da rota').props.value,'Meu planejamento');h.unmount();
});
test('publication detects a changed saved route and never publishes the unreviewed server revision',async()=>{
 const h=harness({initial:fixture()});review(h);press(h,'Abrir gestão da versão salva');press(h,'Publicar rota');h.storage.current={...h.storage.current,nome:'Outra revisão'};press(h,'Confirmar publicação');await tick();assert.equal(h.published.length,0);assert.ok(JSON.stringify(h.tree()).includes('A versão salva mudou'));assert.ok(find(h.tree(),'Conferir versão do servidor'));h.unmount();
});

test('creation offers only available operational turmas in review and retains the draft on lookup failure',async()=>{
 let attempts=0;const create=harness({publicas:{listarMinhasRotas:async()=>[fixture({turmaId:8})]},extras:{'../../services/turmas':{listarTurmasMotorista:async()=>{if(++attempts===1)throw Error('Lookup offline');return [{id:7,nome:'Disponível',turno:'MANHA'},{id:8,nome:'Já associada',turno:'TARDE'}];}}}});
 input(create,'Nome da rota','Nova rota');input(create,'Cidade de operação','Caruaru');press(create,'Continuar');point(create,'Escolher origem','Rua A',-8,-35);point(create,'Escolher destino','Rua B',-8.1,-35.1);press(create,'Continuar');press(create,'Continuar');find(create.tree(),'Segunda').props.onPress();nodes(create.tree()).find(n=>n.props?.label==='Horário de ida').props.onChange('07:00');press(create,'Continuar');create.tree();await tick();
 let t=create.tree();assert.ok(JSON.stringify(t).includes('Lookup offline'));nodes(t).find(n=>n.type==='Async').props.onRetry();create.tree();await tick();t=create.tree();assert.ok(find(t,'Disponível'));assert.equal(find(t,'Já associada'),undefined);press(create,'Disponível');assert.equal(create.writes.length,0);create.unmount();
});
test('publication can be explicitly withdrawn and no save operation toggles it',async()=>{
 const h=harness({initial:fixture({publicada:true})});review(h);press(h,'Abrir gestão da versão salva');press(h,'Retirar publicação');assert.equal(h.published.length,0);press(h,'Confirmar retirada');await tick();assert.deepEqual(h.published,[false]);h.unmount();
});

test('a failed final read keeps publication blocked until saving can verify the server result',async()=>{
 let reads=0;const h=harness({initial:fixture(),publicas:{buscarRotaPublica:async()=>{if(++reads===2)throw Error('Final read offline');return h.storage.current;}}});review(h);press(h,'Salvar alterações');await tick();assert.ok(JSON.stringify(h.tree()).includes('confirmação final'));press(h,'Abrir gestão da versão salva');assert.equal(find(h.tree(),'Publicar rota').props.disabled,true);assert.equal(h.published.length,0);h.unmount();
});
test('route loader waits for the existing route and locks native swipe-back without replacing the planner on focus',async()=>{
 const options=[],navigation={setOptions:value=>options.push(value)};
 const h=harness({initial:fixture(),entry:'src/app/editar-rota-publica.tsx',extras:{'expo-router':{useRouter:()=>({back(){}}),useNavigation:()=>navigation}}}),props={id:'9',motoristaId:'1'};
 const first=h.render('CarregarRota',props);assert.ok(nodes(first).some(n=>n.props?.title==='Carregando rota salva…'));await tick();const loaded=h.render('CarregarRota',props);assert.equal(loaded.type.name,'PlanejarRotaPublica');assert.equal(loaded.props.initial.id,9);assert.equal(options[0].gestureEnabled,false);assert.equal(h.reads.length,1);h.unmount();
});

test('a concurrent edit between the data and stop writes prevents overwriting the server itinerary',async()=>{
 const initial=fixture(),h=service({initial,publicas:{salvarRotaPublica:async(id,d)=>{const response={...initial,...d};h.storage.current={...response,paradas:[{...initial.paradas[0],nome:'Alterado em outra sessão'}]};return response;}}}),state=h.s.estadoEdicaoRota(initial),d=h.p.rascunhoDaRota(initial);
 d.nome='Nova identidade';d.paradas[0].nome='Meu ponto';await assert.rejects(h.s.salvarPlanejamentoRota(state,d,()=>true),e=>e.status===409);assert.equal(h.writes.length,0);assert.equal(d.paradas[0].nome,'Meu ponto');assert.equal(h.storage.current.paradas[0].nome,'Alterado em outra sessão');h.unmount();
});

test('leaving management with a retained draft also requires explicit discard',()=>{
 const h=harness({initial:fixture()});input(h,'Nome da rota','Meu rascunho');review(h);press(h,'Abrir gestão da versão salva');press(h,'Voltar às rotas');assert.equal(h.exits(),0);assert.ok(find(h.tree(),'Continuar planejando'));press(h,'Continuar planejando');press(h,'Editar planejamento');assert.equal(find(h.tree(),'Nome da rota').props.value,'Meu rascunho');h.unmount();
});
