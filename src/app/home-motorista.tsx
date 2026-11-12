import { useAppAlert } from '../contexts/AppAlertContext';
import { AppModal as Modal } from '../components/AppModal';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useHomeRefresh } from '../hooks/useHomeRefresh';
import { iniciarViagem, reiniciarViagem } from '../services/viagens';
import { fetchTurmasMotorista, fetchPassageirosTurma, fetchSolicitacoesTurma } from '../services/motoristaHome';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    
    
    Pressable,
    ScrollView,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { ApiError, apiFetch, errorMessage, readApiError, readApiJson } from '../config/api';
import { AsyncState } from '../components/AsyncState';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';

import { BannerRotaAtiva } from '../components/banners/BannerRotaAtiva';
import { CardsTurmasMotorista } from '../components/cards/CardsTurmasMotorista';
import { BotoesAcaoMotorista } from '../components/motorista/BotoesAcaoMotorista';
import { HeaderMotorista } from '../components/motorista/HeaderMotorista';
import { ListaPassageirosAprovados } from '../components/motorista/ListaPassageirosAprovados';
import { PainelTurmaSelecionada } from '../components/motorista/PainelTurmaSelecionada';

import type { Turma, PassageiroTurma as Aluno, SolicitacaoTurma as VinculoPendente } from '../types/turma';

export default function HomeMotorista() {
    const Alert = useAppAlert();
    const { user } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [erroCarga, setErroCarga] = useState<string | null>(null);
    const primeiraCarga = useRef(true);
    const turmaSelecionadaRef = useRef<Turma | null>(null);

    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [turmaSelecionada, setTurmaSelecionada] = useState<Turma | null>(null);
    const [passageiros, setPassageiros] = useState<Aluno[]>([]);
    const [alunosPendentes, setAlunosPendentes] = useState<VinculoPendente[]>([]);
    const [carregandoPassageiros, setCarregandoPassageiros] = useState(false);
    const [erroPassageiros, setErroPassageiros] = useState<string | null>(null);
    const [carregandoPendentes, setCarregandoPendentes] = useState(false);
    const [erroPendentes, setErroPendentes] = useState<string | null>(null);
    const passageirosRequest = useRef(0);
    const pendentesRequest = useRef(0);
    const [viagemAtiva, setViagemAtiva] = useState(false);

    const [modalNotificacoesVisible, setModalNotificacoesVisible] = useState(false);
    const [analisando, setAnalisando] = useState<number | null>(null);
    const analisePendente = useRef(false);
    const inicioPendente = useRef(false);

    const { refreshing, refresh } = useHomeRefresh(user?.id ?? null, carregarDadosSilencioso);

    async function carregarDadosSilencioso() {
        if (primeiraCarga.current) setLoading(true);

        const success = user?.id ? await buscarTurmas(String(user.id)) : false;
        setLoading(false);
        primeiraCarga.current = false;
        return success;
    }

    async function buscarTurmas(motoristaId: string | number) {
        setErroCarga(null);
        try {
            const data = await fetchTurmasMotorista(motoristaId);
            setTurmas(data);

            if (data.length === 0) {
                turmaSelecionadaRef.current = null;
                setTurmaSelecionada(null);
                setPassageiros([]);
                setAlunosPendentes([]);
                setViagemAtiva(false);
                passageirosRequest.current++;
                pendentesRequest.current++;
                setCarregandoPassageiros(false);
                setCarregandoPendentes(false);
                setErroPassageiros(null);
                setErroPendentes(null);
                return true;
            }

            const chaveTurma = `@bevans:turma_selecionada:${motoristaId}`;

            const idSalvo = await AsyncStorage.getItem(chaveTurma);

            const idPreferido = turmaSelecionadaRef.current?.id ??
                (idSalvo ? Number(idSalvo) : null);

            const turmaEncontrada = idPreferido !== null
                ? data.find(
                    (t) => Number(t.id) === Number(idPreferido)
                )
                : undefined;

            const atual = turmaEncontrada ?? data[0];

            turmaSelecionadaRef.current = atual;
            setTurmaSelecionada(atual);

            await AsyncStorage.setItem(
                chaveTurma,
                String(atual.id)
            );

            const [detailsLoaded] = await Promise.all([buscarDadosDaTurma(atual.id), checarAmnesia(atual.id)]);
            return detailsLoaded;

        } catch (error) {
            setErroCarga(errorMessage(error));
            console.error('Erro ao carregar turmas:', error);
            return false;
        }
    }

    async function buscarDadosDaTurma(turmaId: number) {
        const results = await Promise.all([
            buscarPassageirosPorTurma(turmaId),
            buscarAlunosPendentes(turmaId)
        ]);
        return results.every(Boolean);
    }

    async function buscarPassageirosPorTurma(turmaId: number) {
        const request = ++passageirosRequest.current;
        const atual = () => turmaSelecionadaRef.current?.id === turmaId && request === passageirosRequest.current;
        setCarregandoPassageiros(true);
        setErroPassageiros(null);
        try {
            const dados = await fetchPassageirosTurma(turmaId);
            if (!atual()) return false;
            setPassageiros(dados);
            return true;
        } catch (e) {
            if (atual()) setErroPassageiros(errorMessage(e));
            console.log("Falha ao buscar passageiros.");
            return false;
        } finally {
            if (atual()) setCarregandoPassageiros(false);
        }
    }

    async function buscarAlunosPendentes(turmaId: number) {
        const request = ++pendentesRequest.current;
        const atual = () => turmaSelecionadaRef.current?.id === turmaId && request === pendentesRequest.current;
        setCarregandoPendentes(true);
        setErroPendentes(null);
        try {
            const dados = await fetchSolicitacoesTurma(turmaId);
            if (!atual()) return false;
            setAlunosPendentes(dados);
            return true;
        } catch (e) {
            if (atual()) setErroPendentes(errorMessage(e));
            console.log("Falha ao buscar pendentes.");
            return false;
        } finally {
            if (atual()) setCarregandoPendentes(false);
        }
    }

    async function analisarSolicitacao(vinculoId: number, status: 'APROVADO' | 'REJEITADO') {
        if (analisePendente.current) return;
        analisePendente.current = true;
        setAnalisando(vinculoId);
        try {
            const res = await apiFetch(`/turmas/analisar/${vinculoId}?status=${status}`, {
                method: 'PUT',
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });
            if (res.ok) {
                if (turmaSelecionada) {
                    await buscarDadosDaTurma(turmaSelecionada.id);
                }
            } else {
                Alert.alert("Erro", "Não foi possível atualizar a solicitação.");
            }
        } catch (e) {
            Alert.alert("Erro", errorMessage(e));
        } finally {
            analisePendente.current = false;
            setAnalisando(null);
        }
    }

    async function checarAmnesia(turmaId: number) {
        if (!user?.id || !turmaId) return;

        try {
            const chaveStorage = `@vanbora:viagem_ativa_${user.id}`;

            const res = await apiFetch(`/rota/status-atual?turmaId=${turmaId}`, {
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });
            if (turmaSelecionadaRef.current?.id !== turmaId) return;

            if (res.ok) {
                const data = await readApiJson<any>(res);
                if (turmaSelecionadaRef.current?.id !== turmaId) return;
                const statusStr = (data?.status || data?.situacao || '').toUpperCase();

                const ativo = statusStr === 'ATIVA' || statusStr === 'EM_CURSO' || data?.ativa === true;

                setViagemAtiva(ativo);

                if (ativo) {
                    await AsyncStorage.setItem(chaveStorage, 'true');
                } else {
                    await AsyncStorage.removeItem(chaveStorage);
                }
            } else {
                setViagemAtiva(false);
                await AsyncStorage.removeItem(chaveStorage);
            }
        } catch (e: any) {
            setViagemAtiva(false);
        }
    }

    const removerAluno = useCallback(async (alunoId: number, nomeAluno: string) => {
        if (!turmaSelecionada) return;

        Alert.alert(
            "Remover Passageiro",
            `Deseja realmente remover ${nomeAluno} desta turma?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Remover",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const res = await apiFetch(`/turmas/${turmaSelecionada.id}/alunos/${alunoId}`, {
                                method: 'DELETE',
                                headers: { 'Bypass-Tunnel-Reminder': 'true' }
                            });

                            if (res.ok) await buscarDadosDaTurma(turmaSelecionada.id);
                            else Alert.alert("Erro", "Não foi possível remover o aluno.");
                        } catch (e) {
            Alert.alert("Erro", errorMessage(e));
                        }
                    }
                }
            ]
        );
    }, [turmaSelecionada]);

    const totalPassageiros = useMemo(() => passageiros.length, [passageiros]);
    const totalRespostas = useMemo(() => passageiros.filter(p => p.status).length, [passageiros]);
    const todosResponderam = useMemo(() => !carregandoPassageiros && !erroPassageiros && totalPassageiros > 0 && totalRespostas === totalPassageiros,
        [totalPassageiros, totalRespostas, carregandoPassageiros, erroPassageiros]);

    const iniciarRota = useCallback((sentido: 'IDA' | 'VOLTA') => {
        if (!user?.id) return;
        if (!turmaSelecionada) {
            Alert.alert("Atenção", "Selecione uma turma.");
            return;
        }

        const turmaId = turmaSelecionada.id;
        const executarInicioNoServidor = async (forcarEncerramento = false) => {
            if (inicioPendente.current || turmaSelecionadaRef.current?.id !== turmaId) return;
            inicioPendente.current = true;
            try {
                if (forcarEncerramento) await reiniciarViagem(turmaId, sentido);
                else await iniciarViagem(turmaId, sentido);
                await AsyncStorage.setItem('@vanbora:viagem_ativa_' + user.id, 'true');
                if (turmaSelecionadaRef.current?.id !== turmaId) return;
                setViagemAtiva(true);
                router.push({ pathname: '/mapa', params: { sentido: sentido.toLowerCase(), turmaId: String(turmaId) } });
            } catch (error) {
                if (!forcarEncerramento && error instanceof ApiError && error.status === 409) {
                    Alert.alert('Rota em andamento', 'Esta turma tem uma viagem em andamento. Deseja encerrar e iniciar outra?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Encerrar e iniciar', style: 'destructive', onPress: () => executarInicioNoServidor(true) },
                    ]);
                } else {
                    if (turmaSelecionadaRef.current?.id === turmaId) await checarAmnesia(turmaId);
                    Alert.alert('Erro', errorMessage(error));
                }
            } finally { inicioPendente.current = false; }
        };

        Alert.alert(
            !todosResponderam ? "Alunos Pendentes" : "Iniciar Rota",
            !todosResponderam ? "Existem alunos sem confirmar presença. Deseja iniciar mesmo assim?" : `Deseja iniciar a rota de ${sentido} agora?`,
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Iniciar", style: "default", onPress: () => executarInicioNoServidor(false) }
            ]
        );
    }, [turmaSelecionada, todosResponderam, user?.id, router]);

    if (!loading && erroCarga && turmas.length === 0) {
        return <View style={styles.centerContainer}><AsyncState message={erroCarga} onRetry={refresh} /></View>;
    }

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <AsyncState loading title="Carregando suas turmas..." />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <HeaderMotorista
                nomeMotorista={user?.nome ? user.nome.split(' ')[0] : ''}
                totalPendentes={alunosPendentes.length}
                onAbrirNotificacoes={() => setModalNotificacoesVisible(true)}
            />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
                {erroCarga && <AsyncState message={erroCarga} onRetry={refresh} />}
                {viagemAtiva && <BannerRotaAtiva
                    onPress={() => {
                        if (!turmaSelecionada) return;

                        router.push({
                            pathname: '/mapa',
                            params: {
                                turmaId: String(turmaSelecionada.id),
                            },
                        });
                    }}
                />}

                <CardsTurmasMotorista
                    turmas={turmas}
                    turmaSelecionada={turmaSelecionada}
                    onSelecionarTurma={async (t) => {
                        turmaSelecionadaRef.current = t;
                        setTurmaSelecionada(t);
                        setPassageiros([]);
                        setAlunosPendentes([]);
                        setViagemAtiva(false);

                        if (user?.id) {
                            const chaveTurma =
                                `@bevans:turma_selecionada:${user.id}`;

                            await AsyncStorage.setItem(
                                chaveTurma,
                                String(t.id)
                            );
                        }

                        await Promise.all([buscarDadosDaTurma(t.id), checarAmnesia(t.id)]);

                        console.log('TURMA SELECIONADA:', {
                            id: t.id,
                            nome: t.nome,
                        });
                    }}
                    onEditarTurma={() => {
                        if (turmaSelecionada) {
                            router.push({
                                pathname: '/editar-turma',
                                params: {
                                    id: turmaSelecionada.id,
                                    nomeAtual: turmaSelecionada.nome,
                                    turnoAtual: turmaSelecionada.turno,
                                    origemAtual: turmaSelecionada.origemNome,
                                    destinoAtual: turmaSelecionada.destinoNome
                                }
                            } as any);
                        }
                    }}
                />

                <PainelTurmaSelecionada
                    turma={turmaSelecionada}
                    onAtualizarTurma={(tAtualizada) => { turmaSelecionadaRef.current = tAtualizada; setTurmaSelecionada(tAtualizada); }}
                />

                {turmaSelecionada && (
                    <>
                        <View style={[
                            styles.badgeStatus,
                            { backgroundColor: todosResponderam ? theme.colors.success : theme.colors.primary }
                        ]}>
                            <Text style={styles.badgeTitle}>
                                {todosResponderam ? "PRONTO!" : "COLETANDO..."}
                            </Text>
                            <Text style={styles.badgeSubtitle}>
                                {turmaSelecionada.nome} ({totalRespostas}/{totalPassageiros} responderam)
                            </Text>
                        </View>

                        <BotoesAcaoMotorista
                            viagemAtiva={viagemAtiva}
                            todosResponderam={todosResponderam}
                            onIniciarRota={iniciarRota}
                        />
                    </>
                )}

                {turmaSelecionada && <ListaPassageirosAprovados
                    passageiros={passageiros}
                    loading={carregandoPassageiros}
                    error={erroPassageiros}
                    onRetry={() => buscarPassageirosPorTurma(turmaSelecionada.id)}
                    onRemoverAluno={removerAluno}
                />}
            </ScrollView>

            <Modal
                visible={modalNotificacoesVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setModalNotificacoesVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable
                        style={styles.modalBackdrop}
                        onPress={() => setModalNotificacoesVisible(false)}
                    />
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Solicitações de Entrada</Text>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar solicitações" hitSlop={12}
                                onPress={() => setModalNotificacoesVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>

                        {carregandoPendentes && <AsyncState loading title="Carregando solicitações..." />}
                        {!carregandoPendentes && erroPendentes && <AsyncState message={erroPendentes}
                            onRetry={() => turmaSelecionada ? buscarAlunosPendentes(turmaSelecionada.id) : Promise.resolve()} />}
                        {!carregandoPendentes && !erroPendentes && alunosPendentes.length === 0 && (
                            <AsyncState status="empty" title="Nenhuma solicitação pendente" message="Novos pedidos de entrada aparecerão aqui." />
                        )}
                        {alunosPendentes.length > 0 && (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                                {alunosPendentes.map(item => (
                                    <View key={item.id} style={styles.itemRowCard}>
                                        <View style={styles.flexOne}>
                                            <Text style={styles.nomeAluno}>{item.aluno?.nome}</Text>
                                            <Text style={styles.telAluno}>
                                                {item.aluno?.telefone || 'Sem telefone'}
                                            </Text>
                                        </View>
                                        <View style={styles.actionsPendenteRow}>
                                            {analisando === item.id && <ActivityIndicator accessibilityLabel="Analisando solicitação" color={theme.colors.primary} />}
                                            <TouchableOpacity
                                                accessibilityRole="button"
                                                accessibilityLabel={`Recusar entrada de ${item.aluno?.nome || 'passageiro'}`}
                                                accessibilityState={{ disabled: analisando !== null, busy: analisando === item.id }}
                                                disabled={analisando !== null}
                                                hitSlop={8}
                                                onPress={() => analisarSolicitacao(item.id, 'REJEITADO')}
                                                style={styles.btnRecusar}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="close" size={20} color={theme.colors.danger} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                accessibilityRole="button"
                                                accessibilityLabel={`Aprovar entrada de ${item.aluno?.nome || 'passageiro'}`}
                                                accessibilityState={{ disabled: analisando !== null, busy: analisando === item.id }}
                                                disabled={analisando !== null}
                                                hitSlop={8}
                                                onPress={() => analisarSolicitacao(item.id, 'APROVADO')}
                                                style={styles.btnAprovar}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="checkmark" size={20} color={theme.colors.success} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    flexOne: {
        flex: 1,
    },
    scrollContent: {
        padding: theme.spacing.md,
        gap: theme.spacing.md,
    },
    badgeStatus: {
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    badgeTitle: {
        color: theme.colors.surface,
        fontWeight: theme.typography.weight.bold,
        fontSize: theme.typography.size.regular,
        letterSpacing: 0.5,
    },
    badgeSubtitle: {
        color: theme.colors.surface,
        fontSize: theme.typography.size.small,
        marginTop: 4,
        opacity: 0.9,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalBackdrop: {
        flex: 1,
    },
    modalCard: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: theme.spacing.lg,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
    },
    modalTitle: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    emptyTextModal: {
        color: theme.colors.textLight,
        textAlign: 'center',
        marginVertical: theme.spacing.xl,
        fontSize: theme.typography.size.regular,
    },
    modalScrollContent: {
        paddingBottom: theme.spacing.xl,
        gap: theme.spacing.sm,
    },
    itemRowCard: {
        backgroundColor: theme.colors.background,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    nomeAluno: {
        fontSize: theme.typography.size.regular,
        fontWeight: '600',
        color: theme.colors.text,
    },
    telAluno: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        marginTop: 2,
    },
    actionsPendenteRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    btnAprovar: {
        backgroundColor: `${theme.colors.success}15`,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnRecusar: {
        backgroundColor: `${theme.colors.danger}15`,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
