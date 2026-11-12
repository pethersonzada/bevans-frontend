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
    const { AuthProvider } = load('src/app/context/AuthContext.tsx', {
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
        '../../config/firebase': { auth },
        '../../config/api': { errorMessage: api.errorMessage, onSessionExpired: fn => { expired = fn; return () => {}; } },
        '../../services/session': { ...realSession, fetchSessionUser: async uid => {
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
    let focus, appStateChange, calls = 0, removed = false, signal;
    const { useFocusedPolling } = load('src/hooks/useFocusedPolling.ts', {
        react: { useRef: current => ({ current }), useCallback: fn => fn },
        'expo-router': { useFocusEffect: fn => { focus = fn; } },
        'react-native': { AppState: { currentState: 'active', addEventListener: (_, fn) => {
            appStateChange = fn; return { remove: () => { removed = true; } };
        } } },
        '../services/polling': polling,
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
    blur(); assert.equal(fake.timers.size, 0); assert.equal(removed, true);
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
