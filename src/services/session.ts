import { ApiError, apiRequest } from '../config/api';

export type SessionUser = { id: string | null; nome: string; tipo: string; endereco: string };
export const EMPTY_USER: SessionUser = { id: null, nome: '', tipo: '', endereco: '' };
export const SESSION_KEYS = ['userId', 'userName', 'userTipo', 'userEndereco', 'firebaseUid'];

export function profileToUser(profile: unknown): SessionUser {
    const data = profile as Record<string, unknown> | null;
    const id = data?.id;
    if (!((typeof id === 'number' || typeof id === 'string') && /^[1-9]\d*$/.test(String(id))) ||
        !['PASSAGEIRO', 'ALUNO', 'MOTORISTA'].includes(String(data?.tipo))) {
        throw new ApiError('O perfil da conta é inválido. Entre em contato com o suporte.', 'invalid-response');
    }
    return {
        id: String(id),
        nome: typeof data?.nome === 'string' ? data.nome : 'Usuário',
        tipo: String(data?.tipo),
        endereco: typeof data?.enderecoCompleto === 'string' ? data.enderecoCompleto : 'Endereço Pendente',
    };
}

export async function fetchSessionUser(uid: string) {
    return profileToUser(await apiRequest(`/usuarios/por-uid/${encodeURIComponent(uid)}`));
}
