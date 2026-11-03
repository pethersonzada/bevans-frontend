import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../styles/theme';

type Props = {
    viagemAtiva: boolean;
    todosResponderam: boolean;
    onIniciarRota: (sentido: string) => void;
};

export function BotoesAcaoMotorista({ viagemAtiva, todosResponderam, onIniciarRota }: Props) {
    const btnColor = viagemAtiva
        ? theme.colors.textLight
        : (todosResponderam ? theme.colors.primary : theme.colors.primaryDark);

    return (
        <View style={styles.actionContainer}>
            <Text style={styles.sectionTitle}>{viagemAtiva ? "Acessar Mapa" : "Iniciar Trajeto"}</Text>

            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.btnMotorista, { backgroundColor: btnColor }]}
                    onPress={() => onIniciarRota('IDA')}
                    disabled={viagemAtiva}
                >
                    <Ionicons name={viagemAtiva ? "lock-closed" : "arrow-up"} size={20} color={theme.colors.surface} />
                    <Text style={styles.btnText}>IDA</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.btnMotorista, { backgroundColor: btnColor }]}
                    onPress={() => onIniciarRota('VOLTA')}
                    disabled={viagemAtiva}
                >
                    <Ionicons name={viagemAtiva ? "lock-closed" : "arrow-down"} size={20} color={theme.colors.surface} />
                    <Text style={styles.btnText}>VOLTA</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    actionContainer: {
        marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.textLight,
        marginBottom: theme.spacing.sm,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    btnMotorista: {
        flex: 1,
        height: 50,
        borderRadius: theme.borderRadius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
    },
    btnText: {
        color: theme.colors.surface,
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
    },
});