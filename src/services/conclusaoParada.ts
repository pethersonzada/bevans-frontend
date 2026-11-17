import { conferirSnapshotRoteiro, restaurarVisitadas, type PontoNavegacao, type PainelRoteiro } from './roteiroNavegacao';
import type { EstadoOperacional } from './operacoes';

export type PainelParadas = Omit<PainelRoteiro, 'registros'> & {
    registros: (PainelRoteiro['registros'][number] & { id: number; estado: EstadoOperacional; versao: number })[];
};
export type SituacaoPonto = 'DISTANTE' | 'PROXIMO' | 'CHEGOU';
export type ChegadaPonto = { chave: string; situacao: SituacaoPonto; leituras: number; observadoEm: number };

// A chegada é informativa e transitória. Nunca conclui pontos nem confirma passageiros.
export function atualizarChegada(anterior: ChegadaPonto | null, chave: string, distancia: number,
    precisao: number, velocidadeKmh: number, observadoEm: number, agora: number): ChegadaPonto {
    const confiavel = Number.isFinite(precisao) && precisao >= 0 && precisao <= 45 &&
        Number.isFinite(observadoEm) && agora - observadoEm >= 0 && agora - observadoEm <= 15000;
    const perto = confiavel && distancia <= 80;
    const noPonto = perto && distancia <= 30 && Number.isFinite(velocidadeKmh) && velocidadeKmh <= 5 && velocidadeKmh >= 0;
    const sequencia = anterior?.chave === chave && observadoEm > anterior.observadoEm && observadoEm - anterior.observadoEm <= 15000;
    const leituras = noPonto ? (sequencia ? anterior.leituras + 1 : 1) : 0;
    return { chave, situacao: leituras >= 2 ? 'CHEGOU' : perto ? 'PROXIMO' : 'DISTANTE', leituras, observadoEm };
}

export function chegadaAtual(chegada: ChegadaPonto | null, chave: string, agora: number): boolean {
    return chegada?.chave === chave && chegada.situacao === 'CHEGOU' && agora >= chegada.observadoEm && agora - chegada.observadoEm <= 15000;
}

export function conferirPainelParadas(pontos: PontoNavegacao[], painel: PainelParadas | null, viagemId: number, sentido: string): asserts painel is PainelParadas {
    conferirSnapshotRoteiro(pontos, painel, viagemId, sentido);
    if (!painel || painel.registros.some(r => !Number.isSafeInteger(r.id) || r.id <= 0 ||
        !Number.isSafeInteger(r.versao) || r.versao < 0 || !['AGUARDANDO', 'EMBARCADO', 'NAO_EMBARCOU', 'DESEMBARCADO'].includes(r.estado))) {
        throw new Error('Estado operacional inválido. Atualize o controle da viagem.');
    }
}

export function impedimentoConclusao(ponto: PontoNavegacao, painel: PainelParadas | null): string | null {
    if (!painel) return 'Atualize o estado operacional antes de concluir.';
    for (const p of ponto.passageiros) {
        const registro = painel.registros.find(r => r.alunoId === p.id);
        if (!registro || !['EMBARCADO', 'NAO_EMBARCOU', 'DESEMBARCADO'].includes(registro.estado)) {
            return 'Há passageiros aguardando. Registre o que ocorreu no controle de embarque.';
        }
    }
    if (ponto.tipo === 'DESTINO' && painel.registros.some(r => !['NAO_EMBARCOU', 'DESEMBARCADO'].includes(r.estado))) {
        return 'Confirme os desembarques e resolva os passageiros aguardando antes de concluir o destino.';
    }
    return null;
}

export function restaurarConclusoes(dados: unknown, assinatura: string, pontos: PontoNavegacao[], painel: PainelParadas): Set<string> {
    if ((dados as { confirmacao?: string } | null)?.confirmacao !== 'MOTORISTA') return new Set();
    // Origem não participa das visitas. Aceita cache v5 anterior somente se
    // contiver confirmações manuais contíguas e mesma assinatura do snapshot.
    const operacionais = pontos[0]?.tipo === 'ORIGEM' ? pontos.slice(1) : pontos;
    const antigas = (dados as { chaves?: unknown[] } | null)?.chaves;
    const legado = pontos[0]?.tipo === 'ORIGEM' && Array.isArray(antigas) && antigas[0] === pontos[0].chave;
    const chaves = legado
        ? new Set([...restaurarVisitadas(dados, assinatura, pontos)].filter(chave => chave !== pontos[0].chave))
        : restaurarVisitadas(dados, assinatura, operacionais);
    // Correção concorrente para AGUARDANDO reabre o ponto e todo o sufixo, sem saltar a ordem.
    const validas = new Set<string>();
    for (const ponto of operacionais) {
        if (!chaves.has(ponto.chave) || impedimentoConclusao(ponto, painel)) break;
        validas.add(ponto.chave);
    }
    return validas;
}
