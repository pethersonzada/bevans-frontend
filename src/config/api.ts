import { API_URL } from './config';
import { auth } from './firebase';

export async function apiFetch(path: string, options: RequestInit = {}) {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;

    const headers: Record<string, string> = {
        'Bypass-Tunnel-Reminder': 'true',
        ...(options.headers as Record<string, string>),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    return fetch(`${API_URL}${path}`, { ...options, headers });
}