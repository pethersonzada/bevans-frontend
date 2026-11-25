import { apiFetch, readApiError, readApiJson } from '../config/api';
import type { ConfirmacaoPresenca } from '../types/presenca';

export type EstadoOperacionalPassageiro = 'AGUARDANDO' | 'EMBARCADO' | 'NAO_EMBARCOU' | 'DESEMBARCADO';
export type MinhaOperacao = {
    id: number;
    estado: EstadoOperacionalPassageiro;
    ordem: number;
    paradaId: number | null;
    versao: number;
};

const estadosOperacionais = new Set<EstadoOperacionalPassageiro>([
    'AGUARDANDO', 'EMBARCADO', 'NAO_EMBARCOU', 'DESEMBARCADO',
]);

export async function fetchMinhaOperacao(viagemId: number, signal?: AbortSignal): Promise<MinhaOperacao | null> {
    if (!Number.isSafeInteger(viagemId) || viagemId <= 0) throw new Error('Viagem inválida.');
    const response = await apiFetch(`/operacoes/VIAGEM/${viagemId}/minha`, {
        signal,
        headers: { 'Cache-Control': 'no-store' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw await readApiError(response);
    const data = await readApiJson<Record<string, unknown>>(response);
    if (!data || !Number.isSafeInteger(data.id) || !estadosOperacionais.has(data.estado as EstadoOperacionalPassageiro)
        || !Number.isSafeInteger(data.ordem) || (data.ordem as number) < 0
        || !Number.isSafeInteger(data.versao) || (data.versao as number) < 0
        || (data.paradaId != null && (!Number.isSafeInteger(data.paradaId) || (data.paradaId as number) <= 0))) {
        throw new Error('O servidor não confirmou seu estado de embarque.');
    }
    return {
        id: data.id as number,
        estado: data.estado as EstadoOperacionalPassageiro,
        ordem: data.ordem as number,
        paradaId: data.paradaId as number | null,
        versao: data.versao as number,
    };
}

export type PosicaoPassageiro = {
    estado: EstadoOperacionalPassageiro;
    ordem: number;
    paradasAntes: number | null;
    proximo: boolean;
};

export async function fetchMinhaPosicao(viagemId: number, signal: AbortSignal): Promise<PosicaoPassageiro | null> {
    if (!Number.isSafeInteger(viagemId) || viagemId <= 0) throw new Error('Viagem inválida.');
    const response = await apiFetch(`/operacoes/VIAGEM/${viagemId}/minha/posicao`, {
        signal,
        headers: { 'Cache-Control': 'no-store' },
    });
    if (response.status === 404) {
        const registro = await fetchMinhaOperacao(viagemId, signal);
        return registro && { estado: registro.estado, ordem: registro.ordem, paradasAntes: null, proximo: false };
    }
    if (!response.ok) throw await readApiError(response);
    const data = await readApiJson<(PosicaoPassageiro & { viagemId: number })>(response);
    if (!data || data.viagemId !== viagemId || !estadosOperacionais.has(data.estado)
        || !Number.isSafeInteger(data.ordem) || data.ordem < 0
        || (data.paradasAntes !== null && (!Number.isSafeInteger(data.paradasAntes) || data.paradasAntes < 0))
        || data.proximo !== (data.estado === 'AGUARDANDO' && data.paradasAntes === 0)
        || (data.estado !== 'AGUARDANDO' && data.paradasAntes !== null)) {
        throw new Error('O servidor não confirmou sua posição de embarque.');
    }
    const { estado, ordem, paradasAntes, proximo } = data;
    return { estado, ordem, paradasAntes, proximo };
}

export function mensagemMinhaOperacao(operacao: (Pick<MinhaOperacao, 'estado' | 'ordem'> & Partial<PosicaoPassageiro>) | null): string {
    if (!operacao) return 'Não foi possível confirmar seu embarque nesta viagem.';
    if (operacao.estado === 'EMBARCADO') return 'Embarque confirmado · você está na van.';
    if (operacao.estado === 'NAO_EMBARCOU') return 'Não embarcou nesta viagem.';
    if (operacao.estado === 'DESEMBARCADO') return 'Desembarque confirmado.';
    if (operacao.proximo) return 'Você é o próximo.';
    if (operacao.paradasAntes === 1) return 'Falta 1 parada antes da sua.';
    if (operacao.paradasAntes && operacao.paradasAntes > 1) return `Faltam ${operacao.paradasAntes} paradas antes da sua.`;
    if (operacao.paradasAntes === null) return 'Aguardando embarque · posição na fila indisponível.';
    // O índice do roteiro é fixo e não indica quais paradas já foram concluídas.
    if (operacao.ordem > 0) return `Aguardando embarque · parada ${operacao.ordem} no roteiro.`;
    return 'Aguardando embarque.';
}

export async function fetchMinhaConfirmacao(userId: string, turmaId: number, signal?: AbortSignal) {
    const response = await apiFetch(`/rota/minha-confirmacao?usuarioId=${userId}&turmaId=${turmaId}`, { signal });
    if (response.status === 404) return null;
    const data = await readApiJson<ConfirmacaoPresenca>(response);
    return data?.status ? data : null;
}

export async function fetchPassengerRadar(turmaId: number, signal: AbortSignal) {
    const response = await apiFetch(`/rota/status-atual?turmaId=${turmaId}`, { signal });
    if (!response.ok) throw await readApiError(response);
    const data = await readApiJson<{ status?: string; situacao?: string; ativa?: boolean; viagemId?:number }>(response);
    const status = data?.status || data?.situacao;
    const active = status === 'ATIVA' || status === 'EM_CURSO' || data?.ativa === true;
    const inactive = status === 'INATIVA' || data?.ativa === false;
    if (active === inactive) throw new Error('O servidor não confirmou o estado da viagem.');
    if (!active) return { status: 'INATIVA', gps: 'GARAGEM', position: null, viagemId: null };
    if(!Number.isSafeInteger(data?.viagemId)||data!.viagemId!<=0)return {status:'ATIVA',gps:'AGUARDANDO',position:null,viagemId:null};
    const viagemId = data!.viagemId!;
    let location: Response;
    try { location = await apiFetch(`/viagens/${data!.viagemId}/localizacao`, { signal }); }
    catch (error) {
        if (signal.aborted || !['network', 'timeout'].includes((error as { kind?: string }).kind || '')) throw error;
        // O estado da viagem foi confirmado; falha no GPS não o invalida.
        return { status: 'ATIVA', gps: 'AGUARDANDO', position: null, viagemId };
    }
    if (location.status === 401 || location.status === 403) throw await readApiError(location);
    if (!location.ok) return { status: 'ATIVA', gps: 'AGUARDANDO', position: null, viagemId };
    const pos = await readApiJson<{ latitude?: number; longitude?: number;estado?:string;observadoEm?:string }>(location);
    const idade=Date.now()-Date.parse(pos?.observadoEm||'');
    if (pos?.estado!=='ATUALIZADA'||!Number.isFinite(idade)||idade>=30000||idade< -5000||pos.latitude == null || pos.longitude == null) return { status: 'ATIVA', gps: 'AGUARDANDO', position: null, viagemId };
    const latitude = pos.latitude, longitude = pos.longitude;
    const valid = Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
    return { status: 'ATIVA', gps: valid ? 'ONLINE' : 'AGUARDANDO', position: valid ? { latitude, longitude, expiresAt:Date.parse(pos.observadoEm!)+30000 } : null, viagemId };
}
