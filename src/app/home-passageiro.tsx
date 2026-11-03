import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '../config/api';
import { globalStyles } from '../styles/globalStyles';
import { theme } from '../styles/theme';

import { CardTurmaPassageiro } from '../components/cards/CardTurmaPassageiro';
import ConfirmadosAvatares from '../components/motorista/ConfirmadosAvatares';
import { SeletorPresenca } from '../components/passageiro/SeletorPresenca';
import { useAuth } from './context/AuthContext';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
MapboxGL.setAccessToken(MAPBOX_TOKEN);

export default function HomePassageiro() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef<MapboxGL.Camera>(null);

    const [loading, setLoading] = useState(true);
    const [temEndereco, setTemEndereco] = useState(true);
    const [statusConfirmado, setStatusConfirmado] = useState('');
    const [minhaLocalizacao, setMinhaLocalizacao] = useState<{ latitude: number; longitude: number } | null>(null);
    const [posicaoVan, setPosicaoVan] = useState<{ latitude: number; longitude: number } | null>(null);
    const [statusViagem, setStatusViagem] = useState('INATIVA');
    const [statusGps, setStatusGps] = useState('GARAGEM');
    const [turma, setTurma] = useState<any>(null);
    const [enderecos, setEnderecos] = useState<{ id: number; apelido: string; rua: string; numero: string; bairro: string; }[]>([]);
    const [passageirosConfirmados, setPassageirosConfirmados] = useState<{ nome: string; iniciais: string }[]>([]);

    useFocusEffect(
        useCallback(() => {
            if (user?.id) {
                carregarDados();
            }
        }, [user?.id])
    );

    useEffect(() => {
        let intervalo: ReturnType<typeof setInterval> | null = null;

        const verificarRadar = async () => {
            try {
                const res = await apiFetch(`/rota/status-atual`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
                if (!res.ok) {
                    setStatusViagem('INATIVA');
                    setStatusGps('GARAGEM');
                    return;
                }
                const data = await res.json();
                const estadoAtual = data?.status || 'INATIVA';
                setStatusViagem(estadoAtual);

                if (user?.id) {
                    carregarDadosSilencioso();
                }

                if (estadoAtual === 'ATIVA') {
                    const resLoc = await apiFetch(`/rota/localizacao-van`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
                    if (resLoc.ok) {
                        setStatusGps('ONLINE');
                        const pos = await resLoc.json();
                        if (pos?.latitude && pos?.longitude) {
                            const novaPos = { latitude: Number(pos.latitude), longitude: Number(pos.longitude) };
                            setPosicaoVan(novaPos);
                            if (cameraRef.current) {
                                cameraRef.current.setCamera({
                                    centerCoordinate: [novaPos.longitude, novaPos.latitude],
                                    zoomLevel: 16,
                                    animationDuration: 1000,
                                });
                            }
                        }
                    } else if (resLoc.status === 404) {
                        setStatusGps('AGUARDANDO');
                    }
                } else {
                    setStatusGps('GARAGEM');
                    setPosicaoVan(null);
                }
            } catch (e) {
                setStatusViagem('INATIVA');
                setStatusGps('GARAGEM');
            }
        };

        verificarRadar();
        intervalo = setInterval(verificarRadar, 15000);

        return () => {
            if (intervalo) clearInterval(intervalo);
        };
    }, [user?.id]);

    async function carregarDados() {
        setLoading(true);
        await carregarDadosSilencioso();
        setLoading(false);
    }

    async function carregarDadosSilencioso() {
        try {
            if (user?.id) {
                const [resStatus, resTurma, resEnderecos] = await Promise.all([
                    apiFetch(`/usuarios/passageiros`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } }),
                    apiFetch(`/turmas/usuario/${user.id}`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } }),
                    apiFetch(`/enderecos/usuario/${user.id}`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } })
                ]);

                if (resEnderecos.ok) {
                    const listaEnderecos = await resEnderecos.json();
                    setEnderecos(listaEnderecos);
                    setTemEndereco(listaEnderecos.length > 0);
                }

                if (resStatus.ok) {
                    const list = await resStatus.json();
                    const meuRegistro = list.find((p: any) => String(p.id || p.usuarioId || p.passageiroId) === String(user.id));
                    setStatusConfirmado(meuRegistro?.status || meuRegistro?.presenca || '');

                    const confirmados = list
                        .filter((p: any) => {
                            const st = (p.status || p.presenca || '').toUpperCase();
                            return st === 'IDA' || st === 'VOLTA' || st === 'AMBOS' || st === 'CONFIRMADO';
                        })
                        .map((p: any) => {
                            const nomeCompleto = p.nome || p.usuarioNome || 'Passageiro';
                            const partes = nomeCompleto.trim().split(' ');
                            const iniciais = partes.length > 1
                                ? `${partes[0][0]}${partes[partes.length - 1][0]}`
                                : partes[0].substring(0, 2);

                            return {
                                nome: nomeCompleto,
                                iniciais: iniciais.toUpperCase()
                            };
                        });

                    setPassageirosConfirmados(confirmados);
                }

                if (resTurma.ok) {
                    const dadosTurma = await resTurma.json();
                    setTurma(dadosTurma);
                } else {
                    setTurma(null);
                }

                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    setMinhaLocalizacao({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                }
            }
        } catch (e) {
            console.log("Erro ao atualizar dados em segundo plano", e);
        }
    }

    async function registrarPresenca(status: string, enderecoId?: number) {
        if (!user?.id) return;
        const statusEnvio = status === 'LIMPAR' ? 'LIMPAR' : status;
        setStatusConfirmado(status === 'LIMPAR' ? '' : statusEnvio);

        try {
            let url = `/rota/confirmar?usuarioId=${Number(user.id)}&status=${statusEnvio}`;
            if (enderecoId) {
                url += `&enderecoId=${enderecoId}`;
            }

            const res = await apiFetch(url, {
                method: 'POST',
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });

            if (res.ok) {
                carregarDadosSilencioso();
            }
        } catch (e) {
            Alert.alert("Erro", "Falha de conexão ao registrar presença.");
        }
    }

    const minhaPosicaoNaFila = useMemo(() => {
        if (!user?.nome) return null;
        const index = passageirosConfirmados.findIndex(p => p.nome.toLowerCase() === user.nome.toLowerCase());
        return index !== -1 ? index + 1 : null;
    }, [passageirosConfirmados, user?.nome]);

    if (loading) {
        return (
            <View style={[globalStyles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    const centroMapa = posicaoVan || minhaLocalizacao;

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
                <View>
                    <Text style={styles.dateText}>
                        {new Date().toLocaleDateString('pt-BR', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                    </Text>
                    <Text style={styles.welcome}>Olá, {user?.nome ? user.nome.split(' ')[0] : ''}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                            {statusViagem === 'INATIVA' ? (
                                <View style={styles.cadeadoBox}>
                                    <View style={styles.busIconContainer}>
                                        <Ionicons name="bus-outline" size={36} color={theme.colors.textLight} />
                                    </View>
                                    <Text style={styles.cadeadoTitulo}>A van está na garagem</Text>
                                    <Text style={styles.cadeadoSubtitulo}>O radar será ativado quando a viagem começar.</Text>
                                </View>
                            ) : centroMapa ? (
                                <MapboxGL.MapView
                                    style={styles.flexOne}
                                    styleURL={MapboxGL.StyleURL.Dark}
                                    logoEnabled={false}
                                    attributionEnabled={false}
                                    compassEnabled={false}
                                >
                                    <MapboxGL.Camera
                                        ref={cameraRef}
                                        zoomLevel={16}
                                        centerCoordinate={[centroMapa.longitude, centroMapa.latitude]}
                                    />
                                    {posicaoVan && (
                                        <MapboxGL.PointAnnotation id="van-passageiro" coordinate={[posicaoVan.longitude, posicaoVan.latitude]}>
                                            <View style={styles.vanMarker}>
                                                <Text style={styles.vanMarkerIcon}>🚐</Text>
                                            </View>
                                        </MapboxGL.PointAnnotation>
                                    )}
                                </MapboxGL.MapView>
                            ) : (
                                <View style={styles.center}>
                                    <ActivityIndicator size="large" color={theme.colors.primary} />
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
                                        {minhaPosicaoNaFila ? `${minhaPosicaoNaFila}º na ordem de embarque` : 'Não confirmado na rota de hoje'}
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

                        <View style={styles.colegasCard}>
                            <Text style={styles.colegasTitle}>Colegas Confirmados</Text>
                            <ConfirmadosAvatares passageiros={passageirosConfirmados} />
                        </View>

                        <SeletorPresenca statusConfirmado={statusConfirmado} enderecos={enderecos} onRegistrar={registrarPresenca} />
                    </>
                ) : (
                    <View style={styles.emptyStateCard}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="ticket-outline" size={32} color={theme.colors.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>Aguardando Vinculação</Text>
                        <Text style={styles.emptyText}>
                            Você ainda não faz parte de nenhuma turma ou o motorista ainda não aprovou o seu acesso.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={() => router.push('/entrar-turma')}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="key-outline" size={18} color={theme.colors.surface} style={styles.emptyButtonIcon} />
                            <Text style={styles.emptyButtonText}>Inserir Código de Convite</Text>
                        </TouchableOpacity>
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
        paddingBottom: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    dateText: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    welcome: {
        fontSize: theme.typography.size.title,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    scrollContent: {
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    bannerAlerta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${theme.colors.danger}10`,
        borderWidth: 1,
        borderColor: `${theme.colors.danger}30`,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
    },
    alertaIconCircle: {
        backgroundColor: `${theme.colors.danger}20`,
        padding: theme.spacing.xs + 2,
        borderRadius: theme.borderRadius.md,
    },
    alertaTitulo: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.danger,
    },
    alertaTexto: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
    },
    radarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
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
        backgroundColor: `${theme.colors.success}15`,
        borderColor: `${theme.colors.success}30`,
    },
    badgeOffline: {
        backgroundColor: `${theme.colors.primary}15`,
        borderColor: `${theme.colors.primary}30`,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    dotOnline: {
        backgroundColor: theme.colors.success,
    },
    dotOffline: {
        backgroundColor: theme.colors.primary,
    },
    statusBadgeText: {
        fontSize: theme.typography.size.small,
        fontWeight: '700',
    },
    textOnline: {
        color: theme.colors.success,
    },
    textOffline: {
        color: theme.colors.primary,
    },
    radarCard: {
        height: 220,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cadeadoBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.lg,
    },
    busIconContainer: {
        backgroundColor: theme.colors.background,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.pill,
        marginBottom: theme.spacing.xs,
    },
    cadeadoTitulo: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    cadeadoSubtitulo: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        marginTop: 2,
    },
    vanMarker: {
        backgroundColor: '#1E1E1E',
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    vanMarkerIcon: {
        fontSize: 18,
    },
    statusViagemCard: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: theme.spacing.md,
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
        paddingHorizontal: theme.spacing.xs + 2,
        paddingVertical: 2,
        borderRadius: theme.borderRadius.sm,
    },
    emCursoText: {
        fontSize: theme.typography.size.small,
        fontWeight: '700',
        color: theme.colors.success,
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
        marginBottom: 2,
    },
    filaValue: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.primary,
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
    },
    colegasTitle: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
    },
    emptyStateCard: {
        marginTop: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.xl,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
    },
    emptyIconCircle: {
        backgroundColor: `${theme.colors.primary}15`,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.pill,
        marginBottom: theme.spacing.md,
    },
    emptyTitle: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: theme.spacing.xs,
    },
    emptyText: {
        fontSize: theme.typography.size.regular,
        color: theme.colors.textLight,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: theme.spacing.xl,
    },
    emptyButton: {
        height: 50,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.md,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    emptyButtonIcon: {
        marginRight: theme.spacing.xs,
    },
    emptyButtonText: {
        color: theme.colors.surface,
        fontWeight: theme.typography.weight.bold,
        fontSize: theme.typography.size.regular,
    },
});