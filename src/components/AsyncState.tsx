import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../styles/theme';

type Props = { loading?: boolean; message?: string; onRetry?: () => void };

export function AsyncState({ loading = false, message, onRetry }: Props) {
    return (
        <View style={styles.container} accessibilityLiveRegion="polite">
            {loading && <ActivityIndicator size="large" color={theme.colors.primary} />}
            <Text style={styles.message}>{loading ? 'Carregando...' : message}</Text>
            {!loading && onRetry && (
                <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={styles.button}>
                    <Text style={styles.action}>Tentar novamente</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: theme.spacing.lg, alignItems: 'center', gap: theme.spacing.sm },
    message: { color: theme.colors.text, textAlign: 'center' },
    button: { minHeight: 48, paddingHorizontal: theme.spacing.md, justifyContent: 'center' },
    action: { color: theme.colors.primary, fontWeight: '700' },
});
