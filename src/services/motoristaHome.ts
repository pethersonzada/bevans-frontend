import { apiFetch, apiRequest, readApiError } from '../config/api';
import { recursoId } from './catalogo';
import type { PassageiroTurma, SolicitacaoTurma } from '../types/turma';
export { listarTurmasMotorista as fetchTurmasMotorista } from './turmas';

async function fetchList<T>(path: string): Promise<T[]> {
    const data = await apiRequest<T[]>(path);
    if (data === null) return [];
    if (!Array.isArray(data)) throw new Error('O servidor retornou uma lista inválida. Tente novamente.');
    return data;
}

export function fetchPassageirosTurma(turmaId: number) {
    return fetchList<PassageiroTurma>(`/turmas/${turmaId}/passageiros`);
}
export function fetchSolicitacoesTurma(turmaId: number) {
    return fetchList<SolicitacaoTurma>(`/turmas/${turmaId}/pendentes`);
}

export async function removerPassageiroTurma(turmaId: number, passageiroId: number): Promise<void> {
    const response = await apiFetch(`/turmas/${recursoId(turmaId)}/alunos/${recursoId(passageiroId)}`, { method: 'DELETE' });
    if (!response.ok) throw await readApiError(response);
}
