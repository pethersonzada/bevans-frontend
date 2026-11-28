import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal as Modal } from '../components/AppModal';
import { AsyncState } from '../components/AsyncState';
import { HeaderMotorista } from '../components/motorista/HeaderMotorista';
import { PainelTurmaSelecionada } from '../components/motorista/PainelTurmaSelecionada';
import { errorMessage } from '../config/api';
import { useAppAlert } from '../contexts/AppAlertContext';
import { useAuth } from '../contexts/AuthContext';
import { useHomeRefresh } from '../hooks/useHomeRefresh';
import { useThemeRevision } from '../hooks/useThemeRevision';

import {
    fetchPassageirosTurma,
    fetchSolicitacoesTurma,
    fetchTurmasMotorista,
    removerPassageiroTurma,
} from '../services/motoristaHome';

import {
    consultarEstadoViagem,
    cancelarViagemConferida,
    iniciarViagem,
    type EstadoViagem,
} from '../services/viagens';

import { filterTurmas } from '../services/turmaSearch';
import { theme } from '../styles/theme';
import { themedStyles } from '../styles/themedStyles';

import type {
    PassageiroTurma as Aluno,
    Turma,
    SolicitacaoTurma as VinculoPendente,
} from '../types/turma';

type Filtro =
    | 'TODOS'
    | 'IDA'
    | 'VOLTA'
    | 'NAO_VOU'
    | 'PENDENTES';

type Sentido = 'IDA' | 'VOLTA';

const participa = (p: Aluno, sentido: Sentido) =>
    p.status === sentido || p.status === 'AMBOS';

const rotuloStatus = (s?: string) => {
    switch (s) {
        case 'AMBOS':
            return 'Ida e volta';
        case 'IDA':
            return 'Somente ida';
        case 'VOLTA':
            return 'Somente volta';
        case 'NAO_VOU':
            return 'Não vai';
        default:
            return 'Aguardando resposta';
    }
};

const nomeTurma = (t: Turma) =>
    t.nome?.trim() || t.destinoNome || 'Turma sem nome';

export default function HomeMotorista() {
    const darkMode = useThemeRevision() === 'dark';
    const Alert = useAppAlert();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [erroCarga, setErroCarga] = useState<string | null>(null);

    const primeiraCarga = useRef(true);
    const turmaSelecionadaRef = useRef<Turma | null>(null);

    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [turmaSelecionada, setTurmaSelecionada] =
        useState<Turma | null>(null);

    const [passageiros, setPassageiros] = useState<Aluno[]>([]);

    const [alunosPendentes, setAlunosPendentes] =
        useState<VinculoPendente[]>([]);

    const [carregandoPassageiros, setCarregandoPassageiros] =
        useState(false);

    const [erroPassageiros, setErroPassageiros] =
        useState<string | null>(null);

    const [carregandoPendentes, setCarregandoPendentes] =
        useState(false);

    const [erroPendentes, setErroPendentes] =
        useState<string | null>(null);

    const [estadoViagem, setEstadoViagem] =
        useState<EstadoViagem | null>(null);

    const [erroViagem, setErroViagem] =
        useState<string | null>(null);

    const passageirosRequest = useRef(0);
    const pendentesRequest = useRef(0);
    const viagemRequest = useRef(0);

    const [modalTurmas, setModalTurmas] = useState(false);
    const [pesquisa, setPesquisa] = useState('');

    const [modalPassageiros, setModalPassageiros] =
        useState(false);

    const [filtro, setFiltro] = useState<Filtro>('TODOS');
    const [buscaPassageiro, setBuscaPassageiro] = useState('');

    const [gerenciarPassageiros, setGerenciarPassageiros] =
        useState(false);

    const [gestaoAberta, setGestaoAberta] = useState(false);

    const inicioPendente = useRef(false);
    const inicioExecutando = useRef(false);

    const [iniciando, setIniciando] = useState(false);

    const emFoco = useRef(false);

    useFocusEffect(
        useCallback(() => {
            emFoco.current = true;

            const dismiss = () => {
                if (!inicioExecutando.current) {
                    inicioPendente.current = false;
                }
            };

            const subscription = AppState.addEventListener(
                'change',
                state => {
                    if (state !== 'active') dismiss();
                }
            );

            return () => {
                emFoco.current = false;
                dismiss();
                subscription.remove();
            };
        }, [])
    );

    const { refreshing, refresh } = useHomeRefresh(
        user?.id ?? null,
        carregarDadosSilencioso
    );

    async function carregarDadosSilencioso() {
        if (primeiraCarga.current) {
            setLoading(true);
        }

        const success = user?.id
            ? await buscarTurmas(String(user.id))
            : false;

        setLoading(false);
        primeiraCarga.current = false;

        return success;
    }

    function limparSelecao() {
        passageirosRequest.current++;
        pendentesRequest.current++;
        viagemRequest.current++;

        setPassageiros([]);
        setAlunosPendentes([]);
        setEstadoViagem(null);
        setErroViagem(null);
        setErroPassageiros(null);
        setErroPendentes(null);
        setCarregandoPassageiros(false);
        setCarregandoPendentes(false);
        setModalPassageiros(false);
        setGestaoAberta(false);
    }

    async function buscarTurmas(
        motoristaId: string | number
    ) {
        setErroCarga(null);

        try {
            const data = await fetchTurmasMotorista(motoristaId);

            setTurmas(data);

            if (!data.length) {
                turmaSelecionadaRef.current = null;
                setTurmaSelecionada(null);
                limparSelecao();

                return true;
            }

            const chave =
                `@bevans:turma_selecionada:${motoristaId}`;

            const salvo = await AsyncStorage.getItem(chave)
                .catch(() => null);

            const preferido =
                turmaSelecionadaRef.current?.id ??
                (salvo ? Number(salvo) : null);

            const atual =
                data.find(t => Number(t.id) === preferido) ??
                data[0];

            if (turmaSelecionadaRef.current?.id !== atual.id) {
                limparSelecao();
            }

            turmaSelecionadaRef.current = atual;
            setTurmaSelecionada(atual);

            void AsyncStorage.setItem(
                chave,
                String(atual.id)
            ).catch(() => {});

            const resultados = await Promise.all([
                buscarDadosDaTurma(atual.id),
                checarAmnesia(atual.id),
            ]);

            return resultados.every(Boolean);
        } catch (error) {
            setErroCarga(errorMessage(error));
            return false;
        }
    }

    async function buscarDadosDaTurma(turmaId: number) {
        const resultados = await Promise.all([
            buscarPassageirosPorTurma(turmaId),
            buscarAlunosPendentes(turmaId),
        ]);

        return resultados.every(Boolean);
    }

    async function buscarPassageirosPorTurma(turmaId: number) {
        const request = ++passageirosRequest.current;

        const atual = () =>
            turmaSelecionadaRef.current?.id === turmaId &&
            request === passageirosRequest.current;

        setCarregandoPassageiros(true);
        setErroPassageiros(null);

        try {
            const dados = await fetchPassageirosTurma(turmaId);

            if (!atual()) return false;

            setPassageiros(dados);

            return true;
        } catch (e) {
            if (atual()) {
                setErroPassageiros(errorMessage(e));
            }

            return false;
        } finally {
            if (atual()) {
                setCarregandoPassageiros(false);
            }
        }
    }

    async function buscarAlunosPendentes(turmaId: number) {
        const request = ++pendentesRequest.current;

        const atual = () =>
            turmaSelecionadaRef.current?.id === turmaId &&
            request === pendentesRequest.current;

        setCarregandoPendentes(true);
        setErroPendentes(null);

        try {
            const dados = await fetchSolicitacoesTurma(turmaId);

            if (!atual()) return false;

            setAlunosPendentes(dados);

            return true;
        } catch (e) {
            if (atual()) {
                setErroPendentes(errorMessage(e));
            }

            return false;
        } finally {
            if (atual()) {
                setCarregandoPendentes(false);
            }
        }
    }

    async function checarAmnesia(turmaId: number) {
        if (!user?.id || !turmaId) return false;

        const request = ++viagemRequest.current;

        const atual = () =>
            turmaSelecionadaRef.current?.id === turmaId &&
            request === viagemRequest.current;

        try {
            const data = await consultarEstadoViagem(turmaId);

            if (!atual()) return false;

            setEstadoViagem(data);
            setErroViagem(null);

            const chave = `@vanbora:viagem_ativa_${user.id}`;

            void (
                data.status === 'ATIVA'
                    ? AsyncStorage.setItem(chave, 'true')
                    : AsyncStorage.removeItem(chave)
            ).catch(() => {});

            return true;
        } catch (e) {
            if (atual()) {
                setEstadoViagem(null);
                setErroViagem(errorMessage(e));
            }

            return false;
        }
    }

    async function selecionarTurma(t: Turma) {
        if (inicioPendente.current) return;

        setModalTurmas(false);
        setPesquisa('');

        if (turmaSelecionadaRef.current?.id === t.id) return;

        limparSelecao();

        turmaSelecionadaRef.current = t;
        setTurmaSelecionada(t);

        if (user?.id) {
            void AsyncStorage.setItem(
                `@bevans:turma_selecionada:${user.id}`,
                String(t.id)
            ).catch(() => {});
        }

        await Promise.all([
            buscarDadosDaTurma(t.id),
            checarAmnesia(t.id),
        ]);
    }

    function removerAluno(
        alunoId: number,
        nomeAluno: string
    ) {
        if (!turmaSelecionada) return;

        const id = turmaSelecionada.id;

        Alert.alert(
            'Remover passageiro',
            `Deseja remover ${nomeAluno} desta turma?`,
            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: 'Remover',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (
                                turmaSelecionadaRef.current?.id !== id
                            ) return;

                            await removerPassageiroTurma(
                                id,
                                alunoId
                            );

                            if (
                                turmaSelecionadaRef.current?.id === id
                            ) {
                                await buscarDadosDaTurma(id);
                            }
                        } catch (e) {
                            Alert.alert('Erro', errorMessage(e));
                        }
                    },
                },
            ]
        );
    }

    const viagemAtiva = estadoViagem?.status === 'ATIVA';

    const total = passageiros.length;

    const ida = passageiros.filter(p =>
        participa(p, 'IDA')
    ).length;

    const volta = passageiros.filter(p =>
        participa(p, 'VOLTA')
    ).length;

    const ausentes = passageiros.filter(
        p => p.status === 'NAO_VOU'
    ).length;

    const pendentes = passageiros.filter(
        p =>
            !['IDA', 'VOLTA', 'AMBOS', 'NAO_VOU'].includes(
                p.status || ''
            )
    ).length;

    const presencasDisponiveis =
        !carregandoPassageiros &&
        !erroPassageiros &&
        !erroCarga;

    const todosResponderam =
        presencasDisponiveis && pendentes === 0;

    const inicioBloqueado =
        iniciando ||
        !estadoViagem ||
        viagemAtiva ||
        !todosResponderam;

    async function retomarViagem() {
        if (!turmaSelecionada || inicioPendente.current) {
            return;
        }

        const id = turmaSelecionada.id;

        inicioPendente.current = true;
        setIniciando(true);

        try {
            const atual = await consultarEstadoViagem(id);

            if (
                !emFoco.current ||
                turmaSelecionadaRef.current?.id !== id
            ) return;

            setEstadoViagem(atual);
            setErroViagem(null);

            if (atual.status === 'ATIVA') {
                router.push({
                    pathname: '/mapa',
                    params: {
                        turmaId: String(id),
                        sentido: atual.sentido?.toLowerCase(),
                    },
                });
            } else {
                Alert.alert(
                    'Viagem encerrada',
                    'Não existe mais uma viagem ativa nesta turma.'
                );
            }
        } catch (e) {
            Alert.alert(
                'Estado indisponível',
                errorMessage(e)
            );
        } finally {
            inicioPendente.current = false;
            setIniciando(false);
        }
    }

    function solicitarCancelamentoViagem() {
        const turma = turmaSelecionada;
        const viagemId = estadoViagem?.status === 'ATIVA' ? estadoViagem.viagemId : undefined;
        if (!turma || !viagemId || !user?.id || inicioPendente.current) return;
        const usuarioId = user.id;
        const vigente = () => emFoco.current && turmaSelecionadaRef.current?.id === turma.id;
        Alert.alert(
            'Cancelar viagem?',
            'O rastreamento será encerrado e a viagem ficará registrada como cancelada. Se houver passageiros embarcados, registre os desembarques reais antes de cancelar.',
            [
                { text: 'Voltar', style: 'cancel' },
                {
                    text: 'Cancelar viagem',
                    style: 'destructive',
                    onPress: async () => {
                        if (!vigente() || inicioPendente.current) return;
                        inicioPendente.current = true;
                        inicioExecutando.current = true;
                        setIniciando(true);
                        ++viagemRequest.current;
                        try {
                            const oficial = await cancelarViagemConferida(turma.id, viagemId);
                            if (turmaSelecionadaRef.current?.id === turma.id) {
                                ++viagemRequest.current;
                                setEstadoViagem(oficial);
                                setErroViagem(null);
                                await AsyncStorage.multiRemove([
                                    '@vanbora:viagem_ativa',
                                    `@vanbora:viagem_ativa_${usuarioId}`,
                                ]).catch(() => {});
                            }
                            if (vigente()) Alert.alert('Viagem cancelada', 'O rastreamento foi encerrado.');
                        } catch (e) {
                            if (vigente()) {
                                await checarAmnesia(turma.id);
                                const mensagem = errorMessage(e);
                                if (/passageiros na van|confirme desembarques/i.test(mensagem)) {
                                    Alert.alert('Ainda há passageiros na van',
                                        'Registre os desembarques reais dos passageiros embarcados. Depois volte aqui para cancelar a viagem.',
                                        [
                                            { text: 'Voltar', style: 'cancel' },
                                            { text: 'Ver desembarques', onPress: () => {
                                                if (vigente()) router.push({ pathname: '/controle-viagem', params: { tipo: 'VIAGEM', id: String(viagemId), finalidade: 'cancelar' } });
                                            } },
                                        ]);
                                } else Alert.alert('Cancelamento não confirmado', mensagem);
                            }
                        } finally {
                            inicioExecutando.current = false;
                            inicioPendente.current = false;
                            setIniciando(false);
                        }
                    },
                },
            ]
        );
    }

    async function iniciarRota(sentido: Sentido) {
        if (
            !user?.id ||
            !turmaSelecionada ||
            inicioPendente.current ||
            inicioBloqueado
        ) return;

        const id = turmaSelecionada.id;

        const vigente = () =>
            emFoco.current &&
            turmaSelecionadaRef.current?.id === id;

        inicioPendente.current = true;

        const liberar = () => {
            inicioPendente.current = false;
            setIniciando(false);
        };

        try {
            const atual = await consultarEstadoViagem(id);

            if (!vigente()) {
                liberar();
                return;
            }

            setEstadoViagem(atual);

            if (atual.status === 'ATIVA') {
                liberar();

                Alert.alert(
                    'Viagem em andamento',
                    'Use Continuar viagem para voltar ao mapa.'
                );

                return;
            }

            Alert.alert(
                sentido === 'IDA'
                    ? 'Iniciar ida?'
                    : 'Iniciar volta?',
                `${nomeTurma(turmaSelecionada)}\n${
                    sentido === 'IDA' ? ida : volta
                } passageiro(s) confirmado(s).`,
                [
                    {
                        text: 'Cancelar',
                        style: 'cancel',
                        onPress: liberar,
                    },
                    {
                        text: 'Iniciar viagem',
                        onPress: async () => {
                            if (
                                !inicioPendente.current ||
                                inicioExecutando.current ||
                                !vigente()
                            ) {
                                if (!inicioExecutando.current) {
                                    liberar();
                                }

                                return;
                            }

                            inicioExecutando.current = true;
                            setIniciando(true);

                            try {
                                await iniciarViagem(id, sentido);

                                const oficial =
                                    await consultarEstadoViagem(id);

                                if (!vigente()) return;

                                setEstadoViagem(oficial);
                                setErroViagem(null);

                                if (oficial.status !== 'ATIVA') {
                                    throw new Error(
                                        'O servidor ainda não confirmou a partida.'
                                    );
                                }

                                void AsyncStorage.setItem(
                                    `@vanbora:viagem_ativa_${user.id}`,
                                    'true'
                                ).catch(() => {});

                                router.push({
                                    pathname: '/mapa',
                                    params: {
                                        turmaId: String(id),
                                        sentido:
                                            oficial.sentido?.toLowerCase(),
                                    },
                                });
                            } catch (e) {
                                if (vigente()) {
                                    await checarAmnesia(id);

                                    Alert.alert(
                                        'Partida não confirmada',
                                        errorMessage(e)
                                    );
                                }
                            } finally {
                                inicioExecutando.current = false;
                                liberar();
                            }
                        },
                    },
                ],
                {
                    onDismiss: liberar,
                }
            );
        } catch (e) {
            liberar();

            if (vigente()) {
                Alert.alert(
                    'Estado indisponível',
                    errorMessage(e)
                );
            }
        }
    }

    function abrirPassageiros(
        f: Filtro,
        gerenciar = false
    ) {
        setGerenciarPassageiros(gerenciar);
        setBuscaPassageiro('');
        setFiltro(f);
        setModalPassageiros(true);
    }

    const normalizar = (valor: string) =>
        valor
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();

    const listaFiltrada = passageiros
        .filter(
            p =>
                (
                    filtro === 'TODOS' ||
                    (
                        filtro === 'PENDENTES'
                            ? ![
                                  'IDA',
                                  'VOLTA',
                                  'AMBOS',
                                  'NAO_VOU',
                              ].includes(p.status || '')
                            : filtro === 'NAO_VOU'
                              ? p.status === 'NAO_VOU'
                              : participa(p, filtro)
                    )
                ) &&
                normalizar(p.nome || '').includes(
                    normalizar(buscaPassageiro)
                )
        )
        .sort((a, b) =>
            (a.nome || '').localeCompare(
                b.nome || '',
                'pt-BR'
            )
        );

    const grupos =
        filtro === 'TODOS'
            ? [
                  {
                      titulo: 'Vão viajar',
                      itens: listaFiltrada.filter(
                          p =>
                              participa(p, 'IDA') ||
                              participa(p, 'VOLTA')
                      ),
                  },
                  {
                      titulo: 'Sem resposta',
                      itens: listaFiltrada.filter(
                          p =>
                              ![
                                  'IDA',
                                  'VOLTA',
                                  'AMBOS',
                                  'NAO_VOU',
                              ].includes(p.status || '')
                      ),
                  },
                  {
                      titulo: 'Não vão',
                      itens: listaFiltrada.filter(
                          p => p.status === 'NAO_VOU'
                      ),
                  },
              ]
            : [
                  {
                      titulo: '',
                      itens: listaFiltrada,
                  },
              ];

    if (loading) {
        return (
            <View style={styles.center}>
                <AsyncState
                    loading
                    title="Carregando suas turmas..."
                />
            </View>
        );
    }

    if (erroCarga && !turmas.length) {
        return (
            <View style={styles.center}>
                <AsyncState
                    message={erroCarga}
                    onRetry={refresh}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle={
                    darkMode
                        ? 'light-content'
                        : 'dark-content'
                }
                backgroundColor="transparent"
                translucent
            />

            <HeaderMotorista nomeMotorista={user.nome} />

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor={theme.colors.primary}
                        colors={[theme.colors.primary]}
                    />
                }
            >
                {erroCarga && (
                    <AsyncState
                        message={erroCarga}
                        onRetry={refresh}
                    />
                )}

                {!turmaSelecionada ? (
                    <View style={styles.card}>
                        <AsyncState
                            status="empty"
                            title="Nenhuma turma cadastrada"
                            message="Crie sua primeira turma para organizar as viagens."
                            actionLabel="Criar turma"
                            onAction={() =>
                                router.push('/cadastro-turma')
                            }
                        />
                    </View>
                ) : (
                    <>
                        <View style={styles.turmaBar}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Trocar turma. Atual: ${nomeTurma(turmaSelecionada)}`}
                                disabled={iniciando}
                                onPress={() => {
                                    setPesquisa('');
                                    setModalTurmas(true);
                                }}
                                style={styles.turmaSeletor}
                            >
                                <View style={styles.flex}>
                                    <Text style={styles.label}>
                                        TURMA ATUAL
                                    </Text>

                                    <Text style={styles.turmaNome}>
                                        {nomeTurma(turmaSelecionada)}
                                    </Text>
                                </View>

                                <Ionicons
                                    name="chevron-down"
                                    size={20}
                                    color={theme.colors.primary}
                                />
                            </Pressable>

                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Atualizar informações"
                                onPress={refresh}
                                disabled={refreshing}
                                style={styles.iconButton}
                            >
                                {refreshing ? (
                                    <ActivityIndicator
                                        color={theme.colors.primary}
                                    />
                                ) : (
                                    <Ionicons
                                        name="refresh-outline"
                                        size={23}
                                        color={theme.colors.primary}
                                    />
                                )}
                            </Pressable>
                        </View>

                        <View style={styles.dayHeading}>
                            <Text
                                accessibilityRole="header"
                                style={styles.dayTitle}
                            >
                                Viagens de hoje
                            </Text>

                            {presencasDisponiveis &&
                                pendentes === 0 && (
                                    <View style={styles.readyMark}>
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={16}
                                            color={theme.colors.success}
                                        />

                                        <Text style={styles.readyText}>
                                            Todos responderam
                                        </Text>
                                    </View>
                                )}
                        </View>

                        {viagemAtiva && (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Continuar viagem"
                                disabled={iniciando}
                                onPress={retomarViagem}
                                style={[
                                    styles.continuar,
                                    iniciando && styles.disabled,
                                ]}
                            >
                                <Ionicons
                                    name="navigate-outline"
                                    size={28}
                                    color={theme.colors.surface}
                                />

                                <View style={styles.flex}>
                                    <Text style={styles.primaryTitle}>
                                        Continuar viagem
                                    </Text>

                                    <Text style={styles.primaryDetail}>
                                        {estadoViagem?.sentido ===
                                        'VOLTA'
                                            ? 'Volta'
                                            : estadoViagem?.sentido ===
                                                'IDA'
                                              ? 'Ida'
                                              : 'Rota'}{' '}
                                        em andamento
                                    </Text>
                                </View>

                                <Ionicons
                                    name="arrow-forward"
                                    size={22}
                                    color={theme.colors.surface}
                                />
                            </Pressable>
                        )}

                        {erroViagem && (
                            <AsyncState
                                message={erroViagem}
                                onRetry={() =>
                                    checarAmnesia(
                                        turmaSelecionada.id
                                    )
                                }
                            />
                        )}

                        {!estadoViagem && !erroViagem && (
                            <Text style={styles.muted}>
                                Consultando estado da viagem...
                            </Text>
                        )}

                        <View style={styles.tripList}>
                            {(['IDA', 'VOLTA'] as const).map(
                                sentido => {
                                    const ehIda = sentido === 'IDA';
                                    const count = ehIda ? ida : volta;
                                    const nome = ehIda ? 'Ida' : 'Volta';

                                    return (
                                        <View
                                            key={sentido}
                                            style={styles.tripTile}
                                        >
                                            <View style={styles.tripTop}>
                                                <View style={styles.tripIcon}>
                                                    <Ionicons
                                                        name={
                                                            ehIda
                                                                ? 'school-outline'
                                                                : 'home-outline'
                                                        }
                                                        size={22}
                                                        color={
                                                            theme.colors.primary
                                                        }
                                                    />
                                                </View>

                                                <Text
                                                    style={styles.tripTitle}
                                                >
                                                    {nome}
                                                </Text>
                                            </View>

                                            <Text
                                                style={
                                                    styles.tripDestination
                                                }
                                            >
                                                {ehIda
                                                    ? 'Para a faculdade'
                                                    : 'Para casa'}
                                            </Text>

                                            <Pressable
                                                accessibilityRole="button"
                                                accessibilityLabel={`Ver passageiros da ${nome.toLowerCase()}, ${
                                                    presencasDisponiveis
                                                        ? count
                                                        : 'quantidade indisponível'
                                                }`}
                                                onPress={() =>
                                                    abrirPassageiros(sentido)
                                                }
                                                style={styles.tripInfo}
                                            >
                                                <Text
                                                    style={styles.tripNumber}
                                                    adjustsFontSizeToFit
                                                    numberOfLines={1}
                                                >
                                                    {presencasDisponiveis
                                                        ? count
                                                        : '—'}
                                                </Text>

                                                <View style={styles.tripCount}>
                                                    <Text
                                                        style={
                                                            styles.countText
                                                        }
                                                    >
                                                        {presencasDisponiveis &&
                                                        count === 1
                                                            ? 'Passageiro'
                                                            : 'Passageiros'}
                                                    </Text>

                                                    <Ionicons
                                                        name="chevron-forward"
                                                        size={14}
                                                        color={
                                                            theme.colors.primary
                                                        }
                                                    />
                                                </View>
                                            </Pressable>

                                            {!viagemAtiva && (
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Iniciar ${nome.toLowerCase()}`}
                                                    accessibilityState={{
                                                        disabled:
                                                            inicioBloqueado,
                                                    }}
                                                    disabled={inicioBloqueado}
                                                    onPress={() =>
                                                        iniciarRota(sentido)
                                                    }
                                                    style={[
                                                        styles.startButton,
                                                        inicioBloqueado &&
                                                            styles.disabled,
                                                    ]}
                                                >
                                                    <Text
                                                        style={styles.startText}
                                                    >
                                                        Iniciar{' '}
                                                        {nome.toLowerCase()}
                                                    </Text>

                                                    <Ionicons
                                                        name="arrow-forward"
                                                        size={16}
                                                        color={
                                                            theme.colors.surface
                                                        }
                                                    />
                                                </Pressable>
                                            )}
                                        </View>
                                    );
                                }
                            )}
                        </View>

                        {iniciando && (
                            <ActivityIndicator
                                accessibilityLabel="Confirmando viagem"
                                color={theme.colors.primary}
                            />
                        )}

                        {erroPassageiros && (
                            <AsyncState
                                message={erroPassageiros}
                                onRetry={() =>
                                    buscarPassageirosPorTurma(
                                        turmaSelecionada.id
                                    )
                                }
                            />
                        )}

                        {presencasDisponiveis ? (
                            <View style={styles.responseRow}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Ver ${ausentes} passageiros que não vão`}
                                    onPress={() =>
                                        abrirPassageiros('NAO_VOU')
                                    }
                                    style={styles.responseLink}
                                >
                                    <Text style={styles.responseText}>
                                        {ausentes} não vão
                                    </Text>

                                    <Ionicons
                                        name="chevron-forward"
                                        size={14}
                                        color={theme.colors.textLight}
                                    />
                                </Pressable>

                                <View style={styles.responseDivider} />

                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Ver ${pendentes} passageiros sem resposta`}
                                    onPress={() =>
                                        abrirPassageiros('PENDENTES')
                                    }
                                    style={styles.responseLink}
                                >
                                    <Text
                                        style={[
                                            styles.responseText,
                                            pendentes > 0 && {
                                                color: theme.colors.danger,
                                            },
                                        ]}
                                    >
                                        {pendentes} sem resposta
                                    </Text>

                                    <Ionicons
                                        name="chevron-forward"
                                        size={14}
                                        color={theme.colors.textLight}
                                    />
                                </Pressable>
                            </View>
                        ) : (
                            <Text style={styles.muted}>
                                {carregandoPassageiros
                                    ? 'Atualizando passageiros...'
                                    : 'Confirmações indisponíveis'}
                            </Text>
                        )}

                        {!viagemAtiva &&
                            presencasDisponiveis &&
                            !todosResponderam && (
                                <Text style={styles.notice}>
                                    Aguarde as confirmações para iniciar.
                                </Text>
                            )}

                        <View style={styles.flatMenu}>
                            {viagemAtiva && (
                                <>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="Cancelar viagem"
                                        disabled={iniciando}
                                        onPress={solicitarCancelamentoViagem}
                                        style={[styles.menuRow, iniciando && styles.disabled]}
                                    >
                                        <Ionicons name="close-circle-outline" size={24} color={theme.colors.danger} />
                                        <Text style={[styles.menuTitle, styles.flex, { color: theme.colors.danger }]}>Cancelar viagem</Text>
                                        <Ionicons name="chevron-forward" size={19} color={theme.colors.textLight} />
                                    </Pressable>
                                    <View style={styles.divider} />
                                </>
                            )}
                            <Pressable
                                accessibilityRole="button"
                                onPress={() =>
                                    abrirPassageiros('TODOS')
                                }
                                style={styles.menuRow}
                            >
                                <Ionicons
                                    name="people-outline"
                                    size={24}
                                    color={theme.colors.primary}
                                />

                                <Text
                                    style={[
                                        styles.menuTitle,
                                        styles.flex,
                                    ]}
                                >
                                    Passageiros
                                </Text>

                                <Text style={styles.muted}>
                                    {presencasDisponiveis
                                        ? total
                                        : '—'}
                                </Text>

                                <Ionicons
                                    name="chevron-forward"
                                    size={19}
                                    color={theme.colors.textLight}
                                />
                            </Pressable>

                            <View style={styles.divider} />

                            <Pressable
                                accessibilityRole="button"
                                onPress={() =>
                                    router.push({
                                        pathname: '/notificacoes',
                                        params: {
                                            aba: 'pedidos',
                                        },
                                    })
                                }
                                style={styles.menuRow}
                            >
                                <Ionicons
                                    name="person-add-outline"
                                    size={24}
                                    color={theme.colors.primary}
                                />

                                <Text
                                    style={[
                                        styles.menuTitle,
                                        styles.flex,
                                    ]}
                                >
                                    Solicitações da turma
                                </Text>

                                <Text style={styles.muted}>
                                    {carregandoPendentes ||
                                    erroPendentes
                                        ? '—'
                                        : alunosPendentes.length}
                                </Text>

                                <Ionicons
                                    name="chevron-forward"
                                    size={19}
                                    color={theme.colors.textLight}
                                />
                            </Pressable>

                            <View style={styles.divider} />

                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{
                                    expanded: gestaoAberta,
                                }}
                                onPress={() =>
                                    setGestaoAberta(v => !v)
                                }
                                style={styles.menuRow}
                            >
                                <Ionicons
                                    name="settings-outline"
                                    size={24}
                                    color={theme.colors.primary}
                                />

                                <Text
                                    style={[
                                        styles.menuTitle,
                                        styles.flex,
                                    ]}
                                >
                                    Gerenciar turma
                                </Text>

                                <Ionicons
                                    name={
                                        gestaoAberta
                                            ? 'chevron-up'
                                            : 'chevron-down'
                                    }
                                    size={19}
                                    color={theme.colors.textLight}
                                />
                            </Pressable>
                        </View>

                        {gestaoAberta && (
                            <>
                                <PainelTurmaSelecionada
                                    turma={turmaSelecionada}
                                    onAtualizarTurma={t => {
                                        if (
                                            turmaSelecionadaRef.current?.id !==
                                            t.id
                                        ) return;

                                        turmaSelecionadaRef.current = t;
                                        setTurmaSelecionada(t);

                                        setTurmas(lista =>
                                            lista.map(item =>
                                                item.id === t.id
                                                    ? t
                                                    : item
                                            )
                                        );
                                    }}
                                />

                                <View style={styles.card}>
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() =>
                                            abrirPassageiros(
                                                'TODOS',
                                                true
                                            )
                                        }
                                        style={styles.menuRow}
                                    >
                                        <Ionicons
                                            name="people-outline"
                                            size={24}
                                            color={theme.colors.primary}
                                        />

                                        <Text
                                            style={[
                                                styles.menuTitle,
                                                styles.flex,
                                            ]}
                                        >
                                            Gerenciar passageiros
                                        </Text>

                                        <Ionicons
                                            name="chevron-forward"
                                            size={20}
                                            color={
                                                theme.colors.textLight
                                            }
                                        />
                                    </Pressable>

                                    <View style={styles.divider} />

                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() =>
                                            router.push({
                                                pathname:
                                                    '/configuracoes-turma',
                                                params: {
                                                    turmaId: String(
                                                        turmaSelecionada.id
                                                    ),
                                                },
                                            })
                                        }
                                        style={styles.menuRow}
                                    >
                                        <Ionicons
                                            name="settings-outline"
                                            size={24}
                                            color={theme.colors.primary}
                                        />

                                        <Text
                                            style={[
                                                styles.menuTitle,
                                                styles.flex,
                                            ]}
                                        >
                                            Configurações da turma
                                        </Text>

                                        <Ionicons
                                            name="chevron-forward"
                                            size={20}
                                            color={
                                                theme.colors.textLight
                                            }
                                        />
                                    </Pressable>

                                    <View style={styles.divider} />

                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() =>
                                            router.push(
                                                '/cadastro-turma'
                                            )
                                        }
                                        style={styles.menuRow}
                                    >
                                        <Ionicons
                                            name="add-circle-outline"
                                            size={24}
                                            color={theme.colors.primary}
                                        />

                                        <Text
                                            style={[
                                                styles.menuTitle,
                                                styles.flex,
                                            ]}
                                        >
                                            Criar nova turma
                                        </Text>

                                        <Ionicons
                                            name="chevron-forward"
                                            size={20}
                                            color={
                                                theme.colors.textLight
                                            }
                                        />
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </>
                )}
            </ScrollView>

            <Modal
                visible={modalTurmas}
                animationType="fade"
                transparent
                onRequestClose={() =>
                    setModalTurmas(false)
                }
            >
                <View style={styles.overlay}>
                    <Pressable
                        style={styles.backdrop}
                        onPress={() => setModalTurmas(false)}
                    />

                    <View style={styles.sheet}>
                        <View style={styles.line}>
                            <Text
                                style={[
                                    styles.title,
                                    styles.flex,
                                ]}
                            >
                                Escolher turma
                            </Text>

                            <Pressable
                                accessibilityLabel="Fechar turmas"
                                accessibilityRole="button"
                                style={styles.iconButton}
                                onPress={() =>
                                    setModalTurmas(false)
                                }
                            >
                                <Ionicons
                                    name="close"
                                    size={24}
                                    color={theme.colors.text}
                                />
                            </Pressable>
                        </View>

                        {turmas.length > 4 && (
                            <TextInput
                                value={pesquisa}
                                onChangeText={setPesquisa}
                                placeholder="Pesquisar turma"
                                placeholderTextColor={
                                    theme.colors.textLight
                                }
                                accessibilityLabel="Pesquisar turma"
                                style={styles.search}
                            />
                        )}

                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                        >
                            {filterTurmas(turmas, pesquisa).map(
                                t => (
                                    <Pressable
                                        key={t.id}
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            selected:
                                                t.id ===
                                                turmaSelecionada?.id,
                                        }}
                                        style={styles.menuRow}
                                        onPress={() =>
                                            selecionarTurma(t)
                                        }
                                    >
                                        <View style={styles.flex}>
                                            <Text
                                                style={styles.menuTitle}
                                            >
                                                {nomeTurma(t)}
                                            </Text>

                                            <Text style={styles.muted}>
                                                {t.turno ||
                                                    'Turno geral'}
                                            </Text>
                                        </View>

                                        <Ionicons
                                            name={
                                                t.id ===
                                                turmaSelecionada?.id
                                                    ? 'checkmark-circle'
                                                    : 'chevron-forward'
                                            }
                                            size={24}
                                            color={theme.colors.primary}
                                        />
                                    </Pressable>
                                )
                            )}

                            {!filterTurmas(turmas, pesquisa)
                                .length && (
                                <Text style={styles.muted}>
                                    Nenhuma turma encontrada.
                                </Text>
                            )}
                        </ScrollView>

                        <Pressable
                            accessibilityRole="button"
                            style={styles.secondaryButton}
                            onPress={() => {
                                setModalTurmas(false);

                                router.push('/cadastro-turma');
                            }}
                        >
                            <Ionicons
                                name="add"
                                size={24}
                                color={theme.colors.primary}
                            />

                            <Text style={styles.secondaryTitle}>
                                Nova turma
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={modalPassageiros}
                animationType="fade"
                transparent
                onRequestClose={() =>
                    setModalPassageiros(false)
                }
            >
                <View style={styles.overlay}>
                    <Pressable
                        style={styles.backdrop}
                        onPress={() =>
                            setModalPassageiros(false)
                        }
                    />

                    <View
                        style={[
                            styles.sheet,
                            styles.passengerSheet,
                            {
                                paddingBottom: Math.max(
                                    insets.bottom,
                                    16
                                ),
                            },
                        ]}
                    >
                        <View style={styles.handle} />

                        <View style={styles.line}>
                            <View style={styles.flex}>
                                <Text style={styles.title}>
                                    {gerenciarPassageiros
                                        ? 'Gerenciar passageiros'
                                        : 'Passageiros'}
                                </Text>

                                <Text style={styles.muted}>
                                    {turmaSelecionada
                                        ? nomeTurma(turmaSelecionada)
                                        : ''}
                                </Text>
                            </View>

                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Fechar passageiros"
                                onPress={() =>
                                    setModalPassageiros(false)
                                }
                                style={styles.iconButton}
                            >
                                <Ionicons
                                    name="close"
                                    size={24}
                                    color={theme.colors.text}
                                />
                            </Pressable>
                        </View>

                        <View style={styles.searchRow}>
                            <Ionicons
                                name="search-outline"
                                size={21}
                                color={theme.colors.textLight}
                            />

                            <TextInput
                                value={buscaPassageiro}
                                onChangeText={setBuscaPassageiro}
                                placeholder="Buscar passageiro"
                                placeholderTextColor={
                                    theme.colors.textLight
                                }
                                accessibilityLabel="Buscar passageiro"
                                style={styles.searchInput}
                                autoCorrect={false}
                            />

                            {!!buscaPassageiro && (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="Limpar busca"
                                    onPress={() =>
                                        setBuscaPassageiro('')
                                    }
                                    style={styles.iconButton}
                                >
                                    <Ionicons
                                        name="close-circle"
                                        size={19}
                                        color={theme.colors.textLight}
                                    />
                                </Pressable>
                            )}
                        </View>

                        <View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={
                                    styles.filters
                                }
                                keyboardShouldPersistTaps="handled"
                            >
                                {(
                                    [
                                        {
                                            value: 'TODOS',
                                            label: 'Todos',
                                            count: total,
                                        },
                                        {
                                            value: 'IDA',
                                            label: 'Ida',
                                            count: ida,
                                        },
                                        {
                                            value: 'VOLTA',
                                            label: 'Volta',
                                            count: volta,
                                        },
                                        {
                                            value: 'NAO_VOU',
                                            label: 'Não vão',
                                            count: ausentes,
                                        },
                                        {
                                            value: 'PENDENTES',
                                            label: 'Pendentes',
                                            count: pendentes,
                                        },
                                    ] as {
                                        value: Filtro;
                                        label: string;
                                        count: number;
                                    }[]
                                ).map(f => (
                                    <Pressable
                                        key={f.value}
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            selected:
                                                filtro === f.value,
                                        }}
                                        onPress={() =>
                                            setFiltro(f.value)
                                        }
                                        style={[
                                            styles.filter,
                                            filtro === f.value &&
                                                styles.filterSelected,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.filterText,
                                                filtro === f.value && {
                                                    color:
                                                        theme.colors.surface,
                                                },
                                            ]}
                                        >
                                            {f.label}

                                            {presencasDisponiveis
                                                ? ` ${f.count}`
                                                : ''}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>

                        {carregandoPassageiros && (
                            <AsyncState
                                loading
                                title="Carregando passageiros..."
                            />
                        )}

                        {!carregandoPassageiros &&
                            erroPassageiros && (
                                <AsyncState
                                    message={erroPassageiros}
                                    onRetry={() =>
                                        turmaSelecionada
                                            ? buscarPassageirosPorTurma(
                                                  turmaSelecionada.id
                                              )
                                            : Promise.resolve(false)
                                    }
                                />
                            )}

                        {!carregandoPassageiros &&
                            !erroPassageiros && (
                                <ScrollView
                                    style={styles.passengerScroll}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                >
                                    {!listaFiltrada.length && (
                                        <AsyncState
                                            status="empty"
                                            title="Nenhum passageiro encontrado"
                                        />
                                    )}

                                    {grupos
                                        .filter(
                                            g => g.itens.length > 0
                                        )
                                        .map(g => (
                                            <View
                                                key={g.titulo || filtro}
                                            >
                                                {!!g.titulo && (
                                                    <Text
                                                        style={
                                                            styles.groupTitle
                                                        }
                                                    >
                                                        {g.titulo} ·{' '}
                                                        {g.itens.length}
                                                    </Text>
                                                )}

                                                {g.itens.map(p => (
                                                    <View
                                                        key={p.id}
                                                        style={
                                                            styles.passengerRow
                                                        }
                                                    >
                                                        <View
                                                            style={
                                                                styles.avatar
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.initial
                                                                }
                                                            >
                                                                {p.nome
                                                                    ?.trim()
                                                                    .charAt(0)
                                                                    .toUpperCase() ||
                                                                    'P'}
                                                            </Text>
                                                        </View>

                                                        <View
                                                            style={
                                                                styles.flex
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.menuTitle
                                                                }
                                                            >
                                                                {p.nome ||
                                                                    'Passageiro'}
                                                            </Text>

                                                            <Text
                                                                style={[
                                                                    styles.muted,
                                                                    {
                                                                        color:
                                                                            participa(
                                                                                p,
                                                                                'IDA'
                                                                            ) ||
                                                                            participa(
                                                                                p,
                                                                                'VOLTA'
                                                                            )
                                                                                ? theme.colors.success
                                                                                : theme.colors.textLight,
                                                                    },
                                                                ]}
                                                            >
                                                                {rotuloStatus(
                                                                    p.status
                                                                )}
                                                            </Text>
                                                        </View>

                                                        {gerenciarPassageiros && (
                                                            <Pressable
                                                                accessibilityRole="button"
                                                                accessibilityLabel={`Remover ${p.nome}`}
                                                                onPress={() =>
                                                                    removerAluno(
                                                                        p.id,
                                                                        p.nome
                                                                    )
                                                                }
                                                                style={
                                                                    styles.iconButton
                                                                }
                                                            >
                                                                <Ionicons
                                                                    name="trash-outline"
                                                                    size={20}
                                                                    color={
                                                                        theme.colors.danger
                                                                    }
                                                                />
                                                            </Pressable>
                                                        )}
                                                    </View>
                                                ))}
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

const styles = themedStyles(() =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },

        center: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
        },

        content: {
            padding: 20,
            paddingBottom: 24,
            gap: 14,
        },

        flex: {
            flex: 1,
            minWidth: 0,
            gap: 4,
        },

        card: {
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 18,
            padding: 16,
            gap: 12,
        },

        turmaNome: {
            fontSize: 17,
            fontWeight: '700',
            color: theme.colors.text,
        },

        iconButton: {
            minWidth: 48,
            minHeight: 48,
            justifyContent: 'center',
            alignItems: 'center',
        },

        line: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },

        title: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.colors.text,
        },

        muted: {
            color: theme.colors.textLight,
            fontSize: 14,
            lineHeight: 19,
        },

        notice: {
            color: theme.colors.danger,
            fontSize: 14,
            lineHeight: 20,
        },

        continuar: {
            backgroundColor: theme.colors.primary,
            minHeight: 80,
            padding: 16,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },

        primaryTitle: {
            color: theme.colors.surface,
            fontSize: 18,
            fontWeight: '700',
        },

        primaryDetail: {
            color: theme.colors.surface,
            fontSize: 14,
            lineHeight: 19,
        },

        secondaryButton: {
            minHeight: 72,
            borderWidth: 1.5,
            borderColor: theme.colors.primary,
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },

        secondaryTitle: {
            color: theme.colors.primary,
            fontSize: 18,
            fontWeight: '700',
        },

        disabled: {
            opacity: 0.45,
        },

        menuRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 64,
            paddingVertical: 6,
        },

        menuTitle: {
            fontSize: 16,
            color: theme.colors.text,
            fontWeight: '700',
        },

        divider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.colors.border,
        },

        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.48)',
        },

        backdrop: {
            flex: 1,
        },

        sheet: {
            maxHeight: '85%',
            padding: 20,
            paddingBottom: 28,
            gap: 14,
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
        },

        search: {
            minHeight: 48,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 12,
            color: theme.colors.text,
            paddingHorizontal: 14,
            fontSize: 16,
        },

        filters: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingRight: 4,
        },

        filter: {
            minHeight: 44,
            paddingHorizontal: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.subtle,
            borderRadius: 22,
        },

        filterSelected: {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
        },

        filterText: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.text,
        },

        passengerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 60,
            paddingVertical: 8,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
        },

        initial: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors.primary,
        },

        turmaBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingBottom: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
        },

        turmaSeletor: {
            flex: 1,
            minHeight: 54,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },

        label: {
            color: theme.colors.textLight,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.8,
        },

        dayHeading: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            paddingTop: 4,
        },

        dayTitle: {
            color: theme.colors.text,
            fontSize: 23,
            fontWeight: '700',
        },

        readyMark: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },

        readyText: {
            color: theme.colors.success,
            fontSize: 12,
            fontWeight: '600',
        },

        tripList: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },

        tripTile: {
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 138,
            minWidth: 0,
            backgroundColor: theme.colors.surface,
            borderRadius: 18,
            padding: 14,
            gap: 6,
        },

        tripTop: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },

        tripIcon: {
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: theme.colors.subtle,
            alignItems: 'center',
            justifyContent: 'center',
        },

        tripTitle: {
            flexShrink: 1,
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors.text,
        },

        tripDestination: {
            fontSize: 12,
            color: theme.colors.textLight,
            lineHeight: 17,
        },

        tripInfo: {
            flex: 1,
            minHeight: 78,
            justifyContent: 'center',
            paddingVertical: 6,
        },

        tripNumber: {
            fontSize: 42,
            fontWeight: '700',
            color: theme.colors.text,
            fontVariant: ['tabular-nums'],
        },

        tripCount: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            flexWrap: 'wrap',
        },

        countText: {
            color: theme.colors.primary,
            fontSize: 13,
            fontWeight: '600',
        },

        startButton: {
            minHeight: 48,
            paddingHorizontal: 8,
            paddingVertical: 10,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
            borderRadius: 10,
            backgroundColor: theme.colors.primary,
        },

        startText: {
            flexShrink: 1,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: '700',
            color: theme.colors.surface,
        },

        responseRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
        },

        responseText: {
            color: theme.colors.textLight,
            fontSize: 13,
            fontWeight: '600',
        },

        responseLink: {
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
        },

        responseDivider: {
            width: 1,
            height: 14,
            backgroundColor: theme.colors.border,
        },

        flatMenu: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
            marginTop: 2,
        },

        passengerSheet: {
            height: '88%',
            maxHeight: '88%',
            gap: 12,
        },

        handle: {
            width: 34,
            height: 4,
            borderRadius: 4,
            backgroundColor: theme.colors.border,
            alignSelf: 'center',
        },

        searchRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
            paddingHorizontal: 12,
            borderRadius: 12,
            gap: 8,
            minHeight: 48,
        },

        searchInput: {
            flex: 1,
            minHeight: 48,
            color: theme.colors.text,
            fontSize: 15,
        },

        passengerScroll: {
            flex: 1,
        },

        groupTitle: {
            fontSize: 13,
            color: theme.colors.textLight,
            fontWeight: '700',
            marginTop: 14,
            marginBottom: 5,
        },

        avatar: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: theme.colors.subtle,
            alignItems: 'center',
            justifyContent: 'center',
        },
    })
);