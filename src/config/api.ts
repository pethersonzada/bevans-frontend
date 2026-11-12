import { API_URL } from './config';
import { auth } from './firebase';

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted' | 'session' | 'invalid-response';

export class ApiError extends Error {
    constructor(message: string, public readonly kind: ApiErrorKind, public readonly status?: number) {
        super(message);
        this.name = 'ApiError';
    }
}

const expiredListeners = new Set<() => void>();
let dataRevision = 0;
export function getApiDataRevision() { return dataRevision; }
export function onSessionExpired(listener: () => void) {
    expiredListeners.add(listener);
    return () => { expiredListeners.delete(listener); };
}

export function errorMessage(error: unknown, fallback = 'Não foi possível concluir a operação.') {
    return error instanceof Error ? error.message : fallback;
}

export async function readApiError(response: Response): Promise<ApiError> {
    const text = await response.text();
    let message = `Não foi possível concluir a operação (HTTP ${response.status}).`;
    try {
        const body = JSON.parse(text);
        const detail = body?.erro || body?.message;
        if (typeof detail === 'string' && detail.trim()) message = detail;
    } catch {
        if (text.trim() && !text.trim().startsWith('<')) message = text;
    }
    return new ApiError(message, 'http', response.status);
}

export async function readApiJson<T>(response: Response): Promise<T | null> {
    if (!response.ok) throw await readApiError(response);
    const text = await response.text();
    if (!text.trim()) return null;
    try { return JSON.parse(text) as T; }
    catch { throw new ApiError('O servidor retornou uma resposta inválida.', 'invalid-response', response.status); }
}

type ApiOptions = RequestInit & { timeoutMs?: number };

// Preserve Response for callers that handle individual HTTP statuses.
export async function apiFetch(path: string, options: ApiOptions = {}): Promise<Response> {
    const { timeoutMs = 20000, signal, ...requestOptions } = options;
    const controller = new AbortController();
    let timedOut = false;
    let requestUser = auth.currentUser;
    const aborted = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new ApiError(
            timedOut ? 'O servidor demorou para responder. Tente novamente.' : 'Operação cancelada.',
            timedOut ? 'timeout' : 'aborted'
        )), { once: true });
    });
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
        const execute = async () => {
            await auth.authStateReady();
            const user = auth.currentUser;
            if (requestUser && user !== requestUser) throw new ApiError('Sua sessão mudou. Entre novamente.', 'session');
            requestUser = user;
            if (!user) throw new ApiError('Sua sessão terminou. Entre novamente.', 'session');
            if (!API_URL) throw new ApiError('O endereço do servidor não está configurado.', 'invalid-response');
            const assertSession = () => {
                if (controller.signal.aborted) throw new ApiError(
                    timedOut ? 'O servidor demorou para responder. Tente novamente.' : 'Operação cancelada.',
                    timedOut ? 'timeout' : 'aborted'
                );
                if (auth.currentUser !== user) throw new ApiError('Sua sessão mudou. Entre novamente.', 'session');
            };
            const send = async (forceRefresh: boolean) => {
                const token = await user.getIdToken(forceRefresh);
                assertSession();
                const headers = new Headers(requestOptions.headers);
                if (/\.loca\.lt(?:\/|$)/i.test(API_URL || '')) headers.set('Bypass-Tunnel-Reminder', 'true');
                else headers.delete('Bypass-Tunnel-Reminder');
                headers.set('Authorization', `Bearer ${token}`);
                const response = await fetch(`${API_URL}${path}`, { ...requestOptions, headers, signal: controller.signal });
                assertSession();
                return response;
            };
            let response = await send(false);
            if (response.status === 401) response = await send(true);
            if (response.status === 401) {
                expiredListeners.forEach(listener => listener());
                throw new ApiError('Sua sessão expirou. Entre novamente.', 'session', 401);
            }
            if (response.ok && !['GET', 'HEAD', 'OPTIONS'].includes((requestOptions.method || 'GET').toUpperCase())) dataRevision++;
            return response;
        };
        return await Promise.race([execute(), aborted]);
    } catch (error) {
        if (error instanceof ApiError) throw error;
        if (controller.signal.aborted) throw new ApiError(
            timedOut ? 'O servidor demorou para responder. Tente novamente.' : 'Operação cancelada.',
            timedOut ? 'timeout' : 'aborted'
        );
        const code = (error as { code?: string })?.code;
        if (code === 'auth/user-token-expired' || code === 'auth/invalid-user-token' || code === 'auth/user-disabled') {
            if (auth.currentUser === requestUser) expiredListeners.forEach(listener => listener());
            throw new ApiError('Sua sessão expirou. Entre novamente.', 'session');
        }
        throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 'network');
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T | null> {
    return readApiJson<T>(await apiFetch(path, options));
}
