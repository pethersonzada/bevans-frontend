import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../config/api';
import { theme } from '../styles/theme';

type Props = {
    status?: 'loading' | 'empty' | 'error';
    loading?: boolean;
    title?: string;
    message?: string;
    onRetry?: () => void | Promise<unknown>;
    onAction?: () => void | Promise<unknown>;
    actionLabel?: string;
    appearance?: 'default' | 'map';
};

export function AsyncState({ status = 'error', loading = false, title, message, onRetry, onAction, actionLabel, appearance = 'default' }: Props) {
    const [retrying, setRetrying] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const pending = useRef(false);
    const currentStatus = loading ? 'loading' : status;
    const busy = currentStatus === 'loading' || retrying;
    const action = onRetry || onAction;
    const foreground = appearance === 'map' ? theme.colors.map.text : theme.colors.text;
    const actionColor = appearance === 'map' ? theme.colors.map.text : theme.colors.primary;
    const heading = retrying ? 'Tentando novamente...' : title || {
        loading: 'Carregando...', empty: 'Nada por aqui ainda', error: 'Não foi possível carregar',
    }[currentStatus];
    const execute = async () => {
        if (!action || pending.current || busy) return;
        pending.current = true;
        setRetrying(true);
        setActionError(null);
        try { await action(); }
        catch (error) { setActionError(errorMessage(error)); }
        finally { pending.current = false; setRetrying(false); }
    };
    return (
        <View style={styles.container} accessibilityLiveRegion="polite" accessibilityState={{ busy }}>
            {busy ? <ActivityIndicator accessibilityLabel={heading} size="large" color={actionColor} /> : (
                <Ionicons accessible={false} name={currentStatus === 'empty' ? 'information-circle-outline' : 'alert-circle-outline'}
                    size={28} color={appearance === 'map' ? theme.colors.map.textLight : theme.colors.textLight} />
            )}
            <Text style={[styles.title, { color: foreground }]} accessibilityRole="header">{heading}</Text>
            {Boolean(actionError || message) && <Text style={[styles.message, { color: foreground }]}>{actionError || message}</Text>}
            {currentStatus !== 'loading' && action && (
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}
                    disabled={busy} onPress={execute} style={[styles.button, { borderColor: actionColor,
                        backgroundColor: appearance === 'map' ? theme.colors.map.surface : theme.colors.surface }]}>
                    <Text style={[styles.action, { color: actionColor }]}>{actionLabel || (onRetry ? 'Tentar novamente' : 'Continuar')}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: theme.spacing.lg, alignItems: 'center', gap: theme.spacing.sm, width: '100%' },
    title: { color: theme.colors.text, fontSize: theme.typography.size.regular, fontWeight: '700', textAlign: 'center' },
    message: { color: theme.colors.text, textAlign: 'center' },
    button: { minHeight: 48, paddingHorizontal: theme.spacing.md, justifyContent: 'center', borderRadius: theme.borderRadius.md,
        borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.surface },
    action: { color: theme.colors.primary, fontWeight: '700', fontSize: theme.typography.size.regular, textAlign: 'center' },
});
