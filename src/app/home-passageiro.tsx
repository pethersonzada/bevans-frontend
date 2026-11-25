import { themedStyles } from '../styles/themedStyles';
import { useThemeRevision } from '../hooks/useThemeRevision';
import { HeaderHome } from '../components/HeaderHome';
import { useAppAlert } from '../contexts/AppAlertContext';
import { CardsTurmasPassageiro } from '../components/cards/CardsTurmasPassageiro';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentCoordinates } from '../services/location';
import { useFocusEffect,useRouter } from 'expo-router';
import { useHomeRefresh } from '../hooks/useHomeRefresh';
import { useFocusedPolling } from '../hooks/useFocusedPolling';
import { fetchMinhaConfirmacao, fetchMinhaOperacao, fetchPassengerRadar, mensagemMinhaOperacao, type MinhaOperacao } from '../services/passageiroHome';
import { salvarPresencaPassageiro } from '../services/presencaPassageiro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AppState,
    
    ScrollView,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { apiFetch, errorMessage, readApiError, readApiJson } from '../config/api';
import { AsyncState } from '../components/AsyncState';
import { globalStyles } from '../styles/globalStyles';
import { theme } from '../styles/theme';

import { CardTurmaPassageiro } from '../components/cards/CardTurmaPassageiro';
import { MapaRadarPassageiro } from '../components/passageiro/MapaRadarPassageiro';
import { PresencaTurma } from '../components/passageiro/PresencaTurma';
import type { ConfirmacaoPresenca } from '../types/presenca';
import { useAuth } from '../contexts/AuthContext';


interface Coordenadas {
    latitude: number;
    longitude: number;
}

export default function HomePassageiro() {
    const darkMode = useThemeRevision() === 'dark';
    const Alert = useAppAlert();
    const { user } = useAuth();
    const router = useRouter();
    const primeiraCarga = useRef(true);
    const dadosRequestRef = useRef(0);
    const gpsSolicitadoRef = useRef(false);
    const gpsController = useRef<AbortController | null>(null);
    useEffect(() => () => gpsController.current?.abort(), []);

    const [loading, setLoading] = useState(true);
    const [erroCarga, setErroCarga] = useState<string | null>(null);
    const [temEndereco, setTemEndereco] = useState(true);
    const [confirmacao, setConfirmacao] =
        useState<ConfirmacaoPresenca | null>(null);

    const [salvandoPresenca, setSalvandoPresenca] =
        useState(false);
    const presencaPendente = useRef(false);

    const [turmasPassageiro, setTurmasPassageiro] =
        useState<any[]>([]);

    const [turmaSelecionadaId, setTurmaSelecionadaId] =
        useState<number | null>(null);

    const turmaSelecionadaRef = useRef<number | null>(null);

    const [minhaLocalizacao, setMinhaLocalizacao] = useState<Coordenadas | null>(null);
    const [posicaoVan, setPosicaoVan] = useState<Coordenadas | null>(null);
    const gpsExpiryTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
    useFocusEffect(useCallback(()=>{
        const clear=()=>{if(gpsExpiryTimer.current)clearTimeout(gpsExpiryTimer.current);setPosicaoVan(null);setStatusGps('AGUARDANDO');};
        const subscription=AppState.addEventListener('change',state=>{if(state!=='active')clear();});
        return()=>{subscription.remove();clear();};
    },[]));
    const [statusViagem, setStatusViagem] = useState('CARREGANDO');
    const [statusGps, setStatusGps] = useState('AGUARDANDO');
    const [erroRadar, setErroRadar] = useState('');
    const [minhaOperacao, setMinhaOperacao] = useState<MinhaOperacao | null>(null);
    const [erroOperacao, setErroOperacao] = useState('');
    const viagemAtivaRef = useRef<number | null>(null);

    const [turma, setTurma] = useState<any>(null);
    const [enderecos, setEnderecos] = useState<any[]>([]);
    useEffect(() => {
        primeiraCarga.current = true;
        gpsSolicitadoRef.current = false;
        turmaSelecionadaRef.current = null;
        setTurmaSelecionadaId(null); setTurma(null); setTurmasPassageiro([]);
        setConfirmacao(null); setEnderecos([]); setMinhaLocalizacao(null);
        setPosicaoVan(null); setStatusViagem('CARREGANDO'); setStatusGps('AGUARDANDO');
        setErroRadar(''); setLoading(true);
        setMinhaOperacao(null); setErroOperacao(''); viagemAtivaRef.current = null;
        return () => { dadosRequestRef.current++; gpsController.current?.abort(); if(gpsExpiryTimer.current)clearTimeout(gpsExpiryTimer.current); };
    }, [user?.id]);

    const buscarLocalizacaoPassageiro = useCallback(async () => {
        gpsController.current?.abort();
        const controller = new AbortController();
        gpsController.current = controller;
        try {
            const coordinates = await getCurrentCoordinates({ signal: controller.signal });
            if (!controller.signal.aborted) setMinhaLocalizacao(coordinates);
        } catch { /* The home remains usable without device location. */ }
    }, []);

    const carregarDadosSilencioso = useCallback(
        async (turmaPreferidaId?: number) => {
            if (!user?.id) return null;
            const requestId = ++dadosRequestRef.current;
            const atual = () => requestId === dadosRequestRef.current;
            setErroCarga(null);

            try {
                const [resTurmas, resEnderecos] =
                    await Promise.all([
                        apiFetch(
                            `/turmas/usuario/${user.id}/todas`,
                            {
                                headers: {
                                    'Bypass-Tunnel-Reminder': 'true',
                                },
                            }
                        ),
                        apiFetch(
                            `/enderecos/usuario/${user.id}`,
                            {
                                headers: {
                                    'Bypass-Tunnel-Reminder': 'true',
                                },
                            }
                        ),
                    ]);

                if (resEnderecos.ok) {
                    const lista = await readApiJson<any>(resEnderecos);
                    if (!atual()) return null;
                    if (!Array.isArray(lista)) throw new Error('Resposta de endereços inválida.');
                    setEnderecos(lista);
                    setTemEndereco(lista.length > 0);
                } else {
                    throw await readApiError(resEnderecos);
                }

                if (!resTurmas.ok) {
                    throw await readApiError(resTurmas);
                }

                const turmasRecebidas: any[] =
                    await readApiJson<any>(resTurmas);
                if (!atual()) return null;
                if (!Array.isArray(turmasRecebidas)) throw new Error('Resposta de turmas inválida.');

                setTurmasPassageiro(turmasRecebidas);

                const preferida =
                    turmaPreferidaId ??
                    turmaSelecionadaRef.current;

                const turmaAtual =
                    turmasRecebidas.find(
                        t => t.id === preferida
                    ) ?? turmasRecebidas[0] ?? null;

                const turmaAtualId =
                    turmaAtual?.id ?? null;

                turmaSelecionadaRef.current = turmaAtualId;
                setTurmaSelecionadaId(turmaAtualId);
                setTurma(turmaAtual);

                if (!turmaAtualId) {
                    setConfirmacao(null);
                    setPosicaoVan(null);
                    setStatusViagem('INATIVA');
                    setStatusGps('GARAGEM');
                    return null;
                }

                const saved = await fetchMinhaConfirmacao(user.id, turmaAtualId);

                // Não aplicar resultados de turma anterior.
                if (
                    !atual() ||
                    turmaSelecionadaRef.current !==
                    turmaAtualId
                ) {
                    return null;
                }

                setConfirmacao(saved);

                return turmaAtualId;
            } catch (error) {
                if (atual()) setErroCarga(errorMessage(error));
                console.log(
                    'Erro ao atualizar dados do passageiro.',
                    error
                );
                return false;
            }
        },
        [user?.id]
    );

    const { refreshing, refresh } = useHomeRefresh(user?.id ?? null, async () => {
        if (primeiraCarga.current) setLoading(true);
        if (!gpsSolicitadoRef.current) {
            gpsSolicitadoRef.current = true;
            void buscarLocalizacaoPassageiro();
        }
        const result = await carregarDadosSilencioso();
        setLoading(false);
        primeiraCarga.current = false;
        return result !== false;
    });

    const pollingKey = user?.id && turmaSelecionadaId ? user.id + ':' + turmaSelecionadaId : false;
    useFocusedPolling(async signal => {
        const turmaId = turmaSelecionadaRef.current;
        if (!turmaId) return;
        try {
            const radar = await fetchPassengerRadar(turmaId, signal);
            if (signal.aborted || turmaSelecionadaRef.current !== turmaId) return;
            setStatusViagem(radar.status);
            setStatusGps(radar.gps);
            setErroRadar('');
            if(gpsExpiryTimer.current)clearTimeout(gpsExpiryTimer.current);
            if(radar.position)gpsExpiryTimer.current=setTimeout(()=>{setPosicaoVan(null);setStatusGps('AGUARDANDO');},Math.max(0,radar.position.expiresAt-Date.now()));
            setPosicaoVan(previous => previous?.latitude === radar.position?.latitude && previous?.longitude === radar.position?.longitude ? previous : radar.position);
            if (viagemAtivaRef.current !== radar.viagemId) {
                viagemAtivaRef.current = radar.viagemId;
                setMinhaOperacao(null);
                setErroOperacao('');
            }
            if (radar.viagemId) {
                try {
                    const operacao = await fetchMinhaOperacao(radar.viagemId, signal);
                    if (!signal.aborted && turmaSelecionadaRef.current === turmaId && viagemAtivaRef.current === radar.viagemId) {
                        setMinhaOperacao(operacao);
                        setErroOperacao('');
                    }
                } catch (error) {
                    if (!signal.aborted && viagemAtivaRef.current === radar.viagemId) setErroOperacao(errorMessage(error));
                }
            } else {
                setMinhaOperacao(null);
            }
        } catch (error) {
            if (!signal.aborted && turmaSelecionadaRef.current === turmaId) {setStatusViagem('INDETERMINADO');setStatusGps('AGUARDANDO');setPosicaoVan(null);setErroRadar(errorMessage(error));setMinhaOperacao(null);viagemAtivaRef.current=null;}
        }
    }, 10000, pollingKey);

    useFocusedPolling(async signal => {
        const turmaId = turmaSelecionadaRef.current;
        if (!user?.id || !turmaId || salvandoPresenca) return;
        const revision = dadosRequestRef.current;
        const saved = await fetchMinhaConfirmacao(user.id, turmaId, signal);
        if (!signal.aborted && turmaSelecionadaRef.current === turmaId && revision === dadosRequestRef.current) setConfirmacao(saved);
    }, 30000, pollingKey, false);

    const registrarPresenca = useCallback(
        async (
            status: string,
            enderecoIda?: number,
            enderecoVolta?: number
        ): Promise<boolean> => {
            const turmaId = turmaSelecionadaRef.current;

            if (!user?.id || !turmaId || presencaPendente.current) {
                return false;
            }

            presencaPendente.current = true;
            setSalvandoPresenca(true);

            try {
                const salva = await salvarPresencaPassageiro(String(user.id), turmaId, status, enderecoIda, enderecoVolta);
                if (turmaSelecionadaRef.current !== turmaId) return false;
                dadosRequestRef.current++;
                setConfirmacao(salva);
                await carregarDadosSilencioso(turmaId);
                return true;
            } catch (error) {
                console.log(
                    'Erro ao registrar presença:',
                    error
                );

                Alert.alert(
                    'Erro',
                    errorMessage(error)
                );

                return false;
            } finally {
                presencaPendente.current = false;
                setSalvandoPresenca(false);
            }
        },
        [
            user?.id,
            carregarDadosSilencioso,
        ]
    );

    const centroMapa = useMemo(() => minhaLocalizacao || posicaoVan, [minhaLocalizacao, posicaoVan]);

    if (!loading && erroCarga && turmasPassageiro.length === 0) {
        return <View style={[globalStyles.container, styles.center]}><AsyncState message={erroCarga} onRetry={refresh} /></View>;
    }

    if (loading) {
        return (
            <View style={[globalStyles.container, styles.center]}>
                <AsyncState loading title="Carregando suas turmas..." />
            </View>
        );
    }

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

            <HeaderHome nome={user.nome} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
                {erroCarga && <AsyncState message={erroCarga} onRetry={refresh} />}
                {turmasPassageiro.length > 0 && (
                    <CardsTurmasPassageiro
                        turmas={turmasPassageiro}
                        turmaSelecionadaId={turmaSelecionadaId}
                        onSelecionarTurma={item => {
                            if (item.id === turmaSelecionadaRef.current) return;
                            dadosRequestRef.current++;
                            turmaSelecionadaRef.current = item.id;
                            setTurmaSelecionadaId(item.id);
                            setTurma(item);
                            setConfirmacao(null);
                            setPosicaoVan(null);
                            setStatusViagem('CARREGANDO');
                            setStatusGps('AGUARDANDO');
                            setErroRadar('');
                            setMinhaOperacao(null); setErroOperacao(''); viagemAtivaRef.current = null;
                            void carregarDadosSilencioso(item.id);
                        }}
                        onEntrarTurma={() => router.push('/entrar-turma')}
                    />
                )}

                {!temEndereco && (
                    <TouchableOpacity
                        style={styles.bannerAlerta}
                        onPress={() => router.push('/cadastro-endereco')}
                        activeOpacity={0.8}
                    >
                        <View style={styles.alertaIconCircle}>
                            <Ionicons name="location" size={22} color={theme.colors.danger} />
                        </View>
                        <View style={styles.flexOne}>
                            <Text style={styles.alertaTitulo}>Endereço Pendente</Text>
                            <Text style={styles.alertaTexto}>Toque aqui para definir o seu local de embarque.</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
                    </TouchableOpacity>
                )}


                <CardTurmaPassageiro turma={turma} />

                {turma ? (
                    <>
                        <View style={styles.radarHeader}>
                            <Text style={styles.sectionTitle}>Radar da Van</Text>
                            <View style={[
                                styles.statusBadge,
                                statusGps === 'ONLINE' ? styles.badgeOnline : styles.badgeOffline
                            ]}>
                                <View style={[
                                    styles.statusDot,
                                    statusGps === 'ONLINE' ? styles.dotOnline : styles.dotOffline
                                ]} />
                                <Text style={[
                                    styles.statusBadgeText,
                                    statusGps === 'ONLINE' ? styles.textOnline : styles.textOffline
                                ]}>
                                    {statusGps}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.radarCard}>
                            {statusViagem === 'CARREGANDO' ? (
                                <AsyncState loading title="Consultando a viagem" message="Verificando o estado atual da van." />
                            ) : statusViagem === 'INDETERMINADO' ? (
                                <AsyncState title="Estado da viagem indisponível" message={erroRadar || 'Aguardando uma resposta válida do servidor.'} />
                            ) : statusViagem === 'INATIVA' ? (
                                <View style={styles.cadeadoBox}>
                                    <View style={styles.busIconContainer}>
                                        <Ionicons name="bus-outline" size={36} color={theme.colors.textLight} />
                                    </View>
                                    <Text style={styles.cadeadoTitulo}>A van está na garagem</Text>
                                    <Text style={styles.cadeadoSubtitulo}>O radar será ativado quando a viagem começar.</Text>
                                </View>
                            ) : centroMapa && posicaoVan ? (
                                <MapaRadarPassageiro centroMapa={centroMapa} minhaLocalizacao={minhaLocalizacao} posicaoVan={posicaoVan} />
                            ) : (
                                <View style={styles.center}>
                                    <AsyncState status="empty" title="Viagem em andamento; localização indisponível" message="Aguardando uma localização recente da van. O radar tenta atualizar automaticamente." />
                                </View>
                            )}
                        </View>

                        {statusViagem === 'ATIVA' && (
                            <View style={styles.statusViagemCard}>
                                <View style={styles.statusViagemHeader}>
                                    <View style={styles.statusViagemTitleBox}>
                                        <View style={styles.analyticsIconBox}>
                                            <Ionicons name="analytics" size={18} color={theme.colors.primary} />
                                        </View>
                                        <Text style={styles.statusViagemTitle}>Status da Viagem</Text>
                                    </View>
                                    <View style={styles.emCursoBadge}>
                                        <Text style={styles.emCursoText}>EM CURSO</Text>
                                    </View>
                                </View>

                                <View style={styles.filaBox}>
                                    <Text style={styles.filaLabel}>Seu embarque</Text>
                                    <Text style={styles.filaValue}>
                                        {erroOperacao || mensagemMinhaOperacao(minhaOperacao)}
                                    </Text>
                                </View>

                                <View style={styles.avisoBox}>
                                    <Ionicons name="navigate-circle" size={20} color={theme.colors.primary} style={styles.avisoIcon} />
                                    <Text style={styles.avisoText}>
                                        A van está na estrada recolhendo os passageiros. Fique pronto no local!
                                    </Text>
                                </View>
                            </View>
                        )}

                        <PresencaTurma
                            turmaId={turmaSelecionadaId}
                            key={turmaSelecionadaId ?? 'sem-turma'}
                            confirmacao={confirmacao}
                            enderecos={enderecos}
                            salvando={salvandoPresenca}
                            onRegistrar={registrarPresenca}
                        />
                    </>
                ) : (
                    <View style={styles.emptyStateCard}>
                        <AsyncState status="empty" title="Aguardando vínculo com uma turma"
                            message="Você ainda não participa de uma turma ou seu pedido aguarda aprovação."
                            actionLabel="Inserir código de convite" onAction={() => router.push('/entrar-turma')} />
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = themedStyles(() => StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    flexOne: {
        flex: 1,
    },
    scrollContent: {
        padding: theme.spacing.md,
        gap: theme.spacing.md,
    },
    bannerAlerta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: `${theme.colors.danger}40`,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        shadowColor: theme.colors.danger,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    alertaIconCircle: {
        backgroundColor: `${theme.colors.danger}15`,
        padding: theme.spacing.sm,
        borderRadius: 20,
        marginRight: theme.spacing.sm,
    },
    alertaTitulo: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.danger,
        marginBottom: 2,
    },
    alertaTexto: {
        fontSize: theme.typography.size.small,
        color: theme.colors.text,
    },
    radarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: theme.spacing.sm,
    },
    sectionTitle: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        letterSpacing: -0.3,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.sm,
        borderWidth: 1,
    },
    badgeOnline: {
        backgroundColor: `${theme.colors.success}10`,
        borderColor: `${theme.colors.success}30`,
    },
    badgeOffline: {
        backgroundColor: `${theme.colors.textLight}10`,
        borderColor: `${theme.colors.textLight}30`,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    dotOnline: {
        backgroundColor: theme.colors.success,
    },
    dotOffline: {
        backgroundColor: theme.colors.textLight,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    textOnline: {
        color: theme.colors.success,
    },
    textOffline: {
        color: theme.colors.textLight,
    },
    radarCard: {
        height: 240,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cadeadoBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.background,
    },
    busIconContainer: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: 30,
        marginBottom: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cadeadoTitulo: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    cadeadoSubtitulo: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        marginTop: 4,
        textAlign: 'center',
    },



    statusViagemCard: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: theme.spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statusViagemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusViagemTitleBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    analyticsIconBox: {
        backgroundColor: `${theme.colors.primary}15`,
        padding: 6,
        borderRadius: theme.borderRadius.sm,
    },
    statusViagemTitle: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    emCursoBadge: {
        backgroundColor: `${theme.colors.success}15`,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.pill,
    },
    emCursoText: {
        fontSize: 11,
        fontWeight: '800',
        color: theme.colors.success,
        letterSpacing: 0.5,
    },
    filaBox: {
        backgroundColor: theme.colors.background,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    filaLabel: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        marginBottom: 4,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    filaValue: {
        fontSize: 20,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.primary,
        letterSpacing: -0.5,
    },
    avisoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${theme.colors.primary}10`,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: `${theme.colors.primary}20`,
    },
    avisoIcon: {
        marginRight: theme.spacing.sm,
    },
    avisoText: {
        fontSize: theme.typography.size.small,
        color: theme.colors.text,
        flex: 1,
        lineHeight: 18,
    },
    colegasCard: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    colegasTitle: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
    },
    emptyStateCard: {
        marginTop: theme.spacing.xl,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.xl,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 3,
    },
    emptyIconCircle: {
        backgroundColor: `${theme.colors.primary}15`,
        padding: theme.spacing.lg,
        borderRadius: 40,
        marginBottom: theme.spacing.lg,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    emptyText: {
        fontSize: theme.typography.size.regular,
        color: theme.colors.textLight,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: theme.spacing.xl,
    },
    emptyButton: {
        height: 54,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.md,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    emptyButtonIcon: {
        marginRight: theme.spacing.xs,
    },
    emptyButtonText: {
        color: theme.colors.surface,
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 0.5,
    },
}));
