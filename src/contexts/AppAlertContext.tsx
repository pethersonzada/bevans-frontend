import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, BackHandler, Pressable, StyleSheet, Text, View, type AlertButton, type AlertOptions } from 'react-native';
import { errorMessage } from '../config/api';
import { theme } from '../styles/theme';

type Request = { owner: object; valid: () => boolean; title: string; message?: string; buttons?: AlertButton[]; options?: AlertOptions };
type Host = { show: (request: Request) => void; remove: (owner: object) => void };
const Context = createContext<Host | null>(null);
const LayerContext = createContext<{ layer: ReactNode; register: () => () => void; dismiss: () => void } | null>(null);

export function useModalAlertClose() {
    const context = useContext(LayerContext);
    return (onClose: () => void) => { if (context?.layer) context.dismiss(); else onClose(); };
}

export function AppAlertModalLayer({ children }: { children: ReactNode }) {
    const context = useContext(LayerContext);
    const register = context?.register;
    useEffect(() => register?.(), [register]);
    return <View style={styles.container}>
        <View style={styles.container} accessibilityElementsHidden={Boolean(context?.layer)} importantForAccessibility={context?.layer ? 'no-hide-descendants' : 'auto'}>{children}</View>
        {context?.layer}
    </View>;
}

// Native form modals share this queue and render its layer in their own view tree.
export function AppAlertProvider({ children }: { children: ReactNode }) {
    const [queue, setQueue] = useState<Request[]>([]);
    const current = queue[0];
    const selected = useRef<Request | null>(null);
    const [modalHosts, setModalHosts] = useState(0);
    const register = useCallback(() => {
        setModalHosts(count => count + 1);
        return () => setModalHosts(count => count - 1);
    }, []);
    const show = useCallback((request: Request) => {
        if (request.valid() && AppState.currentState !== 'background' && AppState.currentState !== 'inactive') {
            setQueue(previous => [...previous, request]);
        }
    }, []);
    const remove = useCallback((owner: object) => setQueue(previous => previous.filter(item => item.owner !== owner)), []);
    const host = useMemo(() => ({ show, remove }), [show, remove]);
    const dismiss = useCallback(() => {
        if (!current || current.options?.cancelable === false || selected.current === current) return;
        selected.current = current;
        setQueue(previous => previous.filter(item => item !== current));
        if (current.valid()) current.options?.onDismiss?.();
    }, [current]);
    useEffect(() => {
        if (!current) return;
        const back = BackHandler.addEventListener('hardwareBackPress', () => { dismiss(); return true; });
        const state = AppState.addEventListener('change', value => {
            if (value !== 'active') setQueue([]);
        });
        return () => { back.remove(); state.remove(); };
    }, [current, dismiss]);
    const choose = (button: AlertButton) => {
        if (!current || selected.current === current) return;
        selected.current = current;
        setQueue(previous => previous.filter(item => item !== current));
        if (!current.valid()) return;
        try {
            Promise.resolve(button.onPress?.()).catch(failure => {
                show({ ...current, title: 'Erro', message: errorMessage(failure), buttons: undefined, options: undefined });
            });
        } catch (failure) {
            show({ ...current, title: 'Erro', message: errorMessage(failure), buttons: undefined, options: undefined });
        }
    };
    const layer = current && <View style={styles.overlay} accessibilityViewIsModal>
                <Pressable style={styles.backdrop} accessible={false} onPress={dismiss} />
                <View style={styles.card}>
                    <Text accessibilityRole="header" style={styles.title}>{current.title}</Text>
                    {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
                    <View style={styles.actions}>
                        {(current.buttons?.length ? current.buttons : [{ text: 'OK' }]).map((button, index) =>
                            <Pressable key={index} accessibilityRole="button" style={styles.button} onPress={() => choose(button)}>
                                <Text style={[styles.label, button.style === 'destructive' && styles.destructive]}>{button.text || 'OK'}</Text>
                            </Pressable>)}
                    </View>
                </View>
            </View>;
    return <Context.Provider value={host}><LayerContext.Provider value={{ layer, register, dismiss }}>
        <View style={styles.container}>
            <View style={styles.container} accessibilityElementsHidden={Boolean(current) && !modalHosts} importantForAccessibility={current && !modalHosts ? 'no-hide-descendants' : 'auto'}>{children}</View>
            {!modalHosts && layer}
        </View>
    </LayerContext.Provider></Context.Provider>;
}

export function useAppAlert() {
    const host = useContext(Context);
    if (!host) throw new Error('useAppAlert requires AppAlertProvider');
    const owner = useRef({});
    const active = useRef(false);
    useFocusEffect(useCallback(() => {
        active.current = true;
        return () => { active.current = false; host.remove(owner.current); };
    }, [host]));
    return useMemo(() => ({
        alert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) =>
            host.show({ owner: owner.current, valid: () => active.current, title, message, buttons, options }),
    }), [host]);
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
    card: { backgroundColor: theme.colors.surface, padding: 24, borderRadius: 12, maxHeight: '90%' },
    title: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
    message: { color: theme.colors.text, fontSize: 16, marginTop: 16 },
    actions: { marginTop: 20, gap: 8 },
    button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 8 },
    label: { color: theme.colors.primary, fontSize: 16, fontWeight: '700' },
    destructive: { color: theme.colors.danger },
});
