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

export function conferirSnapshotRoteiro(pontos: CoordenadaRoteiro[], operacao: {
    referenciaId: number; tipo: string; sentido: string;
    contadores: { esperados: number }; registros: { alunoId: number }[];
} | null, viagemId: number, sentido: string): void {
    const ids = new Set(pontos.map(p => p.id));
    if (!operacao || operacao.referenciaId !== viagemId || operacao.tipo !== 'VIAGEM' ||
        operacao.sentido !== sentido || !Array.isArray(operacao.registros) ||
        operacao.contadores?.esperados !== pontos.length || ids.size !== pontos.length ||
        operacao.registros.length !== pontos.length ||
        new Set(operacao.registros.map(r => r.alunoId)).size !== pontos.length ||
        operacao.registros.some(r => !ids.has(r.alunoId))) {
        throw new Error('Os embarques do roteiro não correspondem à operação desta viagem. Atualize antes de navegar.');
    }
}

export function validarPontoRoteiro(p: CoordenadaRoteiro): CoordenadaRoteiro {
    if (!Number.isSafeInteger(p.id) || p.id <= 0 ||
        !Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90 ||
        !Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180 ||
        (p.latitude === 0 && p.longitude === 0)) {
        throw new Error('Um ponto obrigatório da viagem possui dados inválidos. Atualize o roteiro antes de navegar.');
    }
    return p;
}

export function assinaturaRoteiro(pontos: CoordenadaRoteiro[], destino: { latitude: number; longitude: number }): string {
    return JSON.stringify([pontos.map(p => [p.id, p.latitude, p.longitude]), [destino.latitude, destino.longitude]]);
}

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
        validarPontoRoteiro(p);
        ids.add(p.id);
        return { id: -p.id, nome: p.nome, latitude: p.latitude, longitude: p.longitude };
    });
    // Embarques excepcionais aprovados não pertencem a uma parada fixa.
    // Preserva a ordem oficial do snapshot recebido da API.
    const extras = passageiros.filter(p => !paradasValidas.some(parada => mesmoLocal(p, parada)));
    return [...paradasValidas, ...extras];
}
