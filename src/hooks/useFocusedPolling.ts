import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { createPolling } from '../services/polling';

export function useFocusedPolling(task: (signal: AbortSignal) => Promise<void>, intervalMs: number, enabled: string | false, immediate = true) {
    const latest = useRef(task);
    latest.current = task;
    useFocusEffect(useCallback(() => {
        if (!enabled) return;
        const polling = createPolling(signal => latest.current(signal), intervalMs, immediate);
        if (!AppState.currentState || AppState.currentState === 'active') polling.start();
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') polling.start(); else polling.stop();
        });
        return () => { polling.stop(); subscription.remove(); };
    }, [enabled, intervalMs, immediate]));
}
