import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../config/api';
import { theme } from '../../styles/theme';

type Props = {
    turma: any;
    onAtualizarTurma: (turmaAtualizada: any) => void;
};

export function PainelTurmaSelecionada({ turma, onAtualizarTurma }: Props) {
    const [carregandoCodigo, setCarregandoCodigo] = useState(false);
    const [copiado, setCopiado] = useState(false);

    if (!turma) return null;

    const codigo = turma.codigoConvite || '------';

    async function handleCopiarCodigo() {
        if (!turma.codigoConvite) return;
        await Clipboard.setStringAsync(turma.codigoConvite);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    }

    async function handleRegenerarCodigo() {
        setCarregandoCodigo(true);
        try {
            const res = await apiFetch(`/turmas/${turma.id}/regenerar-codigo`, {
                method: 'PUT',
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });

            if (res.ok) {
                const turmaAtualizada = await res.json();
                onAtualizarTurma(turmaAtualizada);
            } else {
                Alert.alert("Erro", "Não foi possível gerar um novo código.");
            }
        } catch (e) {
            Alert.alert("Erro", "Falha de conexão com o servidor.");
        } finally {
            setCarregandoCodigo(false);
        }
    }

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="key" size={15} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.headerTitle}>CÓDIGO DE CONVITE</Text>
                </View>

                <TouchableOpacity 
                    onPress={handleRegenerarCodigo}
                    disabled={carregandoCodigo}
                    style={styles.refreshBtn}
                    activeOpacity={0.6}
                >
                    {carregandoCodigo ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                        <>
                            <Ionicons name="refresh-outline" size={14} color={theme.colors.textLight} />
                            <Text style={styles.refreshText}>Gerar outro</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.codeContainer}>
                <Text style={styles.codeText}>{codigo}</Text>

                <TouchableOpacity 
                    onPress={handleCopiarCodigo}
                    disabled={!turma.codigoConvite}
                    style={[styles.copyBtn, copiado && styles.copyBtnSuccess]}
                    activeOpacity={0.8}
                >
                    <Ionicons 
                        name={copiado ? "checkmark-sharp" : "copy-outline"} 
                        size={16} 
                        color={theme.colors.surface} 
                    />
                    <Text style={styles.copyBtnText}>
                        {copiado ? "Copiado!" : "Copiar"}
                    </Text>
                </TouchableOpacity>
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
        marginBottom: theme.spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    iconCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: `${theme.colors.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.textLight,
        letterSpacing: 0.8,
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    refreshText: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        fontWeight: '500',
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingLeft: theme.spacing.md,
        paddingRight: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
    },
    codeText: {
        fontSize: 22,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.primary,
        letterSpacing: 4,
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.colors.primary,
        paddingVertical: 10,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.sm,
    },
    copyBtnSuccess: {
        backgroundColor: theme.colors.success,
    },
    copyBtnText: {
        color: theme.colors.surface,
        fontWeight: theme.typography.weight.bold,
        fontSize: theme.typography.size.small,
    },
});