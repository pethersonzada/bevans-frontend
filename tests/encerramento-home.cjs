const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/roteiro.cjs');
const { nodes, flush } = require('./helpers/mapa.cjs');
const roteiro = load('src/services/roteiroNavegacao.ts');
const ativa = (viagemId = 42) => ({ status: 'ATIVA', viagemId, sentido: 'IDA' });
const adiar = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function harness({ inicial = ativa(), encerrar, consultar, storageFailure = false } = {}) {
    const slots = [], effects = [], alerts = [], requests = [], paths = [], removed = [];
    const storage = new Map([['@vanbora:viagem_ativa_driver', 'true'], ['@vanbora:viagem_ativa', 'legado'],
        ['@bevans:turma_selecionada:driver', '7'], ['sessao', 'preservar']]);
    const cache = (usuarioId, turmaId, viagemId, sentido, tipo) => roteiro.chaveCacheRoteiro(tipo, { usuarioId, turmaId, viagemId, sentido });
    for (const usuarioId of ['driver', 'outro']) for (const turmaId of [7, 8]) for (const viagemId of [42, 43])
        for (const sentido of ['IDA', 'VOLTA']) for (const tipo of ['geometria', 'visitadas'])
            storage.set(cache(usuarioId, turmaId, viagemId, sentido, tipo), 'cache');
    let cursor = 0, state = inicial, refresh, focusCleanup, appState, reads = 0;
    const react = {
        useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
        useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
        useMemo: fn => fn(), useCallback: fn => fn,
    };
    const api = load('src/config/api.ts', {
        './config': { API_URL: 'https://api.test' },
        './firebase': { auth: { authStateReady: async () => {}, currentUser: { getIdToken: async () => 'token-teste' } } },
    }, { fetch: async (url, options) => {
        assert.equal(options.headers.get('Authorization'), 'Bearer token-teste');
        requests.push({ url, method: options.method || 'GET' });
        if (url.includes('/rota/status-atual?')) {
            reads++;
            return consultar ? consultar({ reads, state, url }) : Response.json(state);
        }
        if (url.endsWith('/rota/encerrar?turmaId=7')) {
            if (encerrar) return encerrar({ setState: value => { state = value; }, ApiError: api.ApiError });
            state = { status: 'INATIVA' }; return new Response(null, { status: 204 });
        }
        throw Error('Consulta indevida: ' + url);
    } });
    const viagens = load('src/services/viagens.ts', { '../config/api': api });
    const jsx = (type, props) => ({ type, props });
    const module = load('src/app/home-motorista.tsx', {
        react, 'react/jsx-runtime': { jsx, jsxs: jsx },
        'react-native': { ActivityIndicator: 'Spinner', AppState: { addEventListener: (_, fn) => { appState = fn; return { remove() {} }; } },
            Pressable: 'Button', RefreshControl: 'Refresh', ScrollView: 'Scroll', StatusBar: 'StatusBar', StyleSheet: { create: x => x }, Text: 'Text', TouchableOpacity: 'Button', View: 'View' },
        '@expo/vector-icons': { Ionicons: 'Icon' },
        '@react-native-async-storage/async-storage': { __esModule: true, default: {
            getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value),
            removeItem: async key => { removed.push(key); storage.delete(key); },
            multiRemove: async keys => { if (storageFailure) throw Error('Armazenamento indisponível'); for (const key of keys) { removed.push(key); storage.delete(key); } },
        } },
        'expo-router': { useRouter: () => ({ push: p => paths.push(p) }), useFocusEffect: fn => { if (!effects.length) { effects.push(fn); focusCleanup = fn(); } } },
        '../components/AppModal': { AppModal: 'Modal' },
        '../contexts/AppAlertContext': { useAppAlert: () => ({ alert: (...args) => alerts.push(args) }) },
        '../hooks/useHomeRefresh': { useHomeRefresh: (_, fn) => { refresh = fn; return { refreshing: false, refresh: fn }; } },
        '../services/motoristaHome': { fetchTurmasMotorista: async () => [{ id: 7, nome: 'Antiga' }, { id: 8, nome: 'Outra' }], fetchPassageirosTurma: async () => [], fetchSolicitacoesTurma: async () => [] },
        '../services/viagens': viagens, '../services/roteiroNavegacao': roteiro, '../config/api': api,
        '../components/AsyncState': { AsyncState: 'AsyncState' }, '../contexts/AuthContext': { useAuth: () => ({ user: { id: 'driver', nome: 'Motorista' } }) },
        '../styles/theme': load('src/styles/theme.ts'), '../components/banners/BannerRotaAtiva': { BannerRotaAtiva: 'Banner' },
        '../components/cards/CardsTurmasMotorista': { CardsTurmasMotorista: 'Turmas' },
        '../components/motorista/BotoesAcaoMotorista': { BotoesAcaoMotorista: 'Partida' },
        '../components/motorista/HeaderMotorista': { HeaderMotorista: 'Header' },
        '../components/motorista/PainelTurmaSelecionada': { PainelTurmaSelecionada: 'Painel' },
    }, { console: { error() {}, log() {} } });
    const render = () => { cursor = 0; return module.default(); };
    const button = () => nodes(render()).find(n => n.props.accessibilityLabel === 'Encerrar viagem ativa');
    const confirm = () => alerts.findLast(a => a[0] === 'Encerrar viagem ativa?')[2].find(b => b.style === 'destructive').onPress();
    return { alerts, requests, paths, storage, removed, cache, render, button, confirm,
        mount: async () => { render(); await refresh(); return render(); }, refresh: () => refresh(),
        setState: value => { state = value; }, blur: () => focusCleanup(), background: () => appState('background'),
        posts: () => requests.filter(r => r.method === 'POST'),
    };
}

test('Home encerra viagem antiga autenticada sem mapa, snapshot ou painel operacional e limpa somente sua execução', async () => {
    const h = harness(); await h.mount();
    const before = new Map(h.storage);
    h.button().props.onPress();
    assert.equal(h.posts().length, 0);
    assert.match(h.alerts[0][1], /interrompe o acompanhamento/);
    assert.match(h.alerts[0][1], /passageiros embarcados/);
    await h.confirm();
    assert.equal(h.posts().length, 1);
    assert.equal(h.requests.at(-1).url, 'https://api.test/rota/status-atual?turmaId=7');
    assert.equal(h.button(), undefined);
    assert.equal(nodes(h.render()).some(n => n.type === 'Banner'), false);
    assert.equal(nodes(h.render()).find(n => n.type === 'Partida').props.viagemAtiva, false);
    assert.equal(h.paths.length, 0);
    const expected = [...before.keys()].filter(k => k.includes(':driver:7:42:') || k === '@vanbora:viagem_ativa_driver');
    assert.deepEqual(h.removed.sort(), expected.sort());
    for (const [key, value] of before) if (!expected.includes(key)) assert.equal(h.storage.get(key), value);
    assert.ok(h.requests.every(r => /\/rota\/(status-atual|encerrar)\?/.test(r.url)));
});

for (const inicial of [{ status: 'INATIVA' }, { status: 'EM_CURSO', viagemId: 42, ativa: true }, { ativa: true }, { status: 'ATIVA' }])
    test(`ação exige status oficial ATIVA e identificador válido: ${JSON.stringify(inicial)}`, async () => {
        const h = harness({ inicial }); await h.mount(); assert.equal(h.button(), undefined); assert.equal(h.posts().length, 0);
    });

test('cliques duplos e partida concorrente não repetem alerta nem requisição; trava permanece até releitura', async () => {
    const pending = adiar(), readback = adiar();
    const h = harness({ encerrar: async () => { await pending.promise; return new Response(null, { status: 204 }); },
        consultar: ({ reads, state }) => reads === 3 ? readback.promise : Response.json(state) });
    await h.mount(); const button = h.button(); button.props.onPress(); button.props.onPress();
    assert.equal(h.alerts.length, 1); assert.equal(h.button().props.disabled, true);
    const primeira = h.confirm(), segunda = h.confirm(); await flush();
    await nodes(h.render()).find(n => n.type === 'Partida').props.onIniciarRota('IDA');
    assert.equal(h.posts().length, 1); assert.equal(h.alerts.length, 1);
    pending.resolve(); await flush(); assert.equal(h.button().props.accessibilityState.busy, true);
    readback.resolve(Response.json({ status: 'INATIVA' })); await Promise.all([primeira, segunda]);
    assert.equal(h.posts().length, 1); assert.equal(h.button(), undefined);
});

test('bloqueio do backend por passageiro embarcado mantém viagem e cache, preserva erro e relê status', async () => {
    const message = 'Há passageiros embarcados. Registre os desembarques antes de encerrar.';
    const h = harness({ encerrar: async () => Response.json({ erro: message }, { status: 409 }) });
    await h.mount(); const before = new Map(h.storage); h.button().props.onPress(); await h.confirm();
    assert.equal(h.alerts.at(-1)[1], message);
    assert.equal(h.button().props.disabled, false); assert.deepEqual(h.storage, before);
    assert.equal(h.requests.at(-1).method, 'GET'); assert.equal(h.posts().length, 1);
});

for (const commit of [false, true]) test(`timeout preserva mensagem e usa estado oficial para decidir limpeza (confirmado=${commit})`, async () => {
    const h = harness({ encerrar: async ({ setState, ApiError }) => { if (commit) setState({ status: 'INATIVA' }); throw new ApiError('Tempo limite no encerramento', 'timeout'); } });
    await h.mount(); h.button().props.onPress(); await h.confirm();
    assert.match(h.alerts.at(-1)[1], /Tempo limite/); assert.equal(Boolean(h.button()), !commit);
    assert.equal(h.removed.length > 0, commit); assert.equal(h.posts().length, 1);
});

test('releitura indisponível não anuncia sucesso nem limpa cache; atualizar recupera a ação', async () => {
    const h = harness({ consultar: ({ reads, state }) => reads === 3 ? Response.json({ erro: 'Status temporariamente indisponível' }, { status: 503 }) : Response.json(state),
        encerrar: async () => new Response(null, { status: 204 }) });
    await h.mount(); const before = new Map(h.storage); h.button().props.onPress(); await h.confirm();
    assert.equal(h.alerts.at(-1)[0], 'Encerramento não confirmado');
    assert.match(h.alerts.at(-1)[1], /Status temporariamente indisponível/);
    assert.deepEqual(h.storage, before); assert.equal(h.button(), undefined);
    assert.match(nodes(h.render()).find(n => n.type === 'AsyncState').props.message, /Status temporariamente indisponível/);
    await h.refresh(); assert.ok(h.button());
});

test('status ainda ativo após resposta de sucesso mantém cache e não anuncia encerramento', async () => {
    const h = harness({ encerrar: async () => new Response(null, { status: 204 }) });
    await h.mount(); h.button().props.onPress(); await h.confirm();
    assert.equal(h.alerts.at(-1)[0], 'Encerramento não confirmado'); assert.ok(h.button()); assert.equal(h.removed.length, 0);
});

test('troca de execução antes de confirmar não encerra outra viagem', async () => {
    const h = harness(); await h.mount(); h.button().props.onPress(); h.setState(ativa(43)); await h.confirm();
    assert.equal(h.posts().length, 0); assert.equal(h.alerts.at(-1)[0], 'A viagem mudou'); assert.equal(h.removed.length, 0);
});

test('nova execução na releitura mantém banner e caches novos ao limpar a viagem anterior', async () => {
    const h = harness({ encerrar: async ({ setState }) => { setState(ativa(43)); return new Response(null, { status: 204 }); } });
    await h.mount(); h.button().props.onPress(); await h.confirm();
    assert.ok(h.button()); assert.equal(h.removed.length, 4);
    assert.ok(h.removed.every(k => k.includes(':driver:7:42:')));
    assert.equal(h.storage.get('@vanbora:viagem_ativa_driver'), 'true');
    assert.equal(h.storage.get(h.cache('driver', 7, 43, 'IDA', 'geometria')), 'cache');
});

test('leitura anterior atrasada não restaura viagem já encerrada', async () => {
    const pending = adiar();
    const h = harness({ consultar: ({ reads, state }) => reads === 2 ? pending.promise : Response.json(state) });
    await h.mount(); const refresh = h.refresh(); await flush(); h.button().props.onPress(); await h.confirm();
    pending.resolve(Response.json(ativa())); await refresh;
    assert.equal(h.button(), undefined); assert.equal(nodes(h.render()).some(n => n.type === 'Banner'), false);
});

test('cancelar libera a ação sem enviar encerramento', async () => {
    const h = harness(); await h.mount(); h.button().props.onPress(); h.alerts[0][2][0].onPress();
    assert.equal(h.button().props.disabled, false); assert.equal(h.posts().length, 0);
    h.button().props.onPress(); await h.confirm(); assert.equal(h.posts().length, 1);
});

test('confirmação de partida pendente impede encerramento concorrente', async () => {
    const h = harness(); await h.mount();
    await nodes(h.render()).find(n => n.type === 'Partida').props.onIniciarRota('VOLTA');
    h.button().props.onPress();
    assert.equal(h.alerts.length, 1); assert.equal(h.alerts[0][0], 'Substituir viagem ativa?');
    assert.equal(h.posts().length, 0);
    h.alerts[0][2][0].onPress(); h.button().props.onPress(); await h.confirm();
    assert.equal(h.posts().length, 1);
});

test('falha ao conferir viagem antes do envio exibe causa sem encerrar nem limpar cache', async () => {
    const h = harness({ consultar: ({ reads, state }) => reads === 2
        ? Response.json({ erro: 'Sem permissão para consultar a viagem' }, { status: 403 }) : Response.json(state) });
    await h.mount(); h.button().props.onPress(); await h.confirm();
    assert.equal(h.posts().length, 0); assert.equal(h.removed.length, 0);
    assert.equal(h.alerts.at(-1)[1], 'Sem permissão para consultar a viagem');
    assert.equal(h.button(), undefined);
});

for (const action of ['blur', 'background']) test(`confirmação obsoleta após ${action} não envia encerramento`, async () => {
    const h = harness(); await h.mount(); h.button().props.onPress(); h[action](); await h.confirm(); assert.equal(h.posts().length, 0);
});

test('mudança de turma invalida confirmação e não limpa dados de outra turma', async () => {
    const h = harness(); await h.mount(); h.button().props.onPress();
    await nodes(h.render()).find(n => n.type === 'Turmas').props.onSelecionarTurma({ id: 8, nome: 'Outra' });
    await h.confirm(); assert.equal(h.posts().length, 0); assert.equal(h.removed.length, 0);
});

test('falha na limpeza local preserva estado oficial encerrado e informa a causa', async () => {
    const h = harness({ storageFailure: true }); await h.mount(); h.button().props.onPress(); await h.confirm();
    assert.equal(h.button(), undefined); assert.ok(h.alerts.some(a => a[1] === 'Armazenamento indisponível'));
    assert.equal(h.posts().length, 1);
});
