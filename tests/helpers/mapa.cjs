const assert = require('node:assert/strict');
const { load, fixture, painel } = require('./roteiro.cjs');
const r = load('src/services/roteiroNavegacao.ts');
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };

function harness({ dados = fixture('FIXA', 'IDA'), sentido = 'IDA', viagemId = 42, storage = new Map(), roteiroStatus = 200, mapboxStatus = 200, incomplete = false, mapboxHandler, estados = {}, panelHandler, storageFailure = false, params = {}, statusCampos = {} } = {}) {
    const slots = [], dependencies = [], cleanups = [], requests = [], direcoes = [], alerts = [];
    let cursor = 0, effects = [], location, now = 100000, network, poll, focusTask, focusCleanup;
    let painelStatus = 200, confirmacaoStatus = 200, statusViagemId = viagemId;
    const official = painel(dados, viagemId, sentido), paths = [];
    for (const registro of official.registros) registro.estado = estados[registro.alunoId] || 'AGUARDANDO';
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
        if (url.endsWith('/rotas-publicas/minhas')) return Response.json([{id:999,turmaId:7}]);
        if (url.endsWith('/turmas/motorista/driver')) return Response.json([{ id: 7, origemLatitude: 0, origemLongitude: 0, destinoLatitude: 0, destinoLongitude: 0 }]);
        if (url.endsWith('/rota/status-atual?turmaId=7')) return Response.json({ status: 'ATIVA', sentido, viagemId: statusViagemId, ...statusCampos });
        if (url.endsWith(`/operacoes/VIAGEM/${viagemId}/roteiro`)) return Response.json(roteiroStatus === 200 ? dados : { erro: 'Snapshot indisponível' }, { status: roteiroStatus });
        if (url.endsWith(`/operacoes/VIAGEM/${viagemId}`)) return panelHandler ? panelHandler(official) : Response.json(painelStatus === 200 ? official : { erro: 'Confirmação indisponível' }, { status: painelStatus });
        const registroId = url.match(/\/passageiros\/(\d+)\/estado$/)?.[1];
        if (registroId) {
            if (confirmacaoStatus !== 200) return Response.json({ erro: 'Falha na confirmação' }, { status: confirmacaoStatus });
            const body = JSON.parse(options.body), registro = official.registros.find(r => r.id === Number(registroId));
            if (body.versao !== registro.versao) return Response.json({ erro: 'Versão alterada' }, { status: 409 });
            registro.estado = body.estado; registro.versao++; return Response.json(registro);
        }
        throw Error('Consulta indevida: ' + url);
    };
    const api = load('src/config/api.ts', {
        './config': { API_URL: 'https://api.test' }, './firebase': { auth: { authStateReady: async () => {}, currentUser: { getIdToken: async () => 'token-teste' } } },
    }, { fetch: request });
    const service = load('src/services/roteiroOperacional.ts', { '../config/api': api, './roteiroNavegacao': r });
    const conclusao = load('src/services/conclusaoParada.ts', { './roteiroNavegacao': r });
    const operacoes = load('src/services/operacoes.ts', { '../config/api': api, './catalogo': { recursoId: Number } });
    const jsx = (type, props) => ({ type, props });
    const module = load('src/app/mapa.tsx', {
        react, 'react/jsx-runtime': { jsx, jsxs: jsx },
        'react-native': { View: 'View', ScrollView: 'Scroll', Text: 'Text', ActivityIndicator: 'Spinner', TouchableOpacity: 'Button', StatusBar: 'StatusBar', Linking: {}, StyleSheet: { create: x => x } },
        '@expo/vector-icons': { Ionicons: 'Icon' },
        '@react-native-async-storage/async-storage': { __esModule: true, default: {
            getItem: async k => storage.get(k) ?? null, setItem: async (k, v) => { if (storageFailure && k.includes('visitadas')) throw Error('Falha ao salvar conclusão'); storage.set(k, v); }, removeItem: async k => { storage.delete(k); },
        } },
        '@react-native-community/netinfo': { __esModule: true, default: { addEventListener: fn => { network = fn; return () => {}; } } },
        '@rnmapbox/maps': { __esModule: true, default: { setAccessToken() {}, StyleURL: { Dark: 'dark' }, MapView: 'Map', Camera: 'Camera', ShapeSource: 'Shape', CircleLayer: 'Circle', SymbolLayer: 'Symbol', PointAnnotation: 'Annotation', LineLayer: 'Line' } },
        'expo-location': { Accuracy: { High: 1, BestForNavigation: 2 }, getCurrentPositionAsync: async () => ({ coords: { latitude: -8.6, longitude: -35.6 } }), watchPositionAsync: async (_, fn) => { location = fn; return { remove() {} }; } },
        'expo-router': { useLocalSearchParams: () => ({ turmaId: '7', sentido: 'ida', ...params }), useRouter: () => ({ replace() {}, push: p => paths.push(p) }), useFocusEffect: fn => { if (!focusTask) { focusTask = fn; focusCleanup = fn(); } } },
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
        '../services/conclusaoParada': conclusao, '../services/operacoes': operacoes,
        '../hooks/useFocusedPolling': { useFocusedPolling: task => { poll = task; } },
        '../services/telemetria': { createPositionSender: () => ({ send: async () => false, cancel() {} }) },
        '../styles/theme': load('src/styles/theme.ts'),
        '../components/mapa/CabecalhoMapa': { CabecalhoMapa: 'Header' },
        '../components/mapa/ControlesViagem': { ControlesViagem: 'Controls' },
        '../components/mapa/PainelManobra': { PainelManobra: 'Maneuver' },
    }, { process: { env: { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'mapbox-teste' } }, fetch: request,
        Date: class extends Date { static now() { return now; } }, setInterval: () => 1, clearInterval() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const render = () => { cursor = 0; effects = []; const tree = module.default(); effects.forEach(fn => fn()); return tree; };
    const tick = (p, { accuracy = 5, speed = 0, advance = 2000, timestamp } = {}) => { now += advance; location({ coords: { ...p, accuracy, speed }, timestamp: timestamp ?? now }); };
    return { storage, requests, direcoes, alerts, paths, official, render, tick,
        refresh: async () => { await poll(new AbortController().signal); await flush(); },
        setEstado: (alunoId, estado) => { const r = official.registros.find(r => r.alunoId === alunoId); r.estado = estado; r.versao++; },
        setPainelError: status => { painelStatus = status; }, setConfirmationError: status => { confirmacaoStatus = status; },
        confirmar: (alunoId, estado) => operacoes.alterarEstadoOperacional('VIAGEM', String(viagemId), official.registros.find(r => r.alunoId === alunoId), true, estado),
        setViagemId: id => { statusViagemId = id; }, setOnline: value => network({ isConnected: value, isInternetReachable: value }),
        advance: ms => { now += ms; }, blur: () => focusCleanup?.(), focus: () => { focusCleanup = focusTask(); },
        concluir: async p => { tick(p); tick(p); const botao = nodes(render()).find(n => n.props.accessibilityLabel === 'Concluir parada'); assert.equal(botao.props.disabled, false); await botao.props.onPress(); await flush(); return render(); },
        unmount: () => { focusCleanup?.(); cleanups.forEach(fn => fn?.()); },
    };
}

module.exports = { harness, nodes, flush, r };
