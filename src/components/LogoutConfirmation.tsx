import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../config/api';
import { theme } from '../styles/theme';
import { FormFeedback } from './FormFeedback';

type Props = { onConfirm: () => Promise<void>; onCancel: () => void };

// Render in the existing screen instead of Android's Activity-backed Alert API.
export function LogoutConfirmation({ onConfirm, onCancel }: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pending = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        const back = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!pending.current) onCancel();
            return true;
        });
        const appState = AppState.addEventListener('change', state => {
            if (state !== 'active' && !pending.current) onCancel();
        });
        return () => { mounted.current = false; back.remove(); appState.remove(); };
    }, [onCancel]);

    const confirm = async () => {
        if (pending.current || !mounted.current) return;
        pending.current = true;
        setBusy(true);
        setError(null);
        try {
            await onConfirm();
            if (mounted.current) onCancel();
        } catch (failure) {
            // The auth layout can unmount this screen before cleanup finishes.
            if (mounted.current) setError(errorMessage(failure, 'Não foi possível encerrar a sessão. Tente novamente.'));
            else console.error('Falha ao concluir limpeza da sessão', failure);
        } finally {
            pending.current = false;
            if (mounted.current) setBusy(false);
        }
    };

    return (
        <View style={styles.overlay} accessibilityViewIsModal>
            <Pressable style={styles.backdrop} accessible={false} disabled={busy} onPress={onCancel} />
            <View style={styles.card}>
                <Text style={styles.title} accessibilityRole="header">Encerrar sessão</Text>
                <Text style={styles.message}>Deseja realmente sair do aplicativo?</Text>
                <FormFeedback message={error} />
                <View style={styles.actions}>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.button}
                        accessibilityState={{ disabled: busy }}>
                        <Text style={styles.cancel}>Cancelar</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={confirm} style={[styles.button, styles.confirm]}
                        accessibilityState={{ disabled: busy, busy }} accessibilityLabel={busy ? 'Encerrando sessão' : 'Sair'}>
                        {busy ? <ActivityIndicator color={theme.colors.surface} accessibilityLabel="Encerrando sessão" />
                            : <Text style={styles.confirmText}>Sair</Text>}
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center', padding: theme.spacing.lg, zIndex: 100 },
    card: { backgroundColor: theme.colors.surface, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg },
    title: { color: theme.colors.text, fontSize: theme.typography.size.large, fontWeight: '700', textAlign: 'center' },
    message: { color: theme.colors.text, fontSize: theme.typography.size.regular, textAlign: 'center', marginTop: theme.spacing.md },
    actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
    button: { flex: 1, minHeight: 48, padding: theme.spacing.sm, alignItems: 'center', justifyContent: 'center',
        borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border },
    confirm: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    cancel: { color: theme.colors.text, fontSize: theme.typography.size.regular, fontWeight: '700' },
    confirmText: { color: theme.colors.surface, fontSize: theme.typography.size.regular, fontWeight: '700' },
});
