const { test } = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./helpers/roteiro.cjs');
const { harness, nodes, flush } = require('./helpers/mapa.cjs');
const texto = h => nodes(h.render()).filter(n => n.type === 'Text').map(n => [n.props.children].flat(Infinity).join('')).join('\n');

test('um passageiro: garagem não é waypoint nem parada restante; destino é final', async () => {
    const dados = fixture('PORTA_A_PORTA', 'IDA');
    const h = harness({ dados, estados: { 11: 'EMBARCADO' } });
    h.render(); await flush(); const tela = h.render();
    assert.deepEqual(h.direcoes[0].slice(1), dados.slice(1).map(p => [p.longitude, p.latitude]));
    assert.deepEqual(h.direcoes[0][0], [-35.6, -8.6]); // GPS atual do cenário
    const pontos = nodes(tela).find(n => n.type === 'Shape' && n.props.id === 'pontosOperacionaisSource').props.shape.features;
    assert.equal(pontos.length, 2); // embarque + destino, garagem fora
    assert.match(texto(h), /1 restante/);
    assert.match(texto(h), new RegExp(`Próxima parada: ${dados[1].nome}`));
    await h.concluir(dados[1]);
    assert.match(texto(h), new RegExp(`Destino final: ${dados[2].nome}`));
    assert.doesNotMatch(texto(h), /[12] restantes/);
    h.unmount();
});
