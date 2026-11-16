const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,nodes,find,fixture}=require('./helpers/excursoes.cjs');
const SERVICE='src/services/enderecoReversoExcursao.ts',PICKER='src/components/EnderecoMapaPicker.tsx';
const tick=()=>new Promise(setImmediate);
const generic='Ponto marcado no mapa';
const address={street:'Rua José de Alencar',streetNumber:null,district:'Centro',city:'Bezerros',region:'PE'};
const full='Rua José de Alencar, Centro, Bezerros - PE';
function tap(h,p,lat,lon){const t=h.render('default',p);nodes(t).find(n=>n.type==='NativeMap').props.onPress({geometry:{type:'Point',coordinates:[lon,lat]}});}

test('reverse address formatting uses only returned components and never invents a house number',()=>{
 const {mod:m}=harness(SERVICE);
 assert.equal(m.formatarEnderecoReverso(address),full);
 assert.equal(m.formatarEnderecoReverso({...address,streetNumber:'125'}),'Rua José de Alencar, 125, Centro, Bezerros - PE');
 assert.equal(m.formatarEnderecoReverso({district:'Centro',city:'Bezerros',region:'PE'}),'Centro, Bezerros - PE');
 assert.equal(m.formatarEnderecoReverso({street:'Rua A',name:'123',postalCode:'55000000'}),'Rua A');
 assert.equal(m.formatarEnderecoReverso({name:'123'}),'');assert.equal(m.formatarEnderecoReverso({country:'Brasil'}),'');
 assert.equal(m.formatarEnderecoReverso({district:'Bezerros',city:'Bezerros',region:'PE'}),'Bezerros - PE');
});
test('native reverse lookup keeps the selected coordinates and does not ask for another permission',async()=>{
 const calls=[];let prompts=0;
 const h=harness(SERVICE,{extras:{'expo-location':{reverseGeocodeAsync:async p=>{calls.push(p);return [address];},requestForegroundPermissionsAsync:()=>prompts++}}});
 const p=await h.mod.resolverEnderecoExcursao({latitude:-8.25,longitude:-35.75});assert.equal(p.nome,full);assert.equal(p.latitude,-8.25);assert.equal(p.longitude,-35.75);assert.equal(p.numero,'');assert.equal(prompts,0);assert.equal(calls.length,1);
});
test('pin selection shows a resolved editable address before confirmation, without snapping to provider coordinates',async()=>{
 const values=[];const h=harness(PICKER),p={onChange:v=>values.push(v),resolverEndereco:async()=>({nome:full,latitude:99,longitude:99,rua:'Rua José de Alencar',numero:'',bairro:'Centro',precisao:'manual'})};
 h.render('default',p);await tick();tap(h,p,-8.3,-35.8);await tick();let t=h.render('default',p);
 assert.equal(find(t,'Nome ou endereço do local').props.value,full);assert.equal(values.at(-1).latitude,-8.3);assert.equal(values.at(-1).longitude,-35.8);assert.ok(!JSON.stringify(t).includes(generic));
 find(t,'Nome ou endereço do local').props.onChangeText('Portão lateral · '+full);assert.equal(values.at(-1).nome,'Portão lateral · '+full);assert.equal(values.at(-1).latitude,-8.3);h.unmount();
});
test('offline or unavailable geocoding preserves the pin and requires a manual description',async()=>{
 const values=[];const h=harness(PICKER),p={onChange:v=>values.push(v),resolverEndereco:async()=>{throw Error('Network unavailable');}};
 h.render('default',p);await tick();tap(h,p,-8.3,-35.8);await tick();let t=h.render('default',p);assert.equal(values.at(-1),null);assert.ok(JSON.stringify(t).includes('pin foi preservado'));
 const input=find(t,'Nome ou endereço do local');input.props.onChangeText('Praça central, ao lado do coreto');assert.equal(values.at(-1).nome,'Praça central, ao lado do coreto');assert.equal(values.at(-1).longitude,-35.8);
 input.props.onChangeText(generic);assert.equal(values.at(-1),null);input.props.onChangeText('   ');assert.equal(values.at(-1),null);h.unmount();
});
test('quick successive pins ignore an old reverse-geocoding response',async()=>{
 const pending=[],values=[];const h=harness(PICKER),p={onChange:v=>values.push(v),resolverEndereco:point=>new Promise(resolve=>pending.push({point,resolve}))};
 h.render('default',p);await tick();tap(h,p,-8.1,-35.1);tap(h,p,-8.2,-35.2);
 pending[1].resolve({...pending[1].point,nome:'Endereço B'});await tick();pending[0].resolve({...pending[0].point,nome:'Endereço A atrasado'});await tick();const t=h.render('default',p);
 assert.equal(values.at(-1).nome,'Endereço B');assert.equal(values.at(-1).latitude,-8.2);assert.equal(find(t,'Nome ou endereço do local').props.value,'Endereço B');h.unmount();
});
test('typing a reviewed description prevents a pending provider result from replacing it',async()=>{
 let finish;const values=[];const h=harness(PICKER),p={onChange:v=>values.push(v),resolverEndereco:()=>new Promise(r=>finish=r)};
 h.render('default',p);await tick();tap(h,p,-8.1,-35.1);find(h.render('default',p),'Nome ou endereço do local').props.onChangeText('Meu ponto revisado');finish({nome:'Outra descrição'});await tick();assert.equal(values.at(-1).nome,'Meu ponto revisado');assert.equal(values.at(-1).latitude,-8.1);h.unmount();
});
test('reopening a confirmed point preserves its name without another reverse lookup',()=>{
 let queries=0;const values=[];const h=harness(PICKER),p={localizacaoInicial:{nome:full,latitude:-8.1,longitude:-35.1},onChange:v=>values.push(v),resolverEndereco:async()=>{queries++;throw Error();}};
 h.render('default',p);const t=h.render('default',p);assert.equal(find(t,'Nome ou endereço do local').props.value,full);assert.equal(queries,0);assert.equal(values.at(-1).nome,full);h.unmount();
});
test('legacy generic addresses can be resolved for display without changing the server DTO or confirmed names',async()=>{
 const calls=[],e={...fixture(),destinoNome:generic,origemNome:'Saída confirmada pelo motorista',origemLatitude:-8.4,origemLongitude:-35.4};e.paradas=[{...e.paradas[0],nome:generic},{...e.paradas[1],nome:'Terminal confirmado'}];
 const h=harness(SERVICE,{extras:{'expo-location':{reverseGeocodeAsync:async p=>{calls.push(p);return [address];}}}}),r=await h.mod.resolverNomesExcursao(e);
 assert.equal(r.excursao.destinoNome,full);assert.equal(r.excursao.paradas[0].nome,full);assert.equal(r.excursao.paradas[1].nome,'Terminal confirmado');assert.equal(r.excursao.origemNome,e.origemNome);assert.equal(e.destinoNome,generic);assert.equal(e.paradas[0].nome,generic);assert.equal(calls.length,2);
});
test('legacy display failure does not expose a generic value as a confirmed address',async()=>{
 const e={...fixture(),destinoNome:generic},h=harness('src/components/excursoes/useNomesExcursao.ts');h.render('useNomesExcursao',e);await tick();const r=h.render('useNomesExcursao',e);assert.equal(r.exibicao.destinoNome,'Endereço não identificado');assert.equal(r.falhas,1);assert.equal(e.destinoNome,generic);h.unmount();
});
test('unmounted picker ignores a late native response',async()=>{
 let finish;const values=[];const h=harness(PICKER),p={onChange:v=>values.push(v),resolverEndereco:()=>new Promise(r=>finish=r)};
 h.render('default',p);await tick();tap(h,p,-8.1,-35.1);const count=values.length;h.unmount();finish({nome:full});await tick();assert.equal(values.length,count);
});

test('details ignore an obsolete coordinate lookup after the excursion changes',async()=>{
 const pending=[],h=harness('src/components/excursoes/useNomesExcursao.ts',{extras:{'expo-location':{reverseGeocodeAsync:p=>new Promise(resolve=>pending.push({p,resolve}))}}});
 const first={...fixture(),destinoNome:generic},second={...first,destinoLatitude:-8.22,destinoLongitude:-35.22};
 h.render('useNomesExcursao',first);await tick();h.render('useNomesExcursao',second);await tick();
 pending[1].resolve([{street:'Rua B'}]);await tick();pending[0].resolve([{street:'Rua A atrasada'}]);await tick();
 assert.equal(h.render('useNomesExcursao',second).exibicao.destinoNome,'Rua B');h.unmount();
});

test('destination and origin round-trip through the current save contract with exact pin coordinates',async()=>{
 let stored=fixture(),body;
 const h=harness(SERVICE,{extras:{'expo-location':{reverseGeocodeAsync:async()=>[address]},'../config/api':{apiRequest:async(path,options={})=>{
  assert.equal(path,'/excursoes/7');if(options.method==='PUT'){body=JSON.parse(options.body);stored={...stored,...body,versao:2};}return stored;
 }}}});
 const point=await h.mod.resolverEnderecoExcursao({latitude:-8.37,longitude:-35.87});
 const planning=h.load('src/components/excursoes/Planejamento.ts'),service=h.load('src/services/excursoes.ts');
 const draft={...planning.rascunhoInicial(stored),destino:point,origem:{...point,nome:'Saída · '+point.nome,latitude:-8.38}};
 await service.salvarExcursao(7,planning.dadosRascunho(draft,1));const reopened=await service.buscarExcursao('7');
 assert.equal(body.destinoNome,full);assert.equal(body.destinoLatitude,-8.37);assert.equal(body.destinoLongitude,-35.87);
 assert.equal(reopened.origemNome,'Saída · '+full);assert.equal(reopened.origemLatitude,-8.38);
 assert.deepEqual(JSON.parse(JSON.stringify(planning.rascunhoInicial(reopened).destino)),{nome:full,latitude:-8.37,longitude:-35.87});
});
test('excursion save and reopen preserve the confirmed address in existing fields and retain stop IDs',async()=>{
 const e=fixture(),writes=[];let persisted=e;
 const services={},h=harness('src/components/excursoes/PlanejarExcursao.tsx',{services,extras:{'../config/api':{apiRequest:async(path,opts={})=>{
  if(opts.method==='PUT'&&path==='/excursoes/7/coleta'){const body=JSON.parse(opts.body);writes.push(body);persisted={...persisted,versao:2,modoColeta:body.modo,paradas:body.paradas};return persisted;}
  if(path==='/excursoes/7')return persisted;throw Error('Unexpected endpoint '+path);
 }},'expo-location':{reverseGeocodeAsync:async()=>[address]}}});Object.assign(services,h.load('src/services/excursoes.ts'));
 const p={initial:e,initialMoment:'Pontos',onClose(){},onPersisted(){},onSaved:async()=>{}};
 let t=h.render('PlanejarExcursao',p);find(t,'Ajustar ponto').props.onPress();t=h.render('PlanejarExcursao',p);find(t,'Mudar posição no mapa').props.onPress();t=h.render('PlanejarExcursao',p);const picker=nodes(t).find(n=>n.type==='MapPicker');
 const core=harness(PICKER);core.render('default',picker.props);await tick();tap(core,picker.props,-8.31,-35.81);await tick();find(h.render('PlanejarExcursao',p),'Usar este ponto').props.onPress();t=h.render('PlanejarExcursao',p);find(t,'Continuar').props.onPress();t=h.render('PlanejarExcursao',p);await find(t,'Salvar alterações').props.action();
 const reopened=await services.buscarExcursao('7');assert.equal(reopened.paradas[0].nome,full);assert.equal(reopened.paradas[0].id,1);assert.equal(reopened.paradas[0].latitude,-8.31);assert.equal(reopened.paradas[0].longitude,-35.81);assert.equal(writes.length,1);assert.ok(!JSON.stringify(writes).includes(generic));
 const view=harness('src/components/excursoes/VisaoGeralViagem.tsx').render('VisaoGeralViagem',{e:reopened,dirty:false});assert.equal(nodes(view).find(n=>n.type?.name==='ItinerarioViagem').props.paradas[0].nome,full);core.unmount();h.unmount();
});
