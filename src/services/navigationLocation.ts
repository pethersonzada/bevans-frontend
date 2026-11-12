import * as Location from 'expo-location';
import { Platform } from 'react-native';

export class NavigationLocationError extends Error {
    constructor(public readonly reason: 'denied' | 'blocked' | 'services') {
        super(reason === 'blocked'
            ? 'O acesso à localização está bloqueado. Abra as configurações, permita a localização para este aplicativo e tente novamente.'
            : reason === 'denied'
                ? 'Permita o acesso à localização para iniciar a navegação.'
                : 'A localização do aparelho está desligada. Ative o GPS e tente novamente.');
    }
}

export async function ensureNavigationLocation(isActive: () => boolean) {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!isActive()) return false;
    if (permission.status !== 'granted') {
        throw new NavigationLocationError(permission.canAskAgain === false ? 'blocked' : 'denied');
    }
    if (!await Location.hasServicesEnabledAsync()) {
        if (!isActive()) return false;
        if (Platform.OS === 'android') {
            // Android displays its own consent prompt to enable location services.
            try { await Location.enableNetworkProviderAsync(); } catch {
                if (isActive()) throw new NavigationLocationError('services');
                return false;
            }
        }
        if (!isActive()) return false;
        if (!await Location.hasServicesEnabledAsync()) throw new NavigationLocationError('services');
    }
    return isActive();
}
