const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function harness({stage,commit=false,occupied=0,unreadable=false}={}) {
    let state={status:'ATIVA',viagemId:11,sentido:'IDA'},writes=[];
    const exports={};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/viagens.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({
        apiRequest:async path=>{if(path.startsWith('/operacoes'))return {contadores:{naVan:occupied}};if(unreadable&&writes.length)throw Error('offline');return state;},
        apiFetch:async path=>{writes.push(path);const step=path.startsWith('/rota/encerrar')?'encerrar':'iniciar';if(stage!==step||commit)state=step==='encerrar'?{status:'INATIVA'}:{status:'ATIVA',viagemId:12,sentido:'VOLTA'};if(stage===step)throw Error('timeout');return {ok:true};}
    })});
    return {service:exports,writes};
}
test('replacement uses the expected active execution and blocks embarked passengers',async()=>{
    const h=harness({occupied:1});await assert.rejects(h.service.reiniciarViagem(7,'VOLTA',11),e=>e.etapa==='verificar');assert.equal(h.writes.length,0);
    const other=harness();await assert.rejects(other.service.reiniciarViagem(7,'VOLTA',99));assert.equal(other.writes.length,0);
});
test('successful end followed by failed start reports old execution ended and inactive readback',async()=>{
    const h=harness({stage:'iniciar'});await assert.rejects(h.service.reiniciarViagem(7,'VOLTA',11),e=>e.anteriorEncerrada&&e.estado.status==='INATIVA'&&e.etapa==='iniciar');assert.equal(h.writes.length,2);
});
test('timeout after start committed is recovered only by official readback without replay',async()=>{
    const h=harness({stage:'iniciar',commit:true});const r=await h.service.reiniciarViagem(7,'VOLTA',11);assert.equal(r.viagemId,12);assert.equal(h.writes.length,2);
});
test('timeout after end committed never automatically starts another trip',async()=>{
    const h=harness({stage:'encerrar',commit:true});await assert.rejects(h.service.reiniciarViagem(7,'VOLTA',11),e=>e.anteriorEncerrada&&e.etapa==='encerrar');assert.equal(h.writes.length,1);
});
test('unknown readback remains unknown and repeated calls cannot duplicate writes',async()=>{
    const h=harness({stage:'iniciar',unreadable:true});await assert.rejects(h.service.reiniciarViagem(7,'VOLTA',11),e=>e.estado===null&&e.anteriorEncerrada);
    const repeated=harness();const first=repeated.service.reiniciarViagem(7,'VOLTA',11);await assert.rejects(repeated.service.reiniciarViagem(7,'VOLTA',11),/andamento/);await first;assert.equal(repeated.writes.length,2);await assert.rejects(repeated.service.reiniciarViagem(7,'VOLTA',11));assert.equal(repeated.writes.length,2);
});

test('old execution is invalidated before the new start request resolves',async()=>{
    let ended=false,startSawInvalidation=false;
    const exports={};let state={status:'ATIVA',viagemId:11,sentido:'IDA'};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/viagens.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({
        apiRequest:async path=>path.startsWith('/operacoes')?{contadores:{naVan:0}}:state,
        apiFetch:async path=>{if(path.startsWith('/rota/encerrar'))state={status:'INATIVA'};else{startSawInvalidation=ended;state={status:'ATIVA',viagemId:12,sentido:'VOLTA'};}return {ok:true};}
    })});
    await exports.reiniciarViagem(7,'VOLTA',11,()=>{ended=true;});assert.equal(startSawInvalidation,true);
});
