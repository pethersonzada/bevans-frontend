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
        capacidade: data.capacidade == null ? null : validarAssentos(data.capacidade),
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

export async function criarTurma(userId: string, nome: string, turno: string, capacidade: number): Promise<Turma> {
    return parseTurma(await apiRequest<unknown>('/turmas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), turno: turno.trim(), motorista: { id: identifier(userId) }, capacidade: validarAssentos(capacidade) }),
    }));
}

export async function atualizarTurma(id: string | number, nome: string, turno: string, capacidade?: number): Promise<void> {
    if (capacidade !== undefined) validarAssentos(capacidade);
    const response = await apiFetch(`/turmas/${identifier(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), turno: turno.trim(), ...(capacidade === undefined ? {} : { capacidade }) }) });
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


export async function salvarPontoTurma(userId: string, turmaId: string, tipo: 'ORIGEM' | 'DESTINO',
    ponto: { nome: string; latitude: number; longitude: number }): Promise<Turma> {
    const id = identifier(turmaId);
    identifier(userId);
    if (!['ORIGEM', 'DESTINO'].includes(tipo) || !ponto.nome.trim() ||
        !Number.isFinite(ponto.latitude) || !Number.isFinite(ponto.longitude) ||
        Math.abs(ponto.latitude) > 90 || Math.abs(ponto.longitude) > 180 ||
        (ponto.latitude === 0 && ponto.longitude === 0)) throw new Error('Confirme um ponto válido no mapa.');
    const prefixo = tipo === 'ORIGEM' ? 'origem' : 'destino';
    const data = await apiRequest<unknown>(`/turmas/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [prefixo + 'Nome']: ponto.nome, [prefixo + 'Latitude']: ponto.latitude, [prefixo + 'Longitude']: ponto.longitude }),
    });
    const turma = data == null ? await buscarTurmaMotorista(userId, id) : parseTurma(data);
    const lat = tipo === 'ORIGEM' ? turma.origemLatitude : turma.destinoLatitude;
    const lon = tipo === 'ORIGEM' ? turma.origemLongitude : turma.destinoLongitude;
    if (turma.id !== id || lat == null || lon == null ||
        Math.abs(lat - ponto.latitude) > 0.0000001 || Math.abs(lon - ponto.longitude) > 0.0000001) {
        throw new Error('O servidor não confirmou as coordenadas salvas. Reabra o mapa e tente novamente.');
    }
    return turma;
}


export function validarAssentos(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 2147483647) {
        throw new Error('Informe uma quantidade inteira e positiva de assentos.');
    }
    return value;
}

export function lerAssentos(texto: string): number {
    if (!/^[1-9]\d*$/.test(texto.trim())) throw new Error('Informe uma quantidade inteira e positiva de assentos.');
    return validarAssentos(Number(texto));
}

export type VagasTurma = { capacidade: number | null; ocupados: number; disponiveis: number | null; configurada: boolean };
export async function consultarVagasTurma(turmaId: string | number): Promise<VagasTurma> {
    const value = await apiRequest<unknown>(`/turmas/${identifier(turmaId)}/vagas`);
    if (!value || typeof value !== 'object') throw new Error('Resposta de vagas inválida.');
    const v = value as VagasTurma;
    if (!Number.isSafeInteger(v.ocupados) || v.ocupados < 0 || typeof v.configurada !== 'boolean') throw new Error('Resposta de vagas inválida.');
    if (v.configurada) {
        validarAssentos(v.capacidade);
        if (v.disponiveis !== Math.max(0, v.capacidade! - v.ocupados)) throw new Error('Resposta de vagas inconsistente.');
    } else if (v.capacidade !== null || v.disponiveis !== null) throw new Error('Resposta de vagas inválida.');
    return v;
}
