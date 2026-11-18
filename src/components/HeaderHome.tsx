import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useFocusedPolling } from '../hooks/useFocusedPolling';
import { AtalhoNotificacoes } from './AtalhoNotificacoes';
import { theme } from '../styles/theme';

export function HeaderHome({ nome }: { nome: string }) {
    const insets = useSafeAreaInsets();
    const [agora, setAgora] = useState(() => new Date());
    useFocusedPolling(async () => setAgora(new Date()), 60000, 'header:data');
    return <View style={[styles.header, {
        paddingTop: insets.top + theme.spacing.md,
        paddingLeft: insets.left + theme.spacing.lg,
        paddingRight: insets.right + theme.spacing.lg,
    }]}>
        <View style={styles.textGroup}>
            <Text style={styles.dateText}>{agora.toLocaleDateString('pt-BR', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
            <Text accessibilityRole="header" style={styles.welcome}>Olá, {nome.trim() || 'Boas-vindas'}</Text>
        </View>
        <AtalhoNotificacoes />
    </View>;
}

const styles = StyleSheet.create({
    header: { paddingBottom: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
        backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    textGroup: { flex: 1, minWidth: 0, gap: 2 },
    dateText: { fontSize: theme.typography.size.small, color: theme.colors.textLight,
        textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5 },
    welcome: { fontSize: 22, fontWeight: theme.typography.weight.bold, color: theme.colors.text, flexShrink: 1 },
});
