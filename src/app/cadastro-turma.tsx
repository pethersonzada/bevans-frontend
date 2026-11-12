import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

import { apiFetch, errorMessage, readApiError, readApiJson } from '../config/api';
import { globalStyles } from '../styles/globalStyles';
import { theme } from '../styles/theme';
import { useAuth } from './context/AuthContext';

export default function CadastroTurma() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [nome, setNome] = useState('');
    const [turno, setTurno] = useState('');
    const [origemNome, setOrigemNome] = useState('');
    const [destinoNome, setDestinoNome] = useState('');
    const [turmaCriadaId, setTurmaCriadaId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    async function garantirTurmaCriada() {
        if (isLoading || !user.id || user.tipo !== 'MOTORISTA') return null;
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
                const novaTurma = await readApiJson<any>(response);
                if (!novaTurma?.id) throw new Error('O servidor não retornou a turma criada.');
                setTurmaCriadaId(novaTurma.id);
                return novaTurma.id;
            } else {
                Alert.alert("Erro", (await readApiError(response)).message);
                return null;
            }
        } catch (e) {
            Alert.alert("Erro", errorMessage(e));
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


    const buscarTurmaSalva = useCallback(async (id: number) => {
        if (!user?.id) {
            throw new Error('Motorista nao identificado.');
        }

        const response = await apiFetch(
            `/turmas/motorista/${user.id}`
        );

        if (!response.ok) {
            throw await readApiError(response);
        }

        const turmas = await readApiJson<any[]>(response);

        const turma = turmas.find(
            (item) => Number(item.id) === id
        );

        if (!turma) {
            throw new Error('Turma nao encontrada no servidor.');
        }

        return turma;
    }, [user?.id]);

    useFocusEffect(
        useCallback(() => {
            if (!turmaCriadaId) return;

            let ativo = true;

            buscarTurmaSalva(turmaCriadaId)
                .then((turma) => {
                    if (!ativo) return;

                    setOrigemNome(turma.origemNome || '');
                    setDestinoNome(turma.destinoNome || '');
                })
                .catch((erro) => {
                    if (ativo) {
                        Alert.alert(
                            'Erro ao carregar turma',
                            errorMessage(erro)
                        );
                    }
                });

            return () => {
                ativo = false;
            };
        }, [turmaCriadaId, buscarTurmaSalva])
    );

    function coordenadasValidas(
        latitude: unknown,
        longitude: unknown
    ) {
        if (latitude == null || longitude == null) {
            return false;
        }

        const lat = Number(latitude);
        const lon = Number(longitude);

        return Number.isFinite(lat)
            && Number.isFinite(lon)
            && lat >= -90
            && lat <= 90
            && lon >= -180
            && lon <= 180
            && !(lat === 0 && lon === 0);
    }

    async function finalizarCadastro() {
        if (!nome.trim() || !turno.trim()) {
            Alert.alert(
                'Aten??o',
                'Preencha o nome e o turno.'
            );
            return;
        }

        if (!turmaCriadaId) {
            Alert.alert(
                'Configure o percurso',
                'Selecione a origem e o destino no mapa antes de finalizar.'
            );
            return;
        }

        setLoading(true);

        try {
            const turma = await buscarTurmaSalva(turmaCriadaId);

            const origemValida = coordenadasValidas(
                turma.origemLatitude,
                turma.origemLongitude
            );

            const destinoValido = coordenadasValidas(
                turma.destinoLatitude,
                turma.destinoLongitude
            );

            setOrigemNome(turma.origemNome || '');
            setDestinoNome(turma.destinoNome || '');

            if (!origemValida || !destinoValido) {
                Alert.alert(
                    'Percurso incompleto',
                    'Configure uma origem e um destino v?lidos no mapa.'
                );
                return;
            }

            const response = await apiFetch(
                `/turmas/${turmaCriadaId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        nome: nome.trim(),
                        turno: turno.trim(),
                    }),
                }
            );

            if (!response.ok) {
                throw await readApiError(response);
            }

            const confirmada = await buscarTurmaSalva(turmaCriadaId);

            if (
                !coordenadasValidas(
                    confirmada.origemLatitude,
                    confirmada.origemLongitude
                ) ||
                !coordenadasValidas(
                    confirmada.destinoLatitude,
                    confirmada.destinoLongitude
                )
            ) {
                throw new Error(
                    'Os endere?os n?o foram confirmados no servidor.'
                );
            }

            Alert.alert(
                'Sucesso',
                'Turma e percurso salvos com sucesso!',
                [
                    {
                        text: 'OK',
                        onPress: () => router.back(),
                    },
                ]
            );
        } catch (erro) {
            Alert.alert(
                'Erro ao finalizar',
                errorMessage(erro)
            );
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
