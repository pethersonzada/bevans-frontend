const { test } = require('node:test'), assert = require('node:assert/strict');
const { load, fixture, painel, ponto, passageiro } = require('./helpers/roteiro.cjs');
const r = load('src/services/roteiroNavegacao.ts');
const execucao = { usuarioId: 'motorista-1', turmaId: 7, viagemId: 42, sentido: 'IDA' };
const gps = { latitude: -8.6, longitude: -35.6 };
const plain = value => JSON.parse(JSON.stringify(value));

for (const modalidade of ['PORTA_A_PORTA', 'PRIVADA_PARADAS', 'FIXA', 'FLEXIVEL']) for (const sentido of ['IDA', 'VOLTA']) {
    test(`${modalidade} ${sentido}: mantém todos os pontos e passageiros na sequência exata da API`, () => {
        const dados = fixture(modalidade, sentido), antes = JSON.stringify(dados);
        const pontos = r.validarRoteiroOperacional(dados);
        assert.equal(JSON.stringify(dados), antes);
        assert.deepEqual(plain(pontos.map(({ chave, ...p }) => p)), dados);
        assert.doesNotThrow(() => r.conferirSnapshotRoteiro(pontos, painel(dados, 42, sentido), 42, sentido));
        const direcoes = r.pontosParaDirecoes(gps, pontos);
        assert.deepEqual(plain(direcoes.slice(1)), plain(pontos));
        assert.equal(direcoes[1].tipo, 'ORIGEM');
        assert.equal(direcoes.at(-1).tipo, 'DESTINO');
        assert.equal(new Set(pontos.map(p => p.chave)).size, dados.length);
        if (modalidade !== 'PORTA_A_PORTA') {
            assert.equal(pontos.find(p => p.paradaId === 11).passageiros.length, 0);
            assert.deepEqual(Array.from(pontos.find(p => p.paradaId === 22).passageiros, a => a.id), [11, 33]);
        }
    });
}

test('pontos coincidentes continuam distintos e paradaId nunca se torna ID do passageiro', () => {
    const dados = fixture('PRIVADA_PARADAS', 'IDA');
    dados[2].latitude = dados[1].latitude; dados[2].longitude = dados[1].longitude;
    const pontos = r.validarRoteiroOperacional(dados);
    assert.equal(pontos.length, 4);
    assert.notEqual(pontos[1].chave, pontos[2].chave);
    assert.equal(pontos[1].paradaId, pontos[2].passageiros[0].id);
    assert.notEqual(pontos[2].paradaId, pontos[2].passageiros[0].id);
});

test('qualquer ponto ou passageiro inválido bloqueia o snapshot inteiro', () => {
    for (const alterar of [
        ps => ps.pop(), ps => ps.shift(), ps => ps[1].latitude = 91,
        ps => ps[1].longitude = null, ps => ps[1].latitude = '0', ps => ps[1].tipo = 'DESCONHECIDO',
        ps => ps[1].paradaId = null, ps => ps[1].passageiros = null,
        ps => ps[2].passageiros[0].id = 0, ps => ps[2].passageiros[0].latitude = NaN,
        ps => ps[2].passageiros.push(ps[2].passageiros[0]),
    ]) {
        const dados = fixture('FIXA', 'IDA'); alterar(dados);
        assert.throws(() => r.validarRoteiroOperacional(dados), /Nenhum ponto obrigatório/);
    }
    for (const dados of [null, {}, [], [ponto('ORIGEM', 'Único', -8, -35)]]) assert.throws(() => r.validarRoteiroOperacional(dados));
    assert.doesNotThrow(() => r.validarPontoRoteiro({ latitude: 0, longitude: -35 }));
    assert.throws(() => r.validarPontoRoteiro({ latitude: 0, longitude: 0 }));
});

test('reconciliação usa alunoId, ordem e paradaId, e rejeita omissão, duplicação ou outra execução', () => {
    const pontos = r.validarRoteiroOperacional(fixture('FIXA', 'IDA'));
    const original = painel(pontos);
    for (const alterar of [
        op => op.referenciaId++, op => op.sentido = 'VOLTA', op => op.tipo = 'EXCURSAO',
        op => op.contadores.esperados++, op => op.registros.pop(),
        op => op.registros[0].alunoId = op.registros[0].id,
        op => op.registros[1].alunoId = op.registros[0].alunoId,
        op => op.registros[0].paradaId = 11, op => op.registros[0].ordem++,
    ]) {
        const op = plain(original); alterar(op);
        assert.throws(() => r.conferirSnapshotRoteiro(pontos, op, 42, 'IDA'), /não correspondem/);
    }
    assert.throws(() => r.conferirSnapshotRoteiro(pontos, null, 42, 'IDA'));
    const vazios = r.validarRoteiroOperacional([pontos[0], pontos.at(-1)]);
    assert.doesNotThrow(() => r.conferirSnapshotRoteiro(vazios, painel(vazios), 42, 'IDA'));
});

test('cache separa usuário, turma, sentido e cada execução no mesmo dia', () => {
    const pontos = r.validarRoteiroOperacional(fixture('FIXA', 'IDA'));
    const assinatura = r.assinaturaRoteiro(execucao, pontos), chave = r.chaveCacheRoteiro('visitadas', execucao);
    for (const mudanca of [{ usuarioId: 'outro' }, { turmaId: 8 }, { viagemId: 43 }, { sentido: 'VOLTA' }]) {
        assert.notEqual(r.assinaturaRoteiro({ ...execucao, ...mudanca }, pontos), assinatura);
        assert.notEqual(r.chaveCacheRoteiro('visitadas', { ...execucao, ...mudanca }), chave);
    }
    for (const alterar of [
        ps => ps[1].latitude -= 0.01, ps => ps.at(-1).longitude -= 0.01,
        ps => ps[2].passageiros.push(passageiro(99)), ps => ps[2].passageiros[0].latitude -= 0.01,
        ps => ps.splice(1, 2, ps[2], ps[1]), ps => ps[1].paradaId++,
    ]) { const ps = plain(pontos); alterar(ps); assert.notEqual(r.assinaturaRoteiro(execucao, ps), assinatura); }
});

test('restaura apenas visitas contíguas do snapshot correto, incluindo parada vazia e extremos', () => {
    const pontos = r.validarRoteiroOperacional(fixture('FIXA', 'IDA'));
    const assinatura = r.assinaturaRoteiro(execucao, pontos), chaves = pontos.slice(0, 2).map(p => p.chave);
    assert.deepEqual(Array.from(r.restaurarVisitadas({ assinatura, chaves }, assinatura, pontos)), chaves);
    assert.equal(pontos.filter(p => !r.restaurarVisitadas({ assinatura, chaves }, assinatura, pontos).has(p.chave)).length, pontos.length - 2);
    for (const dados of [null, [11], {}, { assinatura: 'antigo', chaves }, { assinatura, chaves: [pontos[2].chave] },
        { assinatura, chaves: [chaves[0], chaves[0]] }, { assinatura, chaves: [...chaves, 'desconhecida'] }]) {
        assert.equal(r.restaurarVisitadas(dados, assinatura, pontos).size, 0);
    }
});

test('limite Mapbox bloqueia explicitamente sem cortar pontos obrigatórios', () => {
    const pontos = Array.from({ length: 24 }, (_, i) => ({ ...ponto('PARADA', String(i), -8, -35, i + 1), chave: String(i) }));
    assert.equal(r.pontosParaDirecoes(gps, pontos).length, 25);
    pontos.push({ ...pontos[0], chave: '25' });
    const antes = JSON.stringify(pontos);
    assert.throws(() => r.pontosParaDirecoes(gps, pontos), /26 pontos.*limite de 25.*Nenhum ponto obrigatório/);
    assert.equal(JSON.stringify(pontos), antes);
});

test('Mapbox parcial, sem rota ou com geometria inválida nunca é aplicado', () => {
    const valido = { code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: [[-35, -8], [-36, -9]] }, legs: [{}, {}] }], waypoints: [{ location: [-35, -8] }, { location: [-35.5, -8.5] }, { location: [-36, -9] }] };
    assert.doesNotThrow(() => r.validarRespostaDirecoes(valido, 3));
    for (const alterar of [d => d.waypoints.pop(), d => d.routes[0].legs.pop(), d => d.waypoints[1].location = [null, null],
        d => d.routes[0].geometry.coordinates = [], d => d.routes[0].geometry.coordinates[0][0] = 999]) {
        const dados = plain(valido); alterar(dados); assert.throws(() => r.validarRespostaDirecoes(dados, 3), /pontos obrigatórios/);
    }
    for (const dados of [null, {}, { code: 'NoRoute', message: 'Sem rota' }, { code: 'Ok', routes: [] }]) assert.throws(() => r.validarRespostaDirecoes(dados, 3));
});

test('fallback exige mesma sequência pendente, coordenadas, geometria e assinatura completa', () => {
    const pontos = r.validarRoteiroOperacional(fixture('FIXA', 'IDA'));
    const coordenadas = pontos.map(p => [p.longitude, p.latitude]);
    const cache = { assinatura: 'snapshot', pendentes: pontos.map(p => p.chave), coordenadas, manobras: [],
        geoJson: { features: [{ geometry: { type: 'LineString', coordinates: coordenadas } }] },
        paradas: pontos.map((p, i) => ({ chave: p.chave, nome: p.nome, ponto: p, indiceRota: i })) };
    assert.equal(r.geometriaCompativel(cache, 'snapshot', pontos), true);
    assert.equal(r.geometriaCompativel(cache, 'outra', pontos), false);
    assert.equal(r.geometriaCompativel(cache, 'snapshot', pontos.slice(1)), false);
    for (const alterar of [c => c.paradas.pop(), c => c.paradas[1].chave = c.paradas[0].chave,
        c => c.paradas[1].ponto.latitude = -1, c => c.paradas[1].indiceRota = 999,
        c => c.geoJson.features[0].geometry.coordinates = [], c => c.manobras = null, c => c.paradas = {}]) {
        const c = plain(cache); alterar(c); assert.equal(r.geometriaCompativel(c, 'snapshot', pontos), false);
    }
});

function apiHarness(handler) {
    const requests = [];
    const api = load('src/config/api.ts', {
        './config': { API_URL: 'https://api.test' },
        './firebase': { auth: { authStateReady: async () => {}, currentUser: { getIdToken: async () => 'token-teste' } } },
    }, { fetch: async (url, options) => { requests.push({ url, options }); return handler(url, options); } });
    return { requests, service: load('src/services/roteiroOperacional.ts', { '../config/api': api, './roteiroNavegacao': r }) };
}

test('consulta autenticada usa viagemId e no-store, sem endpoint legado ou reconstrução', async () => {
    const dados = fixture('FLEXIVEL', 'VOLTA');
    const { requests, service } = apiHarness(async () => Response.json(dados));
    const signal = new AbortController().signal;
    assert.equal((await service.consultarRoteiroOperacional(42, signal)).length, dados.length);
    assert.equal(requests.length, 1); assert.equal(requests[0].url, 'https://api.test/operacoes/VIAGEM/42/roteiro');
    assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer token-teste');
    assert.equal(requests[0].options.headers.get('Cache-Control'), 'no-store');
    await assert.rejects(service.consultarRoteiroOperacional(0)); assert.equal(requests.length, 1);
});

for (const status of [409, 503, 403, 404, 500]) test(`HTTP ${status} bloqueia a navegação sem fallback ao cadastro ou passageiros legados`, async () => {
    const detalhe = status === 409 ? 'Esta operação antiga não possui roteiro completo salvo.' : 'Roteiro operacional salvo indisponível.';
    const { service, requests } = apiHarness(async () => Response.json({ erro: detalhe, codigo: 'PONTO_INVALIDO' }, { status }));
    await assert.rejects(service.consultarRoteiroOperacional(42), erro => erro.status === status && erro.message.includes(detalhe) &&
        (status !== 409 || erro.message.includes('Não é seguro reconstruir')) && (status !== 503 || erro.message.includes('Tente atualizar')));
    assert.equal(requests.length, 1);
});

test('rede, JSON inválido e 200 parcial não produzem roteiro', async () => {
    for (const handler of [async () => { throw Error('offline'); }, async () => new Response('{'), async () => Response.json([])]) {
        const { service, requests } = apiHarness(handler);
        await assert.rejects(service.consultarRoteiroOperacional(42)); assert.equal(requests.length, 1);
    }
});
