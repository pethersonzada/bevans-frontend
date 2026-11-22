import { validarPaginaConvite } from './paginaConvite';
export { validarPaginaConvite } from './paginaConvite';
import { apiFetch, apiRequest, readApiJson } from '../config/api';
import { validarDatasExcursao, validarValidadeConvite } from './excursaoFormulario';
import { paginaValida, recursoId, type Pagina } from './catalogo';
import { validarPontosPlanejamento } from './mapaExcursao';
import { mesmaColetaExcursao, mesmaExcursaoSalva, normalizarParadasExcursao, validarColetaExcursao, validarDadosExcursao } from './excursaoValidacao';
export type ParadaExcursao={id:number|null;nome:string;latitude:number;longitude:number;horario:string|null;instrucoes:string|null;pontoConfirmado?:boolean};
export type Excursao={id:number;titulo:string;destinoNome:string;destinoLatitude:number;destinoLongitude:number;
    origemNome:string|null;origemLatitude:number|null;origemLongitude:number|null;partidaEm:string;retornoEm:string|null;
    capacidade:number;estado:string;versao:number;modoColeta:'PORTA_A_PORTA'|'PARADA_UNICA'|'MULTIPLAS_PARADAS';paradas:ParadaExcursao[]};
export type DadosExcursao=Pick<Excursao,'titulo'|'destinoNome'|'destinoLatitude'|'destinoLongitude'|'origemNome'|'origemLatitude'|'origemLongitude'|'partidaEm'|'retornoEm'|'capacidade'> & {versao?:number};
export type ExecucaoExcursao={id:number;excursaoId:number;sentido:'IDA'|'VOLTA';estado:'EM_ANDAMENTO'|'FINALIZADA'|'CANCELADA';pontos:(ReturnType<typeof validarPontosPlanejamento>[number]&{participantes?:{inscricaoId:number;nome:string}[]})[]};
function excursao(r:Excursao|null):Excursao {
    if(!r || !Number.isSafeInteger(r.id) || r.id<=0 || typeof r.titulo!=='string' || !Number.isInteger(r.versao) || !Array.isArray(r.paradas))throw new Error('Resposta de excursão inválida.');return r;
}
export async function listarExcursoes(pagina:number,signal?:AbortSignal) {
    const r=paginaValida(await apiRequest<Pagina<Excursao>>(`/excursoes?pagina=${pagina}&tamanho=20`,{signal}));r.itens.forEach(excursao);return r;
}
export async function buscarExcursao(id:string,signal?:AbortSignal) {
    const r=excursao(await apiRequest<Excursao>(`/excursoes/${recursoId(id)}`,{signal}));if(r.id!==Number(id))throw new Error('Excursão divergente.');return r;
}
export async function salvarExcursao(id:number|null,dados:DadosExcursao) {
    validarDadosExcursao(dados);
    validarDatasExcursao(dados.partidaEm,dados.retornoEm,dados.capacidade);
    const r=excursao(await apiRequest<Excursao>(id?`/excursoes/${recursoId(id)}`:'/excursoes',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)}));
    if(id&&r.id!==id)throw new Error('O servidor retornou outra excursão.');return r;
}
export async function acaoExcursao(id:number,acao:'publicacao'|'cancelamento',versao:number) {
    const r=excursao(await apiRequest<Excursao>(`/excursoes/${recursoId(id)}/${acao}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({versao})}));
    if(r.id!==id||r.estado!==(acao==='publicacao'?'PUBLICADA':'CANCELADA'))throw new Error('O servidor não confirmou a alteração de estado da excursão. Atualize os dados.');return r;
}
export async function salvarColetaExcursao(id:number,modo:Excursao['modoColeta'],versao:number,paradas:ParadaExcursao[]) {
    validarColetaExcursao(modo,paradas);
    const r=excursao(await apiRequest<Excursao>(`/excursoes/${recursoId(id)}/coleta`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({modo,versao,paradas:normalizarParadasExcursao(paradas).map(p=>({...p,pontoConfirmado:true}))})}));
    if(r.id!==id||r.modoColeta!==modo||!mesmaColetaExcursao(paradas,r.paradas))throw new Error('O servidor não confirmou o modo, a ordem e os dados das paradas. Atualize antes de repetir o salvamento.');return r;
}
export async function confirmarPersistenciaExcursao(id:number,esperada:Excursao) {
    const atual=await buscarExcursao(String(id));
    if(!mesmaExcursaoSalva(esperada,atual))throw new Error('A nova consulta não corresponde ao planejamento enviado. Atualize a viagem antes de continuar.');return atual;
}
export function validarExecucaoExcursao(r:ExecucaoExcursao|null,excursaoId:number,sentido?:'IDA'|'VOLTA') {
    if(!r||!Number.isSafeInteger(r.id)||r.id<=0||r.excursaoId!==excursaoId||!['IDA','VOLTA'].includes(r.sentido)||(sentido&&r.sentido!==sentido)||!['EM_ANDAMENTO','FINALIZADA','CANCELADA'].includes(r.estado))throw new Error('O servidor não confirmou a execução desta excursão e sentido.');
    const pontos=validarPontosPlanejamento(r.pontos);
    if(!pontos.length)throw new Error('A execução não possui um roteiro válido. Atualize antes de continuar.');
    return {...r,pontos:r.pontos.map((p,i)=>({...pontos[i],participantes:p.participantes}))};
}
export async function listarExecucoes(id:number,signal?:AbortSignal) {
    const r=await apiRequest<ExecucaoExcursao[]>(`/excursoes/${recursoId(id)}/execucoes`,{signal});if(!Array.isArray(r))throw new Error('Execuções indisponíveis.');return r.map(x=>validarExecucaoExcursao(x,id));
}
export async function buscarExecucaoExcursao(excursaoId:number,execucaoId:number,signal?:AbortSignal) {
    const r=(await listarExecucoes(excursaoId,signal)).find(x=>x.id===execucaoId);
    if(!r)throw new Error('A execução não foi encontrada nesta excursão. Atualize antes de continuar.');return r;
}
export async function iniciarExcursao(id:number,sentido:'IDA'|'VOLTA') {
    const r=await apiRequest<ExecucaoExcursao>(`/excursoes/${recursoId(id)}/execucoes?sentido=${sentido}&otimizar=false`,{method:'POST'});
    const execucao=validarExecucaoExcursao(r,id,sentido);
    if(execucao.estado!=='EM_ANDAMENTO')throw new Error('O servidor não confirmou o início. Consulte as execuções antes de repetir.');return execucao;
}
export async function finalizarExcursao(id:number,execucao:number) {
    const r=validarExecucaoExcursao(await apiRequest<ExecucaoExcursao>(`/excursoes/${recursoId(id)}/execucoes/${recursoId(execucao)}/finalizacao`,{method:'PUT'}),id);
    if(r.id!==execucao||r.estado!=='FINALIZADA')throw new Error('O servidor não confirmou a finalização. Atualize antes de repetir.');return r;
}
export async function criarConviteExcursao(id:number,expiraEm:string,partidaEm?:string) {
    validarValidadeConvite(expiraEm,partidaEm||expiraEm);
    const r=await apiRequest<{convite:{id:number};token:string}>(`/excursoes/${recursoId(id)}/convites`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiraEm})});
    if(!r || !Number.isSafeInteger(r.convite?.id) || r.convite.id<=0 || typeof r.token!=='string' || !r.token.trim() || /\s/.test(r.token))throw new Error('Convite não confirmado. Confira a lista antes de emitir outro.');return {id:r.convite.id,token:r.token};
}
export function linkConvite(base:string|undefined,token:string) {
    const url=validarPaginaConvite(base);
    if(typeof token!=='string'||!token.trim()||/\s/.test(token))throw new Error('Este convite não possui um link válido nesta sessão.');
    url.hash=token;return url.toString();
}
export type InscritoExcursao={id:number;nome:string;estado:string;paradaId:number|null;nomePonto:string|null};
export async function participantesExcursao(id:number,pagina:number,signal?:AbortSignal){return paginaValida(await apiRequest<Pagina<InscritoExcursao>>(`/excursoes/${recursoId(id)}/inscricoes?pagina=${pagina}&tamanho=20`,{signal}));}
export async function confirmarParticipante(id:number,inscricaoId:number){return apiRequest(`/excursoes/${recursoId(id)}/inscricoes/${recursoId(inscricaoId)}/confirmacao`,{method:'PUT'});}
export async function convitesExcursao(id:number,signal?:AbortSignal){
    const r=await apiRequest<{id:number;expiraEm:string;revogadoEm:string|null}[]>(`/excursoes/${recursoId(id)}/convites`,{signal});
    if(!Array.isArray(r)||r.some(c=>!c||!Number.isSafeInteger(c.id)||c.id<=0||typeof c.expiraEm!=='string'||!Number.isFinite(Date.parse(c.expiraEm))||(c.revogadoEm!=null&&(typeof c.revogadoEm!=='string'||!Number.isFinite(Date.parse(c.revogadoEm))))))throw new Error('Convites indisponíveis.');
    return r.map(c=>({id:c.id,expiraEm:c.expiraEm,revogadoEm:c.revogadoEm??null}));
}
export async function revogarConviteExcursao(id:number,conviteId:number){return apiRequest(`/excursoes/${recursoId(id)}/convites/${recursoId(conviteId)}`,{method:'DELETE'});}
export async function planejarExcursao(id:number,sentido:'IDA'|'VOLTA',otimizar:boolean,signal?:AbortSignal){
    const response=await apiFetch(`/excursoes/${recursoId(id)}/planejamento?sentido=${sentido}&otimizar=${otimizar}`,{method:'POST',signal});
    // Development diagnostics contain no names, coordinates or participant data.
    if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[ExcursaoPlanejamentoHTTP]',JSON.stringify({sentido,otimizar,status:response.status}));
    const pontos=validarPontosPlanejamento(await readApiJson<unknown>(response));
    if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[ExcursaoPlanejamentoPontos]',JSON.stringify({sentido,quantidade:pontos.length,tipos:pontos.map(p=>p.tipo??'SEM_TIPO'),coordenadasValidas:true}));
    return pontos;
}
