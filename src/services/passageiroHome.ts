import { apiFetch, readApiError, readApiJson } from '../config/api';
import type { ConfirmacaoPresenca } from '../types/presenca';

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
    if (!active) return { status: 'INATIVA', gps: 'GARAGEM', position: null };
    if(!Number.isSafeInteger(data?.viagemId)||data!.viagemId!<=0)return {status:'ATIVA',gps:'AGUARDANDO',position:null};
    let location: Response;
    try { location = await apiFetch(`/viagens/${data!.viagemId}/localizacao`, { signal }); }
    catch (error) {
        if (signal.aborted || !['network', 'timeout'].includes((error as { kind?: string }).kind || '')) throw error;
        // O estado da viagem foi confirmado; falha no GPS não o invalida.
        return { status: 'ATIVA', gps: 'AGUARDANDO', position: null };
    }
    if (location.status === 401 || location.status === 403) throw await readApiError(location);
    if (!location.ok) return { status: 'ATIVA', gps: 'AGUARDANDO', position: null };
    const pos = await readApiJson<{ latitude?: number; longitude?: number;estado?:string;observadoEm?:string }>(location);
    const idade=Date.now()-Date.parse(pos?.observadoEm||'');
    if (pos?.estado!=='ATUALIZADA'||!Number.isFinite(idade)||idade>=30000||idade< -5000||pos.latitude == null || pos.longitude == null) return { status: 'ATIVA', gps: 'AGUARDANDO', position: null };
    const latitude = pos.latitude, longitude = pos.longitude;
    const valid = Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
    return { status: 'ATIVA', gps: valid ? 'ONLINE' : 'AGUARDANDO', position: valid ? { latitude, longitude, expiresAt:Date.parse(pos.observadoEm!)+30000 } : null };
}
