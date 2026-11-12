import * as Location from 'expo-location';
import { withDeadline } from './asyncOperation';

export type Coordinates = { latitude: number; longitude: number };
export function validCoordinates(latitude: unknown, longitude: unknown): boolean {
    return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
        typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

export async function getCurrentCoordinates({ signal, accuracy = Location.Accuracy.Balanced }: {
    signal?: AbortSignal; accuracy?: Location.Accuracy;
} = {}): Promise<Coordinates> {
    return withDeadline(async activeSignal => {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (activeSignal.aborted) throw new Error('Operação cancelada.');
        if (permission.status !== 'granted') throw new Error('Localização não autorizada. Você pode pesquisar o endereço manualmente.');
        if (!await Location.hasServicesEnabledAsync()) throw new Error('O GPS está desligado. Ative a localização ou pesquise um endereço.');
        if (activeSignal.aborted) throw new Error('Operação cancelada.');
        const location = await Location.getCurrentPositionAsync({ accuracy });
        const { latitude, longitude } = location.coords;
        if (!validCoordinates(latitude, longitude)) throw new Error('O GPS retornou uma localização inválida. Tente novamente.');
        return { latitude, longitude };
    }, { signal, timeoutMs: 20000, timeoutMessage: 'Não foi possível obter o GPS a tempo. Tente novamente ou pesquise um endereço.' });
}
