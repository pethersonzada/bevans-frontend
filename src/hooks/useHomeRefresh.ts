import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
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
        const run = () => { void refresh().catch(console.error); };
        if (!AppState.currentState || AppState.currentState === 'active') run();
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') run(); });
        return () => subscription.remove();
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
