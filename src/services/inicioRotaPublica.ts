import { apiRequest } from '../config/api';
import { buscarRotaPublica } from './rotasPublicas';
import { embarquesMotorista } from './embarques';
import { consultarEstadoViagem, iniciarViagemPublica } from './viagens';
import { consultarRoteiroOperacional } from './roteiroOperacional';
import { conferirSnapshotRoteiro, type PainelRoteiro } from './roteiroNavegacao';
import { mesmaVersaoVisivel } from './itinerarioRotaPublica';
import { dataLocal } from './dataOperacao';
import type { RotaPublica, PontoPublico } from '../types/rotaPublica';

export type RevisaoInicioPublico = { rota: RotaPublica; sentido: 'IDA' | 'VOLTA'; data: string; pontos: PontoPublico[]; aprovados: number };

export async function revisarInicioPublico(esperada: RotaPublica, sentido: 'IDA' | 'VOLTA'): Promise<RevisaoInicioPublico> {
    const rota = await buscarRotaPublica(esperada.id);
    if (!mesmaVersaoVisivel(rota, esperada)) throw new Error('A rota mudou. Reabra a gestão e revise a versão salva antes de iniciar.');
    if (!rota.publicada || !rota.ativa || !rota.vagas.configurada) throw new Error('Publique uma rota ativa com capacidade configurada antes de iniciar.');
    if (!(sentido === 'IDA' ? rota.horarioIda : rota.horarioVolta)) throw new Error('Configure o horário deste sentido antes de iniciar.');
    const hoje = dataLocal();
    const dia = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][new Date().getDay()];
    if (!rota.dias.includes(dia as RotaPublica['dias'][number])) throw new Error('A rota não opera no dia de hoje.');
    const estado = await consultarEstadoViagem(rota.turmaId);
    if (estado.status === 'ATIVA') throw new Error('Já existe uma viagem em andamento nesta turma. Abra a operação atual.');
    const pedidos = await embarquesMotorista(rota.id, hoje, sentido);
    const pontos = await apiRequest<PontoPublico[]>(`/rotas-publicas/${rota.id}/embarques/planejamento?${new URLSearchParams({data:hoje,sentido,otimizar:String(rota.modo==='FLEXIVEL')})}`, { method: 'POST' });
    if (!Array.isArray(pontos) || pontos.length < 2 || pontos.some(p=>!p || typeof p.nome!=='string' || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude)>90 || Math.abs(p.longitude)>180)) throw new Error('O planejamento operacional está incompleto. Atualize antes de iniciar.');
    const extremos = sentido==='IDA' ? [[rota.origemLatitude,rota.origemLongitude],[rota.destinoLatitude,rota.destinoLongitude]] : [[rota.destinoLatitude,rota.destinoLongitude],[rota.origemLatitude,rota.origemLongitude]];
    if ([pontos[0],pontos[pontos.length-1]].some((p,i)=>Math.abs(p.latitude-extremos[i][0])>1e-7 || Math.abs(p.longitude-extremos[i][1])>1e-7)) throw new Error('Os extremos do planejamento não correspondem à rota e ao sentido.');
    const aprovados = pedidos.filter(p=>p.status==='APROVADO');
    if (aprovados.some(p=>p.rotaId!==rota.id || p.dataOperacao!==hoje || p.sentido!==sentido || !pontos.some(pt=>p.paradaId!=null ? pt.paradaId===p.paradaId : Math.abs(pt.latitude-p.latitude!)<1e-7 && Math.abs(pt.longitude-p.longitude!)<1e-7))) throw new Error('Há embarques aprovados ausentes do roteiro. Revise os pedidos antes de iniciar.');
    return { rota, sentido, data: hoje, pontos, aprovados: aprovados.length };
}

export async function confirmarExecucaoPublica(rota: RotaPublica, sentido?: 'IDA' | 'VOLTA') {
    const estado = await consultarEstadoViagem(rota.turmaId);
    if (estado.status !== 'ATIVA' || !estado.viagemId || estado.modalidade!=='PUBLICA' || estado.rotaPublicaId!==rota.id || !['IDA','VOLTA'].includes(estado.sentido||'') || (sentido && estado.sentido !== sentido)) throw new Error('Não foi possível confirmar a execução deste trecho. Consulte o servidor antes de repetir.');
    const [pontos, painel] = await Promise.all([
        consultarRoteiroOperacional(estado.viagemId),
        apiRequest<PainelRoteiro>(`/operacoes/VIAGEM/${estado.viagemId}`),
    ]);
    conferirSnapshotRoteiro(pontos,painel,estado.viagemId,estado.sentido!);
    const extremos=estado.sentido==='IDA'?[[rota.origemLatitude,rota.origemLongitude],[rota.destinoLatitude,rota.destinoLongitude]]:[[rota.destinoLatitude,rota.destinoLongitude],[rota.origemLatitude,rota.origemLongitude]];
    if([pontos[0],pontos[pontos.length-1]].some((p,i)=>Math.abs(p.latitude-extremos[i][0])>1e-7||Math.abs(p.longitude-extremos[i][1])>1e-7))throw new Error('O snapshot ativo não corresponde aos extremos desta rota pública.');
    return { ...estado, viagemId: estado.viagemId, pontos };
}

export async function iniciarTrechoPublico(revisao: RevisaoInicioPublico) {
    if (revisao.data !== dataLocal()) throw new Error('O dia operacional mudou. Revise o trecho novamente.');
    const atual = await revisarInicioPublico(revisao.rota, revisao.sentido);
    if (JSON.stringify(atual) !== JSON.stringify(revisao)) throw new Error('O planejamento ou os embarques mudaram. Revise o trecho novamente.');
    try {
        await iniciarViagemPublica(revisao.rota.id, revisao.sentido);
        return await confirmarExecucaoPublica(revisao.rota, revisao.sentido);
    } catch(error) {
        if(error && typeof error==='object')Object.assign(error,{inicioSolicitado:true});
        throw error;
    }
}
