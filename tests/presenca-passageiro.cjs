const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/excursoes.cjs');
function setup({failure,commit=true,unreadable=false,mismatch=false}={}){
 let saved={status:'IDA',enderecoIda:{id:3},enderecoVolta:null};const writes=[];
 const {recursoId}=harness('src/services/catalogo.ts').mod;
 const service=harness('src/services/presencaPassageiro.ts',{extras:{
  './catalogo':{recursoId},'./passageiroHome':{fetchMinhaConfirmacao:async()=>{if(unreadable)throw Error('Rede');return mismatch?{status:'VOLTA'}:saved;}},
  '../config/api':{apiFetch:async path=>{writes.push(path);const p=new URL('https://api.test'+path).searchParams;if(commit)saved=p.get('status')==='LIMPAR'?null:{status:p.get('status'),enderecoIda:p.has('enderecoIda')?{id:Number(p.get('enderecoIda'))}:null,enderecoVolta:p.has('enderecoVolta')?{id:Number(p.get('enderecoVolta'))}:null};if(failure)throw failure;return {ok:true};},readApiError:async()=>Error('Recusado')}
 }}).mod;return {service,writes};
}
test('presença valida identidade e status antes de escrever e confere endereços por sentido',async()=>{
 const h=setup();for(const args of [['x',2,'IDA'],['1',0,'IDA'],['1',2,'INVENTADO'],['1',2,'IDA',-1]])await assert.rejects(h.service.salvarPresencaPassageiro(...args));assert.equal(h.writes.length,0);
 const saved=await h.service.salvarPresencaPassageiro('1',2,'AMBOS',3,4);assert.equal(saved.enderecoIda.id,3);assert.equal(saved.enderecoVolta.id,4);
 await h.service.salvarPresencaPassageiro('1',2,'NAO_VOU',3,4);assert.ok(!h.writes.at(-1).includes('endereco'));
});
test('limpeza exige releitura vazia e recupera timeout gravado sem repetir POST',async()=>{
 const h=setup({failure:Object.assign(Error('Timeout'),{kind:'timeout'})});assert.equal(await h.service.salvarPresencaPassageiro('1',2,'LIMPAR'),null);assert.equal(h.writes.length,1);
 const rejected=setup({failure:Object.assign(Error('Sem rede'),{kind:'network'}),commit:false});await assert.rejects(rejected.service.salvarPresencaPassageiro('1',2,'LIMPAR'),/Sem rede/);assert.equal(rejected.writes.length,1);
});
test('presença não assume sucesso quando GET falha ou retorna dados diferentes',async()=>{
 for(const options of [{unreadable:true},{mismatch:true}]){const h=setup(options);await assert.rejects(h.service.salvarPresencaPassageiro('1',2,'IDA',3),/conferir|diferente/);assert.equal(h.writes.length,1);}
});
