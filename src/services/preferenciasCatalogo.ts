import AsyncStorage from '@react-native-async-storage/async-storage';
import { recursoId, type FiltrosCatalogo } from './catalogo';

export const filtrosIniciais: FiltrosCatalogo = { cidade: '', destino: '', categoria: '', somenteFavoritas: false };
export function normalizarFiltrosCatalogo(value: unknown): FiltrosCatalogo {
    const data = value && typeof value === 'object' ? value as Partial<FiltrosCatalogo> : {};
    const texto = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 160) : '';
    return { cidade: texto(data.cidade), destino: texto(data.destino),
        categoria: ['ESCOLAR', 'UNIVERSITARIA', 'OUTROS'].includes(String(data.categoria)) ? String(data.categoria) : '',
        somenteFavoritas: data.somenteFavoritas === true };
}
const pendentes = new Map<string, Promise<void>>();
const chave = (conta: string) => `@bevans:catalogo:filtros:v1:${recursoId(conta)}`;
export async function lerFiltrosCatalogo(conta: string): Promise<FiltrosCatalogo> {
    const key = chave(conta);
    await pendentes.get(key)?.catch(() => {});
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { ...filtrosIniciais };
    try { const saved = JSON.parse(raw); return saved?.versao === 1 ? normalizarFiltrosCatalogo(saved.filtros) : { ...filtrosIniciais }; }
    catch { return { ...filtrosIniciais }; }
}
export function salvarFiltrosCatalogo(conta: string, filtros: FiltrosCatalogo): Promise<void> {
    const key = chave(conta), payload = JSON.stringify({ versao: 1, filtros: normalizarFiltrosCatalogo(filtros) });
    const write = (pendentes.get(key) || Promise.resolve()).catch(() => {}).then(() => AsyncStorage.setItem(key, payload));
    pendentes.set(key, write);
    return write.finally(() => { if (pendentes.get(key) === write) pendentes.delete(key); });
}
