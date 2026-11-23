import { themedStyles } from '../../styles/themedStyles';
import { useThemeRevision } from '../../hooks/useThemeRevision';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { filterTurmas } from '../../services/turmaSearch';
import { theme } from '../../styles/theme';
import { AsyncState } from '../AsyncState';

import type { Turma } from '../../types/turma';

type Props = {
    turmas: Turma[];
    turmaSelecionada: Turma | null;
    onSelecionarTurma: (turma: Turma) => void;
    onEditarTurma: () => void;
};

export function CardsTurmasMotorista({ turmas, turmaSelecionada, onSelecionarTurma, onEditarTurma }: Props) {
    useThemeRevision();
    const router = useRouter();
    const [pesquisa, setPesquisa] = useState('');
    const resultados = useMemo(() => filterTurmas(turmas, pesquisa), [turmas, pesquisa]);

    return (
        <View style={styles.container}>

            <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Minhas turmas</Text>

                {turmaSelecionada && (
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Configurações da turma selecionada"
                        onPress={onEditarTurma}
                        style={styles.btnEditar}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="settings-outline"
                            size={18}
                            color={theme.colors.primary}
                        />
                        <Text style={styles.btnEditarText}>Configurar</Text>
                    </TouchableOpacity>
                )}
            </View>


            {turmas.length > 0 && <TextInput accessibilityLabel="Pesquisar turma pelo nome ou código"
                style={styles.search} placeholder="Pesquisar turma ou código" placeholderTextColor={theme.colors.textLight}
                value={pesquisa} onChangeText={setPesquisa} autoCorrect={false} autoCapitalize="none"
                returnKeyType="search" onSubmitEditing={() => {
                    if (pesquisa.trim() && resultados.length === 1) onSelecionarTurma(resultados[0]);
                }} />}
            {turmas.length === 0 ? (
                <AsyncState status="empty" title="Nenhuma turma cadastrada" message="Crie sua primeira turma para organizar os passageiros e o percurso."
                    actionLabel="Criar turma" onAction={() => router.push('/cadastro-turma')} />
            ) : resultados.length === 0 ? (
                <AsyncState status="empty" title="Nenhuma turma encontrada"
                    message="Confira o código ou pesquise pelo nome. A busca inclui somente suas turmas."
                    actionLabel="Limpar pesquisa" onAction={() => setPesquisa('')} />
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {resultados.map(t => {
                        const selecionada = turmaSelecionada?.id === t.id;

                        const tituloExibicao = t.nome?.trim()
                            ? t.nome
                            : (t.origemNome && t.destinoNome ? `${t.origemNome} ➔ ${t.destinoNome}` : (t.destinoNome || 'Rota sem nome'));

                        return (
                            <TouchableOpacity
                                key={t.id}
                                style={[styles.turmaCard, selecionada && styles.turmaCardSelecionada]}
                                onPress={() => onSelecionarTurma(t)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.iconWrapper, selecionada && styles.iconWrapperSelecionada]}>
                                    <Ionicons
                                        name="bus"
                                        size={20}
                                        color={selecionada ? theme.colors.surface : theme.colors.primary}
                                    />
                                </View>

                                <Text
                                    style={[styles.turmaNome, selecionada && styles.turmaNomeSelecionada]}
                                    numberOfLines={1}
                                >
                                    {tituloExibicao}
                                </Text>

                                <Text style={[styles.turmaTurno, selecionada && styles.turmaTurnoSelecionada]}>
                                    {t.turno || 'Turno Geral'}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}


                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Criar nova turma"
                        onPress={() => router.push('/cadastro-turma')}
                        style={styles.cardNovaTurma}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="add"
                            size={56}
                            color={theme.colors.primary}
                        />
                        <Text style={styles.cardNovaTurmaTexto}>
                            Nova turma
                        </Text>
                    </TouchableOpacity>

                </ScrollView>
            )}
        </View>
    );
}

const styles = themedStyles(() => StyleSheet.create({
    search: {
        minHeight: 48, paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm,
        borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md,
        color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.typography.size.regular
    },
    container: {
        marginBottom: theme.spacing.lg,
    },
    headerRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
        paddingHorizontal: theme.spacing.xs,
    },
    sectionTitle: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    btnEditar: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.borderRadius.pill,
        backgroundColor: `${theme.colors.primary}12`,
        borderWidth: 1,
        borderColor: `${theme.colors.primary}30`,
    },
    btnEditarText: {
        color: theme.colors.primary,
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
    },
    btnNova: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: theme.colors.primary,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.pill,
    },
    btnNovaText: {
        color: theme.colors.surface,
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
    },
    emptyContainer: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.xl,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    emptyText: {
        color: theme.colors.textLight,
        fontSize: theme.typography.size.regular,
        textAlign: 'center',
    },
    scrollContent: {
        gap: theme.spacing.sm,
        paddingRight: theme.spacing.md,
    },
    turmaCard: {
        width: 150,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: theme.spacing.xs,
    },
    turmaCardSelecionada: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    iconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: `${theme.colors.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    iconWrapperSelecionada: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    turmaNome: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    turmaNomeSelecionada: {
        color: theme.colors.surface,
    },
    turmaTurno: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
    },
    turmaTurnoSelecionada: {
        color: theme.colors.surface,
    },

    cardNovaTurma: {
        width: 140,
        minHeight: 130,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 0.2,
        borderStyle: 'solid',
        borderColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },

    cardNovaTurmaTexto: {
        color: theme.colors.primary,
        fontSize: 13,
        fontWeight: '700',
    },
}));
