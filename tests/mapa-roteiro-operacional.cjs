const { test } = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./helpers/roteiro.cjs');
const { harness, nodes, flush, r } = require('./helpers/mapa.cjs');

test('entrada pública revalida publicação, modalidade, turma e execução antes de desenhar o snapshot',async()=>{
    const params={turmaId:'7',rotaId:'999',viagemId:'42',modalidade:'PUBLICA'};
    const h=harness({params,statusCampos:{modalidade:'PUBLICA',rotaPublicaId:999}});h.render();await flush();assert.ok(nodes(h.render()).some(n=>n.type==='Map'));assert.ok(h.requests.some(p=>p.endsWith('/rotas-publicas/minhas')));h.unmount();
    for(const campos of [{modalidade:'PRIVADA',rotaPublicaId:999},{modalidade:'PUBLICA',rotaPublicaId:88}]){
        const denied=harness({params,statusCampos:campos});denied.render();await flush();assert.equal(denied.direcoes.length,0);assert.equal(nodes(denied.render()).some(n=>n.type==='Map'),false);denied.unmount();
    }
    const antiga=harness({params:{...params,viagemId:'41'},statusCampos:{modalidade:'PUBLICA',rotaPublicaId:999}});antiga.render();await flush();assert.equal(antiga.direcoes.length,0);antiga.unmount();
});

for (const modalidade of ['PORTA_A_PORTA', 'PRIVADA_PARADAS', 'FIXA', 'FLEXIVEL']) for (const sentido of ['IDA', 'VOLTA']) {
    test(`mapa integrado ${modalidade} ${sentido} usa snapshot completo e extremos oficiais`, async () => {
        const dados = fixture(modalidade, sentido), h = harness({ dados, sentido });
        h.render(); await flush(); const tree = h.render();
        assert.equal(nodes(tree).some(n => n.type === 'Map'), true);
        assert.deepEqual(h.direcoes[0].slice(1), dados.slice(1).map(p => [p.longitude, p.latitude]));
        const features = nodes(tree).find(n => n.type === 'Shape' && n.props.id === 'pontosOperacionaisSource').props.shape.features;
        assert.equal(features.length, dados.length - 1);
        assert.deepEqual(Array.from(features, p => p.properties.paradaId), dados.slice(1).map(p => p.paradaId));
        assert.equal(nodes(tree).find(n => n.type === 'Header').props.direcaoAtual, sentido.toLowerCase());
        assert.equal(h.requests.some(url => /otimizar|rotas-publicas|coleta/.test(url)), false);
        h.unmount();
    });
}

test('origem é referência e a visita abrange paradas vazias, compartilhadas e destino', async () => {
    const dados = fixture('FIXA', 'IDA'), estados = { 11: 'EMBARCADO', 33: 'EMBARCADO', 44: 'EMBARCADO' }, h = harness({ dados, estados });
    h.render(); await flush(); h.render();
    h.tick(dados[0], { accuracy: 100 }); h.tick(dados[0], { speed: 20 }); await flush();
    assert.equal([...h.storage.keys()].some(k => k.includes('visitadas')), false);
    for (const [i, p] of dados.slice(1, 3).entries()) {
        const tree = await h.concluir(p);
        if (i === 0) assert.equal(nodes(tree).some(n => typeof n.props.children === 'string' && n.props.children.includes('Passageiros (2): Pessoa 11, Pessoa 33')), true);
    }
    const key = r.chaveCacheRoteiro('visitadas', { usuarioId: 'driver', turmaId: 7, viagemId: 42, sentido: 'IDA' });
    const cache = JSON.parse(h.storage.get(key));
    assert.deepEqual(cache.chaves, r.validarRoteiroOperacional(dados).slice(1, 3).map(p => p.chave));
    h.unmount();
    const retomada = harness({ dados, estados, storage: h.storage }); retomada.render(); await flush();
    assert.deepEqual(retomada.direcoes[0].slice(1), dados.slice(3).map(p => [p.longitude, p.latitude]));
    for (const p of dados.slice(3)) {
        if (p.tipo === 'DESTINO') { for (const id of [11, 33, 44]) retomada.setEstado(id, 'DESEMBARCADO'); await retomada.refresh(); }
        await retomada.concluir(p);
    }
    assert.deepEqual(JSON.parse(h.storage.get(key)).chaves, r.validarRoteiroOperacional(dados).slice(1).map(p => p.chave));
    retomada.unmount();
    const nova = harness({ dados, viagemId: 43, storage: h.storage }); nova.render(); await flush();
    assert.deepEqual(nova.direcoes[0].slice(1), dados.slice(1).map(p => [p.longitude, p.latitude])); nova.unmount();
});

test('recalcular após desvio preserva sequência de todos os pontos pendentes', async () => {
    const dados = fixture('FLEXIVEL', 'VOLTA'), h = harness({ dados, sentido: 'VOLTA' });
    h.render(); await flush(); h.render();
    h.tick({ latitude: -9, longitude: -36 }); h.tick({ latitude: -9, longitude: -36 }, { advance: 7000 });
    await flush(); h.render();
    assert.equal(h.direcoes.length, 2);
    assert.deepEqual(h.direcoes[1].slice(1), dados.slice(1).map(p => [p.longitude, p.latitude]));
    h.unmount();
});

for (const roteiroStatus of [409, 503]) test(`mapa bloqueia HTTP ${roteiroStatus} e não usa geometria antiga`, async () => {
    const antigo = harness(); antigo.render(); await flush(); antigo.unmount();
    const h = harness({ roteiroStatus, storage: antigo.storage }); h.render(); await flush(); const tree = h.render();
    assert.equal(nodes(tree).some(n => n.type === 'Map'), false);
    const error = nodes(tree).find(n => n.type === 'AsyncState');
    assert.match(error.props.message, roteiroStatus === 409 ? /viagem antiga sem snapshot/ : /snapshot operacional está indisponível/);
    assert.equal(h.direcoes.length, 0); h.unmount();
});

test('Mapbox falhando só usa cache do mesmo snapshot completo e mesmos pontos pendentes', async () => {
    const primeiro = harness(); primeiro.render(); await flush(); primeiro.unmount();
    const offline = harness({ storage: primeiro.storage, mapboxStatus: 503 }); offline.render(); await flush();
    assert.equal(nodes(offline.render()).some(n => n.type === 'Map'), true); offline.unmount();
    const dados = fixture('FIXA', 'IDA'); dados[1].latitude -= 0.01;
    const alterado = harness({ dados, storage: primeiro.storage, mapboxStatus: 503 }); alterado.render(); await flush();
    assert.equal(nodes(alterado.render()).some(n => n.type === 'Map'), false); alterado.unmount();
    const parcial = harness({ incomplete: true }); parcial.render(); await flush();
    assert.equal(nodes(parcial.render()).some(n => n.type === 'Map'), false); parcial.unmount();
});

test('mais de 25 waypoints bloqueia o mapa antes da consulta e mantém mensagem e snapshot íntegros', async () => {
    const dados = fixture('PRIVADA_PARADAS', 'IDA');
    dados.splice(1, 0, ...Array.from({ length: 22 }, (_, i) => ({ tipo: 'PARADA', paradaId: 100 + i, nome: `Parada ${i}`, latitude: -8.1, longitude: -35.1, passageiros: [] })));
    const antes = JSON.stringify(dados), h = harness({ dados }); h.render(); await flush(); const tree = h.render();
    assert.equal(h.direcoes.length, 0); assert.equal(JSON.stringify(dados), antes);
    assert.equal(nodes(tree).some(n => n.type === 'Map'), false);
    assert.match(nodes(tree).find(n => n.type === 'AsyncState').props.message, /limite de 25.*Nenhum ponto obrigatório foi removido/);
    // Uma posição enviada com sucesso não apaga o erro da navegação.
    h.tick(dados[0]); await flush();
    assert.match(nodes(h.render()).find(n => n.type === 'AsyncState').props.message, /limite de 25/);
    h.unmount();
});

test('resposta de recálculo atrasada não ressuscita ponto visitado durante a consulta', async () => {
    const dados = fixture('FIXA', 'IDA'); let concluir;
    const response = coords => Response.json({ code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: coords }, legs: coords.slice(1).map(() => ({ steps: [] })) }], waypoints: coords.map(location => ({ location })) });
    const h = harness({ dados, mapboxHandler: (coords, chamada) => chamada === 1 ? response(coords) : new Promise(resolve => { concluir = () => resolve(response(coords)); }) });
    h.render(); await flush(); h.render();
    h.tick({ latitude: -9, longitude: -36 }); h.tick({ latitude: -9, longitude: -36 }, { advance: 7000 }); await flush();
    assert.equal(typeof concluir, 'function');
    await h.concluir(dados[1]); concluir(); await flush();
    const tree = h.render();
    assert.equal(nodes(tree).some(n => n.type === 'Text' && typeof n.props.children === 'string' && n.props.children.includes('Passageiros (2): Pessoa 11, Pessoa 33')), true);
    h.unmount();
});
