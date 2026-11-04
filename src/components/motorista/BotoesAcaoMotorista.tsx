import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../styles/theme';

interface BotoesAcaoMotoristaProps {
    viagemAtiva: boolean;
    todosResponderam: boolean;
    onIniciarRota: (sentido: 'IDA' | 'VOLTA') => void;
}

export function BotoesAcaoMotorista({ viagemAtiva, todosResponderam, onIniciarRota }: BotoesAcaoMotoristaProps) {
    const isDesabilitado = viagemAtiva;
    const btnColor = isDesabilitado
        ? theme.colors.border
        : (todosResponderam ? theme.colors.primary : theme.colors.primaryDark);

    return (
        <View style={styles.actionContainer}>
            <Text style={styles.sectionTitle}>{viagemAtiva ? "Acessar Mapa" : "Iniciar Trajeto"}</Text>

            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.btnMotorista, { backgroundColor: btnColor }]}
                    onPress={() => onIniciarRota('IDA')}
                    disabled={isDesabilitado}
                    activeOpacity={0.8}
                >
                    <Ionicons name={viagemAtiva ? "lock-closed" : "arrow-up"} size={20} color={isDesabilitado ? theme.colors.textLight : theme.colors.surface} />
                    <Text style={[styles.btnText, isDesabilitado && styles.btnTextDisabled]}>IDA</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.btnMotorista, { backgroundColor: btnColor }]}
                    onPress={() => onIniciarRota('VOLTA')}
                    disabled={isDesabilitado}
                    activeOpacity={0.8}
                >
                    <Ionicons name={viagemAtiva ? "lock-closed" : "arrow-down"} size={20} color={isDesabilitado ? theme.colors.textLight : theme.colors.surface} />
                    <Text style={[styles.btnText, isDesabilitado && styles.btnTextDisabled]}>VOLTA</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    actionContainer: {
        marginBottom: theme.spacing.sm,
    },
    sectionTitle: {
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.textLight,
        marginBottom: theme.spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    btnMotorista: {
        flex: 1,
        height: 54,
        borderRadius: theme.borderRadius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    btnText: {
        color: theme.colors.surface,
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
    },
    btnTextDisabled: {
        color: theme.colors.textLight,
    },
});