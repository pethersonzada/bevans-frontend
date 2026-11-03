import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../styles/theme';

type Props = {
    passageiros: any[];
    turmaSelecionada: any;
    onAdicionarAluno: () => void;
    onRemoverAluno: (id: number, nome: string) => void;
};

export function ListaPassageirosAprovados({ passageiros, turmaSelecionada, onAdicionarAluno, onRemoverAluno }: Props) {
    const formatarNomeResumido = (nomeCompleto: string) => {
        if (!nomeCompleto) return 'Passageiro';
        const partes = nomeCompleto.trim().split(' ');
        if (partes.length === 1) return partes[0];
        return `${partes[0]} ${partes[1]}`;
    };

    const obterIniciais = (nomeCompleto: string) => {
        if (!nomeCompleto) return 'P';
        const partes = nomeCompleto.trim().split(' ');
        if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
        return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View style={styles.titleContainer}>
                    <Text style={styles.sectionTitle}>Passageiros Aprovados</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{passageiros.length}</Text>
                    </View>
                </View>

                {turmaSelecionada && (
                    <TouchableOpacity onPress={onAdicionarAluno} style={styles.addBtn} activeOpacity={0.7}>
                        <Ionicons name="person-add" size={15} color={theme.colors.primary} />
                        <Text style={styles.addBtnText}>Adicionar</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.cardList}>
                {passageiros.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={36} color={theme.colors.textLight} />
                        <Text style={styles.emptyText}>Nenhum aluno vinculado a esta turma no momento.</Text>
                    </View>
                ) : (
                    passageiros.map(p => {
                        const respondeu = Boolean(p.status);
                        return (
                            <View key={p.id} style={styles.cardItem}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{obterIniciais(p.nome)}</Text>
                                </View>

                                <View style={styles.infoGroup}>
                                    <Text style={styles.nameText} numberOfLines={1}>
                                        {formatarNomeResumido(p.nome)}
                                    </Text>
                                    <View style={styles.statusIndicatorRow}>
                                        <View style={[styles.statusDot, { backgroundColor: respondeu ? theme.colors.success : theme.colors.danger }]} />
                                        <Text style={styles.statusSubText}>
                                            {respondeu ? `Confirmou: ${p.status}` : 'Aguardando resposta'}
                                        </Text>
                                    </View>
                                </View>
                                
                                <View style={styles.actionsGroup}>
                                    <TouchableOpacity 
                                        onPress={() => onRemoverAluno(p.id, p.nome)} 
                                        style={styles.deleteBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.xl,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
        paddingHorizontal: theme.spacing.xs,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    sectionTitle: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    countBadge: {
        backgroundColor: `${theme.colors.primary}15`,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: theme.borderRadius.pill,
    },
    countText: {
        color: theme.colors.primary,
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        backgroundColor: `${theme.colors.primary}10`,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.pill,
        borderWidth: 1,
        borderColor: `${theme.colors.primary}30`,
    },
    addBtnText: {
        color: theme.colors.primary,
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
    },
    cardList: {
        gap: theme.spacing.sm,
    },
    emptyContainer: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.xl,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    emptyText: {
        color: theme.colors.textLight,
        fontSize: theme.typography.size.regular,
        textAlign: 'center',
    },
    cardItem: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: `${theme.colors.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: theme.colors.primary,
        fontWeight: theme.typography.weight.bold,
        fontSize: theme.typography.size.regular,
    },
    infoGroup: {
        flex: 1,
        gap: 2,
    },
    nameText: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    statusIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusSubText: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
    },
    actionsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deleteBtn: {
        width: 36,
        height: 36,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: `${theme.colors.danger}12`,
        justifyContent: 'center',
        alignItems: 'center',
    },
});