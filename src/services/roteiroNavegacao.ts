/**
 * Pontos operacionais de uma rota com paradas definidas.
 *
 * O snapshot da viagem identifica passageiros; a rota pública identifica as
 * paradas do serviço. A navegação precisa visitar também paradas sem reservas.
 * IDs negativos são locais à tela e nunca devem ser enviados à API como usuário.
 */
export type CoordenadaRoteiro = {
    id: number;
    nome: string;
    latitude: number;
    longitude: number;
};

export type ParadaPublicaNavegacao = CoordenadaRoteiro;

function mesmoLocal(a: CoordenadaRoteiro, b: CoordenadaRoteiro) {
    // Aproximadamente cinco metros; evita duplicar a parada e seu passageiro.
    return Math.abs(a.latitude - b.latitude) < 0.000045 &&
        Math.abs(a.longitude - b.longitude) < 0.000045;
}

export function montarParadasDefinidas(
    passageiros: CoordenadaRoteiro[],
    paradas: ParadaPublicaNavegacao[],
    sentido: 'IDA' | 'VOLTA',
): CoordenadaRoteiro[] {
    const ordenadas = sentido === 'VOLTA' ? [...paradas].reverse() : [...paradas];
    const ids = new Set<number>();
    const paradasValidas = ordenadas.map(p => {
        if (!Number.isSafeInteger(p.id) || p.id <= 0 || ids.has(p.id)) {
            throw new Error('A rota pública contém parada sem identificador válido.');
        }
        ids.add(p.id);
        return { id: -p.id, nome: p.nome, latitude: p.latitude, longitude: p.longitude };
    });
    // Embarques excepcionais aprovados não pertencem a uma parada fixa.
    // Preserva a ordem oficial do snapshot recebido da API.
    const extras = passageiros.filter(p => !paradasValidas.some(parada => mesmoLocal(p, parada)));
    return [...paradasValidas, ...extras];
}
