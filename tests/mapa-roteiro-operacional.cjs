const { test } = require('node:test'), assert = require('node:assert/strict');
const { load, fixture, painel } = require('./helpers/roteiro.cjs');
const r = load('src/services/roteiroNavegacao.ts');
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };

function harness({ dados = fixture('FIXA', 'IDA'), sentido = 'IDA', viagemId = 42, storage = new Map(), roteiroStatus = 200, mapboxStatus = 200, incomplete = false, mapboxHandler } = {}) {
    const slots = [], dependencies = [], cleanups = [], requests = [], direcoes = [], alerts = [];
    let cursor = 0, effects = [], location, now = 100000;
    const react = {
        useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
        useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
        useEffect: (fn, deps) => { const i = cursor++; if (!dependencies[i] || deps.some((v, j) => !Object.is(v, dependencies[i][j]))) effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); dependencies[i] = deps; },
        useMemo: fn => fn(), useCallback: fn => fn,
    };
    const request = async (url, options) => {
        requests.push(url);
        if (url.startsWith('https://api.mapbox.com/')) {
            const coords = url.split('/driving/')[1].split('?')[0].split(';').map(p => p.split(',').map(Number));
            direcoes.push(coords);
            if (mapboxHandler) return mapboxHandler(coords, direcoes.length);
            if (mapboxStatus !== 200) return Response.json({ message: 'Mapbox indisponível' }, { status: mapboxStatus });
            return Response.json({ code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: coords }, legs: coords.slice(1).map(() => ({ steps: [] })) }],
                waypoints: (incomplete ? coords.slice(1) : coords).map(location => ({ location })) });
        }
        assert.equal(options.headers.get('Authorization'), 'Bearer token-teste');
        if (url.endsWith('/turmas/motorista/driver')) return Response.json([{ id: 7, origemLatitude: 0, origemLongitude: 0, destinoLatitude: 0, destinoLongitude: 0 }]);
        if (url.endsWith('/rota/status-atual?turmaId=7')) return Response.json({ status: 'ATIVA', sentido, viagemId });
        if (url.endsWith(`/operacoes/VIAGEM/${viagemId}/roteiro`)) return Response.json(roteiroStatus === 200 ? dados : { erro: 'Snapshot indisponível' }, { status: roteiroStatus });
        if (url.endsWith(`/operacoes/VIAGEM/${viagemId}`)) return Response.json(painel(dados, viagemId, sentido));
        throw Error('Consulta indevida: ' + url);
    };
    const api = load('src/config/api.ts', {
        './config': { API_URL: 'https://api.test' }, './firebase': { auth: { authStateReady: async () => {}, currentUser: { getIdToken: async () => 'token-teste' } } },
    }, { fetch: request });
    const service = load('src/services/roteiroOperacional.ts', { '../config/api': api, './roteiroNavegacao': r });
    const jsx = (type, props) => ({ type, props });
    const module = load('src/app/mapa.tsx', {
        react, 'react/jsx-runtime': { jsx, jsxs: jsx },
        'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'Spinner', TouchableOpacity: 'Button', StatusBar: 'StatusBar', Linking: {}, StyleSheet: { create: x => x } },
        '@expo/vector-icons': { Ionicons: 'Icon' },
        '@react-native-async-storage/async-storage': { __esModule: true, default: {
            getItem: async k => storage.get(k) ?? null, setItem: async (k, v) => { storage.set(k, v); }, removeItem: async k => { storage.delete(k); },
        } },
        '@react-native-community/netinfo': { __esModule: true, default: { addEventListener: () => () => {} } },
        '@rnmapbox/maps': { __esModule: true, default: { setAccessToken() {}, StyleURL: { Dark: 'dark' }, MapView: 'Map', Camera: 'Camera', ShapeSource: 'Shape', CircleLayer: 'Circle', SymbolLayer: 'Symbol', PointAnnotation: 'Annotation', LineLayer: 'Line' } },
        'expo-location': { Accuracy: { High: 1, BestForNavigation: 2 }, getCurrentPositionAsync: async () => ({ coords: { latitude: -8.6, longitude: -35.6 } }), watchPositionAsync: async (_, fn) => { location = fn; return { remove() {} }; } },
        'expo-router': { useLocalSearchParams: () => ({ turmaId: '7', sentido: 'ida', rotaId: '999' }), useRouter: () => ({ replace() {} }) },
        'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
        '../contexts/AppAlertContext': { useAppAlert: () => ({ alert: (...args) => alerts.push(args) }) },
        '../contexts/AuthContext': { useAuth: () => ({ user: { id: 'driver' } }) },
        '../config/config': { API_URL: 'https://api.test' }, '../config/api': api,
        '../components/AsyncState': { AsyncState: 'AsyncState' },
        '../services/asyncOperation': { withDeadline: fn => fn() },
        '../services/location': { validCoordinates: (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) },
        '../services/navigationLocation': { ensureNavigationLocation: async () => true, NavigationLocationError: class extends Error {} },
        '../services/viagens': { encerrarViagem: async () => {} },
        '../services/roteiroNavegacao': r, '../services/roteiroOperacional': service,
        '../services/telemetria': { createPositionSender: () => ({ send: async () => false, cancel() {} }) },
        '../styles/theme': load('src/styles/theme.ts'),
        '../components/mapa/CabecalhoMapa': { CabecalhoMapa: 'Header' },
        '../components/mapa/ControlesViagem': { ControlesViagem: 'Controls' },
        '../components/mapa/PainelManobra': { PainelManobra: 'Maneuver' },
    }, { process: { env: { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'mapbox-teste' } }, fetch: request,
        Date: class extends Date { static now() { return now; } }, setInterval: () => 1, clearInterval() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    return { storage, requests, direcoes, alerts,
        render: () => { cursor = 0; effects = []; const tree = module.default(); effects.forEach(fn => fn()); return tree; },
        tick: (p, { accuracy = 5, speed = 0, advance = 2000 } = {}) => { now += advance; location({ coords: { ...p, accuracy, speed }, timestamp: now }); },
        unmount: () => cleanups.forEach(fn => fn?.()),
    };
}

for (const modalidade of ['PORTA_A_PORTA', 'PRIVADA_PARADAS', 'FIXA', 'FLEXIVEL']) for (const sentido of ['IDA', 'VOLTA']) {
    test(`mapa integrado ${modalidade} ${sentido} usa snapshot completo e extremos oficiais`, async () => {
        const dados = fixture(modalidade, sentido), h = harness({ dados, sentido });
        h.render(); await flush(); const tree = h.render();
        assert.equal(nodes(tree).some(n => n.type === 'Map'), true);
        assert.deepEqual(h.direcoes[0].slice(1), dados.map(p => [p.longitude, p.latitude]));
        const features = nodes(tree).find(n => n.type === 'Shape' && n.props.id === 'pontosOperacionaisSource').props.shape.features;
        assert.equal(features.length, dados.length);
        assert.deepEqual(Array.from(features, p => p.properties.paradaId), dados.map(p => p.paradaId));
        assert.equal(nodes(tree).find(n => n.type === 'Header').props.direcaoAtual, sentido.toLowerCase());
        assert.equal(h.requests.some(url => /otimizar|rotas-publicas|coleta/.test(url)), false);
        h.unmount();
    });
}

test('visita por ponto inclui origem, parada vazia e compartilhada; retoma execução sem esconder passageiros', async () => {
    const dados = fixture('FIXA', 'IDA'), h = harness({ dados });
    h.render(); await flush(); h.render();
    h.tick(dados[0], { accuracy: 100 }); h.tick(dados[0], { speed: 20 }); await flush();
    assert.equal([...h.storage.keys()].some(k => k.includes('visitadas')), false);
    for (const [i, p] of dados.slice(0, 3).entries()) {
        h.tick(p); h.tick(p); await flush(); const tree = h.render();
        if (i === 1) assert.equal(nodes(tree).some(n => typeof n.props.children === 'string' && n.props.children.includes('Passageiros (2): Pessoa 11, Pessoa 33')), true);
    }
    const key = r.chaveCacheRoteiro('visitadas', { usuarioId: 'driver', turmaId: 7, viagemId: 42, sentido: 'IDA' });
    const cache = JSON.parse(h.storage.get(key));
    assert.deepEqual(cache.chaves, r.validarRoteiroOperacional(dados).slice(0, 3).map(p => p.chave));
    h.unmount();
    const retomada = harness({ dados, storage: h.storage }); retomada.render(); await flush();
    assert.deepEqual(retomada.direcoes[0].slice(1), dados.slice(3).map(p => [p.longitude, p.latitude]));
    for (const p of dados.slice(3)) { retomada.tick(p); retomada.tick(p); await flush(); retomada.render(); }
    assert.deepEqual(JSON.parse(h.storage.get(key)).chaves, r.validarRoteiroOperacional(dados).map(p => p.chave));
    retomada.unmount();
    const nova = harness({ dados, viagemId: 43, storage: h.storage }); nova.render(); await flush();
    assert.deepEqual(nova.direcoes[0].slice(1), dados.map(p => [p.longitude, p.latitude])); nova.unmount();
});

test('recalcular após desvio preserva sequência de todos os pontos pendentes', async () => {
    const dados = fixture('FLEXIVEL', 'VOLTA'), h = harness({ dados, sentido: 'VOLTA' });
    h.render(); await flush(); h.render();
    h.tick(dados[0]); h.tick(dados[0]); await flush(); h.render();
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
    h.render(); await flush(); h.render(); h.tick(dados[0]); h.tick(dados[0]); await flush(); h.render();
    h.tick({ latitude: -9, longitude: -36 }); h.tick({ latitude: -9, longitude: -36 }, { advance: 7000 }); await flush();
    assert.equal(typeof concluir, 'function');
    h.tick(dados[1]); h.tick(dados[1]); await flush(); h.render(); concluir(); await flush();
    const tree = h.render();
    assert.equal(nodes(tree).some(n => n.type === 'Text' && typeof n.props.children === 'string' && n.props.children.includes('Passageiros (2): Pessoa 11, Pessoa 33')), true);
    h.unmount();
});
