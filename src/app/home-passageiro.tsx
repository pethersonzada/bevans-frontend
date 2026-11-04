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

interface PassageiroConfirmado {
    id: number | string;
    nome: string;
    iniciais: string;
}

interface Coordenadas {
    latitude: number;
    longitude: number;
}

export default function HomePassageiro() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef<MapboxGL.Camera>(null);
    const primeiraCarga = useRef(true);

    const [loading, setLoading] = useState(true);
    const [temEndereco, setTemEndereco] = useState(true);
    const [statusConfirmado, setStatusConfirmado] = useState('');
    
    const [minhaLocalizacao, setMinhaLocalizacao] = useState<Coordenadas | null>(null);
    const [posicaoVan, setPosicaoVan] = useState<Coordenadas | null>(null);
    const [statusViagem, setStatusViagem] = useState('INATIVA');
    const [statusGps, setStatusGps] = useState('GARAGEM');
    
    const [turma, setTurma] = useState<any>(null);
    const [enderecos, setEnderecos] = useState<any[]>([]);
    const [passageirosConfirmados, setPassageirosConfirmados] = useState<PassageiroConfirmado[]>([]);

    const buscarLocalizacaoPassageiro = useCallback(async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                setMinhaLocalizacao(coords);
            }
        } catch (e) {
            console.log("Erro silencioso ao buscar GPS local.");
        }
    }, []);

    const carregarDadosSilencioso = useCallback(async () => {
        if (!user?.id) return;
        
        try {
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

            let turmaAtualId = null;
            if (resTurma.ok) {
                const dadosTurma = await resTurma.json();
                setTurma(dadosTurma);
                turmaAtualId = dadosTurma?.id;
            } else {
                setTurma(null);
            }

            if (resStatus.ok) {
                const list = await resStatus.json();
                const meuRegistro = list.find((p: any) => String(p.id || p.usuarioId || p.passageiroId) === String(user.id));
                setStatusConfirmado(meuRegistro?.status || meuRegistro?.presenca || '');
            }

            // BUSCA A ORDEM DE ROTA OTIMIZADA PARA REFLETIR A SEQUÊNCIA REAL DO MOTORISTA
            if (turmaAtualId) {
                const resOtimizada = await apiFetch(`/rota/otimizar?sentido=ida&turmaId=${turmaAtualId}`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
                if (resOtimizada.ok) {
                    const listaOtimizada = await resOtimizada.json();
                    const confirmados = listaOtimizada.map((p: any) => {
                        const nomeCompleto = p.nome || p.usuarioNome || 'Passageiro';
                        const partes = nomeCompleto.trim().split(' ');
                        const iniciais = partes.length > 1
                            ? `${partes[0][0]}${partes[partes.length - 1][0]}`
                            : partes[0].substring(0, 2);

                        return {
                            id: p.id || p.usuarioId,
                            nome: nomeCompleto,
                            iniciais: iniciais.toUpperCase()
                        };
                    });
                    setPassageirosConfirmados(confirmados);
                }
            }

            return turmaAtualId;
        } catch (e) {
            console.log("Erro ao atualizar dados da API.", e);
            return null;
        }
    }, [user?.id]);

    useFocusEffect(
        useCallback(() => {
            let ativo = true;

            const inicializar = async () => {
                if (primeiraCarga.current) setLoading(true);
                
                await buscarLocalizacaoPassageiro(); 
                await carregarDadosSilencioso();
                
                if (ativo) {
                    setLoading(false);
                    primeiraCarga.current = false;
                }
            };

            inicializar();

            return () => { ativo = false; };
        }, [buscarLocalizacaoPassageiro, carregarDadosSilencioso])
    );

    useEffect(() => {
        let intervalo: ReturnType<typeof setInterval> | null = null;
        let buscando = false;

        const verificarRadar = async () => {
            if (!user?.id || buscando) return;
            buscando = true;

            try {
                const turmaId = turma?.id;
                if (!turmaId) {
                    buscando = false;
                    return;
                }

                const res = await apiFetch(`/rota/status-atual?turmaId=${turmaId}`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
                
                if (!res.ok) {
                    setStatusViagem('INATIVA');
                    setStatusGps('GARAGEM');
                    buscando = false;
                    return;
                }
                
                const data = await res.json();
                const estadoAtual = data?.status || data?.situacao || 'INATIVA';
                const ativoStr = estadoAtual === 'ATIVA' || estadoAtual === 'EM_CURSO' || data?.ativa === true ? 'ATIVA' : 'INATIVA';
                setStatusViagem(ativoStr);

                carregarDadosSilencioso();

                if (ativoStr === 'ATIVA') {
                    const resLoc = await apiFetch(`/rota/localizacao-van?turmaId=${turmaId}`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
                    
                    if (resLoc.ok) {
                        setStatusGps('ONLINE');
                        const pos = await resLoc.json();
                        
                        if (pos?.latitude && pos?.longitude) {
                            const novaPos = { latitude: Number(pos.latitude), longitude: Number(pos.longitude) };
                            setPosicaoVan(novaPos);
                            
                            cameraRef.current?.setCamera({
                                centerCoordinate: [novaPos.longitude, novaPos.latitude],
                                zoomLevel: 16,
                                animationDuration: 1000,
                            });
                        }
                    } else {
                        setStatusGps('AGUARDANDO');
                    }
                } else {
                    setStatusGps('GARAGEM');
                    setPosicaoVan(null);
                }
            } catch (e) {
                setStatusGps('AGUARDANDO');
            } finally {
                buscando = false;
            }
        };

        verificarRadar();
        intervalo = setInterval(verificarRadar, 10000);

        return () => {
            if (intervalo) clearInterval(intervalo);
        };
    }, [user?.id, turma?.id, carregarDadosSilencioso]);

    const registrarPresenca = useCallback(async (status: string, enderecoId?: number) => {
        if (!user?.id) return;
        
        const statusEnvio = status === 'LIMPAR' ? 'LIMPAR' : status;
        setStatusConfirmado(status === 'LIMPAR' ? '' : statusEnvio);

        try {
            let url = `/rota/confirmar?usuarioId=${Number(user.id)}&status=${statusEnvio}`;
            if (enderecoId) url += `&enderecoId=${enderecoId}`;

            const res = await apiFetch(url, {
                method: 'POST',
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });

            if (res.ok) await carregarDadosSilencioso();
        } catch (e) {
            Alert.alert("Erro", "Falha ao registrar presença.");
        }
    }, [user?.id, carregarDadosSilencioso]);

    const minhaPosicaoNaFila = useMemo(() => {
        if (!user?.id || passageirosConfirmados.length === 0) return null;
        const index = passageirosConfirmados.findIndex(p => String(p.id) === String(user.id));
        return index !== -1 ? index + 1 : null;
    }, [passageirosConfirmados, user?.id]);

    const centroMapa = useMemo(() => minhaLocalizacao || posicaoVan, [minhaLocalizacao, posicaoVan]);
    const dataFormatada = useMemo(() => new Date().toLocaleDateString('pt-BR', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase(), []);

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

            <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
                <Text style={styles.dateText}>{dataFormatada}</Text>
                <Text style={styles.welcome}>Olá, <Text style={styles.nomeBold}>{user?.nome ? user.nome.split(' ')[0] : ''}</Text></Text>
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
                                    {minhaLocalizacao && (
                                        <MapboxGL.PointAnnotation id="passageiro-local" coordinate={[minhaLocalizacao.longitude, minhaLocalizacao.latitude]}>
                                            <View style={styles.passageiroMarker}>
                                                <Ionicons name="person" size={14} color="#FFFFFF" />
                                            </View>
                                        </MapboxGL.PointAnnotation>
                                    )}
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
                                    <ActivityIndicator size="small" color={theme.colors.primary} />
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
                            <Text style={styles.colegasTitle}>Colegas Confirmados na Rota</Text>
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
    vanMarker: {
        backgroundColor: '#1E1E1E',
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 3,
        borderColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        elevation: 5,
    },
    vanMarkerIcon: {
        fontSize: 20,
    },
    passageiroMarker: {
        backgroundColor: theme.colors.primary,
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
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