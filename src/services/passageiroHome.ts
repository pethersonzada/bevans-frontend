import { apiFetch, readApiError, readApiJson } from '../config/api';
import type { ConfirmacaoPresenca } from '../components/passageiro/SeletorPresenca';

export async function fetchMinhaConfirmacao(userId: string, turmaId: number, signal: AbortSignal) {
    const response = await apiFetch(`/rota/minha-confirmacao?usuarioId=${userId}&turmaId=${turmaId}`, { signal });
    if (response.status === 404) return null;
    const data = await readApiJson<ConfirmacaoPresenca>(response);
    return data?.status ? data : null;
}

export async function fetchPassengerRadar(turmaId: number, signal: AbortSignal) {
    const response = await apiFetch(`/rota/status-atual?turmaId=${turmaId}`, { signal });
    if (!response.ok && response.status !== 404) throw await readApiError(response);
    const data = response.ok ? await readApiJson<{ status?: string; situacao?: string; ativa?: boolean }>(response) : null;
    const status = data?.status || data?.situacao;
    const active = status === 'ATIVA' || status === 'EM_CURSO' || data?.ativa === true;
    if (!active) return { status: 'INATIVA', gps: 'GARAGEM', position: null };
    const location = await apiFetch(`/rota/localizacao-van?turmaId=${turmaId}`, { signal });
    if (!location.ok) return { status: 'ATIVA', gps: 'AGUARDANDO', position: null };
    const pos = await readApiJson<{ latitude?: number; longitude?: number }>(location);
    if (pos?.latitude == null || pos.longitude == null) return { status: 'ATIVA', gps: 'AGUARDANDO', position: null };
    const latitude = Number(pos.latitude), longitude = Number(pos.longitude);
    const valid = Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
    return { status: 'ATIVA', gps: valid ? 'ONLINE' : 'AGUARDANDO', position: valid ? { latitude, longitude } : null };
}
