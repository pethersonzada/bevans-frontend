const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,nodes,find,fixture}=require('./helpers/excursoes.cjs');
const WIZ='src/components/excursoes/PlanejarExcursao.tsx';
const props=(e=fixture())=>({initial:e,onClose(){},onPersisted(){},onSaved:async()=>{}});
const turn=()=>new Promise(setImmediate);
test('excursion preview ignores a late response from another excursion and reports empty itineraries',async()=>{
 let finish;
 const h=harness('src/components/GestaoExcursao.tsx',{services:{planejarExcursao:()=>new Promise(resolve=>finish=resolve)}});
 const p={id:7,secao:'roteiro'};
 let t=h.render('GestaoExcursao',p);find(t,'Ver sequência dos pontos').props.onPress();
 h.render('GestaoExcursao',{...p,id:8});finish([{nome:'Ponto antigo',latitude:-8,longitude:-35}]);await turn();
 t=h.render('GestaoExcursao',{...p,id:8});assert.equal(nodes(t).some(n=>n.type==='MapPreview'),false);
 find(t,'Ver sequência dos pontos').props.onPress();finish([]);await turn();t=h.render('GestaoExcursao',{...p,id:8});
 assert.ok(JSON.stringify(t).includes('Nenhum ponto retornado'));h.unmount();
});
test('date and time selection preserves local calendar and emits an ISO instant without manual input',()=>{
 const {mod:form}=harness('src/services/excursaoFormulario.ts');const original=new Date(2027,4,10,9,35),chosen=new Date(2027,5,12,17,45);
 const date=new Date(form.selecionarDataHora(original.toISOString(),chosen,'date'));assert.equal(date.getMonth(),5);assert.equal(date.getDate(),12);assert.equal(date.getHours(),9);
 const time=new Date(form.selecionarDataHora(original.toISOString(),chosen,'time'));assert.equal(time.getMonth(),4);assert.equal(time.getHours(),17);assert.equal(time.getMinutes(),45);
});
test('form rejects past start, reverse return, fractional seats and incoherent invitation expiry',()=>{
 const {mod:f}=harness('src/services/excursaoFormulario.ts'),now=Date.parse('2026-11-15T12:00:00-03:00');
 assert.throws(()=>f.validarDatasExcursao('2026-11-15T11:59:00-03:00',null,10,now),/futura/);assert.throws(()=>f.validarDatasExcursao('2026-11-16T12:00:00-03:00','2026-11-16T11:00:00-03:00',10,now),/retorno/);assert.throws(()=>f.validarDatasExcursao('2026-11-16T12:00:00-03:00',null,1.5,now),/inteira/);
 for(const expiry of ['invalid','2026-11-14T12:00:00Z','2026-11-18T12:00:00Z'])assert.throws(()=>f.validarValidadeConvite(expiry,'2026-11-17T12:00:00Z',now));f.validarValidadeConvite('2026-11-16T12:00:00-03:00','2026-11-17T12:00:00Z',now);
});
test('sharing cancellation, failure and shared result never claim message delivery',async()=>{
 const {mod:f}=harness('src/services/excursaoFormulario.ts');assert.match(await f.compartilharConviteSeguro('secret',async()=>({action:'dismissed'}),'shared'),/cancelado/);assert.match(await f.compartilharConviteSeguro('secret',async()=>{throw Error();},'shared'),/tente compartilhar novamente/);assert.match(await f.compartilharConviteSeguro('secret',async()=>({action:'shared'}),'shared'),/entrega.*não foi confirmada/);
});
test('editor keeps unrelated drafts and stop order across moments, overview and version updates',()=>{
 const h=harness(WIZ);let p=props(),t=h.render('PlanejarExcursao',p);find(t,'Título da excursão').props.onChangeText('Meu planejamento');
 p={...p,initialMoment:'Pontos',command:1};h.render('PlanejarExcursao',p);t=h.render('PlanejarExcursao',p);assert.equal(nodes(t).filter(n=>n.type==='Input').length,0);find(t,'Ajustar ponto').props.onPress();t=h.render('PlanejarExcursao',p);assert.equal(find(t,'Nome da parada 1').props.value,'Praça A');
 p={...p,visible:false,initial:{...p.initial,versao:2},latestVersion:2};assert.equal(h.render('PlanejarExcursao',p),null);
 p={...p,visible:true,initialMoment:'Destino',command:2};h.render('PlanejarExcursao',p);t=h.render('PlanejarExcursao',p);assert.equal(find(t,'Título da excursão').props.value,'Meu planejamento');assert.ok(JSON.stringify(t).includes('mudou em outra sessão'));
});
test('created invitation is retained after dismissed share, so retry does not issue a second token',async()=>{
 let issued=0;const e=fixture();
 const h=harness('src/components/excursoes/ConvitesViagem.tsx',{services:{criarConviteExcursao:async()=>{issued++;return {id:4,token:'synthetic'};},validarPaginaConvite:()=>{},linkConvite:()=> 'https://example.test/#synthetic',buscarExcursao:async()=>e,convitesExcursao:async()=>[{id:4,expiraEm:new Date(Date.now()+3600000).toISOString(),revogadoEm:null}]}});
 let t=h.render('ConvitesViagem',{e});nodes(t).find(n=>n.type?.name==='DataViagem').props.onChange(new Date(Date.now()+3600000).toISOString());t=h.render('ConvitesViagem',{e});await find(t,'Gerar e compartilhar convite').props.action();t=h.render('ConvitesViagem',{e});assert.ok(JSON.stringify(t).includes('Compartilhamento cancelado'));await find(t,'Compartilhar convite criado novamente').props.action();assert.equal(issued,1);
});
test('irreversible action requires confirmation and rejects double taps while pending',async()=>{
 let calls=0,finish;const h=harness('src/components/excursoes/AcaoExcursao.tsx'),p={title:'Finalizar execução',confirmMessage:'Encerrar?',action:()=>{calls++;return new Promise(r=>finish=r);}};
 let t=h.render('AsyncAction',p);find(t,'Finalizar execução').props.onPress();assert.equal(calls,0);t=h.render('AsyncAction',p);find(t,'Confirmar: Finalizar execução').props.onPress();find(t,'Confirmar: Finalizar execução').props.onPress();assert.equal(calls,1);finish();await turn();assert.equal(h.lock.current,false);
});
test('date picker dismissal does not mutate a draft and confirmed selection emits ISO',()=>{
 const h=harness('src/components/excursoes/DataViagem.tsx'),values=[],p={label:'Partida',value:'2027-05-10T12:00:00Z',onChange:v=>values.push(v)};
 let t=h.render('DataViagem',p);find(t,'Partida - escolher data').props.onPress();t=h.render('DataViagem',p);nodes(t).find(n=>n.type==='NativeDatePicker').props.onChange({type:'dismissed'},new Date(2027,6,11));assert.equal(values.length,0);
 find(h.render('DataViagem',p),'Partida - escolher data').props.onPress();t=h.render('DataViagem',p);nodes(t).find(n=>n.type==='NativeDatePicker').props.onChange({type:'set'},new Date(2027,6,11));assert.equal(new Date(values[0]).getMonth(),6);
});
test('a failed background refresh keeps overview and the mounted editor snapshot',()=>{
 const e=fixture();let resource={data:e,error:'',reload(){}};
 const h=harness('src/app/editar-excursao.tsx',{resources:key=>String(key).startsWith('excursao:')?resource:{data:null,error:'',reload(){}}});
 h.render('TelaExcursao',{id:'7',motorista:true});let t=h.render('TelaExcursao',{id:'7',motorista:true});const editor=()=>nodes(t).find(n=>n.type?.name==='PlanejarExcursao');assert.equal(editor().props.initial,e);assert.equal(editor().props.visible,false);
 resource={data:null,error:'offline',reload(){}};t=h.render('TelaExcursao',{id:'7',motorista:true});assert.equal(editor().props.initial,e);assert.ok(JSON.stringify(t).includes('offline'));
});
test('publication reviews saved excursion data and blocks publishing an unrelated unsaved draft',()=>{
 const e=fixture(),h=harness('src/app/editar-excursao.tsx',{resources:key=>({data:String(key).startsWith('excursao:')?e:[],error:'',reload(){}})}),p={id:'7',motorista:true};
 h.render('TelaExcursao',p);let t=h.render('TelaExcursao',p);nodes(t).find(n=>n.type?.name==='PlanejarExcursao').props.onDirty(true);t=h.render('TelaExcursao',p);
 // Reach the publication view from a draft server snapshot.
 const draft={...e,estado:'RASCUNHO'};const hd=harness('src/app/editar-excursao.tsx',{resources:key=>({data:String(key).startsWith('excursao:')?draft:[],error:'',reload(){}})});hd.render('TelaExcursao',p);t=hd.render('TelaExcursao',p);nodes(t).find(n=>n.type?.name==='PlanejarExcursao').props.onDirty(true);nodes(t).find(n=>n.type?.name==='VisaoGeralViagem').props.onSection('publicacao');t=hd.render('TelaExcursao',p);assert.equal(find(t,'Publicar excursão').props.disabled,true);assert.equal(nodes(t).find(n=>n.type?.name==='DestinoHero').props.titulo,e.titulo);
});
test('saving boarding points adopts server IDs without leaving publication blocked by an already-saved draft',async()=>{
 const e=fixture(),saved={...e,versao:2,paradas:[{...e.paradas[0],id:30},{...e.paradas[1],id:31}]};let final;
 const h=harness(WIZ,{services:{salvarColetaExcursao:async()=>saved}}),p={...props(e),initialMoment:'Pontos',onSaved:async(_,r)=>final=r};
 let t=h.render('PlanejarExcursao',p);find(t,'Mover ponto 1 abaixo').props.onPress();t=h.render('PlanejarExcursao',p);find(t,'Continuar').props.onPress();t=h.render('PlanejarExcursao',p);await find(t,'Salvar alterações').props.action();assert.equal(final,saved);t=h.render('PlanejarExcursao',p);assert.equal(nodes(t).find(n=>n.type?.name==='ItinerarioViagem').props.paradas[0].id,30);
});
