const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(code, { exports, Headers, Response, AbortController, setTimeout, clearTimeout, Error, require: name => {
        if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
        return mocks[name];
    }, ...globals });
    return exports;
}

function componentHarness(file, name, extraMocks = {}) {
    const slots = [];
    const dependencies = [];
    const cleanups = new Map();
    let cursor = 0, effects = [];
    const react = {
        createContext: () => ({ Provider: 'Provider' }),
        useMemo: factory => factory(),
        useCallback: callback => callback,
        useState(initial) {
            const i = cursor++;
            if (!(i in slots)) slots[i] = initial;
            return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
        },
        useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
        useEffect(effect, next) {
            const i = cursor++;
            if (!dependencies[i] || next.some((value, j) => value !== dependencies[i][j])) effects.push(() => {
                cleanups.get(i)?.();
                const cleanup = effect();
                if (typeof cleanup === 'function') cleanups.set(i, cleanup);
            });
            dependencies[i] = next;
        },
    };
    const element = (type, props) => ({ type, props });
    const theme = load('src/styles/theme.ts', {}).theme;
    const module = load(file, {
        react, 'react/jsx-runtime': { jsx: element, jsxs: element },
        'react-native': { StyleSheet: { create: value => value }, Text: 'Text', View: 'View', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner' },
        '@expo/vector-icons': { Ionicons: 'Icon' },
        '../styles/theme': { theme }, '../../styles/theme': { theme },
        '../config/api': { errorMessage: error => error instanceof Error ? error.message : 'Falha na operação.' },
        '../AsyncState': { AsyncState: 'AsyncState' },
        '../../contexts/AppAlertContext': { useAppAlert: () => ({ alert() {} }) },
        ...extraMocks,
    });
    const render = props => {
        cursor = 0; effects = [];
        const tree = module[name](props);
        effects.forEach(effect => effect());
        return tree;
    };
    render.unmount = () => { cleanups.forEach(cleanup => cleanup()); cleanups.clear(); };
    return render;
}

function elements(tree) {
    if (!tree || typeof tree !== 'object') return [];
    return [tree, ...[tree.props?.children].flat(Infinity).flatMap(elements)];
}

function logoutHarness() {
    const theme = load('src/styles/theme.ts', {}).theme;
    let back, appState;
    const render = componentHarness('src/components/LogoutConfirmation.tsx', 'LogoutConfirmation', {
        './FormFeedback': { FormFeedback: 'FormFeedback' },
        'react-native': {
            StyleSheet: { create: value => value }, Text: 'Text', View: 'View', Pressable: 'Button', ActivityIndicator: 'Spinner',
            Alert: { alert: () => assert.fail('Logout must not call Android native Alert') },
            BackHandler: { addEventListener: (_, callback) => { back = callback; return { remove() {} }; } },
            AppState: { addEventListener: (_, callback) => { appState = callback; return { remove() {} }; } },
        },
        '../styles/theme': { theme },
    });
    return { render, back: () => back(), background: () => appState('background') };
}

test('logout confirmation uses in-screen controls and blocks duplicate confirmation', async () => {
    const h = logoutHarness();
    let confirmed = 0, cancelled = 0, finish;
    const props = { onCancel: () => { cancelled++; }, onConfirm: () => { confirmed++; return new Promise(resolve => { finish = resolve; }); } };
    let tree = h.render(props);
    elements(tree).find(node => node.type === 'Button' && elements(node).some(child => child.props.children === 'Cancelar')).props.onPress();
    assert.equal(cancelled, 1); assert.equal(confirmed, 0);
    const press = elements(tree).find(node => node.props.accessibilityLabel === 'Sair').props.onPress;
    const first = press(); await press();
    assert.equal(confirmed, 1);
    assert.equal(h.back(), true); h.background(); assert.equal(cancelled, 1);
    tree = h.render(props);
    assert.equal(elements(tree).find(node => node.props.accessibilityLabel === 'Encerrando sessão' && node.type === 'Button').props.disabled, true);
    finish(); await first;
    assert.equal(cancelled, 2);
    h.render.unmount();
});

test('logout failures are displayed inline and late completion does not touch a detached screen', async () => {
    const h = logoutHarness();
    const props = { onCancel: () => assert.fail('must not close on failure'), onConfirm: async () => { throw new Error('Não foi possível sair'); } };
    await elements(h.render(props)).find(node => node.props.accessibilityLabel === 'Sair').props.onPress();
    const failed = h.render(props);
    assert.equal(elements(failed).some(node => node.type === 'FormFeedback' && node.props.message === 'Não foi possível sair'), true);
    let finish;
    const retry = { ...props, onConfirm: () => new Promise(resolve => { finish = resolve; }) };
    const pending = elements(h.render(retry)).find(node => node.props.accessibilityLabel === 'Sair').props.onPress();
    h.render.unmount(); finish(); await pending;
});

test('async states distinguish loading, empty and error, with accessible actions', () => {
    const render = componentHarness('src/components/AsyncState.tsx', 'AsyncState');
    const loading = render({ loading: true, title: 'Carregando turmas...' });
    assert.equal(loading.props.accessibilityState.busy, true);
    assert.equal(elements(loading).some(node => node.type === 'Spinner'), true);
    assert.equal(elements(loading).some(node => node.type === 'Button'), false);
    const empty = render({ status: 'empty', title: 'Nenhuma turma', actionLabel: 'Criar turma', onAction: () => {} });
    assert.equal(elements(empty).some(node => node.props.children === 'Criar turma'), true);
    assert.equal(elements(empty).find(node => node.type === 'Button').props.accessibilityRole, 'button');
    const error = render({ status: 'error', message: 'Sem conexão', onRetry: async () => {} });
    assert.equal(elements(error).some(node => node.props.children === 'Tentar novamente'), true);
    assert.equal(elements(error).some(node => node.props.children === 'Sem conexão'), true);
});

test('retry blocks duplicate taps, exposes busy state and releases the action after completion', async () => {
    let calls = 0, finish;
    const render = componentHarness('src/components/AsyncState.tsx', 'AsyncState');
    const props = { message: 'Sem conexão', onRetry: () => { calls++; return new Promise(resolve => { finish = resolve; }); } };
    const press = elements(render(props)).find(node => node.type === 'Button').props.onPress;
    const first = press(); await press();
    assert.equal(calls, 1);
    const pending = render(props);
    assert.equal(pending.props.accessibilityState.busy, true);
    assert.equal(elements(pending).find(node => node.type === 'Button').props.disabled, true);
    finish(); await first;
    assert.equal(render(props).props.accessibilityState.busy, false);
});

test('a rejected retry displays the failure and enables another attempt', async () => {
    const render = componentHarness('src/components/AsyncState.tsx', 'AsyncState');
    const props = { onRetry: async () => { throw new Error('Servidor indisponível'); } };
    await elements(render(props)).find(node => node.type === 'Button').props.onPress();
    const failed = render(props);
    assert.equal(failed.props.accessibilityState.busy, false);
    assert.equal(elements(failed).find(node => node.type === 'Button').props.disabled, false);
    assert.equal(elements(failed).some(node => node.props.children === 'Servidor indisponível'), true);
});

test('passenger list does not describe failed or pending requests as an empty list', () => {
    const render = componentHarness('src/components/motorista/ListaPassageirosAprovados.tsx', 'ListaPassageirosAprovados');
    const props = { passageiros: [], turmaSelecionada: { id: 1 }, onRemoverAluno: () => {} };
    const failed = elements(render({ ...props, error: 'Sem permissão', onRetry: async () => {} }));
    assert.equal(failed.some(node => node.type === 'AsyncState' && node.props.status === 'empty'), false);
    assert.equal(failed.some(node => node.type === 'AsyncState' && node.props.message === 'Sem permissão'), true);
    const pending = elements(render({ ...props, loading: true }));
    assert.equal(pending.some(node => node.type === 'AsyncState' && node.props.loading), true);
    assert.equal(pending.some(node => node.type === 'AsyncState' && node.props.status === 'empty'), false);
    const empty = elements(render(props));
    assert.equal(empty.some(node => node.type === 'AsyncState' && node.props.status === 'empty'), true);
});

test('passenger list preserves existing data while showing a refresh failure', () => {
    const render = componentHarness('src/components/motorista/ListaPassageirosAprovados.tsx', 'ListaPassageirosAprovados');
    const tree = elements(render({ passageiros: [{ id: 10, nome: 'Ana Silva' }], error: 'Sem conexão', onRemoverAluno: () => {} }));
    assert.equal(tree.some(node => node.type === 'AsyncState' && node.props.message === 'Sem conexão'), true);
    assert.equal(tree.some(node => node.props.children === 'Ana Silva'), true);
});

test('apiFetch preserves all HeadersInit forms and uses the current token', async () => {
    let request;
    const { apiFetch } = load('src/config/api.ts', {
        './config': { API_URL: 'https://example.test' },
        './firebase': { auth: { authStateReady: async () => {}, currentUser: { getIdToken: async () => 'fresh-token' } } },
    }, { fetch: async (url, options) => { request = { url, ...options }; return new Response('{}'); } });
    for (const headers of [{ Accept: 'application/json' }, [['Accept', 'application/json']], new Headers({ Accept: 'application/json' })]) {
        await apiFetch('/turmas', { headers });
        assert.equal(request.url, 'https://example.test/turmas');
        assert.equal(request.headers.get('Accept'), 'application/json');
        assert.equal(request.headers.get('Authorization'), 'Bearer fresh-token');
    }
});

function apiHarness(fetchImpl, user = { getIdToken: async () => 'token' }) {
    const auth = { authStateReady: async () => {}, currentUser: user };
    const api = load('src/config/api.ts', {
        './config': { API_URL: 'https://example.test' }, './firebase': { auth },
    }, { fetch: fetchImpl });
    return { ...api, auth };
}

test('missing session blocks requests before network access', async () => {
    let calls = 0;
    const api = apiHarness(async () => { calls++; }, null);
    await assert.rejects(api.apiFetch('/private'), error => error.kind === 'session');
    assert.equal(calls, 0);
});

test('401 refreshes once with a fresh token, while 403 preserves the session', async () => {
    const tokens = [], refreshed = [];
    const api = apiHarness(async (_, options) => {
        tokens.push(options.headers.get('Authorization'));
        return new Response('{}', { status: tokens.length === 1 ? 401 : 200 });
    }, { getIdToken: async force => { refreshed.push(force); return force ? 'fresh' : 'old'; } });
    await api.apiFetch('/private');
    assert.deepEqual(tokens, ['Bearer old', 'Bearer fresh']);
    assert.deepEqual(refreshed, [false, true]);
    let expired = 0;
    const denied = apiHarness(async () => new Response('{}', { status: 403 }));
    denied.onSessionExpired(() => expired++);
    assert.equal((await denied.apiFetch('/private')).status, 403);
    assert.equal(expired, 0);
});

test('persistent 401 expires session after exactly two attempts', async () => {
    let calls = 0, expired = 0;
    const api = apiHarness(async () => { calls++; return new Response('{}', { status: 401 }); });
    api.onSessionExpired(() => expired++);
    await assert.rejects(api.apiFetch('/private'), error => error.kind === 'session' && error.status === 401);
    assert.equal(calls, 2);
    assert.equal(expired, 1);
});

test('responses from a logged-out session are discarded', async () => {
    let finish;
    const api = apiHarness(() => new Promise(resolve => { finish = resolve; }));
    const request = api.apiFetch('/private');
    await new Promise(resolve => setImmediate(resolve));
    api.auth.currentUser = null;
    finish(new Response('{}'));
    await assert.rejects(request, error => error.kind === 'session');
});

test('network, caller cancellation and timeout have distinct errors', async () => {
    const offline = apiHarness(async () => { throw new TypeError('offline'); });
    await assert.rejects(offline.apiFetch('/private'), error => error.kind === 'network');
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(offline.apiFetch('/private', { signal: controller.signal }), error => error.kind === 'aborted');
    // Also bound token refresh time, before fetch has even started.
    const pending = apiHarness(async () => { throw new Error('must not fetch'); }, { getIdToken: () => new Promise(() => {}) });
    await assert.rejects(pending.apiFetch('/private', { timeoutMs: 10 }), error => error.kind === 'timeout');
});

test('JSON parser accepts empty responses and standardizes HTTP and malformed body errors', async () => {
    const api = apiHarness();
    assert.equal(await api.readApiJson(new Response(null, { status: 204 })), null);
    assert.equal((await api.readApiJson(new Response('{"ok":true}'))).ok, true);
    await assert.rejects(api.readApiJson(new Response('bad json')), error => error.kind === 'invalid-response');
    for (const body of ['{"erro":"Sem permissão"}', '{"message":"Sem permissão"}', 'Sem permissão']) {
        const error = await api.readApiError(new Response(body, { status: 403 }));
        assert.equal(error.message, 'Sem permissão');
        assert.equal(error.kind, 'http');
        assert.equal(error.status, 403);
    }
    const error = await api.readApiError(new Response('<html>proxy error</html>', { status: 502 }));
    assert.ok(!error.message.includes('<html>'));
});

test('session profile rejects absent, zero, arbitrary and malformed user IDs and unknown roles', () => {
    const api = apiHarness();
    const { profileToUser } = load('src/services/session.ts', { '../config/api': api });
    for (const id of [undefined, null, 0, -1, 'null', 'undefined', 'abc', '1.5']) {
        assert.throws(() => profileToUser({ id, tipo: 'PASSAGEIRO' }));
    }
    assert.throws(() => profileToUser({ id: 10, tipo: 'ADMIN' }));
    assert.equal(profileToUser({ id: 10, tipo: 'MOTORISTA', nome: 'Ana' }).id, '10');
});

function sessionHarness(initialStorage = {}, profileImplementation) {
    const slots = [], deps = [];
    let cursor = 0, effects = [], observer, expired;
    const storage = new Map(Object.entries(initialStorage));
    const auth = { currentUser: null };
    let signOutCalls = 0, profileCalls = 0;
    const react = {
        createContext: () => ({ Provider: 'Provider' }),
        useState(initial) {
            const i = cursor++;
            if (!(i in slots)) slots[i] = initial;
            return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
        },
        useRef(initial) {
            const i = cursor++;
            return slots[i] ||= { current: initial };
        },
        useCallback(fn, next) {
            const i = cursor++;
            if (!deps[i] || next.some((v, j) => v !== deps[i][j])) slots[i] = fn;
            deps[i] = next;
            return slots[i];
        },
        useEffect(fn, next) {
            const i = cursor++;
            if (!deps[i] || next.some((v, j) => v !== deps[i][j])) effects.push(fn);
            deps[i] = next;
        },
    };
    const api = apiHarness();
    const realSession = load('src/services/session.ts', { '../config/api': api });
    const sessionUser = { id: '25', nome: 'Ana', tipo: 'PASSAGEIRO', endereco: 'Casa' };
    const { AuthProvider } = load('src/contexts/AuthContext.tsx', {
        react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
        '@react-native-async-storage/async-storage': { __esModule: true, default: {
            multiGet: async keys => keys.map(key => [key, storage.get(key) ?? null]),
            multiSet: async entries => entries.forEach(([key, value]) => storage.set(key, value)),
            multiRemove: async keys => keys.forEach(key => storage.delete(key)),
            setItem: async (key, value) => storage.set(key, value),
        } },
        'firebase/auth': {
            onAuthStateChanged: (_, fn) => { observer = fn; return () => {}; },
            signOut: async () => { signOutCalls++; auth.currentUser = null; await observer(null); },
        },
        '../config/firebase': { auth },
        '../config/api': { errorMessage: api.errorMessage, onSessionExpired: fn => { expired = fn; return () => {}; } },
        '../services/session': { ...realSession, fetchSessionUser: async uid => {
            assert.equal(uid, 'firebase-ana'); profileCalls++;
            return profileImplementation ? profileImplementation() : sessionUser;
        } },
    });
    const render = () => {
        cursor = 0; effects = [];
        const tree = AuthProvider({ children: null });
        effects.forEach(fn => fn());
        return tree.props.value;
    };
    render();
    return {
        render, storage, sessionUser,
        get profileCalls() { return profileCalls; },
        get signOutCalls() { return signOutCalls; },
        expire: () => expired(),
        async emit(user) { auth.currentUser = user; await observer(user); },
    };
}

test('startup never restores a cached numeric identity without Firebase authentication', async () => {
    const h = sessionHarness({ userId: '1', theme: 'dark' });
    assert.equal(h.render().isLoading, true);
    await h.emit(null);
    assert.equal(h.render().user.id, null);
    assert.equal(h.render().isLoading, false);
    assert.equal(h.storage.has('userId'), false);
    assert.equal(h.storage.get('theme'), 'dark');
});

test('startup restores backend identity for Firebase UID instead of cached userId', async () => {
    const h = sessionHarness({ userId: '1', firebaseUid: 'firebase-ana' });
    await h.emit({ uid: 'firebase-ana' });
    assert.equal(h.render().user.id, '25');
    assert.equal(h.profileCalls, 1);
});

test('cached profile from another Firebase account is not restored', async () => {
    const h = sessionHarness({ userId: '1', firebaseUid: 'another-account' });
    await h.emit({ uid: 'firebase-ana' });
    assert.equal(h.render().user.id, null);
    assert.equal(h.profileCalls, 0);
});

test('logout closes Firebase, clears profile and preserves unrelated preferences', async () => {
    const h = sessionHarness({ theme: 'dark', userId: '25', firebaseUid: 'firebase-ana' });
    await h.emit({ uid: 'firebase-ana' });
    await h.render().signOut();
    assert.equal(h.render().user.id, null);
    assert.equal(h.signOutCalls, 1);
    assert.equal(h.storage.has('userId'), false);
    assert.equal(h.storage.get('theme'), 'dark');
});

test('profile restoration failure leaves protected identity unavailable and exposes an error', async () => {
    const h = sessionHarness({ userId: '25' }, async () => { throw new Error('Servidor indisponível'); });
    await h.emit({ uid: 'firebase-ana' });
    assert.equal(h.render().user.id, null);
    assert.equal(h.render().isLoading, false);
    assert.equal(h.render().sessionError, 'Servidor indisponível');
});

test('late startup response cannot restore a profile after logout', async () => {
    let finish;
    const h = sessionHarness({ userId: '25' }, () => new Promise(resolve => { finish = resolve; }));
    const restoring = h.emit({ uid: 'firebase-ana' });
    await new Promise(resolve => setImmediate(resolve));
    await h.render().signOut();
    finish(h.sessionUser);
    await restoring;
    assert.equal(h.render().user.id, null);
    assert.equal(h.storage.has('userId'), false);
});

test('a new Firebase registration does not activate a protected profile automatically', async () => {
    const h = sessionHarness();
    await h.emit(null);
    await h.emit({ uid: 'firebase-ana' });
    assert.equal(h.render().user.id, null);
    assert.equal(h.render().isLoading, false);
    assert.equal(h.profileCalls, 0);
    await h.render().signIn(h.sessionUser);
    assert.equal(h.render().user.id, '25');
    assert.equal(h.storage.get('firebaseUid'), 'firebase-ana');
});

test('home refresh reuses fresh data, deduplicates requests and revalidates after writes or TTL', async () => {
    const { createRefreshTask } = load('src/services/refreshTask.ts', {});
    let clock = 0, revision = 0, calls = 0, finish;
    const refresh = createRefreshTask(() => {
        calls++; return new Promise(resolve => { finish = resolve; });
    }, () => revision, 30000, () => clock);
    const first = refresh();
    const duplicate = refresh();
    assert.equal(first, duplicate);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
    finish(true); await first;
    clock = 1000; await refresh(); assert.equal(calls, 1);
    revision++;
    const afterWrite = refresh(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 2); finish(true); await afterWrite;
    clock = 31000;
    const stale = refresh(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 3); finish(true); await stale;
    const manual = refresh(true); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 4); finish(true); await manual;
});

test('failed home loads are retried immediately rather than cached', async () => {
    const { createRefreshTask } = load('src/services/refreshTask.ts', {});
    let calls = 0;
    const refresh = createRefreshTask(async () => { calls++; return false; }, () => 0);
    await refresh(); await refresh();
    assert.equal(calls, 2);
});

test('a write during a pending home request causes one follow-up refresh', async () => {
    const { createRefreshTask } = load('src/services/refreshTask.ts', {});
    let revision = 0, calls = 0, finish;
    const refresh = createRefreshTask(() => {
        calls++;
        return calls === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(true);
    }, () => revision);
    const first = refresh(); await new Promise(resolve => setImmediate(resolve));
    revision++;
    const afterWrite = refresh(); finish(true);
    await first; await afterWrite;
    assert.equal(calls, 2);
});

test('only successful mutations invalidate home freshness', async () => {
    let status = 200;
    const api = apiHarness(async () => new Response('{}', { status }));
    await api.apiFetch('/turmas'); assert.equal(api.getApiDataRevision(), 0);
    await api.apiFetch('/turmas', { method: 'POST' }); assert.equal(api.getApiDataRevision(), 1);
    status = 403;
    await api.apiFetch('/turmas', { method: 'PUT' }); assert.equal(api.getApiDataRevision(), 1);
});

function fakePollingTimers() {
    let nextId = 0;
    const timers = new Map();
    return {
        timers,
        setTimeout(fn) { const id = ++nextId; timers.set(id, fn); return id; },
        clearTimeout(id) { timers.delete(id); },
    };
}

test('polling waits for the previous request and cancels timers and requests on stop', async () => {
    const fake = fakePollingTimers();
    const { createPolling } = load('src/services/polling.ts', {}, fake);
    let calls = 0, finish, signal;
    const polling = createPolling(s => { signal = s; calls++; return new Promise(resolve => { finish = resolve; }); }, 10000);
    polling.start(); polling.start();
    assert.equal(calls, 1);
    assert.equal(fake.timers.size, 0);
    finish(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(fake.timers.size, 1);
    polling.stop();
    assert.equal(signal.aborted, true);
    assert.equal(fake.timers.size, 0);
});

test('focused polling stops on background and blur and resumes once on foreground', async () => {
    const fake = fakePollingTimers();
    const polling = load('src/services/polling.ts', {}, fake);
    let focus, appStateChange, networkChange, calls = 0, removed = false, networkRemoved = false, signal;
    const { useFocusedPolling } = load('src/hooks/useFocusedPolling.ts', {
        react: { useRef: current => ({ current }), useCallback: fn => fn },
        'expo-router': { useFocusEffect: fn => { focus = fn; } },
        'react-native': { AppState: { currentState: 'active', addEventListener: (_, fn) => {
            appStateChange = fn; return { remove: () => { removed = true; } };
        } } },
        '../services/polling': polling,
        '@react-native-community/netinfo': { __esModule: true, default: { addEventListener: fn => {
            networkChange = fn; return () => { networkRemoved = true; };
        } } },
    });
    useFocusedPolling(async s => { signal = s; calls++; }, 10000, 'user:turma');
    const blur = focus();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
    appStateChange('background');
    assert.equal(signal.aborted, true);
    assert.equal(fake.timers.size, 0);
    appStateChange('active'); appStateChange('active');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 2);
    networkChange({ isConnected: false });
    assert.equal(fake.timers.size, 0); assert.equal(signal.aborted, true);
    networkChange({ isConnected: true, isInternetReachable: true });
    networkChange({ isConnected: true, isInternetReachable: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 3);
    blur(); assert.equal(fake.timers.size, 0); assert.equal(removed, true); assert.equal(networkRemoved, true);
});

test('deadline bounds native/provider waits and rejects cancellation before starting work', async () => {
    const { withDeadline } = load('src/services/asyncOperation.ts', {});
    await assert.rejects(withDeadline(() => new Promise(() => {}), { timeoutMs: 5 }), error => error.kind === 'timeout');
    const controller = new AbortController(); controller.abort();
    let calls = 0;
    await assert.rejects(withDeadline(async () => { calls++; }, { signal: controller.signal }), error => error.kind === 'cancelled');
    assert.equal(calls, 0);
});

function locationHarness(permission = 'granted', enabled = true, coordinates = { latitude: 0, longitude: 0 }) {
    let gpsCalls = 0;
    const asyncOperation = load('src/services/asyncOperation.ts', {});
    const service = load('src/services/location.ts', {
        './asyncOperation': asyncOperation,
        'expo-location': { Accuracy: { Balanced: 3 },
            requestForegroundPermissionsAsync: async () => ({ status: permission }),
            hasServicesEnabledAsync: async () => enabled,
            getCurrentPositionAsync: async () => { gpsCalls++; return { coords: coordinates }; },
        },
    });
    return { ...service, calls: () => gpsCalls };
}

test('denied permission or disabled GPS does not start a position request', async () => {
    const denied = locationHarness('denied');
    await assert.rejects(denied.getCurrentCoordinates(), /não autorizada/);
    assert.equal(denied.calls(), 0);
    const disabled = locationHarness('granted', false);
    await assert.rejects(disabled.getCurrentCoordinates(), /desligado/);
    assert.equal(disabled.calls(), 0);
});

test('GPS validates finite coordinates and accepts valid zero coordinates', async () => {
    const valid = locationHarness();
    assert.equal((await valid.getCurrentCoordinates()).latitude, 0);
    for (const latitude of [NaN, Infinity, 91, '12', null]) {
        await assert.rejects(locationHarness('granted', true, { latitude, longitude: 0 }).getCurrentCoordinates(), /inválida/);
    }
});

function addressService(fetchImpl, env = { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'test-token' }) {
    return load('src/services/enderecoSearch.ts', { './asyncOperation': load('src/services/asyncOperation.ts', {}) },
        { fetch: fetchImpl, process: { env } });
}

test('address provider failures are errors even when optional POI search is disabled', async () => {
    const service = addressService(async () => new Response('{}', { status: 503 }));
    await assert.rejects(service.pesquisarEnderecos('Rua Central'), /HTTP 503/);
});

test('address search distinguishes genuine zero results from malformed responses', async () => {
    const empty = addressService(async () => new Response('{"features":[]}'));
    assert.equal((await empty.pesquisarEnderecos('Rua Central')).length, 0);
    const malformed = addressService(async () => new Response('{}'));
    await assert.rejects(malformed.pesquisarEnderecos('Rua Central'), /inválidos/);
});

test('address search can use a configured optional provider when the primary fails', async () => {
    const service = addressService(async url => url.includes('mapbox') ? new Response('{}', { status: 503 })
        : new Response('{"results":[{"place_id":"1","name":"Campus","lat":-8,"lon":-35}]}'),
        { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'test', EXPO_PUBLIC_GEOAPIFY_API_KEY: 'test' });
    const results = await service.pesquisarEnderecos('Campus');
    assert.equal(results.length, 1);
    assert.equal(results[0].tipo, 'estabelecimento');
});

test('driver services scope endpoints and distinguish empty lists from invalid payloads', async () => {
    const paths = []; let body = null;
    const api = { apiRequest: async path => { paths.push(path); return body; } };
    const service = load('src/services/motoristaHome.ts', { '../config/api': api,
        './turmas': load('src/services/turmas.ts', { '../config/api': api }) });
    assert.equal((await service.fetchTurmasMotorista(25)).length, 0);
    await service.fetchPassageirosTurma(7); await service.fetchSolicitacoesTurma(7);
    assert.deepEqual(paths, ['/turmas/motorista/25', '/turmas/7/passageiros', '/turmas/7/pendentes']);
    body = { erro: 'invalid' };
    await assert.rejects(service.fetchPassageirosTurma(7), /lista inválida/);
});

test('turma parsing validates identity and coordinates instead of trusting a TypeScript cast', () => {
    const { parseTurma } = load('src/services/turmas.ts', { '../config/api': {} });
    const turma = parseTurma({ id: '25', nome: 'Campus', turno: 'Noite', origemLatitude: 0 });
    assert.equal(turma.id, 25); assert.equal(turma.origemLatitude, 0);
    for (const invalid of [null, [], {}, { id: 0 }, { id: -1 }, { id: 'abc' }, { id: 1, origemLatitude: NaN }]) {
        assert.throws(() => parseTurma(invalid));
    }
});

test('turma writes accept 204 responses and preserve the documented payload', async () => {
    const requests = [];
    const service = load('src/services/turmas.ts', { '../config/api': {
        apiFetch: async (path, options) => { requests.push({ path, ...options }); return new Response(null, { status: 204 }); },
    } });
    await service.atualizarTurma('7', ' Campus ', ' Noite ');
    await service.excluirTurma(7);
    assert.equal(requests[0].method, 'PUT');
    assert.deepEqual(JSON.parse(requests[0].body), { nome: 'Campus', turno: 'Noite' });
    assert.equal(requests[1].path, '/turmas/7'); assert.equal(requests[1].method, 'DELETE');
});

test('invalid turma identities are rejected before a request can be sent', async () => {
    let calls = 0;
    const service = load('src/services/turmas.ts', { '../config/api': {
        apiFetch: async () => { calls++; }, apiRequest: async () => { calls++; },
    } });
    await assert.rejects(service.criarTurma('null', 'Campus', 'Noite'));
    await assert.rejects(service.atualizarTurma('../1', 'Campus', 'Noite'));
    await assert.rejects(service.excluirTurma(0));
    assert.equal(calls, 0);
});

test('code regeneration rejects another turma or a missing code in the response', async () => {
    let response = { id: 2, codigoConvite: 'XYZ' };
    const service = load('src/services/turmas.ts', { '../config/api': { apiRequest: async () => response } });
    await assert.rejects(service.regenerarCodigoTurma(1), /não confirmou/);
    response = { id: 1 }; await assert.rejects(service.regenerarCodigoTurma(1), /não confirmou/);
    response = { id: 1, codigoConvite: 'ABC123' };
    assert.equal((await service.regenerarCodigoTurma(1)).codigoConvite, 'ABC123');
});

test('trip requests send only the backend contract and distinguish 400 from conflict', async () => {
    const calls = []; let status = 200;
    const api = apiHarness();
    const service = load('src/services/viagens.ts', { '../config/api': {
        readApiError: api.readApiError,
        apiFetch: async (path, options) => { calls.push({ path, ...options }); return new Response('{}', { status }); },
    } }, { URLSearchParams });
    await service.iniciarViagem(7, 'IDA');
    await service.encerrarViagem(7);
    assert.deepEqual(JSON.parse(calls[0].body), { turmaId: 7, sentido: 'IDA' });
    assert.equal(calls[1].path, '/rota/encerrar?turmaId=7');
    assert.equal(calls[1].body, undefined);
    status = 400;
    await assert.rejects(service.iniciarViagem(7, 'IDA'), error => error.status === 400);
    status = 409;
    await assert.rejects(service.iniciarViagem(7, 'IDA'), error => error.status === 409);
    const previous = calls.length;
    await assert.rejects(service.enviarPosicaoVan(0, 0, 0));
    await assert.rejects(service.enviarPosicaoVan(7, NaN, 0));
    assert.equal(calls.length, previous);
});

test('restart never starts a trip if ending the previous one failed', async () => {
    const paths = []; const api = apiHarness(); let status = 503;
    const service = load('src/services/viagens.ts', { '../config/api': {
        readApiError: api.readApiError, apiFetch: async path => { paths.push(path); return new Response('{}', { status }); },
    } });
    await assert.rejects(service.reiniciarViagem(7, 'IDA'));
    assert.deepEqual(paths, ['/rota/encerrar?turmaId=7']);
    status = 200; paths.length = 0;
    await service.reiniciarViagem(7, 'VOLTA');
    assert.deepEqual(paths, ['/rota/encerrar?turmaId=7', '/rota/iniciar']);
});

test('telemetry skips offline, inactive, missing turma and another account, without replaying old points', async () => {
    const points = [];
    const { createPositionSender } = load('src/services/telemetria.ts', { './viagens': {
        enviarPosicaoVan: async (turmaId, latitude) => { points.push({ turmaId, latitude }); },
    } });
    const context = { userId: '25', turmaId: 7, online: false, active: true, mounted: true };
    const sender = createPositionSender('25', () => context);
    await sender.send({ latitude: 1, longitude: 2 });
    context.online = true; context.active = false;
    await sender.send({ latitude: 1, longitude: 2 });
    context.active = true; context.turmaId = null;
    await sender.send({ latitude: 1, longitude: 2 });
    context.turmaId = 8; context.userId = 'another';
    await sender.send({ latitude: 1, longitude: 2 });
    assert.equal(points.length, 0);
    context.userId = '25';
    await sender.send({ latitude: 3, longitude: 4 });
    assert.deepEqual(points, [{ turmaId: 8, latitude: 3 }]);
});

test('telemetry serializes sends and discards completion after context changes or cancellation', async () => {
    let finish, signal, calls = 0;
    const { createPositionSender } = load('src/services/telemetria.ts', { './viagens': {
        enviarPosicaoVan: async (_, __, ___, activeSignal) => { calls++; signal = activeSignal; return new Promise(resolve => { finish = resolve; }); },
    } });
    const context = { userId: '25', turmaId: 7, online: true, active: true, mounted: true };
    const sender = createPositionSender('25', () => context);
    const pending = sender.send({ latitude: 1, longitude: 2 });
    assert.equal(await sender.send({ latitude: 3, longitude: 4 }), false);
    assert.equal(calls, 1);
    sender.cancel(); assert.equal(signal.aborted, true);
    context.turmaId = 8; finish();
    assert.equal(await pending, false);
});

function accountHarness({ status = 200, providerFailure = false, rollbackFailure = false, networkError = false,
    commitOnError = false, readbackFailure = false, firebaseEmail = 'old@example.test', initialServerEmail = 'old@example.test' } = {}) {
    const api = apiHarness();
    const user = { uid: 'firebase-25', email: firebaseEmail };
    const auth = { currentUser: user };
    const firebaseChanges = [], requests = [];
    let reads = 0, serverEmail = initialServerEmail;
    const service = load('src/services/conta.ts', {
        '../config/firebase': { auth },
        'firebase/auth': {
            EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
            reauthenticateWithCredential: async () => {},
            updateEmail: async (account, email) => {
                firebaseChanges.push(email);
                if (providerFailure || (rollbackFailure && firebaseChanges.length > 1)) throw new Error('Provider unavailable');
                account.email = email;
            },
        },
        '../config/api': {
            readApiError: api.readApiError,
            apiRequest: async () => {
                reads++;
                if (readbackFailure && reads > 1) throw new Error('Readback unavailable');
                return { id: 25, email: serverEmail };
            },
            apiFetch: async (path, options) => {
                requests.push({ path, ...options });
                if (options.method === 'PUT' && (status === 200 || commitOnError)) serverEmail = JSON.parse(options.body).email;
                if (networkError) throw new Error('Network unavailable');
                return new Response('{"erro":"Recusado pelo servidor"}', { status });
            },
        },
    });
    return { ...service, auth, firebaseChanges, requests };
}

test('Firebase email refusal leaves the backend unchanged', async () => {
    const account = accountHarness({ providerFailure: true });
    await assert.rejects(account.alterarEmailConta('25', 'new@example.test', 'password'));
    assert.equal(account.requests.length, 0);
});

test('backend email refusal restores Firebase only after confirming the old backend value', async () => {
    const account = accountHarness({ status: 409 });
    await assert.rejects(account.alterarEmailConta('25', 'new@example.test', 'password'), /Recusado/);
    assert.deepEqual(account.firebaseChanges, ['new@example.test', 'old@example.test']);
    assert.equal(account.auth.currentUser.email, 'old@example.test');
});

test('an unknown email result that committed on the server is recovered by readback', async () => {
    const account = accountHarness({ networkError: true, commitOnError: true });
    await account.alterarEmailConta('25', 'new@example.test', 'password');
    assert.deepEqual(account.firebaseChanges, ['new@example.test']);
});

test('unknown email state or failed compensation stays explicit without blind rollback', async () => {
    const unknown = accountHarness({ networkError: true, readbackFailure: true });
    await assert.rejects(unknown.alterarEmailConta('25', 'new@example.test', 'password'), error => error.name === 'EmailSyncPendingError');
    assert.deepEqual(unknown.firebaseChanges, ['new@example.test']);
    const compensation = accountHarness({ status: 409, rollbackFailure: true });
    await assert.rejects(compensation.alterarEmailConta('25', 'new@example.test', 'password'), error => error.name === 'EmailSyncPendingError');
});

test('retry can synchronize an email already changed in Firebase without changing it again', async () => {
    const account = accountHarness({ firebaseEmail: 'new@example.test' });
    await account.alterarEmailConta('25', 'new@example.test', 'password');
    assert.equal(account.firebaseChanges.length, 0);
    assert.equal(account.requests.length, 1);
    const synchronized = accountHarness({ firebaseEmail: 'new@example.test', initialServerEmail: 'new@example.test' });
    await synchronized.alterarEmailConta('25', 'new@example.test', 'password');
    assert.equal(synchronized.requests.length, 0);
});

test('account deletion invokes only the backend, which owns Firebase deletion', async () => {
    const account = accountHarness();
    await account.excluirContaServidor('25');
    assert.equal(account.requests.length, 1);
    assert.equal(account.requests[0].path, '/usuarios/25');
    assert.equal(account.requests[0].method, 'DELETE');
    assert.equal(account.firebaseChanges.length, 0);
});

test('a late code-regeneration response cannot replace a newly selected turma', async () => {
    let finish, calls = 0; const updates = [];
    const render = componentHarness('src/components/motorista/PainelTurmaSelecionada.tsx', 'PainelTurmaSelecionada', {
        '../../config/api': { errorMessage: error => error.message },
        '../../services/turmas': { regenerarCodigoTurma: async () => { calls++; return new Promise(resolve => { finish = resolve; }); } },
        'expo-clipboard': { setStringAsync: async () => {} },
    });
    const original = { turma: { id: 1, turno: 'Noite' }, onAtualizarTurma: value => updates.push(value) };
    const tree = render(original);
    const press = elements(tree).find(node => node.type === 'Button' && node.props.onPress.name === 'handleRegenerarCodigo').props.onPress;
    const first = press(); await press(); assert.equal(calls, 1);
    render({ ...original, turma: { id: 2, turno: 'Manhã' } });
    finish({ id: 1, turno: 'Noite', codigoConvite: 'ABC123' });
    await first;
    assert.equal(updates.length, 0);
});

test('turma search accepts code or name without adding results outside the authorized list', () => {
    const { filterTurmas } = load('src/services/turmaSearch.ts', {});
    const turmas = [
        { id: 1, nome: 'Universidade São João', codigoConvite: 'ABC123', turno: 'Manhã' },
        { id: 2, nome: 'Campus Central', codigoConvite: 'DEF456', turno: 'Noite' },
    ];
    assert.equal(filterTurmas(turmas, ' abc123 ')[0].id, 1);
    assert.equal(filterTurmas(turmas, 'sao manha')[0].id, 1);
    assert.equal(filterTurmas(turmas, 'CENTRAL')[0].id, 2);
    assert.equal(filterTurmas(turmas, 'unknown').length, 0);
    assert.equal(filterTurmas(turmas, '').length, 2);
    assert.equal(turmas.length, 2);
});

test('inactive passenger radar only queries status and never refetches turmas or addresses', async () => {
    const paths = [];
    const { fetchPassengerRadar } = load('src/services/passageiroHome.ts', { '../config/api': {
        apiFetch: async path => { paths.push(path); return new Response('{"status":"INATIVA"}'); },
        readApiJson: async response => response.json(),
    } });
    const result = await fetchPassengerRadar(7, new AbortController().signal);
    assert.equal(result.status, 'INATIVA');
    assert.deepEqual(paths, ['/rota/status-atual?turmaId=7']);
});

// Exercise the component's hooks and event handlers without native services.
function presenceHarness() {
    const state = [], deps = [];
    let cursor, effects;
    const react = {
        useState(initial) {
            const i = cursor++;
            if (!(i in state)) state[i] = initial;
            return [state[i], value => { state[i] = value; }];
        },
        useEffect(effect, next) {
            const i = cursor++;
            if (!deps[i] || next.some((value, j) => !Object.is(value, deps[i][j]))) effects.push(effect);
            deps[i] = next;
        },
    };
    const element = (type, props) => ({ type, props });
    const theme = load('src/styles/theme.ts', {}).theme;
    const { SeletorPresenca } = load('src/components/passageiro/SeletorPresenca.tsx', {
        '../../contexts/AppAlertContext': { useAppAlert: () => ({ alert() {} }) },
        react, 'react/jsx-runtime': { jsx: element, jsxs: element },
        '@expo/vector-icons': { Ionicons: 'Icon' },
        'react-native': { StyleSheet: { create: x => x }, Alert: {}, View: 'View', Text: 'Text', TouchableOpacity: 'Button' },
        '../../styles/theme': { theme },
    });
    return {
        state,
        render(confirmacao) {
            cursor = 0; effects = [];
            const tree = SeletorPresenca({ confirmacao, enderecos: [], onRegistrar: async () => true });
            effects.forEach(effect => effect());
            return tree;
        },
    };
}

function buttons(node, found = []) {
    if (!node || typeof node !== 'object') return found;
    if (node.type === 'Button') found.push(node);
    for (const child of [node.props?.children].flat(Infinity)) buttons(child, found);
    return found;
}

test('presence draft survives polling, including changed server data; cancel restores saved values', () => {
    const h = presenceHarness();
    const saved = { status: 'IDA', enderecoIda: { id: 10 }, enderecoVolta: null };
    h.render(saved);
    buttons(h.render(saved))[0].props.onPress(); // Alterar confirmação
    buttons(h.render(saved))[2].props.onPress(); // Ambos
    assert.equal(h.state[1], 'AMBOS');
    const changed = { ...saved, status: 'VOLTA', enderecoVolta: { id: 20 } };
    h.render(changed);
    assert.equal(h.state[0], true);
    assert.equal(h.state[1], 'AMBOS');
    const tree = h.render({ ...changed });
    buttons(tree).at(-1).props.onPress(); // Cancelar
    h.render(changed);
    assert.equal(h.state[1], 'VOLTA');
    assert.equal(h.state[3], 20);
});

test('first presence selection survives a polling result without confirmation', () => {
    const h = presenceHarness();
    h.render(null);
    buttons(h.render(null))[0].props.onPress();
    h.render(null);
    assert.equal(h.state[1], 'IDA');
    h.render({ status: 'VOLTA', enderecoIda: null, enderecoVolta: null });
    assert.equal(h.state[1], 'IDA');
});

function alertHarness() {
    const events = {};
    const render = componentHarness('src/contexts/AppAlertContext.tsx', 'AppAlertProvider', {
        'expo-router': { useFocusEffect() {} },
        'react-native': {
            StyleSheet: { create: value => value }, Text: 'Text', View: 'View', Pressable: 'Button',
            AppState: { currentState: 'active', addEventListener: (_, callback) => { events.state = callback; return { remove() {} }; } },
            BackHandler: { addEventListener: (_, callback) => { events.back = callback; return { remove() {} }; } },
        },
    });
    const tree = render({ children: null });
    return { render: () => render({ children: null }), host: tree.props.value, events };
}

test('in-app alerts queue messages, preserve destructive actions and ignore detached owners', () => {
    const h = alertHarness();
    const owner = {};
    let active = true, calls = 0;
    h.host.show({ owner, valid: () => active, title: 'Delete', buttons: [{ text: 'Delete', style: 'destructive', onPress: () => calls++ }] });
    h.host.show({ owner: {}, valid: () => true, title: 'Next' });
    let tree = h.render();
    const button = elements(tree).find(node => node.type === 'Button' && node.props.accessibilityRole === 'button');
    assert.equal(elements(tree).some(node => node.props?.children === 'Delete'), true);
    active = false;
    button.props.onPress();
    button.props.onPress();
    assert.equal(calls, 0);
    tree = h.render();
    assert.equal(elements(tree).some(node => node.props?.children === 'Next'), true);
    h.events.state('background');
    assert.equal(elements(h.render()).some(node => node.props?.children === 'Next'), false);
});

test('in-app alert honors noncancelable back and removes all messages belonging to a closed screen', () => {
    const h = alertHarness();
    const owner = {};
    let dismissed = 0;
    h.host.show({ owner, valid: () => true, title: 'Required', options: { cancelable: false, onDismiss: () => dismissed++ } });
    h.render();
    assert.equal(h.events.back(), true);
    assert.equal(elements(h.render()).some(node => node.props?.children === 'Required'), true);
    assert.equal(dismissed, 0);
    h.host.remove(owner);
    assert.equal(elements(h.render()).some(node => node.props?.children === 'Required'), false);
});

function navigationLocationHarness({ permission = { status: 'granted' }, enabled = false, accept = true, active = () => true } = {}) {
    let prompts = 0, requests = 0;
    const module = load('src/services/navigationLocation.ts', {
        'react-native': { Platform: { OS: 'android' } },
        'expo-location': {
            requestForegroundPermissionsAsync: async () => { requests++; return permission; },
            hasServicesEnabledAsync: async () => enabled,
            enableNetworkProviderAsync: async () => { prompts++; if (!accept) throw new Error('cancel'); enabled = true; },
        },
    });
    return { run: () => module.ensureNavigationLocation(active), prompts: () => prompts, requests: () => requests };
}

test('navigation requests permission and offers Android location activation before continuing', async () => {
    const h = navigationLocationHarness();
    assert.equal(await h.run(), true);
    assert.equal(h.requests(), 1);
    assert.equal(h.prompts(), 1);
});

test('navigation distinguishes blocked permission, rejected activation and a detached screen', async () => {
    const blocked = navigationLocationHarness({ permission: { status: 'denied', canAskAgain: false } });
    await assert.rejects(blocked.run(), error => error.reason === 'blocked');
    assert.equal(blocked.prompts(), 0);
    const denied = navigationLocationHarness({ permission: { status: 'denied', canAskAgain: true } });
    await assert.rejects(denied.run(), error => error.reason === 'denied');
    const cancelled = navigationLocationHarness({ accept: false });
    await assert.rejects(cancelled.run(), error => error.reason === 'services');
    const detached = navigationLocationHarness({ active: () => false });
    assert.equal(await detached.run(), false);
    assert.equal(detached.prompts(), 0);
});
