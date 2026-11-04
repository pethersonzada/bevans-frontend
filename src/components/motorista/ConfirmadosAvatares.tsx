import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../styles/theme';

export interface PassageiroResumido {
    nome: string;
    iniciais?: string;
}

interface ConfirmadosAvataresProps {
    passageiros: PassageiroResumido[];
}

export default function ConfirmadosAvatares({ passageiros = [] }: ConfirmadosAvataresProps) {
    const maxVisiveis = 4;
    
    const { visiveis, excedentes } = useMemo(() => {
        return {
            visiveis: passageiros.slice(0, maxVisiveis),
            excedentes: passageiros.length - maxVisiveis
        };
    }, [passageiros]);

    return (
        <View style={styles.container}>
            <View style={styles.avatarGroup}>
                {visiveis.map((passageiro, index) => (
                    <View
                        key={index}
                        style={[styles.avatarCircle, { zIndex: maxVisiveis - index, marginLeft: index > 0 ? -12 : 0 }]}
                    >
                        <Text style={styles.avatarText}>{passageiro.iniciais || 'P'}</Text>
                    </View>
                ))}
            </View>
            
            <View style={styles.textContainer}>
                {passageiros.length > 0 ? (
                    <Text style={styles.infoText}>
                        <Text style={styles.boldText}>{passageiros.length}</Text> {passageiros.length === 1 ? 'confirmado' : 'confirmados'} na rota
                        {excedentes > 0 && <Text> +{excedentes}</Text>}
                    </Text>
                ) : (
                    <Text style={styles.emptyText}>Nenhuma confirmação ainda</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    avatarGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarCircle: {
        height: 36,
        width: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: theme.colors.surface,
        backgroundColor: theme.colors.primaryDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: theme.colors.surface,
        fontSize: 12,
        fontWeight: theme.typography.weight.bold,
        textTransform: 'uppercase',
    },
    textContainer: {
        flex: 1,
    },
    infoText: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
    },
    boldText: {
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    emptyText: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
    },
});