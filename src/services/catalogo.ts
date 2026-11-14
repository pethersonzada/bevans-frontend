import { apiRequest, apiFetch, readApiError } from '../config/api';

export type Pagina<T> = { itens: T[]; pagina: number; totalPaginas: number; total: number };
export type ResumoRota = { id: number; nome: string; cidade: string; destino: string; motoristaNome: string;
    categoria: string; modo: string; favorita: boolean; horarioIda: string | null; horarioVolta: string | null;
    vagas: { capacidade: number | null; ocupados: number; disponiveis: number | null } };
export type FiltrosCatalogo = { cidade: string; destino: string; categoria: string; somenteFavoritas: boolean };
export function recursoId(value: number | string): number {
    if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error('Identificador inválido.');
    return Number(value);
}
export function paginaValida<T>(value: Pagina<T> | null): Pagina<T> {
    if (!value || !Array.isArray(value.itens) || !Number.isInteger(value.pagina) || value.pagina < 0
        || !Number.isInteger(value.totalPaginas) || value.totalPaginas < 0 || !Number.isInteger(value.total) || value.total < 0)
        throw new Error('O servidor retornou uma página inválida.');
    return value;
}
export async function consultarCatalogo(filtros: FiltrosCatalogo, pagina: number, signal?: AbortSignal) {
    const params = new URLSearchParams({ pagina: String(pagina), tamanho: '20' });
    for (const key of ['cidade', 'destino', 'categoria'] as const) if (filtros[key].trim()) params.set(key, filtros[key].trim());
    if (filtros.somenteFavoritas) params.set('somenteFavoritas', 'true');
    const result = paginaValida(await apiRequest<Pagina<ResumoRota>>(`/rotas-publicas/catalogo?${params}`, { signal }));
    if (result.itens.some(r => !r || !Number.isSafeInteger(r.id) || r.id <= 0 || typeof r.nome !== 'string'
        || typeof r.favorita !== 'boolean' || !r.vagas)) throw new Error('Resposta de catálogo inválida.');
    return result;
}
export async function alterarFavorito(id: number, favorito: boolean) {
    const response = await apiFetch(`/rotas-publicas/${recursoId(id)}/favorito`, { method: favorito ? 'PUT' : 'DELETE' });
    if (!response.ok) throw await readApiError(response);
}
