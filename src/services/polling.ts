export function createPolling(task: (signal: AbortSignal) => Promise<void>, intervalMs: number, immediate = true) {
    let current: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
        current?.abort();
        current = null;
        if (timer) clearTimeout(timer);
        timer = null;
    };
    return {
        start() {
            if (current) return;
            const controller = new AbortController();
            current = controller;
            const tick = async () => {
                try { await task(controller.signal); }
                catch (error) { if (!controller.signal.aborted) console.error('Falha ao atualizar dados', error); }
                finally {
                    if (current === controller) timer = setTimeout(tick, intervalMs);
                }
            };
            if (immediate) void tick(); else timer = setTimeout(tick, intervalMs);
        },
        stop,
    };
}
