import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';

type Props = {
    nomeMotorista: string;
    totalPendentes: number;
    onAbrirNotificacoes: () => void;
};

export function HeaderMotorista({ nomeMotorista, totalPendentes, onAbrirNotificacoes }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
            <View style={styles.textGroup}>
                <Text style={styles.dateText}>
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <Text style={styles.welcome}>Olá, {nomeMotorista}</Text>
            </View>

            <TouchableOpacity 
                onPress={onAbrirNotificacoes} 
                style={styles.notifButton}
                activeOpacity={0.7}
            >
                <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
                {totalPendentes > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{totalPendentes}</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    textGroup: {
        gap: 2,
    },
    dateText: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    welcome: {
        fontSize: 22,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    notifButton: {
        width: 48,
        height: 48,
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: theme.colors.danger,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
        borderWidth: 2,
        borderColor: theme.colors.surface,
    },
    badgeText: {
        color: theme.colors.surface,
        fontSize: 10,
        fontWeight: theme.typography.weight.bold,
    },
});