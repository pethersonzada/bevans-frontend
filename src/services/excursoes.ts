import { apiRequest } from '../config/api';
import { paginaValida, recursoId, type Pagina } from './catalogo';
export type ParadaExcursao={id:number|null;nome:string;latitude:number;longitude:number;horario:string|null;instrucoes:string|null;pontoConfirmado?:boolean};
export type Excursao={id:number;titulo:string;destinoNome:string;destinoLatitude:number;destinoLongitude:number;
    origemNome:string|null;origemLatitude:number|null;origemLongitude:number|null;partidaEm:string;retornoEm:string|null;
    capacidade:number;estado:string;versao:number;modoColeta:'PORTA_A_PORTA'|'PARADA_UNICA'|'MULTIPLAS_PARADAS';paradas:ParadaExcursao[]};
export type DadosExcursao=Pick<Excursao,'titulo'|'destinoNome'|'destinoLatitude'|'destinoLongitude'|'origemNome'|'origemLatitude'|'origemLongitude'|'partidaEm'|'retornoEm'|'capacidade'> & {versao?:number};
export type ExecucaoExcursao={id:number;excursaoId:number;sentido:string;estado:string;pontos:{paradaId:number|null;nome:string;latitude:number;longitude:number}[]};
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
    return excursao(await apiRequest<Excursao>(id?`/excursoes/${recursoId(id)}`:'/excursoes',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)}));
}
export async function acaoExcursao(id:number,acao:'publicacao'|'cancelamento',versao:number) {
    return excursao(await apiRequest<Excursao>(`/excursoes/${recursoId(id)}/${acao}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({versao})}));
}
export async function salvarColetaExcursao(id:number,modo:Excursao['modoColeta'],versao:number,paradas:ParadaExcursao[]) {
    return excursao(await apiRequest<Excursao>(`/excursoes/${recursoId(id)}/coleta`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({modo,versao,paradas:paradas.map(p=>({...p,pontoConfirmado:true}))})}));
}
export async function listarExecucoes(id:number,signal?:AbortSignal) {
    const r=await apiRequest<ExecucaoExcursao[]>(`/excursoes/${recursoId(id)}/execucoes`,{signal});if(!Array.isArray(r))throw new Error('Execuções indisponíveis.');return r;
}
export async function iniciarExcursao(id:number,sentido:'IDA'|'VOLTA') {
    const r=await apiRequest<ExecucaoExcursao>(`/excursoes/${recursoId(id)}/execucoes?sentido=${sentido}&otimizar=false`,{method:'POST'});
    if(!r?.id || r.excursaoId!==id)throw new Error('Execução não confirmada.');return r;
}
export async function finalizarExcursao(id:number,execucao:number) {
    return apiRequest<ExecucaoExcursao>(`/excursoes/${recursoId(id)}/execucoes/${recursoId(execucao)}/finalizacao`,{method:'PUT'});
}
export async function criarConviteExcursao(id:number,expiraEm:string) {
    const r=await apiRequest<{id:number;token:string}>(`/excursoes/${recursoId(id)}/convites`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiraEm})});
    if(!r || typeof r.token!=='string' || !r.token)throw new Error('Convite não confirmado.');return r;
}
export function linkConvite(base:string|undefined,token:string) {
    if(!base)throw new Error('A página HTTPS de convites do webapp ainda não está configurada.');
    const url=new URL(base);if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash)throw new Error('Configure uma página HTTPS de convites sem parâmetros.');
    url.hash=token;return url.toString();
}
