import { apiRequest } from '../config/api';
import { recursoId } from './catalogo';
import { listarTurmasMotorista } from './turmas';
import type { SolicitacaoTurma, Turma } from '../types/turma';

export async function listarVinculosPendentes(usuarioId: string, signal?: AbortSignal) {
    const turmas = await listarTurmasMotorista(usuarioId);
    const listas = await Promise.all(turmas.map(async turma => {
        const pedidos = await apiRequest<SolicitacaoTurma[]>(`/turmas/${turma.id}/pendentes`, { signal });
        if (!Array.isArray(pedidos)) throw new Error('Não foi possível consultar os pedidos de vínculo.');
        return pedidos.map(pedido => {
            recursoId(pedido.id);
            return { ...pedido, turma };
        });
    }));
    return listas.flat();
}

export async function analisarVinculo(id: number, status: 'APROVADO' | 'REJEITADO') {
    await apiRequest(`/turmas/analisar/${recursoId(id)}?status=${status}`, { method: 'PUT' });
}

export async function minhasTurmasPassageiro(usuarioId: string, signal?: AbortSignal) {
    const r = await apiRequest<Turma[]>(`/turmas/usuario/${recursoId(usuarioId)}/todas`, { signal });
    if (!Array.isArray(r)) throw new Error('Não foi possível consultar suas turmas.');
    return r;
}
