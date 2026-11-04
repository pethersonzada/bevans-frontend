import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
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
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Evita memory leak caso o componente desmonte durante os 2s do "Copiado!"
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    if (!turma) return null;

    const codigo = turma.codigoConvite || '------';

    async function handleCopiarCodigo() {
        if (!turma.codigoConvite) return;
        await Clipboard.setStringAsync(turma.codigoConvite);
        setCopiado(true);
        
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopiado(false), 2000);
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
                        <Ionicons name="key" size={14} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.headerTitle}>CÓDIGO DE CONVITE</Text>
                </View>

                <TouchableOpacity 
                    onPress={handleRegenerarCodigo}
                    disabled={carregandoCodigo}
                    style={styles.refreshBtn}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    {carregandoCodigo ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                        <>
                            <Ionicons name="refresh-outline" size={14} color={theme.colors.textLight} />
                            <Text style={styles.refreshText}>Gerar novo</Text>
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
        borderRadius: theme.borderRadius.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    iconCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: `${theme.colors.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.colors.textLight,
        letterSpacing: 0.8,
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
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
        borderRadius: theme.borderRadius.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingLeft: theme.spacing.lg,
        paddingRight: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
    },
    codeText: {
        fontSize: 24,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.primary,
        letterSpacing: 6,
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