import { apiRequest } from '../config/api';
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
