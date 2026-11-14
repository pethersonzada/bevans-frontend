import { apiFetch, readApiError, apiRequest } from '../config/api';

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

export async function enviarPosicaoVan(turmaId: number, latitude: number, longitude: number, signal?: AbortSignal, amostra?:{precisao:number;observadoEm:string}) {
    turmaIdValido(turmaId);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        throw new Error('Coordenadas da van inválidas.');
    }
    if(!amostra||!Number.isFinite(amostra.precisao)||amostra.precisao<0)throw new Error('Precisão GPS indisponível.');
    const status=await apiRequest<{status:string;viagemId:number}>(`/rota/status-atual?turmaId=${turmaId}`,{signal});
    if(status?.status!=='ATIVA'||!Number.isSafeInteger(status.viagemId))throw new Error('Não há viagem ativa autorizada.');
    const response = await apiFetch(`/viagens/${status.viagemId}/localizacao`, { method: 'PUT', signal, timeoutMs: 10000,
        headers:{'Content-Type':'application/json'},body:JSON.stringify({latitude,longitude,...amostra,amostraId:`gps-${Date.now()}-${Math.random().toString(36).slice(2)}`}) });
    if (!response.ok) throw await readApiError(response);
}
