const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/roteiro.cjs');
const {harness}=require('./helpers/excursoes.cjs');

test('timeout de consulta não sugere confirmação enviada; escrita incerta continua explícita',async()=>{
 const service=load('src/services/operacoes.ts',{'../config/api':{apiRequest:async()=>{throw {kind:'timeout'};}},'./catalogo':{recursoId:Number}});
 let consult;
 const h=harness('src/app/controle-viagem.tsx',{
  resources:(key,fn)=>{if(String(key).startsWith('operacao:'))consult=fn;return {data:null,error:'',reload(){}};},
  extras:{'../services/operacoes':service,'../components/RastreamentoViagem':{RastreamentoViagem:'GPS'}},
 });
 const tree=h.render('Painel',{tipo:'VIAGEM',id:'73',motorista:false});
 assert.ok(JSON.stringify(tree).includes('73'),'referência da execução aparece mesmo sem sentido no registro próprio');
 await assert.rejects(consult(new AbortController().signal),error=>/consulta da operação demorou/.test(error.message)&&!/pode ter sido registrada/.test(error.message));
 assert.match(service.mensagemErroOperacao({kind:'timeout'}),/pode ter sido registrada/);
 h.unmount();
});
