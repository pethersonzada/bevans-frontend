import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../styles/theme';
import { AsyncState } from '../AsyncState';
import type { PassageiroTurma } from '../../types/turma';

type Props = {
    passageiros: PassageiroTurma[];
    onRemoverAluno: (id: number, nome: string) => void;
    loading?: boolean;
    error?: string | null;
    onRetry?: () => Promise<unknown>;
};

// Funções puras movidas para fora para não realocar memória a cada render
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

export function ListaPassageirosAprovados({ passageiros, onRemoverAluno, loading, error, onRetry }: Props) {
    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View style={styles.titleContainer}>
                    <Text style={styles.sectionTitle}>Passageiros</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{error && passageiros.length === 0 ? '—' : passageiros.length}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.cardList}>
                {loading && <AsyncState loading title="Carregando passageiros..." />}
                {!loading && error && <AsyncState status="error" message={error} onRetry={onRetry} />}
                {!loading && !error && passageiros.length === 0 && (
                    <AsyncState status="empty" title="Nenhum passageiro vinculado" message="Os passageiros aprovados desta turma aparecerão aqui." />
                )}
                {passageiros.length > 0 && (
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

                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remover ${p.nome || 'passageiro'} da turma`}
                                    onPress={() => onRemoverAluno(p.id, p.nome)}
                                    style={styles.deleteBtn}
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                                </TouchableOpacity>
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
        marginTop: theme.spacing.sm,
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
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: theme.borderRadius.pill,
    },
    countText: {
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
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderStyle: 'dashed',
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
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
        fontWeight: '600',
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
    deleteBtn: {
        padding: theme.spacing.xs,
        borderRadius: theme.borderRadius.sm,
    },
});
