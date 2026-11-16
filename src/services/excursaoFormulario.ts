export const modosColeta = {
    PORTA_A_PORTA: { nome: 'Porta a porta', descricao: 'Buscar cada participante no ponto individual confirmado.' },
    PARADA_UNICA: { nome: 'Um ponto de encontro', descricao: 'Todos embarcam em uma única parada.' },
    MULTIPLAS_PARADAS: { nome: 'Vários pontos de encontro', descricao: 'Visitar as paradas na ordem cadastrada.' },
};
export function selecionarDataHora(iso: string, escolha: Date, modo: 'date' | 'time'): string {
    const resultado = iso ? new Date(iso) : new Date(escolha);
    if (!Number.isFinite(resultado.getTime()) || !Number.isFinite(escolha.getTime())) throw new Error('Data inválida.');
    if (modo === 'date') resultado.setFullYear(escolha.getFullYear(), escolha.getMonth(), escolha.getDate());
    else resultado.setHours(escolha.getHours(), escolha.getMinutes(), 0, 0);
    return resultado.toISOString();
}
export function validarDatasExcursao(partida: string, retorno: string | null, capacidade: number, agora = Date.now()) {
    const inicio = Date.parse(partida), fim = retorno ? Date.parse(retorno) : null;
    if (!Number.isFinite(inicio) || inicio <= agora) throw new Error('Escolha uma partida futura.');
    if (fim !== null && (!Number.isFinite(fim) || fim <= inicio)) throw new Error('O retorno deve ocorrer depois da partida.');
    if (!Number.isSafeInteger(capacidade) || capacidade < 1) throw new Error('Informe uma quantidade inteira e positiva de lugares.');
}
export function validarValidadeConvite(expira: string, partida: string, agora = Date.now()) {
    const validade = Date.parse(expira), inicio = Date.parse(partida);
    if (!Number.isFinite(validade) || !Number.isFinite(inicio) || validade <= agora || validade > inicio || validade > agora + 30 * 86400000)
        throw new Error('A validade deve ser futura, até a partida e no máximo 30 dias a partir de agora.');
}
export async function compartilharConviteSeguro(link: string, share: (link: string) => Promise<{action:string}>, sharedAction: string) {
    try { const resultado = await share(link); return resultado.action === sharedAction
        ? 'Link disponibilizado ao compartilhamento do sistema. A entrega ao destinatário não foi confirmada.'
        : 'Compartilhamento cancelado. O convite foi criado e pode ser compartilhado novamente ou revogado.';
    } catch { return 'Não foi possível abrir o compartilhamento. O convite foi criado; tente compartilhar novamente ou revogue-o.'; }
}
