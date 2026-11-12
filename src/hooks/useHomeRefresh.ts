import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getApiDataRevision } from '../config/api';
import { createRefreshTask } from '../services/refreshTask';

// Keep fresh screen data when switching tabs, revalidate after writes or 30s.
export function useHomeRefresh(identity: string | null, load: () => Promise<boolean>) {
    const latest = useRef(load);
    latest.current = load;
    const [refreshing, setRefreshing] = useState(false);
    const refresh = useMemo(() => createRefreshTask(() => latest.current(), getApiDataRevision), [identity]);
    useFocusEffect(useCallback(() => {
        if (!identity) return;
        let foreground = !AppState.currentState || AppState.currentState === 'active';
        let online = true;
        const run = (force = false) => { if (foreground && online) void refresh(force).catch(console.error); };
        run();
        const subscription = AppState.addEventListener('change', state => { foreground = state === 'active'; run(); });
        const unsubscribeNetwork = NetInfo.addEventListener(state => {
            const wasOnline = online;
            online = state.isConnected !== false && state.isInternetReachable !== false;
            if (!wasOnline && online) run(true);
        });
        return () => { subscription.remove(); unsubscribeNetwork(); };
    }, [identity, refresh]));
    return {
        refreshing,
        refresh: async () => {
            if (!identity) return;
            setRefreshing(true);
            try { await refresh(true); } finally { setRefreshing(false); }
        },
    };
}
