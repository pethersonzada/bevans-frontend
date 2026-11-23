const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Date,Error,URL,require:name=>{if(name.endsWith('/useThemeRevision'))return {useThemeRevision:()=> 'light'};if(name.endsWith('/themedStyles'))return {themedStyles:factory=>factory()};if(name.endsWith('/PreferenciaAparencia'))return {PreferenciaAparencia:'Appearance'};if(name.endsWith('/ThemeContext'))return {ThemeProvider:'ThemeProvider'};if(name==='./paginaConvite')return load('src/services/paginaConvite.ts',{});if(!(name in mocks))throw Error(name);return mocks[name];}});return exports;}
function harness(){
    const state={created:0,readFailure:null,postFailure:false,postGate:null,metadata:[],requests:[],estado:'PUBLICADA',execucoes:[]};
    const auth={currentUser:{uid:'synthetic-organizer-A'}};
    const expiry=new Date(Date.now()+3600000).toISOString(),departure=new Date(Date.now()+7200000).toISOString();
    const form=load('src/services/excursaoFormulario.ts',{});
    const cat=load('src/services/catalogo.ts',{'../config/api':{}});
    const api={apiRequest:async(path,options={})=>{
        state.requests.push({path,method:options.method||'GET'});
        if(path==='/excursoes/7/convites'&&options.method==='POST'){
            state.created++;const id=state.created;state.metadata.push({id,expiraEm:JSON.parse(options.body).expiraEm,revogadoEm:null});
            if(state.postGate)await state.postGate;
            if(state.postFailure)throw Object.assign(Error('creation outcome unknown'),{kind:'timeout'});
            return {convite:{id},token:`synthetic_invitation_${id}`};
        }
        if(options.method==='DELETE') {const id=Number(path.split('/').at(-1));const c=state.metadata.find(c=>c.id===id);if(c)c.revogadoEm=new Date().toISOString();return null;}
        if(state.readFailure)throw state.readFailure;
        if(path==='/excursoes/7/convites')return state.metadata;
        if(path==='/excursoes/7/execucoes')return state.execucoes;
        if(path==='/excursoes/7')return {id:7,titulo:'Evento',versao:1,paradas:[],estado:state.estado,partidaEm:departure};
        throw Error('Unexpected API endpoint '+path);
    }};
    const mapa=load('src/services/mapaExcursao.ts',{});
    const excursoes=load('src/services/excursoes.ts',{'../config/api':api,'./catalogo':cat,'./excursaoFormulario':form,'./mapaExcursao':mapa,'./excursaoValidacao':load('src/services/excursaoValidacao.ts',{'./mapaExcursao':mapa})});
    const service=load('src/services/convitesCompartilhamento.ts',{'../config/firebase':{auth},'./excursoes':excursoes,'./excursaoFormulario':form});
    service.definirSessaoConvites(auth.currentUser.uid);
    const prepare=(base='https://example.test/convite')=>service.prepararConviteCompartilhamento(7,expiry,departure,base);
    return {state,auth,service,excursoes,prepare,expiry};
}
test('concurrent invitation actions issue one token and place it only in the HTTPS fragment',async()=>{
    const h=harness();const [a,b]=await Promise.all([h.prepare(),h.prepare()]);assert.equal(h.state.created,1);assert.equal(a.link,b.link);const url=new URL(a.link);assert.equal(url.search,'');assert.equal(url.hash,'#synthetic_invitation_1');assert.ok(h.state.requests.every(r=>!r.path.includes('synthetic_invitation')));
});
test('configuration failure prevents issuing an orphan invitation',async()=>{
    const h=harness();await assert.rejects(h.prepare(''),/não está configurada/);await assert.rejects(h.prepare('http://example.test/convite'),/HTTPS/);assert.equal(h.state.created,0);
});
test('newly issued token survives screen remount, copy/share retry and failed follow-up reads',async()=>{
    const h=harness();h.state.readFailure=Object.assign(Error('temporary read failure'),{status:503});await assert.rejects(h.prepare(),/temporary/);assert.equal(h.state.created,1);assert.equal(h.service.estadoConviteCompartilhamento(7).id,1);h.state.readFailure=null;const ready=await h.service.recuperarLinkConvite(7,'https://example.test/convite');ready.registrarResultado('Compartilhamento cancelado.');assert.equal(h.service.estadoConviteCompartilhamento(7).aviso,'Compartilhamento cancelado.');const next=await h.prepare();assert.equal(next.link,ready.link);assert.equal(h.state.created,1);
});
test('revoked, expired and unavailable invitations never yield a recovered link',async()=>{
    for(const mode of ['revoked','expired','closed','missing']){
        const h=harness();await h.prepare();if(mode==='revoked')h.state.metadata[0].revogadoEm=new Date().toISOString();if(mode==='expired')h.state.metadata[0].expiraEm=new Date(Date.now()-1000).toISOString();if(mode==='closed')h.state.estado='CANCELADA';if(mode==='missing')h.state.metadata=[];
        await assert.rejects(h.service.recuperarLinkConvite(7,'https://example.test/convite'));assert.equal(h.service.estadoConviteCompartilhamento(7),null);assert.equal(h.state.created,1);
    }
});
test('unknown POST outcome is not retried until explicit review even if the server created metadata',async()=>{
    const h=harness();h.state.postFailure=true;await assert.rejects(h.prepare(),/pode ter sido registrada/);assert.equal(h.state.metadata.length,1);await assert.rejects(h.prepare(),/Revise/);assert.equal(h.state.created,1);assert.equal(h.service.estadoConviteCompartilhamento(7).incerto,true);
    await h.service.revogarConviteRecuperado(7,1);await h.service.autorizarNovaEmissaoAposRevisao(7);h.state.postFailure=false;const ready=await h.prepare();assert.equal(h.state.created,2);assert.equal(ready.id,2);
});
test('logout/account change discards raw tokens and ignores late creation responses',async()=>{
    const h=harness();let finish;h.state.postGate=new Promise(r=>finish=r);const pending=h.prepare();const rejected=assert.rejects(pending,/sessão mudou/);await new Promise(setImmediate);h.auth.currentUser={uid:'synthetic-organizer-B'};h.service.definirSessaoConvites(h.auth.currentUser.uid);finish();await rejected;assert.equal(h.service.estadoConviteCompartilhamento(7),null);await assert.rejects(h.service.recuperarLinkConvite(7,'https://example.test/convite'),/não está disponível/);
    const another=harness();const old=await another.prepare();another.service.definirSessaoConvites(null);assert.equal(another.service.estadoConviteCompartilhamento(7),null);assert.throws(()=>old.registrarResultado('late share'),/sessão mudou/);
});
test('confirmed revocation forgets the only in-memory secret and list exposes metadata only',async()=>{
    const h=harness();await h.prepare();h.state.metadata[0].token='must-not-be-exposed';const list=await h.excursoes.convitesExcursao(7);assert.equal(list[0].token,undefined);await h.service.revogarConviteRecuperado(7,1);assert.equal(h.service.estadoConviteCompartilhamento(7),null);assert.ok(h.state.metadata[0].revogadoEm);
});

test('HTTP timeout and throttled revalidation preserve the token without releasing a stale link or issuing another',async()=>{
    for(const status of [408,429]){
        const h=harness();const original=await h.prepare();
        h.state.readFailure=Object.assign(Error('temporary HTTP rejection'),{status});
        await assert.rejects(h.service.recuperarLinkConvite(7,'https://example.test/convite'),/temporary HTTP/);
        await assert.rejects(h.prepare(),/temporary HTTP/);
        assert.equal(h.service.estadoConviteCompartilhamento(7).id,original.id);
        assert.equal(h.state.created,1);
        h.state.readFailure=null;
        assert.equal((await h.prepare()).link,original.link);
        assert.equal(h.state.created,1);
    }
});

test('a cached invitation cannot be shared once an execution exists even while the excursion remains published',async()=>{
 const h=harness();await h.prepare();h.state.execucoes=[{id:9,excursaoId:7,sentido:'IDA',estado:'FINALIZADA',pontos:[{paradaId:null,tipo:'DESTINO',nome:'Destino',latitude:-8,longitude:-35}]}];await assert.rejects(h.service.recuperarLinkConvite(7,'https://example.test/convite'));assert.equal(h.service.estadoConviteCompartilhamento(7),null);assert.equal(h.state.created,1);
});
