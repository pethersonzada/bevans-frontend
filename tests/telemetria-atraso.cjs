const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/roteiro.cjs');

for(const failure of [false,true])test(`GPS aguarda cinco segundos após envio demorado ${failure?'recusado':'confirmado'}, sem reenviar amostras puladas`,async()=>{
 let now=10000,finish,calls=0;
 const m=load('src/services/telemetria.ts',{'./viagens':{enviarPosicaoVan:()=>{
  calls++;
  if(calls===1)return new Promise((resolve,reject)=>{finish=()=>failure?reject(Error('rede')):resolve();});
  return Promise.resolve();
 }}},{Date:{now:()=>now}});
 const context={userId:'1',turmaId:10,online:true,active:true,mounted:true};
 const sender=m.createPositionSender('1',()=>context),point={latitude:-8,longitude:-35};
 const first=sender.send(point);now=30000;
 assert.equal(await sender.send(point),false,'requisição em andamento bloqueia concorrência');
 finish();
 if(failure)await assert.rejects(first,/rede/);else assert.equal(await first,true);
 assert.equal(await sender.send(point),false,'resposta tardia não libera uma rajada imediata');
 now+=4999;assert.equal(await sender.send(point),false);
 assert.equal(calls,1);
 now++;assert.equal(await sender.send({...point,latitude:-8.1}),true);
 assert.equal(calls,2);
});
