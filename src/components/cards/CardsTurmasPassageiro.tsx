import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { filterTurmas } from '../../services/turmaSearch';
import { theme } from '../../styles/theme';

type TurmaPassageiro = {
    id: number;
    nome?: string;
    turno?: string;
    codigoConvite?: string;
    codigo?: string;
    origemNome?: string;
    destinoNome?: string;
};

type Props = {
    turmas: TurmaPassageiro[];
    turmaSelecionadaId: number | null;
    onSelecionarTurma: (turma: TurmaPassageiro) => void;
    onEntrarTurma: () => void;
};

export function CardsTurmasPassageiro({ turmas, turmaSelecionadaId, onSelecionarTurma, onEntrarTurma }: Props) {
    const [pesquisa, setPesquisa] = useState('');
    const resultados = useMemo(() => filterTurmas(turmas, pesquisa), [turmas, pesquisa]);

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Minhas turmas</Text>
            </View>
            {turmas.length > 0 && (
                <TextInput
                    accessibilityLabel="Pesquisar turma pelo nome ou código"
                    style={styles.search}
                    placeholder="Pesquisar turma ou código"
                    placeholderTextColor={theme.colors.textLight}
                    value={pesquisa}
                    onChangeText={setPesquisa}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    onSubmitEditing={() => {
                        if (pesquisa.trim() && resultados.length === 1) onSelecionarTurma(resultados[0]);
                    }}
                />
            )}
            {resultados.length === 0 && pesquisa.trim() ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>Nenhuma turma encontrada.</Text>
                    <TouchableOpacity onPress={() => setPesquisa('')} accessibilityRole="button">
                        <Text style={styles.actionText}>Limpar pesquisa</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {resultados.map(turma => {
                        const selecionada = turma.id === turmaSelecionadaId;
                        const titulo = turma.nome?.trim() ||
                            (turma.origemNome && turma.destinoNome
                                ? `${turma.origemNome} ➔ ${turma.destinoNome}`
                                : turma.destinoNome || 'Turma sem nome');
                        return (
                            <TouchableOpacity
                                key={turma.id}
                                accessibilityRole="button"
                                accessibilityState={{ selected: selecionada }}
                                accessibilityLabel={`Selecionar turma ${titulo}`}
                                style={[styles.turmaCard, selecionada && styles.turmaCardSelecionada]}
                                onPress={() => onSelecionarTurma(turma)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.iconWrapper, selecionada && styles.iconWrapperSelecionada]}>
                                    <Ionicons name="bus" size={20} color={selecionada ? theme.colors.surface : theme.colors.primary} />
                                </View>
                                <Text numberOfLines={1} style={[styles.turmaNome, selecionada && styles.turmaNomeSelecionada]}>{titulo}</Text>
                                <Text numberOfLines={1} style={[styles.turmaTurno, selecionada && styles.turmaTurnoSelecionada]}>{turma.turno || 'Turno Geral'}</Text>
                            </TouchableOpacity>
                        );
                    })}
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Entrar em outra turma"
                        onPress={onEntrarTurma}
                        style={styles.cardEntrarTurma}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add" size={52} color={theme.colors.primary} />
                        <Text style={styles.entrarText}>Entrar em turma</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: theme.spacing.lg },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.md,
        paddingHorizontal: theme.spacing.xs,
    },
    sectionTitle: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    search: {
        minHeight: 48,
        paddingHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.md,
        color: theme.colors.text,
        backgroundColor: theme.colors.surface,
        fontSize: theme.typography.size.regular,
    },
    scrollContent: { gap: theme.spacing.sm, paddingRight: theme.spacing.md },
    turmaCard: {
        width: 150,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: theme.spacing.xs,
    },
    turmaCardSelecionada: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    iconWrapper: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: `${theme.colors.primary}15`,
        justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    },
    iconWrapperSelecionada: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    turmaNome: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    turmaNomeSelecionada: { color: theme.colors.surface },
    turmaTurno: { fontSize: theme.typography.size.small, color: theme.colors.textLight },
    turmaTurnoSelecionada: { color: 'rgba(255, 255, 255, 0.8)' },
    cardEntrarTurma: {
        width: 150,
        minHeight: 130,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    entrarText: { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
    empty: { padding: theme.spacing.md, gap: theme.spacing.sm },
    emptyText: { color: theme.colors.textLight },
    actionText: { color: theme.colors.primary, fontWeight: '700' },
});
