import { useAppAlert } from '../contexts/AppAlertContext';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentCoordinates } from '../services/location';
import { useRouter } from 'expo-router';
import { useHomeRefresh } from '../hooks/useHomeRefresh';
import { useFocusedPolling } from '../hooks/useFocusedPolling';
import { fetchMinhaConfirmacao, fetchPassengerRadar } from '../services/passageiroHome';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    
    ScrollView,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch, errorMessage, readApiError, readApiJson } from '../config/api';
import { AsyncState } from '../components/AsyncState';
import { globalStyles } from '../styles/globalStyles';
import { theme } from '../styles/theme';

import { CardTurmaPassageiro } from '../components/cards/CardTurmaPassageiro';
import { MapaRadarPassageiro } from '../components/passageiro/MapaRadarPassageiro';
import {
    SeletorPresenca,

} from '../components/passageiro/SeletorPresenca';
import type { ConfirmacaoPresenca } from '../types/presenca';
import { useAuth } from '../contexts/AuthContext';


interface Coordenadas {
    latitude: number;
    longitude: number;
}

export default function HomePassageiro() {
    const Alert = useAppAlert();
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
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

    const [turmasPassageiro, setTurmasPassageiro] =
        useState<any[]>([]);

    const [turmaSelecionadaId, setTurmaSelecionadaId] =
        useState<number | null>(null);

    const turmaSelecionadaRef = useRef<number | null>(null);

    const [minhaLocalizacao, setMinhaLocalizacao] = useState<Coordenadas | null>(null);
    const [posicaoVan, setPosicaoVan] = useState<Coordenadas | null>(null);
    const [statusViagem, setStatusViagem] = useState('INATIVA');
    const [statusGps, setStatusGps] = useState('GARAGEM');

    const [turma, setTurma] = useState<any>(null);
    const [enderecos, setEnderecos] = useState<any[]>([]);

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

                // Descarta dados de outra turma se a seleção
                // mudou durante a requisição.
                if (
                    turmaPreferidaId === undefined &&
                    turmaSelecionadaRef.current !== null &&
                    turmaAtualId !==
                    turmaSelecionadaRef.current
                ) {
                    return null;
                }

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
            setPosicaoVan(previous => previous?.latitude === radar.position?.latitude && previous?.longitude === radar.position?.longitude ? previous : radar.position);

        } catch (error) {
            if (!signal.aborted) setStatusGps('AGUARDANDO');
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

            if (!user?.id || !turmaId || salvandoPresenca) {
                return false;
            }

            setSalvandoPresenca(true);

            try {
                const params = new URLSearchParams({
                    usuarioId: String(user.id),
                    turmaId: String(turmaId),
                    status,
                });

                if (enderecoIda !== undefined) {
                    params.append(
                        'enderecoIda',
                        String(enderecoIda)
                    );
                }

                if (enderecoVolta !== undefined) {
                    params.append(
                        'enderecoVolta',
                        String(enderecoVolta)
                    );
                }

                const resposta = await apiFetch(
                    `/rota/confirmar?${params.toString()}`,
                    {
                        method: 'POST',
                        headers: {
                            'Bypass-Tunnel-Reminder': 'true',
                        },
                    }
                );

                if (!resposta.ok) {
                    const mensagem = (await readApiError(resposta)).message;

                    Alert.alert(
                        'Erro ao confirmar',
                        mensagem ||
                        'Não foi possível salvar sua presença.'
                    );

                    return false;
                }

                if (turmaSelecionadaRef.current !== turmaId) return false;
                // The server accepted the save. Do not let an older poll restore
                // the previous confirmation while the follow-up fetch is pending.
                dadosRequestRef.current++;
                setConfirmacao({
                    status,
                    enderecoIda: enderecos.find(endereco => endereco.id === enderecoIda) ?? null,
                    enderecoVolta: enderecos.find(endereco => endereco.id === enderecoVolta) ?? null,
                });
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
                setSalvandoPresenca(false);
            }
        },
        [
            user?.id,
            salvandoPresenca,
            carregarDadosSilencioso,
            enderecos,
        ]
    );

    const centroMapa = useMemo(() => minhaLocalizacao || posicaoVan, [minhaLocalizacao, posicaoVan]);
    const dataFormatada = useMemo(() => new Date().toLocaleDateString('pt-BR', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase(), []);

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
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
                <Text style={styles.dateText}>{dataFormatada}</Text>
                <Text style={styles.welcome}>Olá, <Text style={styles.nomeBold}>{user?.nome ? user.nome.split(' ')[0] : ''}</Text></Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
                {erroCarga && <AsyncState message={erroCarga} onRetry={refresh} />}
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


                {turmasPassageiro.length > 0 && (
                    <View style={{
                        gap: 10,
                        padding: theme.spacing.md,
                        backgroundColor: theme.colors.surface,
                        borderRadius: theme.borderRadius.lg,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                    }}>
                        <Text style={{
                            fontSize: theme.typography.size.regular,
                            fontWeight: '700',
                            color: theme.colors.text,
                        }}>
                            Minhas turmas
                        </Text>

                        <View style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 8,
                        }}>
                            {turmasPassageiro.map((item: any) => {
                                const selecionada =
                                    item.id === turmaSelecionadaId;

                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => {
                                            if (selecionada) return;

                                            turmaSelecionadaRef.current =
                                                item.id;

                                            setTurmaSelecionadaId(item.id);
                                            setTurma(item);
                                            setConfirmacao(null);
                                            setPosicaoVan(null);
                                            setStatusViagem('INATIVA');
                                            setStatusGps('GARAGEM');

                                            carregarDadosSilencioso(item.id);
                                        }}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 10,
                                            borderRadius: 10,
                                            borderWidth: 1,
                                            borderColor: selecionada
                                                ? theme.colors.primary
                                                : theme.colors.border,
                                            backgroundColor: selecionada
                                                ? theme.colors.primary
                                                : theme.colors.background,
                                        }}
                                    >
                                        <Text style={{
                                            color: selecionada
                                                ? '#FFFFFF'
                                                : theme.colors.text,
                                            fontWeight: '600',
                                        }}>
                                            {item.nome} · {item.turno}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            onPress={() => router.push('/entrar-turma')}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingVertical: 8,
                            }}
                        >
                            <Ionicons
                                name="add-circle-outline"
                                size={19}
                                color={theme.colors.primary}
                            />
                            <Text style={{
                                color: theme.colors.primary,
                                fontWeight: '600',
                            }}>
                                Entrar em outra turma
                            </Text>
                        </TouchableOpacity>
                    </View>
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
                            {statusViagem === 'INATIVA' ? (
                                <View style={styles.cadeadoBox}>
                                    <View style={styles.busIconContainer}>
                                        <Ionicons name="bus-outline" size={36} color={theme.colors.textLight} />
                                    </View>
                                    <Text style={styles.cadeadoTitulo}>A van está na garagem</Text>
                                    <Text style={styles.cadeadoSubtitulo}>O radar será ativado quando a viagem começar.</Text>
                                </View>
                            ) : centroMapa ? (
                                <MapaRadarPassageiro centroMapa={centroMapa} minhaLocalizacao={minhaLocalizacao} posicaoVan={posicaoVan} />
                            ) : (
                                <View style={styles.center}>
                                    <AsyncState status="empty" title="Localização indisponível" message="Aguardando uma localização válida. O radar tenta atualizar automaticamente." />
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
                                    <Text style={styles.filaLabel}>Sua Posição na Fila</Text>
                                    <Text style={styles.filaValue}>
                                        A ordem de embarque ainda não está disponível.
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

                        <SeletorPresenca
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

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    flexOne: {
        flex: 1,
    },
    header: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        zIndex: 10,
    },
    dateText: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    welcome: {
        fontSize: 24,
        color: theme.colors.text,
    },
    nomeBold: {
        fontWeight: theme.typography.weight.bold,
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
});
