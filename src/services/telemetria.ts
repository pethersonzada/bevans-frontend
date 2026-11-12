import { enviarPosicaoVan } from './viagens';

type Context = { userId: string | null; turmaId: number | null; online: boolean; active: boolean; mounted: boolean };
type Point = { latitude: number; longitude: number };

// This endpoint stores current position, not history. Offline points are never queued.
export function createPositionSender(ownerId: string, context: () => Context) {
    let current: AbortController | null = null;
    return {
        async send(point: Point): Promise<boolean> {
            const snapshot = context();
            if (!snapshot.mounted || !snapshot.online || !snapshot.active || !snapshot.turmaId ||
                snapshot.userId !== ownerId || current) return false;
            const controller = new AbortController();
            current = controller;
            try {
                await enviarPosicaoVan(snapshot.turmaId, point.latitude, point.longitude, controller.signal);
                const latest = context();
                return !controller.signal.aborted && latest.mounted && latest.online && latest.active && latest.userId === ownerId &&
                    latest.turmaId === snapshot.turmaId;
            } finally {
                if (current === controller) current = null;
            }
        },
        cancel() { current?.abort(); current = null; },
    };
}
