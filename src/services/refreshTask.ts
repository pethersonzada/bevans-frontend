// Screen-local freshness and single-flight, without persisting private API data.
export function createRefreshTask(
    load: () => Promise<boolean>,
    revision: () => number,
    staleMs = 30000,
    now = Date.now
) {
    let lastSuccess: { time: number; revision: number } | null = null;
    let pending: Promise<boolean> | null = null;
    let pendingRevision = 0;
    function refresh(force = false): Promise<boolean> {
        if (pending) {
            if (pendingRevision !== revision()) return pending.then(() => refresh(force));
            return pending;
        }
        if (!force && lastSuccess && lastSuccess.revision === revision() && now() - lastSuccess.time < staleMs) {
            return Promise.resolve(true);
        }
        const startRevision = revision();
        pendingRevision = startRevision;
        pending = Promise.resolve().then(load).then(success => {
            if (success) lastSuccess = { time: now(), revision: startRevision };
            return success;
        }).finally(() => { pending = null; });
        return pending;
    }
    return refresh;
}
