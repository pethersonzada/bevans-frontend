import { apiFetch, readApiError } from '../config/api';
import { recursoId } from './catalogo';
import { fetchMinhaConfirmacao } from './passageiroHome';
import type { ConfirmacaoPresenca } from '../types/presenca';

export async function salvarPresencaPassageiro(usuarioId: string, turmaId: number, status: string,
    enderecoIda?: number, enderecoVolta?: number): Promise<ConfirmacaoPresenca | null> {
    recursoId(usuarioId); recursoId(turmaId);
    if (!['IDA', 'VOLTA', 'AMBOS', 'NAO_VOU', 'LIMPAR'].includes(status)) throw new Error('Escolha uma confirmação válida.');
    const params = new URLSearchParams({ usuarioId, turmaId: String(turmaId), status });
    if (['IDA', 'AMBOS'].includes(status) && enderecoIda !== undefined) params.set('enderecoIda', String(recursoId(enderecoIda)));
    if (['VOLTA', 'AMBOS'].includes(status) && enderecoVolta !== undefined) params.set('enderecoVolta', String(recursoId(enderecoVolta)));
    let falha: unknown;
    try {
        const response = await apiFetch(`/rota/confirmar?${params}`, { method: 'POST' });
        if (!response.ok) throw await readApiError(response);
    } catch (error) {
        if (!['network', 'timeout'].includes((error as { kind?: string }).kind || '')) throw error;
        falha = error;
    }
    let saved: ConfirmacaoPresenca | null;
    try { saved = await fetchMinhaConfirmacao(usuarioId, turmaId); }
    catch { throw new Error('Não foi possível conferir sua confirmação. Atualize antes de tentar novamente.'); }
    const corresponde = status === 'LIMPAR' ? saved === null : saved?.status === status
        && (!params.has('enderecoIda') || saved.enderecoIda?.id === enderecoIda)
        && (!params.has('enderecoVolta') || saved.enderecoVolta?.id === enderecoVolta);
    if (!corresponde) throw falha || new Error('A confirmação retornada pelo servidor é diferente. Atualize antes de tentar novamente.');
    return saved;
}
