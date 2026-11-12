import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch, errorMessage, readApiError, readApiJson } from '../config/api';
import { globalStyles } from '../styles/globalStyles';
import { theme } from '../styles/theme';
import { useAuth } from './context/AuthContext';

export default function EntrarTurma() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [codigo, setCodigo] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSolicitarEntrada = async () => {
        if (isLoading || !user.id || loading) return;
        if (!codigo.trim()) {
            Alert.alert("Atenção", "Digite o código de convite enviado pelo motorista.");
            return;
        }

        setLoading(true);
        try {
            const userId = user.id;
            if (!userId) {
                Alert.alert("Erro", "Usuário não identificado. Faça login novamente.");
                return;
            }

            const res = await apiFetch(`/turmas/entrar/${userId}?codigo=${encodeURIComponent(codigo.toUpperCase().trim())}`, {
                method: 'POST',
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });

            const textResponse = (await readApiError(res)).message;

            if (res.ok) {
                Alert.alert("Sucesso", "Solicitação enviada! Aguarde a aprovação do motorista.", [
                    { text: "OK", onPress: () => router.back() }
                ]);
            } else {
                Alert.alert("Erro", textResponse || "Não foi possível entrar na turma.");
            }
        } catch (e) {
            Alert.alert("Erro", errorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            
            <View style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Entrar em uma Turma</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.iconBox}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="key-outline" size={32} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.descriptionText}>
                        Digite o código de convite de 6 caracteres fornecido pelo motorista da sua van para solicitar sua entrada na rota.
                    </Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Código de Convite</Text>
                    <TextInput
                        style={styles.codeInput}
                        placeholder="EX: A1B2C3"
                        placeholderTextColor={theme.colors.textLight}
                        autoCapitalize="characters"
                        maxLength={6}
                        value={codigo}
                        onChangeText={setCodigo}
                    />
                </View>

                <TouchableOpacity 
                    style={[styles.buttonSubmit, loading && styles.buttonDisabled]} 
                    onPress={handleSolicitarEntrada}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color={theme.colors.surface} />
                    ) : (
                        <Text style={styles.buttonText}>Enviar Solicitação</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    backButton: {
        marginRight: theme.spacing.sm,
        padding: 4,
    },
    headerTitle: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    content: {
        padding: theme.spacing.lg,
    },
    iconBox: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: `${theme.colors.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
    },
    descriptionText: {
        color: theme.colors.textLight,
        textAlign: 'center',
        fontSize: theme.typography.size.regular,
        lineHeight: 22,
        paddingHorizontal: theme.spacing.xs,
    },
    inputGroup: {
        marginBottom: theme.spacing.xl,
    },
    label: {
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
        fontWeight: theme.typography.weight.bold,
        fontSize: theme.typography.size.small,
    },
    codeInput: {
        height: 54,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.lg,
        paddingHorizontal: theme.spacing.md,
        color: theme.colors.primary,
        fontSize: 20,
        textAlign: 'center',
        letterSpacing: 4,
        fontWeight: theme.typography.weight.bold,
    },
    buttonSubmit: {
        height: 54,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: theme.colors.surface,
        fontWeight: theme.typography.weight.bold,
        fontSize: 16,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});
