import { auth } from '../config/firebase';
import { buscarExcursao, convitesExcursao, criarConviteExcursao, linkConvite, validarPaginaConvite, revogarConviteExcursao, listarExecucoes } from './excursoes';
import { validarValidadeConvite } from './excursaoFormulario';

type ConviteEmMemoria = { id: number; token: string; expiraEm: string; aviso: string };
let uid: string | null | undefined;
let generation = 0;
const convites = new Map<number, ConviteEmMemoria>();
const incertos = new Set<number>();
const pending = new Map<number, Promise<ConvitePronto>>();
const listeners = new Set<() => void>();
function changed() { listeners.forEach(listener => listener()); }
export function onConvitesChanged(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function definirSessaoConvites(next: string | null) {
    if (uid !== next) { uid = next; generation++; convites.clear(); incertos.clear(); pending.clear(); changed(); }
}
function capture() {
    const user = auth.currentUser;
    if (!user) throw new Error('Entre novamente para gerenciar seus convites.');
    if (uid === undefined) definirSessaoConvites(user.uid);
    const epoch = generation;
    const assertCurrent = () => { if (auth.currentUser !== user || uid !== user.uid || epoch !== generation) throw new Error('A sessão mudou. Nenhum link da conta anterior está disponível.'); };
    assertCurrent();
    return assertCurrent;
}
export function estadoConviteCompartilhamento(excursaoId: number) {
    if (!auth.currentUser || uid !== auth.currentUser.uid) return null;
    const c = convites.get(excursaoId);
    return c ? { id: c.id, expiraEm: c.expiraEm, aviso: c.aviso, incerto: false } : incertos.has(excursaoId) ? { id: null, expiraEm: null, aviso: 'A criação pode ter sido registrada no servidor, mas o link não foi recebido. Confira a lista e revogue convites sem link antes de emitir outro.', incerto: true } : null;
}
export function conviteDisponivelEmMemoria(excursaoId: number, conviteId: number) { return estadoConviteCompartilhamento(excursaoId)?.id === conviteId; }
function forget(excursaoId: number) { convites.delete(excursaoId); changed(); }
async function validar(excursaoId: number, c: ConviteEmMemoria, assertCurrent: () => void) {
    try {
        const [excursao, metadados, execucoes] = await Promise.all([buscarExcursao(String(excursaoId)), convitesExcursao(excursaoId), listarExecucoes(excursaoId)]);
        assertCurrent();
        const salvo = metadados.find(value => value.id === c.id);
        if (!salvo || salvo.revogadoEm) throw new Error('Este convite foi revogado ou não está mais disponível.');
        if (!Number.isFinite(Date.parse(salvo.expiraEm)) || Date.parse(salvo.expiraEm) <= Date.now()) throw new Error('Este convite expirou.');
        if (excursao.estado !== 'PUBLICADA' || Date.parse(excursao.partidaEm) <= Date.now()) throw new Error('Esta excursão não está mais disponível para novas inscrições.');
        if(execucoes.length)throw new Error('As inscrições foram encerradas porque a excursão já possui execução.');
    } catch (error) {
        assertCurrent();
        const e = error as { kind?: string; status?: number };
        // Transient read failures must not destroy the only copy of the token.
        if (e.kind !== 'network' && e.kind !== 'timeout' && e.status !== 408 && e.status !== 429 && !(e.status && e.status >= 500)) forget(excursaoId);
        throw error;
    }
}
export type ConvitePronto = { id: number; link: string; registrarResultado: (message: string) => void };
async function pronto(excursaoId: number, c: ConviteEmMemoria, base: string | undefined, assertCurrent: () => void): Promise<ConvitePronto> {
    await validar(excursaoId, c, assertCurrent);
    assertCurrent();
    return { id: c.id, link: linkConvite(base, c.token), registrarResultado(message) {
        assertCurrent();
        if (convites.get(excursaoId)?.id === c.id) { c.aviso = message; changed(); }
    } };
}
export async function prepararConviteCompartilhamento(excursaoId: number, expiraEm: string, partidaEm: string, base: string | undefined): Promise<ConvitePronto> {
    const assertCurrent = capture();
    if (pending.has(excursaoId)) return pending.get(excursaoId)!;
    const task = (async () => {
        // Validate the actual configured web page before issuing a token.
        validarPaginaConvite(base);
        const existente = convites.get(excursaoId);
        if (existente) return pronto(excursaoId, existente, base, assertCurrent);
        if (incertos.has(excursaoId)) throw new Error('Revise os convites emitidos antes de autorizar uma nova emissão. Não repetimos uma criação com resultado desconhecido.');
        validarValidadeConvite(expiraEm, partidaEm);
        let novo: { id: number; token: string };
        try {
            novo = await criarConviteExcursao(excursaoId, expiraEm, partidaEm);
            assertCurrent();
        } catch (error) {
            assertCurrent();
            const status = (error as { status?: number }).status;
            if (!status || status >= 500) { incertos.add(excursaoId); changed(); throw new Error('A criação pode ter sido registrada, mas o link não foi recebido. Confira os convites emitidos antes de tentar outra emissão.'); }
            throw error;
        }
        const c = { ...novo, expiraEm, aviso: 'Convite criado. Ainda não foi disponibilizado ao compartilhamento.' };
        convites.set(excursaoId, c); changed();
        return pronto(excursaoId, c, base, assertCurrent);
    })();
    pending.set(excursaoId, task);
    void task.finally(() => { if (pending.get(excursaoId) === task) pending.delete(excursaoId); }).catch(() => {});
    return task;
}
export async function recuperarLinkConvite(excursaoId: number, base: string | undefined) {
    const assertCurrent = capture();
    const c = convites.get(excursaoId);
    if (!c) throw new Error('Este link não está disponível nesta sessão. Revogue o convite sem link e emita outro quando necessário.');
    return pronto(excursaoId, c, base, assertCurrent);
}
export async function revogarConviteRecuperado(excursaoId: number, conviteId: number) {
    const assertCurrent = capture();
    await revogarConviteExcursao(excursaoId, conviteId);
    assertCurrent();
    if (convites.get(excursaoId)?.id === conviteId) forget(excursaoId);
    changed();
}
export async function autorizarNovaEmissaoAposRevisao(excursaoId: number) {
    const assertCurrent = capture();
    await convitesExcursao(excursaoId); assertCurrent();
    incertos.delete(excursaoId); changed();
}
