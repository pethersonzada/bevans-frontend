// The notification ID is only a hint. The central loads its authorized context.
export function criarAberturaPush(isCurrent: () => boolean, open: (id: string) => void) {
    const seen = new Set<string>();
    return (value: unknown) => {
        if (!isCurrent()) return;
        const id = String((value as { notificacaoId?: unknown })?.notificacaoId || '');
        if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || seen.has(id)) return;
        seen.add(id);
        if (seen.size > 100) seen.delete(seen.values().next().value!);
        open(id);
    };
}
