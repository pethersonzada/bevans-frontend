import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '../config/api';
import { globalStyles } from '../styles/globalStyles';
import { theme } from '../styles/theme';
import { useAuth } from './context/AuthContext';

export default function CadastroTurma() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [nome, setNome] = useState('');
    const [turno, setTurno] = useState('');
    const [origemNome, setOrigemNome] = useState('');
    const [destinoNome, setDestinoNome] = useState('');
    const [turmaCriadaId, setTurmaCriadaId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    async function garantirTurmaCriada() {
        if (turmaCriadaId) return turmaCriadaId;

        if (!nome.trim() || !turno.trim()) {
            Alert.alert("Atenção", "Preencha primeiro o nome e o turno da turma.");
            return null;
        }

        if (!user?.id) {
            Alert.alert("Erro", "Usuário não identificado.");
            return null;
        }

        try {
            const response = await apiFetch(`/turmas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'true'
                },
                body: JSON.stringify({
                    nome: nome.trim(),
                    turno: turno.trim(),
                    motorista: { id: Number(user.id) }
                })
            });

            if (response.ok) {
                const novaTurma = await response.json();
                setTurmaCriadaId(novaTurma.id);
                return novaTurma.id;
            } else {
                Alert.alert("Erro", "Não foi possível iniciar a turma.");
                return null;
            }
        } catch (e) {
            Alert.alert("Erro", "Falha de conexão com o servidor.");
            return null;
        }
    }

    async function abrirMapaPara(tipo: 'ORIGEM' | 'DESTINO') {
        const id = await garantirTurmaCriada();
        if (!id) return;

        router.push({ 
            pathname: '/selecionar-rota-mapa', 
            params: { turmaId: id, tipo } 
        } as any);
    }

    async function finalizarCadastro() {
        if (!nome.trim() || !turno.trim()) {
            Alert.alert("Atenção", "Preencha o nome e o turno.");
            return;
        }

        setLoading(true);
        try {
            if (turmaCriadaId) {
                Alert.alert("Sucesso", "Turma cadastrada e percurso configurado!", [
                    { text: "OK", onPress: () => router.back() }
                ]);
            } else {
                await garantirTurmaCriada();
                Alert.alert("Sucesso", "Turma cadastrada com sucesso!", [
                    { text: "OK", onPress: () => router.back() }
                ]);
            }
        } catch (error) {
            Alert.alert("Erro", "Falha ao finalizar cadastro.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            
            <View style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cadastrar Nova Turma</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nome da Turma / Rota</Text>
                    <TextInput
                        style={globalStyles.input}
                        placeholder="Ex: Escola Dom Bosco - Manhã"
                        placeholderTextColor={theme.colors.textLight}
                        value={nome}
                        onChangeText={setNome}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Turno</Text>
                    <TextInput
                        style={globalStyles.input}
                        placeholder="Ex: Manhã, Tarde ou Noite"
                        placeholderTextColor={theme.colors.textLight}
                        value={turno}
                        onChangeText={setTurno}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Endereço de Saída (Origem)</Text>
                    <View style={styles.mapInputContainer}>
                        <TextInput
                            style={[globalStyles.input, styles.mapInput]}
                            placeholder="Defina a saída no mapa"
                            placeholderTextColor={theme.colors.textLight}
                            value={origemNome}
                            editable={false}
                        />
                        <TouchableOpacity 
                            style={styles.mapButton}
                            onPress={() => abrirMapaPara('ORIGEM')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="map" size={20} color={theme.colors.surface} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.inputGroup, { marginBottom: theme.spacing.xl }]}>
                    <Text style={styles.label}>Ponto Final (Destino)</Text>
                    <View style={styles.mapInputContainer}>
                        <TextInput
                            style={[globalStyles.input, styles.mapInput]}
                            placeholder="Defina o destino no mapa"
                            placeholderTextColor={theme.colors.textLight}
                            value={destinoNome}
                            editable={false}
                        />
                        <TouchableOpacity 
                            style={styles.mapButton}
                            onPress={() => abrirMapaPara('DESTINO')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="map" size={20} color={theme.colors.surface} />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity 
                    style={[globalStyles.buttonPrimary, loading && styles.buttonDisabled]}
                    onPress={finalizarCadastro}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color={theme.colors.surface} />
                    ) : (
                        <View style={styles.buttonContent}>
                            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.surface} />
                            <Text style={globalStyles.buttonText}>Salvar e Finalizar</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </ScrollView>
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
    inputGroup: {
        marginBottom: theme.spacing.lg,
    },
    label: {
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
    },
    mapInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    mapInput: {
        flex: 1,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        backgroundColor: theme.colors.surface,
    },
    mapButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: theme.spacing.md,
        height: 48,
        borderTopRightRadius: theme.borderRadius.md,
        borderBottomRightRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});