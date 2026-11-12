import { apiFetch, apiRequest, readApiError } from '../config/api';
import type { Turma } from '../types/turma';

function identifier(value: string | number): number {
    const parsed = Number(value);
    if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(parsed)) throw new Error('Identificador inválido.');
    return parsed;
}

export function parseTurma(value: unknown): Turma {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Resposta de turma inválida.');
    const data = value as Record<string, unknown>;
    const id = typeof data.id === 'number' || typeof data.id === 'string' ? Number(data.id) : NaN;
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('A turma retornada não possui um identificador válido.');
    const text = (key: string) => typeof data[key] === 'string' ? data[key] as string : undefined;
    const coordinate = (key: string) => {
        const value = data[key];
        if (value == null) return value as null | undefined;
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('A turma retornou coordenadas inválidas.');
        return value;
    };
    return {
        id, nome: text('nome'), turno: text('turno') || '', codigoConvite: text('codigoConvite'), codigo: text('codigo'),
        origemNome: text('origemNome'), destinoNome: text('destinoNome'),
        origemLatitude: coordinate('origemLatitude'), origemLongitude: coordinate('origemLongitude'),
        destinoLatitude: coordinate('destinoLatitude'), destinoLongitude: coordinate('destinoLongitude'),
    };
}

export async function listarTurmasMotorista(userId: string | number): Promise<Turma[]> {
    const data = await apiRequest<unknown>(`/turmas/motorista/${identifier(userId)}`);
    if (data === null) return [];
    if (!Array.isArray(data)) throw new Error('O servidor retornou uma lista inválida. Tente novamente.');
    return data.map(parseTurma);
}

export async function buscarTurmaMotorista(userId: string | number, turmaId: string | number): Promise<Turma> {
    const id = identifier(turmaId);
    const turma = (await listarTurmasMotorista(userId)).find(item => item.id === id);
    if (!turma) throw new Error('Turma não encontrada na sua conta.');
    return turma;
}

export async function criarTurma(userId: string, nome: string, turno: string): Promise<Turma> {
    return parseTurma(await apiRequest<unknown>('/turmas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), turno: turno.trim(), motorista: { id: identifier(userId) } }),
    }));
}

export async function atualizarTurma(id: string | number, nome: string, turno: string): Promise<void> {
    const response = await apiFetch(`/turmas/${identifier(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), turno: turno.trim() }) });
    if (!response.ok) throw await readApiError(response);
}

export async function excluirTurma(id: string | number): Promise<void> {
    const response = await apiFetch(`/turmas/${identifier(id)}`, { method: 'DELETE' });
    if (!response.ok) throw await readApiError(response);
}

export async function regenerarCodigoTurma(id: number): Promise<Turma> {
    const turma = parseTurma(await apiRequest<unknown>(`/turmas/${identifier(id)}/regenerar-codigo`, { method: 'PUT' }));
    if (turma.id !== id || !turma.codigoConvite?.trim()) throw new Error('O servidor não confirmou o novo código desta turma.');
    return turma;
}
