import { apiRequest } from '../config/api';
import { buscarExcursao, listarExecucoes, type Excursao, type ExecucaoExcursao } from './excursoes';
import { impedimentoInicioExcursao, mesmaExcursaoSalva } from './excursaoValidacao';
import { validarPontosPlanejamento } from './mapaExcursao';

export type RevisaoTrechoExcursao = { versao: number; sentido: 'IDA'|'VOLTA'; pontos: ReturnType<typeof validarPontosPlanejamento>; autorizados: number|null };

export async function revisarTrechoExcursao(e: Excursao, sentido: 'IDA'|'VOLTA'): Promise<RevisaoTrechoExcursao> {
    const [atual,execucoes]=await Promise.all([buscarExcursao(String(e.id)),listarExecucoes(e.id)]);
    if(!mesmaExcursaoSalva(e,atual))throw new Error('A versão da excursão mudou. Atualize a viagem antes de revisar o trecho.');
    const impedimento=impedimentoInicioExcursao(atual,sentido,execucoes);
    if(impedimento)throw new Error(impedimento.mensagem);
    const resposta=await apiRequest<ExecucaoExcursao['pontos']>(`/excursoes/${e.id}/planejamento?sentido=${sentido}&otimizar=false`,{method:'POST'});
    const pontos=validarPontosPlanejamento(resposta);
    if(pontos.length<2)throw new Error('O planejamento não confirmou origem, destino e pontos suficientes para iniciar. Revise a configuração.');
    const participantes=resposta!.every(p=>Array.isArray(p.participantes))?resposta!.flatMap(p=>p.participantes!):null;
    if(participantes?.some(p=>!Number.isSafeInteger(p.inscricaoId)||p.inscricaoId<=0))throw new Error('O servidor não confirmou os participantes autorizados. Atualize a viagem.');
    return {versao:atual.versao,sentido,pontos,autorizados:participantes?new Set(participantes.map(p=>p.inscricaoId)).size:null};
}

export async function conferirRevisaoTrecho(e:Excursao,revisao:RevisaoTrechoExcursao) {
    const atual=await revisarTrechoExcursao(e,revisao.sentido);
    if(JSON.stringify(atual)!==JSON.stringify(revisao))throw new Error('O roteiro ou os participantes mudaram. Revise o trecho novamente antes de iniciar.');
}
