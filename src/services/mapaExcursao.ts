import type { Excursao } from './excursoes';
import type { PontoPublico } from '../types/rotaPublica';

export type PontoMapaExcursao = PontoPublico & { tipo?: 'ORIGEM'|'DESTINO'|'COLETA'|'DESEMBARQUE' };

export function coordenadasMapaValidas(latitude: unknown, longitude: unknown): boolean {
    return typeof latitude === 'number' && typeof longitude === 'number' &&
        Number.isFinite(latitude) && Number.isFinite(longitude) &&
        Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && (latitude !== 0 || longitude !== 0);
}

export function validarPontosPlanejamento(resposta: unknown): PontoMapaExcursao[] {
    if (!Array.isArray(resposta)) throw new Error('O servidor não retornou uma lista de pontos do roteiro.');
    if (resposta.some(p => !p || typeof p.nome !== 'string' || !p.nome.trim() ||
        !coordenadasMapaValidas(p.latitude, p.longitude) ||
        (p.paradaId != null && (!Number.isSafeInteger(p.paradaId) || p.paradaId <= 0)) ||
        (p.tipo != null && !['ORIGEM','DESTINO','COLETA','DESEMBARQUE'].includes(p.tipo)))) {
        throw new Error('O planejamento retornou pontos inválidos. Revise as coordenadas e as paradas da excursão.');
    }
    // Do not pass participant data from the private response to the map.
    return resposta.map(p => ({ paradaId: p.paradaId ?? null, nome: p.nome, latitude: p.latitude, longitude: p.longitude, ...(p.tipo ? { tipo: p.tipo } : {}) }));
}

export function pontosSalvosExcursao(e: Excursao | undefined, sentido: 'IDA'|'VOLTA'): PontoMapaExcursao[] {
    if (!e) return [];
    const pontos: PontoMapaExcursao[] = [];
    if (coordenadasMapaValidas(e.origemLatitude, e.origemLongitude)) pontos.push({ paradaId: null, nome: e.origemNome || 'Ponto de saída', latitude: e.origemLatitude!, longitude: e.origemLongitude!, tipo: 'ORIGEM' });
    if (e.modoColeta !== 'PORTA_A_PORTA') pontos.push(...e.paradas.filter(p => coordenadasMapaValidas(p.latitude,p.longitude) && p.pontoConfirmado !== false).map(p => ({ paradaId: p.id, nome: p.nome, latitude: p.latitude, longitude: p.longitude, tipo: 'COLETA' as const })));
    if (coordenadasMapaValidas(e.destinoLatitude,e.destinoLongitude)) pontos.push({ paradaId: null, nome: e.destinoNome, latitude: e.destinoLatitude, longitude: e.destinoLongitude, tipo: 'DESTINO' });
    // These are saved locations, never a substitute for an execution snapshot.
    return sentido === 'IDA' ? pontos : pontos.reverse().map(p => ({ ...p, tipo: p.tipo === 'ORIGEM' ? 'DESTINO' : p.tipo === 'DESTINO' ? 'ORIGEM' : 'DESEMBARQUE' }));
}
