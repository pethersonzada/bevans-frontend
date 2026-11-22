import { apiRequest } from '../config/api';
import { buscarTurmaMotorista, lerAssentos, listarTurmasMotorista, parseTurma } from './turmas';
import type { Turma } from '../types/turma';

export type PontoTurma = { nome: string; latitude: number; longitude: number };
export type CadastroTurma = {
    nome: string; turno: string; capacidade: string;
    origem: PontoTurma | null; destino: PontoTurma | null;
    etapa: number; turmaId: number | null; anteriores: number[] | null;
};
export const etapasTurma = ['Dados', 'Trajeto', 'Revisão'] as const;
export function novoCadastroTurma(): CadastroTurma {
    return { nome: '', turno: '', capacidade: '', origem: null, destino: null, etapa: 0, turmaId: null, anteriores: null };
}
export function pontoTurmaValido(ponto: PontoTurma | null): ponto is PontoTurma {
    return !!ponto && typeof ponto.nome === 'string' && !!ponto.nome.trim()
        && typeof ponto.latitude === 'number' && Number.isFinite(ponto.latitude) && Math.abs(ponto.latitude) <= 90
        && typeof ponto.longitude === 'number' && Number.isFinite(ponto.longitude) && Math.abs(ponto.longitude) <= 180
        && !(ponto.latitude === 0 && ponto.longitude === 0);
}
export function validarDadosTurma(d: CadastroTurma) {
    if (!d.nome.trim()) throw new Error('Dê um nome à turma para continuar.');
    if (!d.turno.trim()) throw new Error('Escolha ou informe o turno da turma.');
    lerAssentos(d.capacidade);
}
export function validarTrajetoTurma(d: CadastroTurma) {
    if (!pontoTurmaValido(d.origem)) throw new Error('Escolha e confirme a origem no mapa.');
    if (!pontoTurmaValido(d.destino)) throw new Error('Escolha e confirme o destino no mapa.');
}
export function restaurarCadastroTurma(raw: string | null): CadastroTurma {
    if (!raw) return novoCadastroTurma();
    const d = JSON.parse(raw) as CadastroTurma;
    if (!d || typeof d.nome !== 'string' || typeof d.turno !== 'string' || typeof d.capacidade !== 'string'
        || !Number.isInteger(d.etapa) || d.etapa < 0 || d.etapa > 2
        || (d.origem !== null && !pontoTurmaValido(d.origem)) || (d.destino !== null && !pontoTurmaValido(d.destino))
        || (d.turmaId !== null && (!Number.isSafeInteger(d.turmaId) || d.turmaId <= 0))
        || (d.anteriores !== null && (!Array.isArray(d.anteriores) || d.anteriores.some(id => !Number.isSafeInteger(id) || id <= 0)))) {
        throw new Error('O rascunho salvo não pôde ser restaurado.');
    }
    return d;
}
export function correspondeCadastro(turma: Turma, d: CadastroTurma) {
    const corresponde = (prefixo: 'origem' | 'destino', ponto: PontoTurma | null) => pontoTurmaValido(ponto)
        && turma[`${prefixo}Nome`] === ponto.nome.trim()
        && typeof turma[`${prefixo}Latitude`] === 'number' && typeof turma[`${prefixo}Longitude`] === 'number'
        && Math.abs(turma[`${prefixo}Latitude`]! - ponto.latitude) < 0.0000001
        && Math.abs(turma[`${prefixo}Longitude`]! - ponto.longitude) < 0.0000001;
    return turma.nome === d.nome.trim() && turma.turno === d.turno.trim()
        && turma.capacidade === lerAssentos(d.capacidade) && corresponde('origem', d.origem) && corresponde('destino', d.destino);
}
// Persist intent before POST. An uncertain request is reconciled, never repeated.
export async function concluirCadastroTurma(userId: string, draft: CadastroTurma,
    persistir: (draft: CadastroTurma) => Promise<void>, assertCurrent: () => void): Promise<Turma> {
    if (!/^[1-9]\d*$/.test(userId) || !Number.isSafeInteger(Number(userId))) throw new Error('Motorista não identificado.');
    validarDadosTurma(draft); validarTrajetoTurma(draft); assertCurrent();
    let d = { ...draft };
    if (!d.turmaId && d.anteriores !== null) {
        const turmas = await listarTurmasMotorista(userId); assertCurrent();
        const encontradas = turmas.filter(t => !d.anteriores!.includes(t.id) && correspondeCadastro(t, d));
        if (encontradas.length !== 1) throw new Error('Ainda não foi possível confirmar a criação. Confira suas turmas antes de iniciar outro cadastro; não enviaremos uma criação duplicada.');
        d = { ...d, turmaId: encontradas[0].id }; await persistir(d); assertCurrent();
    }
    if (!d.turmaId) {
        const anteriores = (await listarTurmasMotorista(userId)).map(t => t.id); assertCurrent();
        d = { ...d, anteriores }; await persistir(d); assertCurrent();
        let nova: Turma;
        try {
            nova = parseTurma(await apiRequest<unknown>('/turmas', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: d.nome.trim(), turno: d.turno.trim(), capacidade: lerAssentos(d.capacidade), motorista: { id: Number(userId) },
                    origemNome: d.origem!.nome.trim(), origemLatitude: d.origem!.latitude, origemLongitude: d.origem!.longitude,
                    destinoNome: d.destino!.nome.trim(), destinoLatitude: d.destino!.latitude, destinoLongitude: d.destino!.longitude }),
            }));
        } catch (error) {
            assertCurrent();
            const status = (error as { status?: number }).status;
            if (status && status >= 400 && status < 500 && status !== 408) await persistir({ ...d, anteriores: null });
            throw error;
        }
        assertCurrent(); d = { ...d, turmaId: nova.id }; await persistir(d); assertCurrent();
    }
    const confirmada = await buscarTurmaMotorista(userId, d.turmaId!); assertCurrent();
    if (!correspondeCadastro(confirmada, d)) throw new Error('A turma foi criada, mas os dados recebidos diferem da revisão. Confira a turma salva antes de continuar.');
    return confirmada;
}
