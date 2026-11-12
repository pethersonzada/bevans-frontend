import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../styles/theme';
import type { Turma } from '../../types/turma';

interface CardTurmaPassageiroProps {
    turma: Turma | null;
}

export function CardTurmaPassageiro({ turma }: CardTurmaPassageiroProps) {
    if (!turma) {
        return null;
    }

    return (
        <View style={styles.card}>
            <View style={styles.iconCircle}>
                <Ionicons name="bus" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.info}>
                <Text style={styles.nome}>{turma.nome}</Text>
                <Text style={styles.turno}>Turno: {turma.turno || 'Não informado'}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        backgroundColor: `${theme.colors.primary}15`,
        padding: theme.spacing.xs + 2,
        borderRadius: theme.borderRadius.md,
        marginRight: theme.spacing.md,
    },
    info: {
        flex: 1,
    },
    nome: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    turno: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        marginTop: 2,
    },
});
