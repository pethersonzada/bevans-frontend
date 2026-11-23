import { apiFetch, readApiError, apiRequest } from '../config/api';

function turmaIdValido(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Selecione uma turma válida.');
}

export async function iniciarViagem(turmaId: number, sentido: 'IDA' | 'VOLTA') {
    turmaIdValido(turmaId);
    if (sentido !== 'IDA' && sentido !== 'VOLTA') throw new Error('Sentido de viagem inv?lido.');
    const response = await apiFetch('/rota/iniciar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turmaId, sentido, modalidade: 'PRIVADA' }) });
    if (!response.ok) throw await readApiError(response);
}

// Publica??es possuem execu??o pr?pria e n?o devem iniciar viagens privadas.
export async function iniciarViagemPublica(rotaPublicaId: number, sentido: 'IDA' | 'VOLTA') {
    turmaIdValido(rotaPublicaId);
    if (sentido !== 'IDA' && sentido !== 'VOLTA') throw new Error('Sentido de viagem inv?lido.');
    const response = await apiFetch(`/rotas-publicas/${rotaPublicaId}/iniciar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentido }),
    });
    if (!response.ok) throw await readApiError(response);
}

export async function encerrarViagem(turmaId: number) {
    turmaIdValido(turmaId);
    const response = await apiFetch(`/rota/encerrar?turmaId=${turmaId}`, { method: 'POST' });
    if (!response.ok) throw await readApiError(response);
}

export type EstadoViagem = { status: 'ATIVA' | 'INATIVA'; viagemId?: number; sentido?: string; modalidade?: 'PRIVADA'|'PUBLICA'; rotaPublicaId?: number; estado?: string; ultimaViagemId?: number };
export async function consultarEstadoViagem(turmaId: number): Promise<EstadoViagem> {
    turmaIdValido(turmaId);
    const r = await apiRequest<EstadoViagem>(`/rota/status-atual?turmaId=${turmaId}`);
    if (!r || !['ATIVA', 'INATIVA'].includes(r.status) || (r.status === 'ATIVA' && (!Number.isSafeInteger(r.viagemId) || r.viagemId! <= 0))) throw new Error('Não foi possível confirmar o estado da viagem.');
    return r;
}
export async function encerrarViagemConferida(turmaId: number, viagemEsperada: number): Promise<void> {
    if (!Number.isSafeInteger(viagemEsperada) || viagemEsperada <= 0) throw new Error('Atualize a viagem antes de encerrar.');
    const atual = await consultarEstadoViagem(turmaId);
    if (atual.status === 'INATIVA') return;
    if (atual.viagemId !== viagemEsperada) throw new Error('Outra viagem foi iniciada nesta turma. Abra a execução atual antes de encerrar.');
    let falha: unknown;
    try { await encerrarViagem(turmaId); } catch (error) { falha = error; }
    let confirmada: EstadoViagem;
    try { confirmada = await consultarEstadoViagem(turmaId); }
    catch { throw new Error('O encerramento não foi confirmado. Atualize o estado antes de tentar novamente.'); }
    if (confirmada.status === 'INATIVA') return;
    if (falha) throw falha;
    throw new Error('O servidor ainda informa uma viagem ativa. Atualize antes de tentar encerrar novamente.');
}
export class TrocaViagemError extends Error {
    constructor(public readonly etapa: 'verificar' | 'encerrar' | 'iniciar', public readonly anteriorEncerrada: boolean,
        public readonly estado: EstadoViagem | null, public readonly original: unknown) {
        super(anteriorEncerrada
            ? `A viagem anterior foi encerrada. ${estado?.status === 'INATIVA' ? 'Não há viagem ativa. Use Iniciar para tentar uma nova partida.' : 'Não foi possível confirmar uma nova partida. Atualize o estado antes de continuar.'}`
            : 'A substituição não foi concluída. Consulte o estado oficial antes de tentar novamente.');
    }
}
const trocasPendentes = new Set<number>();
export async function reiniciarViagem(turmaId: number, sentido: 'IDA' | 'VOLTA', viagemEsperada: number, onAnteriorEncerrada?: () => void) {
    turmaIdValido(turmaId);
    if (!['IDA', 'VOLTA'].includes(sentido) || !Number.isSafeInteger(viagemEsperada) || viagemEsperada <= 0) throw new Error('Confirme a viagem e o sentido antes de substituir.');
    if (trocasPendentes.has(turmaId)) throw new Error('Já há uma troca de viagem em andamento.');
    trocasPendentes.add(turmaId);
    let etapa: 'verificar' | 'encerrar' | 'iniciar' = 'verificar';
    let encerrada = false;
    try {
        const atual = await consultarEstadoViagem(turmaId);
        if (atual.status !== 'ATIVA' || atual.viagemId !== viagemEsperada) throw new Error('A viagem mudou. Atualize antes de confirmar outra substituição.');
        const operacao = await apiRequest<{ contadores: { naVan: number } }>(`/operacoes/VIAGEM/${viagemEsperada}`);
        if (!operacao?.contadores || !Number.isSafeInteger(operacao.contadores.naVan) || operacao.contadores.naVan !== 0) throw new Error('A troca exige operação disponível e nenhum passageiro embarcado. Registre os desembarques reais no controle da viagem.');
        etapa = 'encerrar';
        await encerrarViagem(turmaId);
        encerrada = true;
        onAnteriorEncerrada?.();
        etapa = 'iniciar';
        await iniciarViagem(turmaId, sentido);
        const estado = await consultarEstadoViagem(turmaId);
        if (estado.status !== 'ATIVA' || estado.viagemId === viagemEsperada || estado.sentido !== sentido) throw new Error('A nova partida não foi confirmada.');
        return estado;
    } catch (error) {
        let estado: EstadoViagem | null = null;
        try { estado = await consultarEstadoViagem(turmaId); } catch { /* Unknown outcome must stay explicit. */ }
        if (etapa === 'iniciar' && estado?.status === 'ATIVA' && estado.viagemId !== viagemEsperada && estado.sentido === sentido) return estado;
        throw new TrocaViagemError(etapa, encerrada || (etapa === 'encerrar' && estado?.status === 'INATIVA'), estado, error);
    } finally { trocasPendentes.delete(turmaId); }
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
