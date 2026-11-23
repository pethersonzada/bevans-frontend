import { themedStyles } from '../styles/themedStyles';
import { useThemeRevision } from '../hooks/useThemeRevision';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,


    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AppModal as Modal } from '../components/AppModal';
import { useAppAlert } from '../contexts/AppAlertContext';
import { useHomeRefresh } from '../hooks/useHomeRefresh';
import { fetchPassageirosTurma, fetchSolicitacoesTurma, fetchTurmasMotorista, removerPassageiroTurma } from '../services/motoristaHome';
import { analisarVinculo } from '../services/solicitacoes';
import { consultarEstadoViagem, iniciarViagem, reiniciarViagem, TrocaViagemError } from '../services/viagens';

import { AsyncState } from '../components/AsyncState';
import { errorMessage } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';

import { BannerRotaAtiva } from '../components/banners/BannerRotaAtiva';
import { CardsTurmasMotorista } from '../components/cards/CardsTurmasMotorista';
import { BotoesAcaoMotorista } from '../components/motorista/BotoesAcaoMotorista';
import { HeaderMotorista } from '../components/motorista/HeaderMotorista';
import { PainelTurmaSelecionada } from '../components/motorista/PainelTurmaSelecionada';

import type { PassageiroTurma as Aluno, Turma, SolicitacaoTurma as VinculoPendente } from '../types/turma';

export default function HomeMotorista() {
    const darkMode = useThemeRevision() === 'dark';
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
    const [mostrarPassageiros, setMostrarPassageiros] = useState(false);
    const [analisando, setAnalisando] = useState<number | null>(null);
    const analisePendente = useRef(false);
    const inicioPendente = useRef(false);
    const inicioExecutando = useRef(false);
    const emFoco = useRef(false);
    useFocusEffect(useCallback(() => {
        emFoco.current = true;
        const dismiss = () => { if (!inicioExecutando.current) inicioPendente.current = false; };
        const subscription = AppState.addEventListener('change', state => { if (state !== 'active') dismiss(); });
        return () => { emFoco.current = false; dismiss(); subscription.remove(); };
    }, []));

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
            await analisarVinculo(vinculoId, status);
            if (turmaSelecionada) await buscarDadosDaTurma(turmaSelecionada.id);
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

            const data = await consultarEstadoViagem(turmaId);
            if (turmaSelecionadaRef.current?.id !== turmaId) return;
            const ativo = data.status === 'ATIVA';
            setViagemAtiva(ativo);
            if (ativo) await AsyncStorage.setItem(chaveStorage, 'true');
            else await AsyncStorage.removeItem(chaveStorage);
        } catch {
            if (turmaSelecionadaRef.current?.id === turmaId) setViagemAtiva(false);
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
                            await removerPassageiroTurma(turmaSelecionada.id, alunoId);
                            await buscarDadosDaTurma(turmaSelecionada.id);
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

    const iniciarRota = useCallback(async (sentido: 'IDA' | 'VOLTA') => {
        if (!user.id || !turmaSelecionada || inicioPendente.current) return;
        const turmaId = turmaSelecionada.id;
        const vigente = () => emFoco.current && turmaSelecionadaRef.current?.id === turmaId;
        inicioPendente.current = true;
        const liberar = () => { inicioPendente.current = false; };
        try {
            const atual = await consultarEstadoViagem(turmaId);
            if (!vigente()) { liberar(); return; }
            setViagemAtiva(atual.status === 'ATIVA');
            let executando = false;
            const executar = async () => {
                if (executando) return;
                executando = true;
                if (!inicioPendente.current || !vigente()) { liberar(); return; }
                inicioExecutando.current = true;
                try {
                    if (atual.status === 'ATIVA') await reiniciarViagem(turmaId, sentido, atual.viagemId!, () => {
                        if (vigente()) setViagemAtiva(false);
                        void AsyncStorage.removeItem('@vanbora:viagem_ativa_' + user.id).catch(() => {});
                    });
                    else await iniciarViagem(turmaId, sentido);
                    const oficial = await consultarEstadoViagem(turmaId);
                    if (!vigente()) return;
                    setViagemAtiva(oficial.status === 'ATIVA');
                    const cache = '@vanbora:viagem_ativa_' + user.id;
                    void (oficial.status === 'ATIVA' ? AsyncStorage.setItem(cache, 'true') : AsyncStorage.removeItem(cache)).catch(() => {});
                    if (oficial.status === 'ATIVA') router.push({ pathname: '/mapa', params: { sentido: oficial.sentido?.toLowerCase(), turmaId: String(turmaId) } });
                } catch (error) {
                    if (!vigente()) return;
                    if (error instanceof TrocaViagemError) {
                        setViagemAtiva(error.estado?.status === 'ATIVA');
                        if (error.anteriorEncerrada) await AsyncStorage.removeItem('@vanbora:viagem_ativa_' + user.id);
                        Alert.alert(error.anteriorEncerrada ? 'Viagem anterior encerrada' : error.etapa === 'encerrar' ? 'Encerramento não confirmado' : 'Troca não concluída', error.message + ' ' + errorMessage(error.original));
                    } else {
                        await checarAmnesia(turmaId);
                        Alert.alert('Partida não confirmada', errorMessage(error) + ' Atualize o estado antes de tentar novamente.');
                    }
                } finally { inicioExecutando.current = false; liberar(); }
            };
            Alert.alert(atual.status === 'ATIVA' ? 'Substituir viagem ativa?' : 'Iniciar viagem?',
                atual.status === 'ATIVA'
                    ? 'A viagem atual será encerrada: GPS e acesso operacional dessa execução serão interrompidos. A nova partida pode falhar e não há retorno automático à viagem anterior. A troca será bloqueada se houver passageiros embarcados.'
                    : (!todosResponderam ? 'Há passageiros sem confirmar presença. Deseja iniciar mesmo assim?' : 'Deseja iniciar a viagem de ' + sentido + '?'),
                [{ text: 'Cancelar', style: 'cancel', onPress: liberar }, { text: atual.status === 'ATIVA' ? 'Encerrar e iniciar outra' : 'Iniciar', style: atual.status === 'ATIVA' ? 'destructive' : 'default', onPress: executar }],
                { onDismiss: liberar });
        } catch (error) { liberar(); if (vigente()) Alert.alert('Estado indisponível', errorMessage(error)); }
    }, [turmaSelecionada, todosResponderam, user.id, router]);

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
            <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

            <HeaderMotorista
                nomeMotorista={user.nome}
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
                        setMostrarPassageiros(false);

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
                                pathname: '/configuracoes-turma',
                                params: {
                                    turmaId: String(turmaSelecionada.id)
                                }
                            });
                        }
                    }}
                />


                {turmaSelecionada ? (
                    <>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionHeaderText}>
                                <Text style={styles.eyebrow}>TURMA ATUAL</Text>
                                <Text style={styles.sectionTitle}>Visão geral</Text>
                            </View>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Abrir configurações da turma"
                                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                                onPress={() => router.push({
                                    pathname: '/configuracoes-turma',
                                    params: { turmaId: String(turmaSelecionada.id) },
                                })}
                            >
                                <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
                            </Pressable>
                        </View>

                        <PainelTurmaSelecionada
                            turma={turmaSelecionada}
                            onAtualizarTurma={(tAtualizada) => {
                                turmaSelecionadaRef.current = tAtualizada;
                                setTurmaSelecionada(tAtualizada);
                            }}
                        />

                        <View style={styles.operationCard}>
                            <View style={styles.operationTop}>
                                <View style={[styles.statusDot, { backgroundColor: viagemAtiva ? theme.colors.success : theme.colors.primary }]} />
                                <Text style={styles.operationStatus}>{viagemAtiva ? 'Viagem em andamento' : 'Próxima viagem'}</Text>
                            </View>
                            <Text style={styles.operationTitle}>
                                {todosResponderam ? 'Presenças confirmadas' : 'Aguardando confirmações'}
                            </Text>
                            <Text style={styles.operationDetail}>
                                {carregandoPassageiros
                                    ? 'Atualizando confirmações...'
                                    : erroPassageiros
                                        ? 'Não foi possível atualizar as confirmações.'
                                        : `${totalRespostas} de ${totalPassageiros} passageiros responderam`}
                            </Text>
                            <View style={styles.progressTrack} accessibilityLabel={`${totalRespostas} de ${totalPassageiros} confirmações`}>
                                <View style={[styles.progressFill, { width: `${totalPassageiros ? Math.min(100, (totalRespostas / totalPassageiros) * 100) : 0}%` }]} />
                            </View>
                            <BotoesAcaoMotorista
                                viagemAtiva={viagemAtiva}
                                todosResponderam={todosResponderam}
                                onIniciarRota={iniciarRota}
                            />
                        </View>

                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionHeaderText}>
                                <Text style={styles.eyebrow}>GESTÃO</Text>
                                <Text style={styles.sectionTitle}>Pessoas</Text>
                            </View>
                        </View>
                        <View style={styles.listCard}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Ver solicitações de entrada, ${alunosPendentes.length} pendentes`}
                                style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
                                onPress={() => setModalNotificacoesVisible(true)}
                            >
                                <View style={styles.menuIcon}><Ionicons name="person-add-outline" size={21} color={theme.colors.primary} /></View>
                                <View style={styles.menuCopy}>
                                    <Text style={styles.menuTitle}>Solicitações de entrada</Text>
                                    <Text style={styles.menuSubtitle}>{carregandoPendentes ? 'Atualizando...' : erroPendentes ? 'Falha ao carregar. Toque para tentar novamente.' : alunosPendentes.length === 0 ? 'Nenhuma solicitação pendente' : `${alunosPendentes.length} aguardando análise`}</Text>
                                </View>
                                {alunosPendentes.length > 0 && <View style={styles.countPill}><Text style={styles.countPillText}>{alunosPendentes.length}</Text></View>}
                                <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
                            </Pressable>
                            <View style={styles.rowDivider} />
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ expanded: mostrarPassageiros }}
                                accessibilityLabel={`${mostrarPassageiros ? 'Ocultar' : 'Mostrar'} passageiros da turma`}
                                style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
                                onPress={() => setMostrarPassageiros(v => !v)}
                            >
                                <View style={styles.menuIcon}><Ionicons name="people-outline" size={21} color={theme.colors.primary} /></View>
                                <View style={styles.menuCopy}>
                                    <Text style={styles.menuTitle}>Passageiros</Text>
                                    <Text style={styles.menuSubtitle}>{carregandoPassageiros ? 'Atualizando...' : erroPassageiros ? 'Erro ao carregar lista' : `${totalPassageiros} na turma`}</Text>
                                </View>
                                <Ionicons name={mostrarPassageiros ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textLight} />
                            </Pressable>
                            {mostrarPassageiros && (
                            <View style={styles.expandedList}>
                                <View style={styles.passengerListHeading}>
                                    <Text style={styles.passengerListTitle}>Passageiros de {turmaSelecionada.nome}</Text>
                                    <Text style={styles.passengerListCount}>Turma selecionada</Text>
                                </View>
                                {carregandoPassageiros && <AsyncState loading title="Carregando passageiros..." />}
                                {!carregandoPassageiros && erroPassageiros && (
                                    <AsyncState message={erroPassageiros} onRetry={() => buscarPassageirosPorTurma(turmaSelecionada.id)} />
                                )}
                                {!carregandoPassageiros && !erroPassageiros && passageiros.length === 0 && (
                                    <AsyncState status="empty" title="Nenhum passageiro vinculado" message="Os passageiros aprovados desta turma aparecerão aqui." />
                                )}
                                {!carregandoPassageiros && !erroPassageiros && passageiros.map(p => (
                                    <View key={p.id} style={styles.passengerRow}>
                                        <View style={styles.passengerAvatar}>
                                            <Text style={styles.passengerInitials}>{p.nome?.trim().charAt(0).toUpperCase() || 'P'}</Text>
                                        </View>
                                        <View style={styles.passengerInfo}>
                                            <Text style={styles.passengerName}>{p.nome?.trim() || 'Passageiro sem nome'}</Text>
                                            <Text style={styles.passengerStatus}>
                                                {p.status ? `Confirmou: ${p.status}` : 'Aguardando resposta'}
                                            </Text>
                                        </View>
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={`Remover ${p.nome || 'passageiro'} da turma`}
                                            onPress={() => removerAluno(p.id, p.nome)}
                                            hitSlop={8}
                                            style={styles.passengerRemove}
                                        >
                                            <Ionicons name="trash-outline" size={19} color={theme.colors.danger} />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                            )}
                        </View>
                    </>
                ) : (
                    <View style={styles.emptyCard}>
                        <Ionicons name="people-outline" size={28} color={theme.colors.primary} />
                        <Text style={styles.emptyTitle}>Nenhuma turma selecionada</Text>
                        <Text style={styles.emptyDescription}>Selecione uma turma acima para gerenciar viagens, solicitações e passageiros.</Text>
                    </View>
                )}
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

const styles = themedStyles(() => StyleSheet.create({
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm },
    sectionHeaderText: { flex: 1, gap: 3 },
    eyebrow: { color: theme.colors.textLight, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
    sectionTitle: { color: theme.colors.text, fontSize: 21, fontWeight: '700' },
    iconButton: { minWidth: 48, minHeight: 48, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
    pressed: { opacity: 0.65 },
    operationCard: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, gap: theme.spacing.sm },
    operationTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDot: { height: 9, width: 9, borderRadius: 5 },
    operationStatus: { color: theme.colors.textLight, fontSize: 13, fontWeight: '600' },
    operationTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
    operationDetail: { color: theme.colors.textLight, fontSize: 14, lineHeight: 20 },
    progressTrack: { height: 6, borderRadius: 6, backgroundColor: theme.colors.border, overflow: 'hidden', marginBottom: theme.spacing.sm },
    progressFill: { height: '100%', borderRadius: 6, backgroundColor: theme.colors.primary },
    listCard: { backgroundColor: theme.colors.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
    menuItem: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: 12, gap: 12 },
    menuIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
    menuCopy: { flex: 1, gap: 4 },
    menuTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
    menuSubtitle: { color: theme.colors.textLight, fontSize: 12, lineHeight: 17 },
    countPill: { borderRadius: 12, backgroundColor: theme.colors.primary, minWidth: 24, minHeight: 24, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
    countPillText: { color: theme.colors.surface, fontSize: 12, fontWeight: '700' },
    rowDivider: { height: 1, marginLeft: 70, backgroundColor: theme.colors.border },
    expandedList: { paddingBottom: 8, backgroundColor: theme.colors.surface },
    passengerListHeading: { paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: 10, gap: 3, borderTopWidth: 1, borderTopColor: theme.colors.border },
    passengerListTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 15 },
    passengerListCount: { color: theme.colors.textLight, fontSize: 12 },
    passengerRow: { backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.md, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    passengerAvatar: { backgroundColor: theme.colors.background, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    passengerInitials: { color: theme.colors.primary, fontWeight: '700', fontSize: 16 },
    passengerInfo: { flex: 1, gap: 4 },
    passengerName: { color: theme.colors.text, fontWeight: '700', fontSize: 14 },
    passengerStatus: { color: theme.colors.textLight, fontSize: 12 },
    passengerRemove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    emptyCard: { padding: theme.spacing.xl, backgroundColor: theme.colors.surface, borderRadius: 18, alignItems: 'center', gap: 10 },
    emptyTitle: { fontWeight: '700', fontSize: 17, color: theme.colors.text },
    emptyDescription: { textAlign: 'center', color: theme.colors.textLight, lineHeight: 20 },

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
}));
