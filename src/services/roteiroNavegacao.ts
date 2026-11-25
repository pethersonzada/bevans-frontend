export type CoordenadaRoteiro = { latitude: number; longitude: number };
export type PassageiroRoteiro = CoordenadaRoteiro & { id: number; nome: string };
export type PontoOperacional = CoordenadaRoteiro & {
    tipo: 'ORIGEM' | 'DESTINO' | 'PARADA' | 'INDIVIDUAL' | 'EXCEPCIONAL';
    paradaId: number | null;
    nome: string;
    passageiros: PassageiroRoteiro[];
};
// A posição no snapshot distingue inclusive pontos coincidentes e IDs de domínios diferentes.
export type PontoNavegacao = PontoOperacional & { chave: string };
export type ExecucaoRoteiro = { usuarioId: string; turmaId: number; viagemId: number; sentido: 'IDA' | 'VOLTA'; rotaPublicaId?: number };
export type PainelRoteiro = {
    referenciaId: number; tipo: string; sentido: string;
    contadores: { esperados: number }; registros: { alunoId: number; paradaId: number | null; ordem: number }[];
};

const falha = () => new Error('O roteiro operacional está incompleto ou inválido. Nenhum ponto obrigatório pode ser omitido. Atualize antes de navegar.');
const idValido = (id: unknown) => Number.isSafeInteger(id) && (id as number) > 0;

export function validarPontoRoteiro(p: CoordenadaRoteiro): void {
    if (!p || !Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90 ||
        !Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180 ||
        (p.latitude === 0 && p.longitude === 0)) throw falha();
}

export function validarRoteiroOperacional(dados: unknown): PontoNavegacao[] {
    if (!Array.isArray(dados) || dados.length < 2) throw falha();
    const passageiros = new Set<number>();
    return dados.map((p: PontoOperacional, indice) => {
        if (!p || !['ORIGEM', 'DESTINO', 'PARADA', 'INDIVIDUAL', 'EXCEPCIONAL'].includes(p.tipo) ||
            (indice === 0 ? p.tipo !== 'ORIGEM' : indice === dados.length - 1 ? p.tipo !== 'DESTINO' : ['ORIGEM', 'DESTINO'].includes(p.tipo)) ||
            !(p.paradaId === null || idValido(p.paradaId)) || (p.tipo === 'PARADA' && p.paradaId === null) ||
            typeof p.nome !== 'string' || !p.nome.trim() || !Array.isArray(p.passageiros)) throw falha();
        validarPontoRoteiro(p);
        for (const passageiro of p.passageiros) {
            if (!passageiro || !idValido(passageiro.id) || passageiros.has(passageiro.id) ||
                typeof passageiro.nome !== 'string' || !passageiro.nome.trim()) throw falha();
            validarPontoRoteiro(passageiro);
            passageiros.add(passageiro.id);
        }
        return { ...p, passageiros: p.passageiros.map(a => ({ ...a })), chave: `${indice}:${p.tipo}:${p.paradaId ?? ''}` };
    });
}

export function conferirSnapshotRoteiro(pontos: PontoNavegacao[], operacao: PainelRoteiro | null, viagemId: number, sentido: string): void {
    const passageiros = pontos.flatMap((p, ordem) => p.passageiros.map(a => ({ ...a, ordem, paradaId: p.paradaId })));
    if (!operacao || operacao.referenciaId !== viagemId || operacao.tipo !== 'VIAGEM' || operacao.sentido !== sentido ||
        !Array.isArray(operacao.registros) || operacao.contadores?.esperados !== passageiros.length ||
        operacao.registros.length !== passageiros.length ||
        new Set(operacao.registros.map(r => r.alunoId)).size !== passageiros.length ||
        passageiros.some(p => !operacao.registros.some(r => r.alunoId === p.id && r.paradaId === p.paradaId && r.ordem === p.ordem))) {
        throw new Error('Os passageiros e paradas do roteiro não correspondem à operação desta viagem. Atualize antes de navegar.');
    }
}

export function assinaturaRoteiro(execucao: ExecucaoRoteiro, pontos: PontoNavegacao[]): string {
    const identidade = [execucao.usuarioId, execucao.turmaId, execucao.viagemId, execucao.sentido];
    if (execucao.rotaPublicaId !== undefined) identidade.push('PUBLICA', execucao.rotaPublicaId);
    return JSON.stringify([...identidade, pontos]);
}

export function chaveCacheRoteiro(tipo: 'visitadas' | 'geometria', execucao: ExecucaoRoteiro): string {
    const modalidade = execucao.rotaPublicaId === undefined ? '' : `:PUBLICA:${execucao.rotaPublicaId}`;
    return `@bevans:roteiro:v5:${tipo}:${encodeURIComponent(execucao.usuarioId)}:${execucao.turmaId}:${execucao.viagemId}:${execucao.sentido}${modalidade}`;
}

// Só aceita progresso contíguo do mesmo snapshot. Cache desconhecido nunca elimina pontos.
export function restaurarVisitadas(dados: unknown, assinatura: string, pontos: PontoNavegacao[]): Set<string> {
    const cache = dados as { assinatura?: string; chaves?: unknown[] } | null;
    if (!cache || cache.assinatura !== assinatura || !Array.isArray(cache.chaves) ||
        cache.chaves.length > pontos.length || cache.chaves.some((chave, i) => chave !== pontos[i].chave)) return new Set();
    return new Set(cache.chaves as string[]);
}

export const LIMITE_WAYPOINTS_MAPBOX = 25;
export function pontosParaDirecoes(posicao: CoordenadaRoteiro, pendentes: PontoNavegacao[]): CoordenadaRoteiro[] {
    validarPontoRoteiro(posicao);
    pendentes.forEach(validarPontoRoteiro);
    const pontos = [posicao, ...pendentes];
    if (pontos.length > LIMITE_WAYPOINTS_MAPBOX) throw new Error(
        `Rota com ${pontos.length} pontos excede o limite de ${LIMITE_WAYPOINTS_MAPBOX} do Mapbox. Nenhum ponto obrigatório foi removido. Navegação indisponível.`
    );
    return pontos;
}

export function validarRespostaDirecoes(dados: any, quantidade: number): void {
    if (dados?.code !== 'Ok' || !dados.routes?.length) throw new Error(dados?.message || 'Mapbox não retornou uma rota válida.');
    const rota = dados.routes[0];
    const coordenadaValida = (c: unknown) => Array.isArray(c) && c.length === 2 &&
        Number.isFinite(c[0]) && Math.abs(c[0]) <= 180 && Number.isFinite(c[1]) && Math.abs(c[1]) <= 90;
    if (rota.geometry?.type !== 'LineString' || !Array.isArray(rota.geometry.coordinates) || rota.geometry.coordinates.length < 2 ||
        !rota.geometry.coordinates.every(coordenadaValida) || !Array.isArray(rota.legs) || rota.legs.length !== quantidade - 1 ||
        !Array.isArray(dados.waypoints) || dados.waypoints.length !== quantidade ||
        !dados.waypoints.every((w: any) => coordenadaValida(w?.location))) {
        throw new Error('Mapbox não retornou todos os pontos obrigatórios ou a geometria completa.');
    }
}

export type ParadaGeometria = { chave: string; nome: string; ponto: CoordenadaRoteiro; indiceRota: number };
export type GeometriaRoteiro = {
    assinatura: string; pendentes: string[]; paradas: ParadaGeometria[];
    coordenadas: [number, number][]; geoJson: any; manobras: unknown[];
};

export function geometriaCompativel(cache: GeometriaRoteiro | null, assinatura: string, pendentes: PontoNavegacao[]): boolean {
    if (!cache || cache.assinatura !== assinatura || !Array.isArray(cache.paradas) || !Array.isArray(cache.manobras) ||
        JSON.stringify(cache.pendentes) !== JSON.stringify(pendentes.map(p => p.chave)) ||
        cache.paradas.length !== pendentes.length || !Array.isArray(cache.coordenadas) || cache.coordenadas.length < 2 ||
        !cache.coordenadas.every(c => Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) ||
        JSON.stringify(cache.geoJson?.features?.[0]?.geometry?.coordinates) !== JSON.stringify(cache.coordenadas)) return false;
    return cache.paradas.every((p, i) => p && p.chave === pendentes[i].chave &&
        p.ponto?.latitude === pendentes[i].latitude && p.ponto?.longitude === pendentes[i].longitude &&
        Number.isInteger(p.indiceRota) && p.indiceRota >= (i ? cache.paradas[i - 1].indiceRota : 0) &&
        p.indiceRota < cache.coordenadas.length);
}

type LinhaGeoJson = { type: 'FeatureCollection'; features: [{
    type: 'Feature'; properties: Record<string, never>;
    geometry: { type: 'LineString'; coordinates: [number, number][] };
}] };
export type TrechosRoteiro = { percorrido: LinhaGeoJson | null; atual: LinhaGeoJson | null; futuro: LinhaGeoJson | null };

const linha = (coordenadas: [number, number][]): LinhaGeoJson | null => coordenadas.length < 2 ? null : ({
    type: 'FeatureCollection', features: [{
        type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coordenadas },
    }],
});

// Recorta exclusivamente a geometria viária devolvida pelo Mapbox. O índice da
// próxima parada vem dos waypoints reconciliados e nunca de proximidade GPS.
export function separarTrechosRoteiro(
    coordenadas: [number, number][], indiceProjecao: number | null, indiceProximaParada: number | null
): TrechosRoteiro {
    const vazio = { percorrido: null, atual: null, futuro: null };
    if (!Array.isArray(coordenadas) || coordenadas.length < 2 ||
        !coordenadas.every(c => Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) ||
        !Number.isInteger(indiceProximaParada) || indiceProximaParada! < 0 || indiceProximaParada! >= coordenadas.length) return vazio;
    const inicio = indiceProjecao === null ? 0 : Math.max(0, Math.min(indiceProximaParada! - 1, indiceProjecao));
    if (indiceProjecao !== null && (!Number.isInteger(indiceProjecao) || indiceProjecao < 0 || indiceProjecao >= coordenadas.length - 1)) return vazio;
    return {
        percorrido: linha(coordenadas.slice(0, inicio + 1)),
        atual: linha(coordenadas.slice(inicio, indiceProximaParada! + 1)),
        futuro: linha(coordenadas.slice(indiceProximaParada!)),
    };
}
