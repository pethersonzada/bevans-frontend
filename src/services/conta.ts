import { EmailAuthProvider, reauthenticateWithCredential, updateEmail } from 'firebase/auth';
import { apiFetch, apiRequest, readApiError } from '../config/api';
import { auth } from '../config/firebase';

export function accountErrorMessage(error: unknown): string {
    const code = (error as { code?: string })?.code;
    const messages: Record<string, string> = {
        'auth/wrong-password': 'A senha atual informada está incorreta.',
        'auth/invalid-credential': 'A senha atual informada está incorreta.',
        'auth/email-already-in-use': 'Este e-mail já está em uso por outra conta.',
        'auth/invalid-email': 'O formato do e-mail é inválido.',
        'auth/requires-recent-login': 'Entre novamente antes de alterar sua conta.',
        'auth/network-request-failed': 'Não foi possível conectar. Verifique sua conexão e tente novamente.',
        'auth/operation-not-allowed': 'A alteração precisa ser autorizada pelo serviço de autenticação. Verifique seu e-mail ou procure o suporte.',
    };
    if (code?.startsWith('auth/')) return messages[code] || 'Não foi possível atualizar a autenticação da conta.';
    return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

export class EmailSyncPendingError extends Error {
    constructor() {
        super('O e-mail de acesso foi alterado, mas não foi possível confirmar a sincronização com o servidor. Mantenha o novo e-mail informado e tente salvar novamente.');
        this.name = 'EmailSyncPendingError';
    }
}

export async function alterarEmailConta(userId: string, email: string, password: string): Promise<void> {
    const user = auth.currentUser;
    if (!user?.email || !/^[1-9]\d*$/.test(userId)) throw new Error('Sessão inválida. Entre novamente.');
    const previousEmail = user.email;
    const nextEmail = email.trim().toLowerCase();
    const assertSession = () => {
        if (auth.currentUser !== user) throw new Error('Sua sessão mudou. Entre novamente.');
    };
    const readProfile = () => apiRequest<{ id: number; email: string }>(`/usuarios/por-uid/${encodeURIComponent(user.uid)}`);
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(previousEmail, password));
    assertSession();
    const profile = await readProfile();
    assertSession();
    if (!profile || String(profile.id) !== userId) throw new Error('O perfil autenticado não corresponde à conta.');
    if (previousEmail.toLowerCase() === nextEmail && profile.email?.toLowerCase() === nextEmail) return;

    // Change Firebase first: a provider refusal must not change the backend profile.
    const changedFirebase = previousEmail.toLowerCase() !== nextEmail;
    if (changedFirebase) await updateEmail(user, nextEmail);
    assertSession();
    if (profile.email?.toLowerCase() === nextEmail) return;

    try {
        const response = await apiFetch(`/usuarios/${userId}/email`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: nextEmail }),
        });
        if (!response.ok) throw await readApiError(response);
    } catch (error) {
        assertSession();
        let serverEmail: string | undefined;
        // A timeout may follow a successful commit. Read back before compensating.
        try {
            const current = await readProfile();
            if (current && String(current.id) === userId) serverEmail = current.email?.toLowerCase();
        } catch { /* Unknown server outcome: never roll back blindly. */ }
        assertSession();
        if (serverEmail === nextEmail) return;
        if (changedFirebase && serverEmail === previousEmail.toLowerCase()) {
            if (user.email?.toLowerCase() !== nextEmail) throw new EmailSyncPendingError();
            try { await updateEmail(user, previousEmail); }
            catch { throw new EmailSyncPendingError(); }
            throw error;
        }
        throw new EmailSyncPendingError();
    }
}

export async function excluirContaServidor(userId: string): Promise<void> {
    if (!/^[1-9]\d*$/.test(userId)) throw new Error('Conta inválida. Entre novamente.');
    const response = await apiFetch(`/usuarios/${userId}`, { method: 'DELETE' });
    if (!response.ok) throw await readApiError(response);
    // Firebase deletion is owned by UsuarioService; only clear the local session afterwards.
}
