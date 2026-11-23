import { getThemeMode, type ThemeMode } from './theme';

// Evaluate each stylesheet once per palette. Reading a style follows the active
// palette without remounting the component or recreating styles on every render.
export function themedStyles<T extends object>(factory: () => T): T {
    const cache = new Map<ThemeMode, T>();
    const current = () => {
        const mode = getThemeMode();
        let value = cache.get(mode);
        if (!value) { value = factory(); cache.set(mode, value); }
        return value;
    };
    return new Proxy({} as T, {
        get: (_target, key) => Reflect.get(current(), key),
        ownKeys: () => Reflect.ownKeys(current()),
        getOwnPropertyDescriptor: (_target, key) => {
            const descriptor = Reflect.getOwnPropertyDescriptor(current(), key);
            return descriptor ? { ...descriptor, configurable: true } : undefined;
        },
    });
}
