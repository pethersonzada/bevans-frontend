import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../styles/theme';

type Turma = {
    id: number;
    nome?: string;
    origemNome?: string;
    destinoNome?: string;
    turno: string;
};

type Props = {
    turmas: Turma[];
    turmaSelecionada: Turma | null;
    onSelecionarTurma: (turma: Turma) => void;
    onEditarTurma: () => void;
};

export function CardsTurmasMotorista({ turmas, turmaSelecionada, onSelecionarTurma, onEditarTurma }: Props) {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Turmas e Rotas</Text>
                
                <View style={styles.actionsContainer}>
                    {turmaSelecionada && (
                        <TouchableOpacity 
                            onPress={onEditarTurma} 
                            style={styles.btnEditar}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="pencil-outline" size={14} color={theme.colors.primary} />
                            <Text style={styles.btnEditarText}>Editar</Text>
                        </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity 
                        onPress={() => router.push('/cadastro-turma' as any)} 
                        style={styles.btnNova}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="add" size={16} color={theme.colors.surface} />
                        <Text style={styles.btnNovaText}>Nova Turma</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {turmas.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="bus-outline" size={32} color={theme.colors.textLight} />
                    <Text style={styles.emptyText}>
                        Nenhuma turma ou rota cadastrada até o momento.
                    </Text>
                </View>
            ) : (
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.scrollContent}
                >
                    {turmas.map(t => {
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
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.lg,
    },
    headerRow: {
        flexDirection: 'row',
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
        color: 'rgba(255, 255, 255, 0.8)',
    },
});