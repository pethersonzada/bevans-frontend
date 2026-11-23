import { themedStyles } from '../styles/themedStyles';
import { useThemeRevision } from '../hooks/useThemeRevision';
import { useAppAlert } from '../contexts/AppAlertContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '../config/api';
import { buscarTurmaMotorista, atualizarTurma, excluirTurma, consultarVagasTurma, lerAssentos } from '../services/turmas';
import { globalStyles } from '../styles/globalStyles';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';
import { AsyncState } from '../components/AsyncState';

export default function EditarTurma() {
    const darkMode = useThemeRevision() === 'dark';
    const Alert = useAppAlert();
    const { id, nomeAtual, turnoAtual, origemAtual, destinoAtual } = useLocalSearchParams<{
        id: string;
        nomeAtual?: string;
        turnoAtual?: string;
        origemAtual?: string;
        destinoAtual?: string;
    }>();

    const router = useRouter();
    const { user, isLoading } = useAuth();
    const sessaoValida = !isLoading && Boolean(user.id) && user.tipo === 'MOTORISTA';
    const insets = useSafeAreaInsets();

    const [nome, setNome] = useState(nomeAtual || '');
    const [turno, setTurno] = useState(turnoAtual || '');
    const [capacidade, setCapacidade] = useState('');
    const [ocupados, setOcupados] = useState<number | null>(null);
    const capacidadeEditada = useRef(false);
    const pedidoCarga = useRef(0);
    const escrita = useRef(false);
    const contexto = user.id + ':' + id;
    const contextoAtual = useRef(contexto);
    if (contextoAtual.current !== contexto) { capacidadeEditada.current = false; contextoAtual.current = contexto; }
    const [origemNome, setOrigemNome] = useState(origemAtual || '');
    const [destinoNome, setDestinoNome] = useState(destinoAtual || '');
    const [loadingDados, setLoadingDados] = useState(false);
    const [erroCarga, setErroCarga] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [excluindo, setExcluindo] = useState(false);

    useFocusEffect(useCallback(() => {
        if (id && sessaoValida) buscarDetalhesTurma();
        return () => { pedidoCarga.current++; };
    }, [id, user.id, sessaoValida]));

    async function buscarDetalhesTurma() {
        const pedido = ++pedidoCarga.current;
        const contextoPedido = contexto;
        setLoadingDados(true);
        setErroCarga(null);
        try {
            const motoristaId = user.id;
            if (!sessaoValida || !motoristaId) return;
            const [turmaAtual, vagas] = await Promise.all([buscarTurmaMotorista(motoristaId, id), consultarVagasTurma(id)]);
            if (pedido !== pedidoCarga.current || contextoPedido !== contextoAtual.current) return;
            if (!capacidadeEditada.current) setCapacidade(turmaAtual.capacidade == null ? '' : String(turmaAtual.capacidade));
            setOcupados(vagas.ocupados);
            if (!nome) setNome(turmaAtual.nome || '');
            if (!turno) setTurno(turmaAtual.turno || '');
            setOrigemNome(turmaAtual.origemNome || '');
            setDestinoNome(turmaAtual.destinoNome || '');
        } catch (e) {
            if (pedido !== pedidoCarga.current || contextoPedido !== contextoAtual.current) return;
            setErroCarga(errorMessage(e));
            console.log("Erro ao buscar detalhes da turma", e);
        } finally {
            if (pedido === pedidoCarga.current && contextoPedido === contextoAtual.current) setLoadingDados(false);
        }
    }

    async function handleSalvarEdicao() {
        if (escrita.current || !sessaoValida || erroCarga || loadingDados || salvando || excluindo) return;
        if (!nome.trim() || !turno.trim()) {
            Alert.alert("Atenção", "Preencha o nome e o turno.");
            return;
        }

        if (!id) {
            Alert.alert("Erro", "ID da turma não identificado.");
            return;
        }

        escrita.current = true;
        const contextoPedido = contexto;
        setSalvando(true);
        try {
            const assentos = lerAssentos(capacidade);
            if (ocupados != null && assentos < ocupados) throw new Error('A capacidade não pode ser menor que os passageiros aprovados (' + ocupados + ').');
            await atualizarTurma(id, nome, turno, assentos);
            const vagas = await consultarVagasTurma(id);
            if (contextoAtual.current !== contextoPedido) return;
            if (vagas.capacidade !== assentos) throw new Error('O servidor não confirmou a capacidade salva. Atualize os dados da turma.');
            setOcupados(vagas.ocupados);
            Alert.alert('Sucesso', 'Turma atualizada com sucesso!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            if (contextoAtual.current !== contextoPedido) return;
            Alert.alert("Erro", errorMessage(error));
        } finally {
            escrita.current = false;
            if (contextoAtual.current === contextoPedido) setSalvando(false);
        }
    }

    function confirmarExclusao() {
        if (!sessaoValida || erroCarga || loadingDados || salvando || excluindo) return;
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
        if (!id || !sessaoValida || erroCarga || loadingDados || salvando || excluindo) return;

        if (escrita.current) return;
        escrita.current = true;
        const contextoPedido = contexto;
        setExcluindo(true);
        try {
            await excluirTurma(id);
            Alert.alert('Sucesso', 'Turma excluída com sucesso!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            Alert.alert("Erro", errorMessage(error));
        } finally {
            escrita.current = false;
            if (contextoAtual.current === contextoPedido) setExcluindo(false);
        }
    }

    if (!sessaoValida) {
        return (
            <View style={globalStyles.container}>
                <AsyncState loading={isLoading} message={isLoading ? undefined : 'Entre com uma conta de motorista para editar esta turma.'} />
            </View>
        );
    }

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

            <View style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Editar Turma e Percurso</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {erroCarga && <AsyncState message={erroCarga} onRetry={buscarDetalhesTurma} />}
                {loadingDados && (
                    <AsyncState loading title="Carregando os dados da turma..." />
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
                    <Text style={styles.label}>Quantidade de assentos</Text>
                    <TextInput accessibilityLabel="Quantidade de assentos" style={styles.input} value={capacidade}
                        keyboardType="number-pad" placeholder="Ex: 12" placeholderTextColor={theme.colors.textLight}
                        onChangeText={valor => { capacidadeEditada.current = true; setCapacidade(valor); }} />
                </View>

                <Text style={styles.label}>{ocupados == null ? 'Carregando ocupação...' : ocupados + ' passageiros aprovados / ' + (capacidade || 'capacidade não configurada') + ' assentos'}</Text>
                <Text style={styles.label}>{ocupados != null && /^[1-9]\d*$/.test(capacidade) ? Math.max(0, Number(capacidade) - ocupados) + ' vagas após salvar esta capacidade' : 'Defina a capacidade para consultar vagas.'}</Text>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Endereço de Saída (Origem)</Text>
                    <View style={styles.mapInputContainer}>
                        <TextInput
                            style={[styles.input, styles.mapInput]}
                            placeholder="Busque o endereço de saída"
                            placeholderTextColor={theme.colors.textLight}
                            value={origemNome}
                            editable={false}
                        />
                        <TouchableOpacity
                            style={styles.mapButton}
                            disabled={loadingDados || Boolean(erroCarga) || salvando || excluindo}
                            onPress={() => router.push({ pathname: '/selecionar-rota-mapa', params: { turmaId: id, tipo: 'ORIGEM' } })}
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
                            placeholder="Busque o endereço de destino"
                            placeholderTextColor={theme.colors.textLight}
                            value={destinoNome}
                            editable={false}
                        />
                        <TouchableOpacity
                            style={styles.mapButton}
                            onPress={() => router.push({ pathname: '/selecionar-rota-mapa', params: { turmaId: id, tipo: 'DESTINO' } })}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="map" size={20} color={theme.colors.surface} />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.buttonSubmit, (salvando || excluindo) && styles.buttonDisabled]}
                    onPress={handleSalvarEdicao}
                    accessibilityRole="button"
                    accessibilityState={{ busy: salvando, disabled: salvando || excluindo || loadingDados || Boolean(erroCarga) }}
                    disabled={salvando || excluindo || loadingDados || Boolean(erroCarga)}
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
                    accessibilityRole="button"
                    accessibilityState={{ busy: excluindo, disabled: salvando || excluindo || loadingDados || Boolean(erroCarga) }}
                    disabled={salvando || excluindo || loadingDados || Boolean(erroCarga)}
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

const styles = themedStyles(() => StyleSheet.create({
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
}));
