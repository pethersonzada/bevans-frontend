import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registrarDispositivo, revogarDispositivo } from './notificacoes';

const key = (owner: string) => `@bevans:push:${owner}`;
const consentKey = (owner: string) => `@bevans:push:consentimento:${owner}`;
const nativeOwnerKey = '@bevans:push:dono-token';
const pendingNativeKey = '@bevans:push:limpeza-pendente';
let owner: string | null | undefined;
let generation = 0;
let queue = Promise.resolve();
let registered: { owner: string; id: string; token: string; generation: number } | null = null;
let activation: { owner: string; generation: number; promise: Promise<string> } | null = null;

function serial<T>(task: () => Promise<T>): Promise<T> {
    const next = queue.catch(() => {}).then(task);
    queue = next.then(() => {}, () => {});
    return next;
}
export function definirSessaoPush(next: string | null) {
    if (owner !== next) { owner = next; generation++; registered = null; }
}
function assertCurrent(id: string, epoch: number, isCurrent: () => boolean) {
    if ((owner !== undefined && owner !== id) || generation !== epoch || !isCurrent()) throw new Error('A sessão mudou. O registro de notificações foi interrompido.');
}
async function invalidateNative() {
    // A failed deletion blocks future registration until cleanup succeeds.
    await AsyncStorage.setItem(pendingNativeKey, 'true');
    await Notifications.unregisterForNotificationsAsync();
    await AsyncStorage.removeItem(nativeOwnerKey);
    await AsyncStorage.removeItem(pendingNativeKey);
    registered = null;
    try { await Notifications.clearLastNotificationResponseAsync?.(); await Notifications.dismissAllNotificationsAsync?.(); } catch { /* No delivery claim; authorization is rechecked on open. */ }
}
async function prepareNative(id: string) {
    const previous = await AsyncStorage.getItem(nativeOwnerKey);
    // Older app versions saved only per-user installation IDs. Rotate their
    // unscoped native token before restoring any account, including after upgrade.
    const legacy = !previous && (await AsyncStorage.getAllKeys()).some(value => /^@bevans:push:[1-9]\d*$/.test(value));
    if (legacy || (previous && previous !== id) || await AsyncStorage.getItem(pendingNativeKey)) await invalidateNative();
}
export async function prepararSessaoPush(id: string) {
    definirSessaoPush(id);
    if (Platform.OS !== 'android') return;
    const epoch = generation;
    await serial(async () => { await prepareNative(id); assertCurrent(id, epoch, () => true); });
}
function androidOnly() {
    if (Platform.OS !== 'android') throw new Error('O token FCM para iOS ainda precisa ser configurado. O push nativo está disponível para Android; a central continua disponível.');
}
async function register(id: string, epoch: number, isCurrent: () => boolean) {
    assertCurrent(id, epoch, isCurrent);
    await prepareNative(id);
    assertCurrent(id, epoch, isCurrent);
    let token: Awaited<ReturnType<typeof Notifications.getDevicePushTokenAsync>>;
    try { token = await Notifications.getDevicePushTokenAsync(); }
    catch { throw new Error('Não foi possível obter o token Android. Confira a configuração nativa e tente novamente.'); }
    assertCurrent(id, epoch, isCurrent);
    if (token.type !== 'android' || typeof token.data !== 'string' || !token.data.trim()) throw new Error('Token FCM indisponível. Confira a configuração Android e tente novamente.');
    const stored = await AsyncStorage.getItem(key(id));
    assertCurrent(id, epoch, isCurrent);
    const installation = stored || `bevans_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(installation)) throw new Error('O identificador da instalação é inválido. Revogue o registro antes de tentar novamente.');
    await AsyncStorage.setItem(key(id), installation);
    await AsyncStorage.setItem(nativeOwnerKey, id);
    assertCurrent(id, epoch, isCurrent);
    if (registered?.owner === id && registered.id === installation && registered.token === token.data && registered.generation === epoch) return installation;
    try {
        await registrarDispositivo(installation, token.data);
        assertCurrent(id, epoch, isCurrent);
        registered = { owner: id, id: installation, token: token.data, generation: epoch };
        return installation;
    } catch (error) {
        if ((owner !== undefined && owner !== id) || epoch !== generation || !isCurrent()) {
            await invalidateNative();
            throw new Error('A sessão mudou. O token anterior foi invalidado; não foi registrado para a nova conta.');
        }
        throw error;
    }
}
export async function ativarPushAndroid(id: string, isCurrent: () => boolean): Promise<string> {
    androidOnly();
    const epoch = generation;
    if (activation?.owner === id && activation.generation === epoch) return activation.promise;
    const promise = serial(async () => {
        assertCurrent(id, epoch, isCurrent);
        await Notifications.setNotificationChannelAsync('operacional', { name: 'Viagens', importance: Notifications.AndroidImportance.DEFAULT, lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PRIVATE });
        const permission = await Notifications.requestPermissionsAsync();
        assertCurrent(id, epoch, isCurrent);
        if (permission.status !== 'granted') {
            if(await AsyncStorage.getItem(consentKey(id))==='true') { await AsyncStorage.removeItem(consentKey(id)); await revoke(id); }
            throw new Error('Push não autorizado. A central de notificações continua disponível.');
        }
        await AsyncStorage.setItem(consentKey(id), 'true');
        return register(id, epoch, isCurrent);
    });
    activation = { owner: id, generation: epoch, promise };
    void promise.finally(() => { if (activation?.promise === promise) activation = null; }).catch(() => {});
    return promise;
}
// Called on token events/resume, without prompting or opting a user in again.
export function renovarPushAndroid(id: string, isCurrent: () => boolean): Promise<string | null> {
    const epoch = generation;
    return serial(async () => {
        if (Platform.OS !== 'android') return null;
        assertCurrent(id, epoch, isCurrent);
        if (await AsyncStorage.getItem(consentKey(id)) !== 'true') return null;
        const permission = await Notifications.getPermissionsAsync();
        assertCurrent(id, epoch, isCurrent);
        if (permission.status !== 'granted') { await AsyncStorage.removeItem(consentKey(id)); await revoke(id); return null; }
        // Read the native current token, rather than trust an old queued event.
        return register(id, epoch, isCurrent);
    });
}
async function revoke(id: string) {
    const installation = await AsyncStorage.getItem(key(id));
    const nativeOwner = await AsyncStorage.getItem(nativeOwnerKey);
    let remoteFailed = false, nativeFailed = false;
    if (installation) {
        try {
            if(owner!==undefined&&owner!==null&&owner!==id)throw new Error('A sessão mudou.');
            await revogarDispositivo(installation); await AsyncStorage.removeItem(key(id));
        }
        catch { remoteFailed = true; } // Preserve ID for an authenticated retry by the owner.
    }
    if ((installation && !nativeOwner) || nativeOwner === id || await AsyncStorage.getItem(pendingNativeKey)) {
        try { await invalidateNative(); } catch { nativeFailed = true; }
    }
    if (remoteFailed || nativeFailed) throw new Error(nativeFailed
        ? 'A revogação não foi concluída. A limpeza do token Android será exigida antes de registrar outra conta.'
        : 'Token Android invalidado. A revogação no servidor está pendente; reconecte nesta conta para tentar novamente.');
}
function scheduleRevoke(id:string):Promise<void>{
    generation++; registered = null;
    return serial(async () => { await AsyncStorage.removeItem(consentKey(id)); await revoke(id); });
}
export function desativarPush(id: string): Promise<void> {
    if(owner!==undefined&&owner!==id)return Promise.reject(new Error('A sessão mudou. A conta atual não foi alterada.'));
    return scheduleRevoke(id);
}
export function encerrarSessaoPush(id: string): Promise<void> {
    if(owner!==undefined&&owner!==null&&owner!==id)return Promise.reject(new Error('A sessão mudou. A conta atual não foi alterada.'));
    definirSessaoPush(null); // Immediately cancel queued/in-flight activation and renewal.
    return scheduleRevoke(id);
}
