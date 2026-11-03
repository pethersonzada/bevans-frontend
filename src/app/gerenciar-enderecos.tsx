import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
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

type Endereco = {
    id: number;
    apelido: string;
    rua: string;
    numero: string;
    bairro: string;
};

export default function GerenciarEnderecos() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [enderecos, setEnderecos] = useState<Endereco[]>([]);

    const [modalEditarVisivel, setModalEditarVisivel] = useState(false);
    const [enderecoEmEdicao, setEnderecoEmEdicao] = useState<Endereco | null>(null);
    const [novoApelido, setNovoApelido] = useState('');
    const [salvandoApelido, setSalvandoApelido] = useState(false);

    const carregarEnderecos = async () => {
        setLoading(true);
        try {
            const userId = await AsyncStorage.getItem('userId');
            if (!userId) return;

            const res = await apiFetch(`/enderecos/usuario/${userId}`, {
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });

            if (res.ok) {
                const data = await res.json();
                setEnderecos(data);
            } else {
                Alert.alert('Erro', 'Não foi possível carregar os endereços.');
            }
        } catch (e) {
            Alert.alert('Erro', 'Não foi possível carregar os endereços.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            carregarEnderecos();
        }, [])
    );

    const abrirModalEdicao = (end: Endereco) => {
        setEnderecoEmEdicao(end);
        setNovoApelido(end.apelido || '');
        setModalEditarVisivel(true);
    };

    const salvarApelido = async () => {
        if (!enderecoEmEdicao || !novoApelido.trim()) return;

        setSalvandoApelido(true);
        try {
            const res = await apiFetch(`/enderecos/${enderecoEmEdicao.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                body: JSON.stringify({ apelido: novoApelido.trim() })
            });

            if (res.ok) {
                setModalEditarVisivel(false);
                carregarEnderecos();
            } else {
                Alert.alert('Erro', 'Não foi possível atualizar o apelido.');
            }
        } catch (e) {
            Alert.alert('Erro', 'Falha de conexão.');
        } finally {
            setSalvandoApelido(false);
        }
    };

    const excluirEndereco = (id: number) => {
        Alert.alert(
            'Excluir Endereço',
            'Deseja realmente remover este local?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await apiFetch(`/enderecos/${id}`, {
                                method: 'DELETE',
                                headers: { 'Bypass-Tunnel-Reminder': 'true' }
                            });
                            if (res.ok) {
                                carregarEnderecos();
                            } else {
                                Alert.alert('Erro', 'Não foi possível excluir o endereço.');
                            }
                        } catch (e) {
                            Alert.alert('Erro', 'Falha de conexão.');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={[globalStyles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <View style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Meus Endereços</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {enderecos.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="location-outline" size={32} color={theme.colors.textLight} />
                        </View>
                        <Text style={styles.emptyText}>Nenhum endereço cadastrado.</Text>
                    </View>
                ) : (
                    enderecos.map((end) => (
                        <View key={end.id} style={styles.addressCard}>
                            <View style={styles.addressInfo}>
                                <Text style={styles.addressTitle}>{end.apelido || 'Endereço'}</Text>
                                <Text style={styles.addressSubtext}>{end.rua}, {end.numero} - {end.bairro}</Text>
                            </View>
                            <View style={styles.actionsRow}>
                                <TouchableOpacity 
                                    onPress={() => abrirModalEdicao(end)} 
                                    style={styles.actionButton}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="pencil-outline" size={20} color={theme.colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => excluirEndereco(end.id)} 
                                    style={styles.actionButton}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}

                <TouchableOpacity
                    style={styles.buttonAdd}
                    onPress={() => router.push('/cadastro-endereco')}
                    activeOpacity={0.85}
                >
                    <Ionicons name="add" size={22} color={theme.colors.surface} style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Adicionar Novo Endereço</Text>
                </TouchableOpacity>
            </ScrollView>

            <Modal
                animationType="fade"
                transparent={true}
                visible={modalEditarVisivel}
                onRequestClose={() => { if (!salvandoApelido) setModalEditarVisivel(false); }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Renomear Endereço</Text>
                        <Text style={styles.modalDescription}>
                            Dê um apelido fácil para identificar este local (Ex: Casa, Trabalho, Faculdade).
                        </Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Apelido do endereço"
                            placeholderTextColor={theme.colors.textLight}
                            value={novoApelido}
                            onChangeText={setNovoApelido}
                            editable={!salvandoApelido}
                            maxLength={30}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setModalEditarVisivel(false)}
                                disabled={salvandoApelido}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalSaveButton, (!novoApelido.trim() || salvandoApelido) && styles.buttonDisabled]}
                                onPress={salvarApelido}
                                disabled={!novoApelido.trim() || salvandoApelido}
                                activeOpacity={0.85}
                            >
                                {salvandoApelido ? (
                                    <ActivityIndicator color={theme.colors.surface} />
                                ) : (
                                    <Text style={styles.modalSaveText}>Salvar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
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
    emptyContainer: {
        alignItems: 'center',
        marginVertical: theme.spacing.xl,
    },
    emptyIconCircle: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.pill,
        marginBottom: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    emptyText: {
        color: theme.colors.textLight,
        fontSize: theme.typography.size.regular,
    },
    addressCard: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    addressInfo: {
        flex: 1,
        marginRight: theme.spacing.sm,
    },
    addressTitle: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginBottom: 2,
    },
    addressSubtext: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    actionButton: {
        padding: 8,
    },
    buttonAdd: {
        height: 54,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginTop: theme.spacing.sm,
    },
    buttonIcon: {
        marginRight: theme.spacing.xs,
    },
    buttonText: {
        color: theme.colors.surface,
        fontWeight: theme.typography.weight.bold,
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.lg,
    },
    modalCard: {
        backgroundColor: theme.colors.surface,
        width: '100%',
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    modalTitle: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
    },
    modalDescription: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        marginBottom: theme.spacing.md,
    },
    modalInput: {
        height: 54,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: theme.spacing.md,
        color: theme.colors.text,
        fontSize: theme.typography.size.regular,
        marginBottom: theme.spacing.lg,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    modalCancelButton: {
        paddingVertical: 10,
        paddingHorizontal: theme.spacing.md,
    },
    modalCancelText: {
        color: theme.colors.textLight,
        fontWeight: theme.typography.weight.bold,
    },
    modalSaveButton: {
        height: 44,
        backgroundColor: theme.colors.primary,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSaveText: {
        color: theme.colors.surface,
        fontWeight: theme.typography.weight.bold,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});