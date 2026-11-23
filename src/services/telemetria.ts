import { enviarPosicaoVan } from './viagens';

type Context = { userId: string | null; turmaId: number | null; online: boolean; active: boolean; mounted: boolean };
type Point = { latitude: number; longitude: number; precisao?:number;observadoEm?:string };

// This endpoint stores current position, not history. Offline points are never queued.
export function createPositionSender(ownerId: string, context: () => Context) {
    let current: AbortController | null = null;
    let lastAttempt=0;
    let lastTurma:number|null=null;
    return {
        async send(point: Point): Promise<boolean> {
            const snapshot = context();
            if (!snapshot.mounted || !snapshot.online || !snapshot.active || !snapshot.turmaId ||
                snapshot.userId !== ownerId || current) return false;
            const now=Date.now();
            if(lastTurma===snapshot.turmaId&&now-lastAttempt<5000)return false;
            lastAttempt=now;lastTurma=snapshot.turmaId;
            const controller = new AbortController();
            current = controller;
            try {
                await enviarPosicaoVan(snapshot.turmaId, point.latitude, point.longitude, controller.signal,
                    point.precisao!=null&&point.observadoEm?{precisao:point.precisao,observadoEm:point.observadoEm}:undefined);
                const latest = context();
                return !controller.signal.aborted && latest.mounted && latest.online && latest.active && latest.userId === ownerId &&
                    latest.turmaId === snapshot.turmaId;
            } finally {
                if (current === controller) {
                    // A API limita o intervalo entre recebimentos. Uma leitura
                    // de status lenta antes do PUT não pode liberar nova amostra
                    // imediatamente após a resposta da anterior.
                    lastAttempt = Date.now();
                    current = null;
                }
            }
        },
        cancel() { current?.abort(); current = null; },
    };
}
