const { test } = require('node:test'), assert = require('node:assert/strict');
const { load, fixture, painel } = require('./helpers/roteiro.cjs');
const { harness, nodes, flush, r } = require('./helpers/mapa.cjs');
const c = load('src/services/conclusaoParada.ts', { './roteiroNavegacao': r });
const botao = h => nodes(h.render()).find(n => n.props.accessibilityLabel === 'Concluir parada');
const texto = h => nodes(h.render()).filter(n => n.type === 'Text').map(n => [n.props.children].flat(Infinity).join('')).join('\n');
const key = (viagemId = 42) => r.chaveCacheRoteiro('visitadas', { usuarioId: 'driver', turmaId: 7, viagemId, sentido: 'IDA' });
const saved = h => JSON.parse(h.storage.get(key()) || '{"chaves":[]}').chaves;
const start = async options => { const h = harness(options); h.render(); await flush(); h.render(); return h; };
const chegar = (h, p, options) => { h.tick(p, options); h.tick(p, options); return botao(h); };

test('chegada distingue distância, proximidade e chegada sem criar conclusão', () => {
    let state = c.atualizarChegada(null, 'a', 100, 5, 0, 100000, 100000);
    assert.equal(state.situacao, 'DISTANTE');
    state = c.atualizarChegada(state, 'a', 60, 5, 0, 102000, 102000);
    assert.equal(state.situacao, 'PROXIMO');
    state = c.atualizarChegada(state, 'a', 10, 5, 0, 104000, 104000);
    assert.equal(state.situacao, 'PROXIMO');
    state = c.atualizarChegada(state, 'a', 10, 5, 0, 106000, 106000);
    assert.equal(state.situacao, 'CHEGOU');
    assert.equal(c.chegadaAtual(state, 'a', 110000), true);
    assert.equal(c.chegadaAtual(state, 'b', 110000), false);
    assert.equal(c.chegadaAtual(state, 'a', 122000), false);
    assert.equal(c.atualizarChegada(state, 'b', 10, 5, 0, 108000, 108000).situacao, 'PROXIMO');
});

test('leituras ruins, repetidas, antigas ou em movimento não autorizam chegada', () => {
    for (const [precisao, velocidade, timestamp, agora] of [[100, 0, 100000, 100000], [-1, 0, 100000, 100000], [5, 18, 100000, 100000],
        [5, Infinity, 100000, 100000], [5, 0, 80000, 100000], [5, 0, 101000, 100000]]) {
        const state = c.atualizarChegada(null, 'a', 5, precisao, velocidade, timestamp, agora);
        assert.notEqual(c.atualizarChegada(state, 'a', 5, precisao, velocidade, timestamp, agora).situacao, 'CHEGOU');
    }
    const primeiro = c.atualizarChegada(null, 'a', 0, 5, 0, 100000, 100000);
    assert.notEqual(c.atualizarChegada(primeiro, 'a', 0, 5, 0, 100000, 100000).situacao, 'CHEGOU');
});

for (const sentido of ['IDA', 'VOLTA']) test(`${sentido}: passar devagar perto não remove parada nem escreve progresso`, async () => {
    const dados = fixture('PRIVADA_PARADAS', sentido), h = await start({ dados, sentido });
    for (const p of dados) for (let i = 0; i < 4; i++) h.tick(p, { speed: 2 });
    await flush(); assert.equal(saved(h).length, 0);
    assert.match(texto(h), new RegExp(`Próxima parada: ${dados[1].nome}`));
    assert.equal(h.requests.some(url => url.includes('/estado')), false); h.unmount();
});

test('garagem nunca exige chegada nem conclusão manual', async () => {
    const dados = fixture('FIXA', 'IDA'), h = await start({ dados });
    assert.deepEqual(h.direcoes[0].slice(1), dados.slice(1).map(p => [p.longitude, p.latitude]));
    assert.match(texto(h), new RegExp(`Próxima parada: ${dados[1].nome}`));
    assert.equal(saved(h).length, 0); h.unmount();
});

test('dois pontos coincidentes exigem duas ações distintas; callback antigo não conclui o seguinte', async () => {
    const dados = fixture('PRIVADA_PARADAS', 'IDA'); dados[2].latitude = dados[1].latitude; dados[2].longitude = dados[1].longitude;
    const h = await start({ dados, estados: { 11: 'NAO_EMBARCOU', 33: 'NAO_EMBARCOU' } }), first = chegar(h, dados[1]).props.onPress;
    first(); first(); await flush(); assert.equal(saved(h).length, 1);
    assert.equal(botao(h).props.disabled, true);
    chegar(h, dados[2]); first(); await flush(); assert.equal(saved(h).length, 1);
    await botao(h).props.onPress(); await flush(); assert.equal(saved(h).length, 2); h.unmount();
});

test('passageiro aguardando bloqueia conclusão e acesso ao controle não inventa confirmação', async () => {
    const dados = fixture('PORTA_A_PORTA', 'IDA'), h = await start({ dados });
    const button = chegar(h, dados[1]); assert.equal(button.props.disabled, true);
    assert.match(texto(h), /Pessoa 11: Aguardando/); assert.match(texto(h), /Há passageiros aguardando/);
    await button.props.onPress(); await flush(); assert.equal(saved(h).length, 0);
    nodes(h.render()).find(n => n.props.accessibilityLabel === 'Controle de embarque').props.onPress();
    assert.equal(h.paths[0].pathname, '/controle-viagem'); assert.equal(h.paths[0].params.id, '42');
    assert.equal(h.requests.some(url => url.includes('/estado')), false); h.unmount();
});

test('embarque compartilhado só libera depois de todos os registros oficiais resolvidos', async () => {
    const dados = fixture('PRIVADA_PARADAS', 'IDA'), h = await start({ dados });
     await h.concluir(dados[1]); chegar(h, dados[2]);
    await h.confirmar(11, 'EMBARCADO'); await h.refresh();
    assert.equal(botao(h).props.disabled, true); assert.equal(saved(h).length, 1);
    await h.confirmar(33, 'NAO_EMBARCOU'); await h.refresh();
    assert.match(texto(h), /Pessoa 11: Embarcado/); assert.match(texto(h), /Pessoa 33: Não embarcou/);
    await h.concluir(dados[2]); assert.equal(saved(h).length, 2); h.unmount();
});

for (const estado of ['NAO_EMBARCOU', 'DESEMBARCADO']) test(`ponto individual com ${estado} respeita estado oficial e exige conclusão manual`, async () => {
    const dados = fixture('PORTA_A_PORTA', 'IDA'), h = await start({ dados, estados: { 11: estado } });
     chegar(h, dados[1]); assert.equal(saved(h).length, 0);
    await botao(h).props.onPress(); await flush(); assert.equal(saved(h).length, 1);
    assert.equal(h.requests.some(url => url.includes('/estado')), false); h.unmount();
});

test('destino exige desembarques; conclusão não encerra viagem nem muda registros', async () => {
    const dados = fixture('PORTA_A_PORTA', 'IDA'), h = await start({ dados, estados: { 11: 'EMBARCADO' } });
     await h.concluir(dados[1]); chegar(h, dados[2]);
    assert.equal(botao(h).props.disabled, true); assert.match(texto(h), /Confirme os desembarques/);
    await h.confirmar(11, 'DESEMBARCADO'); await h.refresh(); await h.concluir(dados[2]);
    assert.equal(saved(h).length, 2); assert.match(texto(h), /Parada concluída: IDA destino/);
    assert.equal(nodes(h.render()).find(n => n.type === 'Controls').props.distanciaRestante, 0);
    assert.equal(h.requests.some(url => /finalizar|encerrar/.test(url)), false); h.unmount();
});

test('parada sem passageiros requer ação explícita e não cria registro operacional', async () => {
    const dados = fixture('PRIVADA_PARADAS', 'IDA'), h = await start({ dados });
    chegar(h, dados[1]); assert.equal(saved(h).length, 0); assert.match(texto(h), /Sem passageiros previstos/);
    await botao(h).props.onPress(); await flush(); assert.equal(saved(h).length, 1);
    assert.equal(h.requests.some(url => url.includes('/estado')), false); h.unmount();
});

test('toque duplo serializa consulta e só conclui um ponto', async () => {
    const dados = fixture('FIXA', 'IDA'), h = await start({ dados });
    const click = chegar(h, dados[1]).props.onPress, before = h.requests.length;
    click(); click(); assert.equal(botao(h).props.accessibilityState.busy, true); await flush();
    assert.equal(saved(h).length, 1); assert.equal(h.requests.length - before, 2); h.unmount();
});

test('GPS impreciso, velocidade desconhecida e chegada expirada mantêm o ponto pendente', async () => {
    const dados = fixture('FIXA', 'IDA'), h = await start({ dados });
    for (const options of [{ accuracy: 100 }, { speed: null }, { timestamp: 1 }, { speed: 3 }]) {
        assert.equal(chegar(h, dados[1], options).props.disabled, true);
    }
    const click = chegar(h, dados[1]).props.onPress; h.advance(16000); await click(); await flush();
    assert.equal(saved(h).length, 0); h.unmount();
});

test('offline bloqueia a conclusão; reconexão revalida sem avançar automaticamente', async () => {
    const dados = fixture('FIXA', 'IDA'), h = await start({ dados }); const click = chegar(h, dados[1]).props.onPress;
    h.setOnline(false); assert.equal(botao(h).props.disabled, true); await click(); await flush();
    assert.equal(saved(h).length, 0); h.setOnline(true); await h.refresh(); assert.equal(saved(h).length, 0);
    await h.concluir(dados[1]); assert.equal(saved(h).length, 1); h.unmount();
});

test('falha de confirmação operacional mantém passageiro aguardando e ponto pendente', async () => {
    const dados = fixture('PORTA_A_PORTA', 'IDA'), h = await start({ dados });
    h.setConfirmationError(503); await assert.rejects(h.confirmar(11, 'EMBARCADO')); await h.refresh();
    chegar(h, dados[1]); assert.equal(botao(h).props.disabled, true); assert.equal(saved(h).length, 0);
    assert.equal(h.official.registros[0].estado, 'AGUARDANDO'); h.unmount();
});

for (const status of [403, 409, 503]) test(`falha HTTP ${status} na conferência final não salva nem avança`, async () => {
    const dados = fixture('FIXA', 'IDA'), h = await start({ dados }); const click = chegar(h, dados[1]).props.onPress;
    h.setPainelError(status); await click(); await flush(); assert.equal(saved(h).length, 0);
    assert.equal(botao(h).props.disabled, true); assert.doesNotMatch(texto(h), /Parada concluída/); h.unmount();
});

test('falha ao persistir conclusão mantém o ponto pendente e permite nova tentativa segura', async () => {
    const dados = fixture('FIXA', 'IDA'), h = await start({ dados, storageFailure: true });
    await chegar(h, dados[1]).props.onPress(); await flush(); assert.equal(saved(h).length, 0);
    assert.match(texto(h), /Falha ao salvar conclusão/); assert.match(texto(h), new RegExp(`Próxima parada: ${dados[1].nome}`)); h.unmount();
});

test('reinício não restaura chegada GPS e ignora cache v4 e v5 sem confirmação explícita', async () => {
    const dados = fixture('FIXA', 'IDA'), pontos = r.validarRoteiroOperacional(dados), execucao = { usuarioId: 'driver', turmaId: 7, viagemId: 42, sentido: 'IDA' };
    const storage = new Map(), assinatura = r.assinaturaRoteiro(execucao, pontos);
    storage.set(key().replace(':v5:', ':v4:'), JSON.stringify({ assinatura, chaves: pontos.map(p => p.chave) }));
    storage.set(key(), JSON.stringify({ assinatura, chaves: pontos.map(p => p.chave) }));
    const h = await start({ dados, storage }); assert.deepEqual(h.direcoes[0].slice(1), dados.slice(1).map(p => [p.longitude, p.latitude]));
    chegar(h, dados[1]); h.unmount(); const retomada = await start({ dados });
    assert.equal(botao(retomada).props.disabled, true); assert.match(texto(retomada), new RegExp(`Próxima parada: ${dados[1].nome}`)); retomada.unmount();
});

test('correção concorrente para aguardando reabre ponto concluído e mantém todo o sufixo no recálculo', async () => {
    const dados = fixture('PORTA_A_PORTA', 'IDA'), h = await start({ dados, estados: { 11: 'EMBARCADO' } });
     await h.concluir(dados[1]); h.setEstado(11, 'AGUARDANDO'); await h.refresh();
    assert.deepEqual(h.direcoes.at(-1).slice(1), dados.slice(1).map(p => [p.longitude, p.latitude]));
    assert.match(texto(h), /parada voltou a ficar pendente/);
    h.unmount(); const retomada = await start({ dados, storage: h.storage });
    assert.deepEqual(retomada.direcoes[0].slice(1), dados.slice(1).map(p => [p.longitude, p.latitude])); retomada.unmount();
});

test('estado alterado entre exibição e clique é conferido novamente antes da conclusão', async () => {
    const dados = fixture('PORTA_A_PORTA', 'IDA'), h = await start({ dados, estados: { 11: 'EMBARCADO' } });
     const click = chegar(h, dados[1]).props.onPress; h.setEstado(11, 'AGUARDANDO');
    await click(); await flush(); assert.equal(saved(h).length, 0); assert.equal(botao(h).props.disabled, true); h.unmount();
});

test('troca de execução antes do clique bloqueia conclusão da execução anterior', async () => {
    const dados = fixture('FIXA', 'IDA'), h = await start({ dados }); const click = chegar(h, dados[1]).props.onPress;
    h.setViagemId(43); await click(); await flush(); assert.equal(saved(h).length, 0); assert.match(texto(h), /execução da viagem mudou/); h.unmount();
});

test('desvio após passar perto recalcula incluindo o mesmo ponto não concluído', async () => {
    const dados = fixture('FIXA', 'IDA'), h = await start({ dados }); chegar(h, dados[1]);
    h.tick({ latitude: -9, longitude: -36 }); h.tick({ latitude: -9, longitude: -36 }, { advance: 7000 }); await flush();
    assert.deepEqual(h.direcoes.at(-1).slice(1), dados.slice(1).map(p => [p.longitude, p.latitude])); assert.equal(saved(h).length, 0); h.unmount();
});

test('conclusão aguardando consulta não avança depois de sair do mapa', async () => {
    let aguardar = false, concluir;
    const dados = fixture('FIXA', 'IDA'), h = await start({ dados, panelHandler: p => !aguardar ? Response.json(p) : new Promise(resolve => { concluir = () => resolve(Response.json(p)); }) });
    const click = chegar(h, dados[1]).props.onPress; aguardar = true; click(); await flush(); h.blur(); concluir(); await flush();
    assert.equal(saved(h).length, 0);
    h.tick(dados[1]); h.tick(dados[1]); h.focus(); assert.equal(botao(h).props.disabled, true); h.unmount();
});

for (const mudanca of ['GPS distante', 'rede perdida', 'posição expirada']) test(`${mudanca} durante a consulta final impede a conclusão`, async () => {
    let aguardar = false, concluir;
    const dados = fixture('FIXA', 'IDA'), h = await start({ dados, panelHandler: p => !aguardar ? Response.json(p) : new Promise(resolve => { concluir = () => resolve(Response.json(p)); }) });
    const click = chegar(h, dados[1]).props.onPress; aguardar = true; click(); await flush();
    if (mudanca === 'GPS distante') h.tick({ latitude: -9, longitude: -36 });
    if (mudanca === 'rede perdida') h.setOnline(false);
    if (mudanca === 'posição expirada') h.advance(16000);
    concluir(); await flush(); assert.equal(saved(h).length, 0); assert.doesNotMatch(texto(h), /Parada concluída/); h.unmount();
});

test('recálculo anterior à correção operacional não oculta ponto reaberto', async () => {
    let concluir;
    const response = coords => Response.json({ code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: coords }, legs: coords.slice(1).map(() => ({ steps: [] })) }], waypoints: coords.map(location => ({ location })) });
    const dados = fixture('PORTA_A_PORTA', 'IDA'), h = await start({ dados, estados: { 11: 'EMBARCADO' },
        mapboxHandler: (coords, n) => n === 2 ? new Promise(resolve => { concluir = () => resolve(response(coords)); }) : response(coords) });
     await h.concluir(dados[1]);
    h.tick({ latitude: -9, longitude: -36 }); h.tick({ latitude: -9, longitude: -36 }, { advance: 7000 }); await flush();
    h.setEstado(11, 'AGUARDANDO'); await h.refresh(); assert.equal(saved(h).length, 0);
    concluir(); await flush();
    const geometryKey = r.chaveCacheRoteiro('geometria', { usuarioId: 'driver', turmaId: 7, viagemId: 42, sentido: 'IDA' });
    assert.deepEqual(JSON.parse(h.storage.get(geometryKey)).pendentes, r.validarRoteiroOperacional(dados).slice(1).map(p => p.chave));
    assert.match(texto(h), /Próxima parada: Endereço do sentido/); h.unmount();
});

test('validação do painel rejeita estados e versões desconhecidos em vez de liberar embarques', () => {
    const pontos = r.validarRoteiroOperacional(fixture('FIXA', 'IDA'));
    for (const alterar of [p => p.registros[0].estado = 'CONFIRMADO', p => p.registros[0].versao = -1, p => p.registros[0].id = 0]) {
        const p = painel(pontos); alterar(p); assert.throws(() => c.conferirPainelParadas(pontos, p, 42, 'IDA'));
    }
});

test('VOLTA conclui cada ponto explicitamente na sequência oficial, incluindo compartilhada, vazia e destino', async () => {
    const dados = fixture('FIXA', 'VOLTA'), h = await start({ dados, sentido: 'VOLTA', estados: { 11: 'NAO_EMBARCOU', 33: 'NAO_EMBARCOU', 44: 'NAO_EMBARCOU' } });
    const cacheKey = r.chaveCacheRoteiro('visitadas', { usuarioId: 'driver', turmaId: 7, viagemId: 42, sentido: 'VOLTA' });
    for (const [i, ponto] of dados.slice(1).entries()) {
        chegar(h, ponto); assert.equal(JSON.parse(h.storage.get(cacheKey) || '{"chaves":[]}').chaves.length, i);
        await botao(h).props.onPress(); await flush();
        assert.equal(JSON.parse(h.storage.get(cacheKey)).chaves.length, i + 1);
    }
    assert.deepEqual(JSON.parse(h.storage.get(cacheKey)).chaves, r.validarRoteiroOperacional(dados).slice(1).map(p => p.chave)); h.unmount();
});

test('IDA privada: confirmar todos os embarques navega ao destino sem segundo clique nem encerramento', async () => {
    const dados = fixture('PORTA_A_PORTA', 'IDA'), options = { dados, statusCampos: { modalidade: 'PRIVADA' } };
    const h = await start(options);
    await h.confirmar(11, 'EMBARCADO'); await h.refresh();
    assert.deepEqual(h.direcoes.at(-1).slice(1), [[dados[2].longitude, dados[2].latitude]]);
    assert.match(texto(h), /Destino final: IDA destino/);
    assert.equal(h.requests.some(url => /finalizar|encerrar/.test(url)), false);
    h.unmount();
    const retomada = await start({ ...options, estados: { 11: 'EMBARCADO' } });
    assert.deepEqual(retomada.direcoes[0].slice(1), [[dados[2].longitude, dados[2].latitude]]);
    assert.match(texto(retomada), /Destino final: IDA destino/);
    retomada.setEstado(11, 'AGUARDANDO'); await retomada.refresh();
    assert.deepEqual(retomada.direcoes.at(-1).slice(1), dados.slice(1).map(p => [p.longitude, p.latitude]));
    assert.match(texto(retomada), /Próxima parada: Endereço do sentido/); retomada.unmount();
});

test('VOLTA privada: embarque não conclui entrega; desembarque libera destino oficial', async () => {
    const dados = fixture('PORTA_A_PORTA', 'VOLTA');
    const h = await start({ dados, sentido: 'VOLTA', statusCampos: { modalidade: 'PRIVADA' } });
    await h.confirmar(11, 'EMBARCADO'); await h.refresh();
    assert.match(texto(h), /Próxima parada: Endereço do sentido/);
    assert.equal(nodes(h.render()).some(n => n.props.accessibilityLabel === 'Concluir parada'), false);
    await h.confirmar(11, 'DESEMBARCADO'); await h.refresh();
    assert.deepEqual(h.direcoes.at(-1).slice(1), [[dados[2].longitude, dados[2].latitude]]);
    assert.match(texto(h), /Destino final: VOLTA destino/);
    assert.equal(h.requests.some(url => /finalizar|encerrar/.test(url)), false);
    h.unmount();
});

test('IDA privada mantém paradas vazias e exige todos os passageiros de uma coleta compartilhada', async () => {
    const dados = fixture('PRIVADA_PARADAS', 'IDA');
    const h = await start({ dados, statusCampos: { modalidade: 'PRIVADA' }, estados: { 11: 'EMBARCADO' } });
    assert.match(texto(h), /Próxima parada: Sem reservas/);
    await h.concluir(dados[1]); await h.refresh();
    assert.match(texto(h), /Próxima parada: Embarque compartilhado/);
    await h.confirmar(33, 'NAO_EMBARCOU'); await h.refresh();
    assert.match(texto(h), /Destino final: IDA destino/);
    assert.deepEqual(h.direcoes.at(-1).slice(1), [[dados[3].longitude, dados[3].latitude]]);
    h.unmount();
});

test('mapa privado confirma embarque diretamente e finaliza IDA em uma única ação na chegada', async () => {
    const dados = fixture('PORTA_A_PORTA', 'IDA');
    const h = await start({ dados, statusCampos: { modalidade: 'PRIVADA' } });
    const button = nodes(h.render()).find(n => n.props.accessibilityLabel === 'Confirmar embarque: Pessoa 11');
    assert.ok(button); assert.equal(h.paths.length, 0);
    await button.props.onPress(); await flush();
    assert.equal(h.official.registros[0].estado, 'EMBARCADO');
    assert.match(texto(h), /Destino final: IDA destino/);
    assert.equal(nodes(h.render()).some(n => n.props.accessibilityLabel === 'Concluir parada'), false);
    assert.equal(nodes(h.render()).some(n => n.props.accessibilityLabel === 'Configurações de passageiros'), true);
    const encerrar = () => nodes(h.render()).find(n => n.type === 'Controls').props.onEncerrarViagem();
    await encerrar();
    assert.equal(h.alerts.at(-1)[0], 'Chegue ao destino');
    assert.equal(h.requests.some(url => url.endsWith('/concluir-ida')), false);
    h.tick(dados[2]); h.tick(dados[2]); h.render();
    await encerrar();
    assert.equal(h.alerts.at(-1)[0], 'Encerrar Viagem');
    await h.alerts.at(-1)[2].find(b => b.style === 'destructive').onPress();
    await flush();
    assert.equal(h.requests.filter(url => url.endsWith('/concluir-ida')).length, 1);
    assert.equal(h.official.registros[0].estado, 'DESEMBARCADO');
    h.unmount();
});

test('mapa privado VOLTA confirma desembarque individual sem encerrar a viagem', async () => {
    const dados = fixture('PORTA_A_PORTA', 'VOLTA');
    const h = await start({ dados, sentido: 'VOLTA', estados: { 11: 'EMBARCADO' }, statusCampos: { modalidade: 'PRIVADA' } });
    const button = nodes(h.render()).find(n => n.props.accessibilityLabel === 'Confirmar desembarque: Pessoa 11');
    assert.ok(button); await button.props.onPress(); await flush();
    assert.equal(h.official.registros[0].estado, 'DESEMBARCADO');
    assert.match(texto(h), /Destino final: VOLTA destino/);
    assert.equal(h.requests.some(url => url.endsWith('/concluir-ida')), false);h.unmount();
});
