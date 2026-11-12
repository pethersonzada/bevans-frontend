export class OperationError extends Error {
    constructor(message: string, public readonly kind: 'timeout' | 'cancelled') {
        super(message);
        this.name = 'OperationError';
    }
}

// Bounds the entire operation, including token/body/native-provider waits.
export async function withDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, {
    signal, timeoutMs = 15000, timeoutMessage = 'A operação demorou para responder. Tente novamente.',
}: { signal?: AbortSignal; timeoutMs?: number; timeoutMessage?: string } = {}): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const aborted = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new OperationError(
            timedOut ? timeoutMessage : 'Operação cancelada.', timedOut ? 'timeout' : 'cancelled'
        )), { once: true });
    });
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
        const run = Promise.resolve().then(() => {
            if (controller.signal.aborted) throw new OperationError('Operação cancelada.', 'cancelled');
            return operation(controller.signal);
        });
        return await Promise.race([run, aborted]);
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
    }
}
