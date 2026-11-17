import { apiFetch, ApiError, readApiError, readApiJson } from '../config/api';
import { validarRoteiroOperacional } from './roteiroNavegacao';

export async function consultarRoteiroOperacional(viagemId: number, signal?: AbortSignal) {
    if (!Number.isSafeInteger(viagemId) || viagemId <= 0) throw new Error('Viagem inválida.');
    const resposta = await apiFetch(`/operacoes/VIAGEM/${viagemId}/roteiro`, {
        signal, headers: { 'Cache-Control': 'no-store' },
    });
    if (resposta.status === 409 || resposta.status === 503) {
        const erro = await readApiError(resposta);
        const orientacao = resposta.status === 409
            ? 'Roteiro indisponível ou viagem antiga sem snapshot completo. Não é seguro reconstruir os pontos pelo cadastro atual.'
            : 'O snapshot operacional está indisponível no servidor. Tente atualizar em instantes.';
        throw new ApiError(`${orientacao} ${erro.message}`, 'http', resposta.status);
    }
    return validarRoteiroOperacional(await readApiJson<unknown>(resposta));
}
