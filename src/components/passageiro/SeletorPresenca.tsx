import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../styles/theme';

type Endereco = {
    id: number;
    apelido: string;
    rua: string;
    numero: string;
    bairro: string;
};

type Props = {
    statusConfirmado: string;
    enderecos: Endereco[];
    onRegistrar: (status: string, enderecoId?: number) => void;
};

const OPCOES_PRESENCA = [
    { key: 'IDA', label: 'Ida' },
    { key: 'VOLTA', label: 'Volta' },
    { key: 'AMBOS', label: 'Ambos' },
    { key: 'NAO_VOU', label: 'Não Vou' },
];

export function SeletorPresenca({ statusConfirmado, enderecos, onRegistrar }: Props) {
    const [statusSelecionado, setStatusSelecionado] = useState<string | null>(null);
    const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<number | null>(null);

    const handleConfirmar = () => {
        if (!enderecoSelecionadoId) {
            Alert.alert('Atenção', 'Selecione um endereço de embarque para continuar.');
            return;
        }
        if (statusSelecionado) {
            onRegistrar(statusSelecionado, enderecoSelecionadoId);
        }
    };

    if (statusConfirmado) {
        return (
            <View style={styles.cardConfirmado}>
                <View style={styles.iconCircle}>
                    <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
                </View>
                <Text style={styles.tituloConfirmado}>Confirmado!</Text>
                <Text style={styles.subtextConfirmado}>Opção: {statusConfirmado}</Text>
                
                <TouchableOpacity 
                    onPress={() => onRegistrar('LIMPAR')} 
                    style={styles.btnAlterar}
                    activeOpacity={0.7}
                >
                    <Text style={styles.btnAlterarText}>Alterar decisão</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!statusSelecionado) {
        return (
            <View style={styles.container}>
                <Text style={styles.sectionTitle}>O que você vai fazer hoje?</Text>
                <View style={styles.gridOpcoes}>
                    {OPCOES_PRESENCA.map((op) => (
                        <TouchableOpacity
                            key={op.key}
                            style={[
                                styles.btnOpcao,
                                op.key === 'NAO_VOU' && styles.btnNaoVou
                            ]}
                            onPress={() => {
                                if (op.key === 'NAO_VOU') {
                                    onRegistrar(op.key);
                                } else {
                                    setStatusSelecionado(op.key);
                                }
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.btnOpcaoText}>{op.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.cardEnderecos}>
            <Text style={styles.sectionTitle}>Escolha o local de embarque:</Text>
            
            {enderecos.length === 0 ? (
                <Text style={styles.alertaSemEndereco}>
                    Você não tem endereços cadastrados!
                </Text>
            ) : (
                enderecos.map((end) => {
                    const selecionado = enderecoSelecionadoId === end.id;
                    return (
                        <TouchableOpacity 
                            key={end.id} 
                            style={[
                                styles.cardEnderecoItem,
                                selecionado && styles.cardEnderecoItemSelecionado
                            ]}
                            onPress={() => setEnderecoSelecionadoId(end.id)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.apelidoEndereco}>{end.apelido || 'Endereço'}</Text>
                            <Text style={styles.detalhesEndereco}>
                                {end.rua}, {end.numero} - {end.bairro}
                            </Text>
                        </TouchableOpacity>
                    );
                })
            )}

            <View style={styles.acoesRow}>
                <TouchableOpacity 
                    style={styles.btnVoltar} 
                    onPress={() => setStatusSelecionado(null)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.btnVoltarText}>Voltar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.btnConfirmar} 
                    onPress={handleConfirmar}
                    activeOpacity={0.85}
                >
                    <Text style={styles.btnConfirmarText}>
                        Confirmar {statusSelecionado}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: theme.spacing.xs,
    },
    cardConfirmado: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.xl,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
    },
    iconCircle: {
        marginBottom: theme.spacing.xs,
    },
    tituloConfirmado: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginVertical: theme.spacing.xs,
    },
    subtextConfirmado: {
        fontSize: theme.typography.size.regular,
        color: theme.colors.textLight,
        marginBottom: theme.spacing.md,
    },
    btnAlterar: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs + 2,
        borderRadius: theme.borderRadius.pill,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    btnAlterarText: {
        color: theme.colors.danger,
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
    },
    sectionTitle: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
    },
    gridOpcoes: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
    },
    btnOpcao: {
        backgroundColor: theme.colors.primary,
        width: '48%',
        height: 48,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnNaoVou: {
        backgroundColor: theme.colors.danger,
    },
    btnOpcaoText: {
        color: theme.colors.surface,
        fontWeight: theme.typography.weight.bold,
        fontSize: theme.typography.size.regular,
    },
    cardEnderecos: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    alertaSemEndereco: {
        color: theme.colors.danger,
        fontSize: theme.typography.size.small,
        marginBottom: theme.spacing.md,
    },
    cardEnderecoItem: {
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        marginBottom: theme.spacing.xs,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cardEnderecoItemSelecionado: {
        backgroundColor: `${theme.colors.primary}15`,
        borderColor: theme.colors.primary,
    },
    apelidoEndereco: {
        fontWeight: theme.typography.weight.bold,
        fontSize: theme.typography.size.regular,
        color: theme.colors.text,
        marginBottom: 2,
    },
    detalhesEndereco: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
    },
    acoesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: theme.spacing.md,
    },
    btnVoltar: {
        paddingVertical: theme.spacing.xs + 2,
        paddingHorizontal: theme.spacing.md,
    },
    btnVoltarText: {
        color: theme.colors.textLight,
        fontWeight: theme.typography.weight.bold,
    },
    btnConfirmar: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: theme.spacing.lg,
        height: 44,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnConfirmarText: {
        color: theme.colors.surface,
        fontWeight: theme.typography.weight.bold,
        fontSize: theme.typography.size.small,
    },
});