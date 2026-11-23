export type PreferenciaAparencia = 'system' | 'light' | 'dark';
export const APARENCIA_KEY = '@bevans:aparencia:v1';
export function lerPreferenciaAparencia(value: unknown): PreferenciaAparencia {
    return value === 'light' || value === 'dark' ? value : 'system';
}
export function resolverAparencia(preferencia: PreferenciaAparencia, sistema: string | null | undefined): 'light' | 'dark' {
    return preferencia === 'system' ? sistema === 'dark' ? 'dark' : 'light' : preferencia;
}
