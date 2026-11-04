import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { ComponentProps, useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { apiFetch } from '../config/api';
import { theme } from '../styles/theme';
import { useAuth } from './context/AuthContext';

import { BannerRotaAtiva } from '../components/banners/BannerRotaAtiva';
import { CardsTurmasMotorista } from '../components/cards/CardsTurmasMotorista';
import { BotoesAcaoMotorista } from '../components/motorista/BotoesAcaoMotorista';
import { HeaderMotorista } from '../components/motorista/HeaderMotorista';
import { ListaPassageirosAprovados } from '../components/motorista/ListaPassageirosAprovados';
import { PainelTurmaSelecionada } from '../components/motorista/PainelTurmaSelecionada';

export type Turma = NonNullable<ComponentProps<typeof CardsTurmasMotorista>['turmaSelecionada']>;

interface Aluno {
    id: number;
    nome: string;
    telefone?: string;
    status?: string;
    [key: string]: any;
}

interface VinculoPendente {
    id: number;
    aluno?: Aluno;
    [key: string]: any;
}

export default function HomeMotorista() {
    const { user } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const primeiraCarga = useRef(true);

    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [turmaSelecionada, setTurmaSelecionada] = useState<Turma | null>(null);
    const [passageiros, setPassageiros] = useState<Aluno[]>([]);
    const [alunosPendentes, setAlunosPendentes] = useState<VinculoPendente[]>([]);
    const [viagemAtiva, setViagemAtiva] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalNotificacoesVisible, setModalNotificacoesVisible] = useState(false);
    const [todosAlunos, setTodosAlunos] = useState<Aluno[]>([]);
    const [carregandoAlunos, setCarregandoAlunos] = useState(false);

    useFocusEffect(
        useCallback(() => {
            carregarDadosSilencioso();
        }, [user?.id, turmaSelecionada?.id])
    );

    async function carregarDadosSilencioso() {
        if (primeiraCarga.current) setLoading(true);

        if (user?.id) {
            await buscarTurmas(String(user.id));
        }

        setLoading(false);
        primeiraCarga.current = false;
    }

    async function buscarTurmas(motoristaId: string | number) {
        try {
            const res = await apiFetch(`/turmas/motorista/${motoristaId}`, { 
                headers: { 'Accept': 'application/json', 'Bypass-Tunnel-Reminder': 'true' } 
            });
            if (!res.ok) throw new Error();
            const data: Turma[] = await res.json();
            setTurmas(data);

            if (data.length > 0) {
                const atual = turmaSelecionada 
                    ? (data.find((t) => t.id === turmaSelecionada.id) || data[0]) 
                    : data[0];

                if (!turmaSelecionada || turmaSelecionada.id !== atual.id) {
                    setTurmaSelecionada(atual);
                }

                await buscarDadosDaTurma(atual.id);
                await checarAmnesia(atual.id);
            } else {
                setTurmaSelecionada(null);
                setPassageiros([]);
                setAlunosPendentes([]);
                setViagemAtiva(false);
            }
        } catch (e) {
            console.log("Falha ao carregar as turmas.");
        }
    }

    async function buscarDadosDaTurma(turmaId: number) {
        await Promise.all([
            buscarPassageirosPorTurma(turmaId),
            buscarAlunosPendentes(turmaId)
        ]);
    }

    async function buscarPassageirosPorTurma(turmaId: number) {
        try {
            const res = await apiFetch(`/turmas/${turmaId}/passageiros`, { 
                headers: { 'Accept': 'application/json', 'Bypass-Tunnel-Reminder': 'true' } 
            });
            if (res.ok) {
                const dados = await res.json();
                setPassageiros(dados);
            }
        } catch (e) { 
            console.log("Falha ao buscar passageiros."); 
        }
    }

    async function buscarAlunosPendentes(turmaId: number) {
        try {
            const res = await apiFetch(`/turmas/${turmaId}/pendentes`, { 
                headers: { 'Accept': 'application/json', 'Bypass-Tunnel-Reminder': 'true' } 
            });
            if (res.ok) {
                const dados = await res.json();
                setAlunosPendentes(dados);
            }
        } catch (e) { 
            console.log("Falha ao buscar pendentes."); 
        }
    }

    async function analisarSolicitacao(vinculoId: number, status: 'APROVADO' | 'REJEITADO') {
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
            Alert.alert("Erro", "Falha de conexão com o servidor."); 
        }
    }

    async function checarAmnesia(turmaId: number) {
        if (!user?.id || !turmaId) return;

        try {
            const chaveStorage = `@vanbora:viagem_ativa_${user.id}`;
            
            const res = await apiFetch(`/rota/status-atual?turmaId=${turmaId}`, { 
                headers: { 'Bypass-Tunnel-Reminder': 'true' } 
            });
            
            if (res.ok) {
                const data = await res.json();
                const statusStr = (data.status || data.situacao || '').toUpperCase();
                
                const ativo = statusStr === 'ATIVA' || statusStr === 'EM_CURSO' || data.ativa === true;
                
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

    async function abrirModalAdicionarAluno() {
        if (!turmaSelecionada) return;
        setModalVisible(true);
        setCarregandoAlunos(true);
        try {
            const res = await apiFetch(`/usuarios/passageiros`, { 
                headers: { 'Bypass-Tunnel-Reminder': 'true' } 
            });
            if (res.ok) {
                const todosOsPassageiros: Aluno[] = await res.json();
                const idsNaTurma = new Set(passageiros.map(p => p.id));
                const disponiveis = todosOsPassageiros.filter((p) => !idsNaTurma.has(p.id));
                setTodosAlunos(disponiveis);
            }
        } catch (e) {
            Alert.alert("Erro", "Não foi possível carregar alunos livres.");
        } finally { 
            setCarregandoAlunos(false); 
        }
    }

    async function vincularAluno(alunoId: number) {
        if (!turmaSelecionada) return;
        try {
            const res = await apiFetch(`/turmas/${turmaSelecionada.id}/alunos/${alunoId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' }
            });

            if (res.ok) {
                setModalVisible(false);
                await buscarDadosDaTurma(turmaSelecionada.id);
            } else {
                const erroTexto = await res.text();
                Alert.alert("Erro", erroTexto || "Não foi possível vincular o aluno.");
            }
        } catch (e) { 
            Alert.alert("Erro", "Falha de conexão com o servidor."); 
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
                            Alert.alert("Erro", "Falha de conexão com o servidor."); 
                        }
                    }
                }
            ]
        );
    }, [turmaSelecionada]);

    const totalPassageiros = useMemo(() => passageiros.length, [passageiros]);
    const totalRespostas = useMemo(() => passageiros.filter(p => p.status).length, [passageiros]);
    const todosResponderam = useMemo(() => totalPassageiros > 0 && totalRespostas === totalPassageiros, [totalPassageiros, totalRespostas]);

    const iniciarRota = useCallback((sentido: string) => {
        if (!turmaSelecionada) { 
            Alert.alert("Atenção", "Selecione uma turma."); 
            return; 
        }

        const executarInicioNoServidor = async (forcarEncerramento = false) => {
            try {
                const chaveStorage = `@vanbora:viagem_ativa_${user?.id}`;

                if (forcarEncerramento) {
                    await apiFetch(`/rota/encerrar?turmaId=${turmaSelecionada.id}&motoristaId=${user?.id}`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Bypass-Tunnel-Reminder': 'true' 
                        },
                        body: JSON.stringify({ 
                            turmaId: Number(turmaSelecionada.id),
                            motoristaId: Number(user?.id) 
                        })
                    });

                    setViagemAtiva(false);
                    await AsyncStorage.removeItem(chaveStorage);
                    await new Promise((resolve) => setTimeout(resolve, 600));
                }

                const bodyIniciar = { 
                    turmaId: Number(turmaSelecionada.id), 
                    motoristaId: Number(user?.id),
                    sentido: sentido.toUpperCase() 
                };

                const res = await apiFetch(`/rota/iniciar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                    body: JSON.stringify(bodyIniciar)
                });

                if (!res.ok) {
                    let errText = await res.text().catch(() => '');

                    if (!forcarEncerramento && (res.status === 400 || res.status === 409 || errText.toLowerCase().includes('em andamento') || errText.toLowerCase().includes('já existe'))) {
                        Alert.alert(
                            'Rota em Andamento',
                            'Já existe uma rota ativa registrada no sistema para esta turma. Deseja encerrar a rota anterior e iniciar uma nova agora?',
                            [
                                { text: 'Cancelar', style: 'cancel' },
                                {
                                    text: 'Encerrar e Iniciar Nova',
                                    style: 'destructive',
                                    onPress: () => executarInicioNoServidor(true)
                                }
                            ]
                        );
                        return;
                    }

                    throw new Error(errText || "Não foi possível iniciar a rota.");
                }

                await AsyncStorage.setItem(chaveStorage, 'true');
                setViagemAtiva(true);
                router.push(`/mapa?sentido=${sentido.toLowerCase()}`);
            } catch (e: any) { 
                Alert.alert("Erro", e.message || "Erro ao iniciar a rota."); 
            }
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

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
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

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {viagemAtiva && <BannerRotaAtiva onPress={() => router.push('/mapa')} />}

                <CardsTurmasMotorista
                    turmas={turmas}
                    turmaSelecionada={turmaSelecionada}
                    onSelecionarTurma={async (t) => { 
                        setTurmaSelecionada(t); 
                        await buscarDadosDaTurma(t.id);
                        await checarAmnesia(t.id);
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
                    onAtualizarTurma={(tAtualizada) => setTurmaSelecionada(tAtualizada as any)}
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

                <ListaPassageirosAprovados
                    passageiros={passageiros}
                    turmaSelecionada={turmaSelecionada}
                    onAdicionarAluno={abrirModalAdicionarAluno}
                    onRemoverAluno={removerAluno}
                />
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
                            <TouchableOpacity onPress={() => setModalNotificacoesVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>
                        
                        {alunosPendentes.length === 0 ? (
                            <Text style={styles.emptyTextModal}>
                                Nenhuma solicitação pendente.
                            </Text>
                        ) : (
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
                                            <TouchableOpacity 
                                                onPress={() => analisarSolicitacao(item.id, 'REJEITADO')} 
                                                style={styles.btnRecusar}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="close" size={20} color={theme.colors.danger} />
                                            </TouchableOpacity>
                                            <TouchableOpacity 
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

            <Modal 
                visible={modalVisible} 
                animationType="fade" 
                transparent={true} 
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable 
                        style={styles.modalBackdrop} 
                        onPress={() => setModalVisible(false)} 
                    />
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Adicionar Passageiro</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>

                        {carregandoAlunos ? (
                            <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinnerModal} />
                        ) : todosAlunos.length === 0 ? (
                            <Text style={styles.emptyTextModal}>Nenhum aluno disponível no momento.</Text>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                                {todosAlunos.map(aluno => (
                                    <TouchableOpacity 
                                        key={aluno.id} 
                                        style={styles.itemRowCard} 
                                        onPress={() => vincularAluno(aluno.id)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.nomeAluno}>{aluno.nome}</Text>
                                        <View style={styles.iconContainer}>
                                            <Ionicons name="add" size={20} color={theme.colors.primary} />
                                        </View>
                                    </TouchableOpacity>
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
    spinnerModal: {
        marginVertical: theme.spacing.xl,
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
    iconContainer: {
        backgroundColor: `${theme.colors.primary}15`,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
});