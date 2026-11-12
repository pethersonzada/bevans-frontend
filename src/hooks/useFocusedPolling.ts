import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { createPolling } from '../services/polling';

export function useFocusedPolling(task: (signal: AbortSignal) => Promise<void>, intervalMs: number, enabled: string | false, immediate = true) {
    const latest = useRef(task);
    latest.current = task;
    useFocusEffect(useCallback(() => {
        if (!enabled) return;
        const polling = createPolling(signal => latest.current(signal), intervalMs, immediate);
        let foreground = !AppState.currentState || AppState.currentState === 'active';
        let online = true;
        const synchronize = () => { if (foreground && online) polling.start(); else polling.stop(); };
        synchronize();
        const subscription = AppState.addEventListener('change', state => {
            foreground = state === 'active';
            synchronize();
        });
        const unsubscribeNetwork = NetInfo.addEventListener(state => {
            online = state.isConnected !== false && state.isInternetReachable !== false;
            synchronize();
        });
        return () => { polling.stop(); subscription.remove(); unsubscribeNetwork(); };
    }, [enabled, intervalMs, immediate]));
}
