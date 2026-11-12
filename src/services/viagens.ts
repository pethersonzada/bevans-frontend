import { apiFetch, readApiError } from '../config/api';

function turmaIdValido(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Selecione uma turma válida.');
}

export async function iniciarViagem(turmaId: number, sentido: 'IDA' | 'VOLTA') {
    turmaIdValido(turmaId);
    if (sentido !== 'IDA' && sentido !== 'VOLTA') throw new Error('Sentido de viagem inválido.');
    const response = await apiFetch('/rota/iniciar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turmaId, sentido }) });
    if (!response.ok) throw await readApiError(response);
}

export async function encerrarViagem(turmaId: number) {
    turmaIdValido(turmaId);
    const response = await apiFetch(`/rota/encerrar?turmaId=${turmaId}`, { method: 'POST' });
    if (!response.ok) throw await readApiError(response);
}

export async function reiniciarViagem(turmaId: number, sentido: 'IDA' | 'VOLTA') {
    await encerrarViagem(turmaId);
    await iniciarViagem(turmaId, sentido);
}

export async function enviarPosicaoVan(turmaId: number, latitude: number, longitude: number, signal?: AbortSignal) {
    turmaIdValido(turmaId);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        throw new Error('Coordenadas da van inválidas.');
    }
    const query = new URLSearchParams({ turmaId: String(turmaId), latitude: String(latitude), longitude: String(longitude) });
    const response = await apiFetch(`/rota/localizacao-van?${query}`, { method: 'POST', signal, timeoutMs: 10000 });
    if (!response.ok) throw await readApiError(response);
}
