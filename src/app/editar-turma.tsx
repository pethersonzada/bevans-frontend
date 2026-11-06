import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function EditarTurma() {
    const { id, nomeAtual, turnoAtual, origemAtual, destinoAtual } = useLocalSearchParams<{
        id: string;
        nomeAtual?: string;
        turnoAtual?: string;
        origemAtual?: string;
        destinoAtual?: string;
    }>();

    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [nome, setNome] = useState(nomeAtual || '');
    const [turno, setTurno] = useState(turnoAtual || '');
    const [origemNome, setOrigemNome] = useState(origemAtual || '');
    const [destinoNome, setDestinoNome] = useState(destinoAtual || '');
    const [loadingDados, setLoadingDados] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [excluindo, setExcluindo] = useState(false);

    useEffect(() => {
        if (id) {
            buscarDetalhesTurma();
        }
    }, [id]);

    async function buscarDetalhesTurma() {
        setLoadingDados(true);
        try {
            const motoristaId = await AsyncStorage.getItem('userId') || '1';
            const response = await apiFetch(`/turmas/motorista/${motoristaId}`, {
                headers: { 'Accept': 'application/json', 'Bypass-Tunnel-Reminder': 'true' }
            });
            if (response.ok) {
                const turmas = await response.json();
                const turmaAtual = turmas.find((t: any) => t.id.toString() === id.toString());
                if (turmaAtual) {
                    if (!nome) setNome(turmaAtual.nome || '');
                    if (!turno) setTurno(turmaAtual.turno || '');
                    setOrigemNome(turmaAtual.origemNome || '');
                    setDestinoNome(turmaAtual.destinoNome || '');
                }
            }
        } catch (e) {
            console.log("Erro ao buscar detalhes da turma", e);
        } finally {
            setLoadingDados(false);
        }
    }

    async function handleSalvarEdicao() {
        if (!nome.trim() || !turno.trim()) {
            Alert.alert("Atenção", "Preencha o nome e o turno.");
            return;
        }

        if (!id) {
            Alert.alert("Erro", "ID da turma não identificado.");
            return;
        }

        setSalvando(true);
        try {
            const response = await apiFetch(`/turmas/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'true'
                },
                body: JSON.stringify({
                    nome: nome.trim(),
                    turno: turno.trim()
                })
            });

            if (response.ok) {
                Alert.alert("Sucesso", "Turma atualizada com sucesso!", [
                    { text: "OK", onPress: () => router.back() }
                ]);
            } else {
                const erroTexto = await response.text();
                Alert.alert("Erro", erroTexto || "Não foi possível atualizar a turma.");
            }
        } catch (error) {
            Alert.alert("Erro", "Falha de conexão com o servidor.");
        } finally {
            setSalvando(false);
        }
    }

    function confirmarExclusao() {
        Alert.alert(
            "Excluir Turma",
            "Deseja realmente excluir esta turma? Todos os vínculos de alunos e histórico de viagens desta rota serão apagados.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: handleExcluirTurma
                }
            ]
        );
    }

    async function handleExcluirTurma() {
        if (!id) return;

        setExcluindo(true);
        try {
            const response = await apiFetch(`/turmas/${id}`, {
                method: 'DELETE',
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });

            if (response.ok) {
                Alert.alert("Sucesso", "Turma excluída com sucesso!", [
                    { text: "OK", onPress: () => router.back() }
                ]);
            } else {
                const erroTexto = await response.text();
                Alert.alert("Erro", erroTexto || "Não foi possível excluir a turma.");
            }
        } catch (error) {
            Alert.alert("Erro", "Falha de conexão com o servidor.");
        } finally {
            setExcluindo(false);
        }
    }

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <View style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Editar Turma e Percurso</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {loadingDados && (
                    <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loadingIndicator} />
                )}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nome da Turma / Rota</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex: Escola Dom Bosco - Manhã"
                        placeholderTextColor={theme.colors.textLight}
                        value={nome}
                        onChangeText={setNome}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Turno</Text>
                    <TextInput
                        style={styles.input}
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
                            style={[styles.input, styles.mapInput]}
                            placeholder="Defina a saída no mapa"
                            placeholderTextColor={theme.colors.textLight}
                            value={origemNome}
                            editable={false}
                        />
                        <TouchableOpacity
                            style={styles.mapButton}
                            onPress={() => router.push({ pathname: '/selecionar-rota-mapa', params: { turmaId: id, tipo: 'ORIGEM' } } as any)}
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
                            style={[styles.input, styles.mapInput]}
                            placeholder="Defina o destino no mapa"
                            placeholderTextColor={theme.colors.textLight}
                            value={destinoNome}
                            editable={false}
                        />
                        <TouchableOpacity
                            style={styles.mapButton}
                            onPress={() => router.push({ pathname: '/selecionar-rota-mapa', params: { turmaId: id, tipo: 'DESTINO' } } as any)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="map" size={20} color={theme.colors.surface} />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.buttonSubmit, (salvando || excluindo) && styles.buttonDisabled]}
                    onPress={handleSalvarEdicao}
                    disabled={salvando || excluindo}
                    activeOpacity={0.85}
                >
                    {salvando ? (
                        <ActivityIndicator color={theme.colors.surface} />
                    ) : (
                        <View style={styles.buttonContent}>
                            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.surface} />
                            <Text style={styles.buttonText}>Salvar Alterações</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.buttonDelete, (salvando || excluindo) && styles.buttonDisabled]}
                    onPress={confirmarExclusao}
                    disabled={salvando || excluindo}
                    activeOpacity={0.8}
                >
                    {excluindo ? (
                        <ActivityIndicator color={theme.colors.danger} />
                    ) : (
                        <View style={styles.buttonContent}>
                            <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                            <Text style={styles.buttonDeleteText}>Excluir Turma</Text>
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
    loadingIndicator: {
        marginBottom: theme.spacing.md,
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
    input: {
        height: 54,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.lg,
        paddingHorizontal: theme.spacing.md + 2,
        fontSize: 16,
        color: theme.colors.text,
    },
    mapInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    mapInput: {
        flex: 1,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
    },
    mapButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: theme.spacing.md + 2,
        height: 54,
        borderTopRightRadius: theme.borderRadius.lg,
        borderBottomRightRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonSubmit: {
        height: 54,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
    },
    buttonDelete: {
        height: 54,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.danger,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    buttonText: {
        color: theme.colors.surface,
        fontSize: 16,
        fontWeight: theme.typography.weight.bold,
    },
    buttonDeleteText: {
        color: theme.colors.danger,
        fontSize: 16,
        fontWeight: theme.typography.weight.bold,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});