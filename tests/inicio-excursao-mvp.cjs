const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {harness,fixture,find,nodes}=require('./helpers/excursoes.cjs');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Date,Error,JSON,Set,require:n=>{if(n.endsWith('/useThemeRevision'))return {useThemeRevision:()=> 'light'};if(n.endsWith('/themedStyles'))return {themedStyles:factory=>factory()};if(n.endsWith('/PreferenciaAparencia'))return {PreferenciaAparencia:'Appearance'};if(n.endsWith('/ThemeContext'))return {ThemeProvider:'ThemeProvider'};return mocks[n];}});return exports;}
function setup(){
 const e=fixture();const state={e,execucoes:[],pontos:[{tipo:'ORIGEM',paradaId:null,nome:'Saída',latitude:-8,longitude:-35,participantes:[]},{tipo:'COLETA',paradaId:1,nome:'Encontro',latitude:-8.1,longitude:-35.1,participantes:[{inscricaoId:8,nome:'Pessoa teste'}]},{tipo:'DESTINO',paradaId:null,nome:'Destino',latitude:-8.2,longitude:-35.2,participantes:[]}]};
 const mapa=load('src/services/mapaExcursao.ts'),validacao=load('src/services/excursaoValidacao.ts',{'./mapaExcursao':mapa});
 const m=load('src/services/inicioExcursao.ts',{'../config/api':{apiRequest:async()=>state.pontos},'./excursoes':{buscarExcursao:async()=>state.e,listarExecucoes:async()=>state.execucoes},'./excursaoValidacao':validacao,'./mapaExcursao':mapa});return {e,state,m};
}
test('revisão de excursão consulta versão, execuções e roteiro antes de expor início',async()=>{
 const {e,m}=setup(),r=await m.revisarTrechoExcursao(e,'IDA');assert.equal(r.versao,e.versao);assert.equal(r.autorizados,1);assert.equal(r.pontos.length,3);assert.equal('participantes'in r.pontos[1],false);await m.conferirRevisaoTrecho(e,r);
});
test('retorno bloqueado, versão diferente, execução ativa e roteiro incompleto impedem revisão',async()=>{
 for(const mutate of [h=>h.state.e={...h.e,versao:2},h=>h.state.execucoes=[{id:2,sentido:'IDA',estado:'EM_ANDAMENTO'}],h=>h.state.pontos.splice(0,2)]){const h=setup();mutate(h);await assert.rejects(h.m.revisarTrechoExcursao(h.e,'IDA'));}
 const h=setup();await assert.rejects(h.m.revisarTrechoExcursao(h.e,'VOLTA'),/Finalize a ida/);
});
test('mudança de autorizados ou de coordenadas após revisão impede confirmação',async()=>{
 const h=setup(),r=await h.m.revisarTrechoExcursao(h.e,'IDA');h.state.pontos[1].participantes.push({inscricaoId:9,nome:'Outra pessoa'});await assert.rejects(h.m.conferirRevisaoTrecho(h.e,r),/participantes mudaram/);
 h.state.pontos[1].participantes.pop();h.state.pontos[1].latitude=-8.5;await assert.rejects(h.m.conferirRevisaoTrecho(h.e,r),/roteiro/);
});
test('ausência de quantidade autorizada é explícita, sem contagem presumida',async()=>{
 const h=setup();delete h.state.pontos[1].participantes;assert.equal((await h.m.revisarTrechoExcursao(h.e,'IDA')).autorizados,null);
});
test('cartões explicam volta indisponível, desconhecido e execução finalizada sem novo botão de início',()=>{
 const h=harness('src/components/excursoes/OperacaoExcursao.tsx'),e=fixture(),base={e,offline:false,dirty:false,onRefresh(){},onPublicar(){},onControle(){}};
 let t=h.render('OperacaoExcursao',{...base,execucoes:null});assert.ok(JSON.stringify(t).includes('Estado não confirmado'));assert.equal(find(t,'Revisar trecho IDA'),undefined);
 t=h.render('OperacaoExcursao',{...base,execucoes:[]});assert.ok(JSON.stringify(t).includes('Finalize a ida'));assert.ok(JSON.stringify(t).includes('retorno não configurados'));
 t=h.render('OperacaoExcursao',{...base,execucoes:[{id:4,sentido:'IDA',estado:'FINALIZADA',pontos:[{nome:'Origem'},{nome:'Destino'}]}]});assert.equal(find(t,'Revisar trecho IDA'),undefined);assert.ok(find(t,'Controle de embarque'));assert.ok(JSON.stringify(t).includes('Finalizada'));h.unmount();
});
