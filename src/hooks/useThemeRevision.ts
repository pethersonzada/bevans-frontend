import { useSyncExternalStore } from 'react';
import { getThemeMode, subscribeTheme } from '../styles/theme';

export function useThemeRevision() {
    return useSyncExternalStore(subscribeTheme, getThemeMode, () => 'light' as const);
}
