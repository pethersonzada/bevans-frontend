import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL } from '../config/config';
import { apiFetch, readApiJson, readApiError } from '../config/api';
import { theme } from '../styles/theme';
import { useAuth } from './context/AuthContext';

import { CabecalhoMapa } from '../components/mapa/CabecalhoMapa';
import { ControlesViagem } from '../components/mapa/ControlesViagem';
import { PainelManobra } from '../components/mapa/PainelManobra';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
MapboxGL.setAccessToken(MAPBOX_TOKEN);

type PassageiroRota = {
    id: number;
    nome: string;
    rua?: string;
    numero?: string;
    bairro?: string;
    latitude: number;
    longitude: number;
    embarcado?: boolean;
};

type LatLng = {
    latitude: number;
    longitude: number;
};

type Sentido = 'ida' | 'volta';

type Manobra = {
    instrucao: string;
    tipo: string;
    coordenada: [number, number];
    indiceRota: number;
};

type Projecao = {
    ponto: LatLng;
    distancia: number;
    bearing: number;
    indice: number;
    t: number;
};

type ParadaNavegacao = {
    passageiroId: number | null;
    nome: string;
    ponto: LatLng;
    indiceRota: number;
};

type GeometriaSalva = {
    geoJson: any;
    coordenadas: [number, number][];
    manobras: Manobra[];
    paradas: ParadaNavegacao[];
    passageirosIds: number[];
};

const CACHE_KEYS = {
    garagem: (turmaId: number) => `@bevans:garagem:${turmaId}`,
    destino: (turmaId: number) => `@bevans:destino:${turmaId}`,
    rota: (turmaId: number, sentido: string) => `@bevans:rota:${turmaId}:${sentido}`,
    geometria: (turmaId: number, sentido: string) => `@bevans:geometria:v2:${turmaId}:${sentido}`,
    visitadas: (turmaId: number, sentido: string) => {
        const hoje = new Date();
        const diaLocal = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        return `@bevans:visitadas:${turmaId}:${sentido}:${diaLocal}`;
    },
    filaLocalizacoes: '@bevans:fila_localizacoes',
};

const RAIO_DESVIO_ROTA_METROS = 80;
const RAIO_CHEGADA_PARADA_METROS = 30;
const VELOCIDADE_MAXIMA_CHEGADA_KMH = 18;
const PRECISAO_MAXIMA_CHEGADA_METROS = 45;
const LEITURAS_PARA_CHEGADA = 2;
const DURACAO_ANIMACAO_MS = 1600;
const JANELA_BUSCA_PROJECAO = 40;
const LIMITE_WAYPOINTS_MAPBOX = 25;
const LIMIAR_TEMPO_FORA_ROTA_MS = 6000;
const COOLDOWN_RECALCULO_MS = 20000;

const HEADERS_PADRAO = {
    'Bypass-Tunnel-Reminder': 'true',
};

async function salvarCache<T>(chave: string, valor: T) {
    try {
        await AsyncStorage.setItem(chave, JSON.stringify(valor));
    } catch {
        // Falha no cache não deve interromper a navegação.
    }
}

async function lerCache<T>(chave: string): Promise<T | null> {
    try {
        const raw = await AsyncStorage.getItem(chave);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

function distanciaMetros(a: LatLng, b: LatLng): number {
    const R = 6371000;
    const rad = Math.PI / 180;

    const dLat = (b.latitude - a.latitude) * rad;
    const dLng = (b.longitude - a.longitude) * rad;

    const lat1 = a.latitude * rad;
    const lat2 = b.latitude * rad;

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function projetarNoSegmento(
    p: LatLng,
    a: LatLng,
    b: LatLng
): {
    ponto: LatLng;
    distancia: number;
    t: number;
    bearing: number;
} {
    const metrosPorGrauLat = 111320;
    const metrosPorGrauLng =
        111320 * Math.cos((a.latitude * Math.PI) / 180);

    const toXY = (pt: LatLng) => ({
        x: (pt.longitude - a.longitude) * metrosPorGrauLng,
        y: (pt.latitude - a.latitude) * metrosPorGrauLat,
    });

    const P = toXY(p);
    const B = toXY(b);

    const ABx = B.x;
    const ABy = B.y;

    const comprimentoQuad = ABx * ABx + ABy * ABy;

    let t =
        comprimentoQuad === 0
            ? 0
            : (P.x * ABx + P.y * ABy) / comprimentoQuad;

    t = Math.max(0, Math.min(1, t));

    const projX = ABx * t;
    const projY = ABy * t;

    const latitude = a.latitude + projY / metrosPorGrauLat;
    const longitude = a.longitude + projX / metrosPorGrauLng;

    const ponto = {
        latitude,
        longitude,
    };

    const distancia = distanciaMetros(p, ponto);

    const bearing =
        (Math.atan2(ABx, ABy) * 180 / Math.PI + 360) % 360;

    return {
        ponto,
        distancia,
        t,
        bearing,
    };
}

function encontrarProjecaoNaRota(
    coordenadas: [number, number][],
    ponto: LatLng,
    indiceAnterior: number | null,
    indiceMinimo: number,
    indiceMaximo: number
): Projecao | null {
    if (coordenadas.length < 2) return null;

    // Nunca procura segmentos depois da próxima parada obrigatória.
    const minimo = Math.max(0, Math.min(coordenadas.length - 2, indiceMinimo));
    const maximo = Math.min(coordenadas.length - 2, Math.max(minimo, indiceMaximo));
    const inicio = indiceAnterior === null
        ? minimo
        : Math.max(minimo, indiceAnterior - 5);
    const fim = indiceAnterior === null
        ? maximo
        : Math.min(maximo, indiceAnterior + JANELA_BUSCA_PROJECAO);
    let melhor: Projecao | null = null;

    for (let i = inicio; i <= fim; i++) {
        const a = { longitude: coordenadas[i][0], latitude: coordenadas[i][1] };
        const b = { longitude: coordenadas[i + 1][0], latitude: coordenadas[i + 1][1] };
        const proj = projetarNoSegmento(ponto, a, b);
        if (!melhor || proj.distancia < melhor.distancia) {
            melhor = { ...proj, indice: i };
        }
    }
    // Sem fallback global: uma rua próxima não pode adiantar a viagem.
    return melhor;
}

function indiceMaisProximoSequencial(
    coordenadas: [number, number][],
    alvo: LatLng,
    inicio: number
): number {
    let melhor = Math.min(inicio, coordenadas.length - 1);
    let distancia = Infinity;
    for (let i = melhor; i < coordenadas.length; i++) {
        const d = distanciaMetros(alvo, {
            latitude: coordenadas[i][1], longitude: coordenadas[i][0],
        });
        if (d < distancia) { distancia = d; melhor = i; }
    }
    return melhor;
}

function distanciaRestanteDesde(
    coordenadas: [number, number][],
    indiceSegmento: number,
    t: number
): number {
    const [lngA, latA] = coordenadas[indiceSegmento];

    const [lngB, latB] =
        coordenadas[
        Math.min(indiceSegmento + 1, coordenadas.length - 1)
        ];

    const segmentoTotal = distanciaMetros(
        {
            latitude: latA,
            longitude: lngA,
        },
        {
            latitude: latB,
            longitude: lngB,
        }
    );

    let total = segmentoTotal * (1 - t);

    for (
        let i = indiceSegmento + 1;
        i < coordenadas.length - 1;
        i++
    ) {
        const [lA, laA] = coordenadas[i];
        const [lB, laB] = coordenadas[i + 1];

        total += distanciaMetros(
            {
                latitude: laA,
                longitude: lA,
            },
            {
                latitude: laB,
                longitude: lB,
            }
        );
    }

    return total;
}

export default function Mapa() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const { sentido, turmaId } = useLocalSearchParams<{
        sentido?: string;
        turmaId?: string;
    }>();

    const { user } = useAuth();

    const cameraRef = useRef<MapboxGL.Camera>(null);

    const [direcaoAtual, setDirecaoAtual] = useState<Sentido>(
        (sentido as Sentido) || 'ida'
    );

    const [localizacao, setLocalizacao] = useState<LatLng | null>(null);
    const [posicaoSuave, setPosicaoSuave] = useState<LatLng | null>(null);
    const [headingAtual, setHeadingAtual] = useState(0);

    const [rota, setRota] = useState<PassageiroRota[]>([]);

    const [garagem, setGaragem] = useState<LatLng | null>(null);
    const [destino, setDestino] = useState<LatLng | null>(null);

    const [geometriaRota, setGeometriaRota] = useState<any>(null);
    const [coordenadasRota, setCoordenadasRota] = useState<
        [number, number][]
    >([]);

    const [manobras, setManobras] = useState<Manobra[]>([]);
    const [manobraAtual, setManobraAtual] = useState<Manobra | null>(null);

    const [loading, setLoading] = useState(true);
    const [viagemAtiva, setViagemAtiva] = useState(true);

    const [online, setOnline] = useState(true);
    const [erroRede, setErroRede] = useState<string | null>(null);

    const [foraDaRota, setForaDaRota] = useState(false);
    const [recalculandoRota, setRecalculandoRota] = useState(false);

    const [velocidadeAtual, setVelocidadeAtual] = useState(0);
    const [horarioAtual, setHorarioAtual] = useState('');

    const [distanciaRestante, setDistanciaRestante] =
        useState<number | null>(null);

    const [etaMinutos, setEtaMinutos] = useState<number | null>(null);

    const [turmaIdAtual, setTurmaIdAtual] = useState<number | null>(null);

    const montadoRef = useRef(true);

    const coordenadasRotaRef = useRef<[number, number][]>([]);
    const manobrasRef = useRef<Manobra[]>([]);

    const direcaoAtualRef = useRef<Sentido>(direcaoAtual);
    const rotaRef = useRef<PassageiroRota[]>([]);

    const garagemRef = useRef<LatLng | null>(null);
    const destinoRef = useRef<LatLng | null>(null);

    const ultimoIndiceProjecaoRef = useRef<number | null>(null);

    const headingRef = useRef(0);
    const posicaoApresentadaRef = useRef<LatLng | null>(null);

    const animFrameRef = useRef<number | null>(null);

    const controladoresAtivosRef = useRef<Set<AbortController>>(
        new Set()
    );

    const primeiroTickForaRotaRef = useRef<number | null>(null);

    const recalculandoRef = useRef(false);
    const ultimaRecalculacaoRef = useRef<number | null>(null);

    const turmaIdRef = useRef<number | null>(null);
    const paradasRef = useRef<ParadaNavegacao[]>([]);
    const visitadosRef = useRef<Set<number>>(new Set());
    const leiturasChegadaRef = useRef(0);
    const indiceMinimoRef = useRef(0);
    const [proximaParada, setProximaParada] = useState<string | null>(null);
    const [paradasRestantes, setParadasRestantes] = useState(0);


    useEffect(() => {
        coordenadasRotaRef.current = coordenadasRota;
    }, [coordenadasRota]);

    useEffect(() => {
        manobrasRef.current = manobras;
    }, [manobras]);

    useEffect(() => {
        direcaoAtualRef.current = direcaoAtual;
    }, [direcaoAtual]);

    useEffect(() => {
        rotaRef.current = rota;
    }, [rota]);

    useEffect(() => {
        garagemRef.current = garagem;
    }, [garagem]);

    useEffect(() => {
        destinoRef.current = destino;
    }, [destino]);

    useEffect(() => {
        turmaIdRef.current = turmaIdAtual;
    }, [turmaIdAtual]);

    async function fetchComTimeout(
        url: string,
        options: RequestInit = {},
        timeoutMs = 20000
    ) {
        const controller = new AbortController();

        controladoresAtivosRef.current.add(controller);

        const timeoutId = setTimeout(
            () => controller.abort(),
            timeoutMs
        );

        try {
            if (API_URL && url.startsWith(API_URL + '/')) {
                return await apiFetch(url.slice(API_URL.length), {
                    ...options, signal: controller.signal, timeoutMs,
                });
            }
            return await fetch(url, {
                ...options,
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
            controladoresAtivosRef.current.delete(controller);
        }
    }

    async function buscarRotaMapbox(
        pontos: LatLng[]
    ): Promise<{
        routeGeoJSON: any;
        coordenadas: [number, number][];
        manobras: Manobra[];
        pontosAjustados: LatLng[];
        indicesWaypoints: number[];
    }> {
        if (pontos.length > LIMITE_WAYPOINTS_MAPBOX) {
            throw new Error(
                `Limite de ${LIMITE_WAYPOINTS_MAPBOX} pontos excedido (${pontos.length} fornecidos)`
            );
        }

        if (!MAPBOX_TOKEN) {
            throw new Error('Token do Mapbox ausente');
        }

        const waypoints = pontos
            .map((p) => `${p.longitude},${p.latitude}`)
            .join(';');

        const url =
            `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}` +
            `?geometries=geojson&overview=full&steps=true&language=pt-BR&access_token=${MAPBOX_TOKEN}`;

        const res = await fetchComTimeout(url, {}, 15000);

        const data = await readApiJson<any>(res);

        if (data.code !== 'Ok' || !data.routes?.length) {
            throw new Error(
                data.message || 'Directions API não retornou rota válida'
            );
        }

        const rotaEscolhida = data.routes[0];

        const routeGeoJSON = {
            type: 'Feature',
            properties: {},
            geometry: rotaEscolhida.geometry,
        };

        const geometryCoords = rotaEscolhida.geometry.coordinates;

        const manobras: Manobra[] = [];

        rotaEscolhida.legs?.forEach((leg: any) => {
            leg.steps?.forEach((s: any) => {
                if (!s.maneuver?.instruction) return;

                const loc = s.maneuver.location;

                let idxRota = geometryCoords.findIndex(
                    (c: any) => c[0] === loc[0] && c[1] === loc[1]
                );

                if (idxRota === -1) {
                    let minD = Infinity;

                    for (let i = 0; i < geometryCoords.length; i++) {
                        const d = distanciaMetros(
                            {
                                longitude: geometryCoords[i][0],
                                latitude: geometryCoords[i][1],
                            },
                            {
                                longitude: loc[0],
                                latitude: loc[1],
                            }
                        );

                        if (d < minD) {
                            minD = d;
                            idxRota = i;
                        }
                    }
                }

                manobras.push({
                    instrucao: s.maneuver.instruction,
                    tipo:
                        s.maneuver.type +
                        (s.maneuver.modifier
                            ? `_${s.maneuver.modifier}`
                            : ''),
                    coordenada: loc,
                    indiceRota: idxRota,
                });
            });
        });

        manobras.sort(
            (a, b) => a.indiceRota - b.indiceRota
        );

        if (!Array.isArray(data.waypoints) || data.waypoints.length !== pontos.length) {
            throw new Error('Mapbox não retornou todos os pontos obrigatórios');
        }
        const pontosAjustados: LatLng[] = data.waypoints.map((w: any) => ({
            longitude: Number(w.location[0]), latitude: Number(w.location[1]),
        }));
        const indicesWaypoints: number[] = [];
        let ultimo = 0;
        for (const ponto of pontosAjustados) {
            ultimo = indiceMaisProximoSequencial(geometryCoords, ponto, ultimo);
            indicesWaypoints.push(ultimo);
        }
        return { routeGeoJSON, coordenadas: geometryCoords, manobras, pontosAjustados, indicesWaypoints };
    }

    useEffect(() => {
        const atualizarRelogio = () => {
            const agora = new Date();

            setHorarioAtual(
                agora.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                })
            );
        };

        atualizarRelogio();

        const timer = setInterval(atualizarRelogio, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            const estaOnline =
                !!state.isConnected &&
                !!state.isInternetReachable;

            setOnline((prev) => {
                if (!prev && estaOnline) {
                    esvaziarFilaLocalizacoes();
                }

                return estaOnline;
            });
        });

        return () => unsubscribe();
    }, []);

    async function enfileirarLocalizacao(ponto: LatLng) {
        const fila =
            (await lerCache<LatLng[]>(
                CACHE_KEYS.filaLocalizacoes
            )) || [];

        fila.push(ponto);

        await salvarCache(
            CACHE_KEYS.filaLocalizacoes,
            fila.slice(-50)
        );
    }

    async function esvaziarFilaLocalizacoes() {
        const fila =
            (await lerCache<LatLng[]>(
                CACHE_KEYS.filaLocalizacoes
            )) || [];

        if (fila.length === 0) return;

        const restantes: LatLng[] = [];

        for (const ponto of fila) {
            try {
                await enviarLocalizacao(ponto);
            } catch {
                restantes.push(ponto);
            }
        }

        await salvarCache(
            CACHE_KEYS.filaLocalizacoes,
            restantes
        );
    }

    async function enviarLocalizacao(ponto: LatLng) {
        const turmaId = turmaIdRef.current;

        const queryTurma = turmaId
            ? `?turmaId=${turmaId}&latitude=${ponto.latitude}&longitude=${ponto.longitude}`
            : `?latitude=${ponto.latitude}&longitude=${ponto.longitude}`;

        try {
            const res = await fetchComTimeout(
                `${API_URL}/rota/localizacao-van${queryTurma}`,
                {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        ...HEADERS_PADRAO,
                    },
                },
                10000
            );

            if (!res.ok) {
                throw new Error('Falha ao enviar localização');
            }
        } catch (error) {
            await enfileirarLocalizacao(ponto);
            throw error;
        }
    }

    function animarParaNovaPosicao(novaPos: LatLng) {
        const origem =
            posicaoApresentadaRef.current || novaPos;

        const inicio = Date.now();

        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
        }

        const passo = () => {
            if (!montadoRef.current) return;

            const progresso = Math.min(
                1,
                (Date.now() - inicio) / DURACAO_ANIMACAO_MS
            );

            const t = progresso * progresso * (3 - 2 * progresso);

            const lat =
                origem.latitude +
                (novaPos.latitude - origem.latitude) * t;

            const lng =
                origem.longitude +
                (novaPos.longitude - origem.longitude) * t;

            const atual = {
                latitude: lat,
                longitude: lng,
            };

            posicaoApresentadaRef.current = atual;

            setPosicaoSuave(atual);

            if (t < 1) {
                animFrameRef.current =
                    requestAnimationFrame(passo);
            }
        };

        passo();
    }

    function aplicarGeometria(
        geoJson: any,
        coordenadas: [number, number][],
        manobrasCalculadas: Manobra[],
        paradas: ParadaNavegacao[]
    ) {
        setGeometriaRota(geoJson);
        setCoordenadasRota(coordenadas);
        coordenadasRotaRef.current = coordenadas;
        setManobras(manobrasCalculadas);
        manobrasRef.current = manobrasCalculadas;
        setManobraAtual(manobrasCalculadas[0] || null);
        paradasRef.current = paradas;
        indiceMinimoRef.current = 0;
        ultimoIndiceProjecaoRef.current = null;
        leiturasChegadaRef.current = 0;
        setProximaParada(paradas[0]?.nome || null);
        setParadasRestantes(paradas.length);
    }

    async function registrarParadaVisitada(parada: ParadaNavegacao) {
        if (parada.passageiroId === null || !turmaIdRef.current) return;
        visitadosRef.current.add(parada.passageiroId);
        await salvarCache(
            CACHE_KEYS.visitadas(turmaIdRef.current, direcaoAtualRef.current),
            Array.from(visitadosRef.current)
        );
    }

    async function recalcularRotaAPartirDe(
        origemAtual: LatLng
    ) {
        if (recalculandoRef.current) return;

        const garagemAtual = garagemRef.current;
        const destinoAtual = destinoRef.current;

        if (!garagemAtual || !destinoAtual) return;

        recalculandoRef.current = true;

        if (montadoRef.current) {
            setRecalculandoRota(true);
        }

        try {
            const idsPendentes = new Set(
                paradasRef.current
                    .filter((p) => p.passageiroId !== null)
                    .map((p) => p.passageiroId)
            );
            const pendentes = rotaRef.current.filter(p => idsPendentes.has(p.id));

            const destinoFinal =
                direcaoAtualRef.current === 'ida'
                    ? destinoAtual
                    : garagemAtual;

            const pontosOrdenados = [
                origemAtual,
                ...pendentes,
                destinoFinal,
            ];

            const {
                routeGeoJSON,
                coordenadas,
                manobras: manobrasCalculadas,
                pontosAjustados,
                indicesWaypoints,
            } = await buscarRotaMapbox(pontosOrdenados);

            if (!montadoRef.current) return;
            const idsAindaPendentes = new Set(paradasRef.current.map(p => p.passageiroId));
            if (pendentes.some(p => !idsAindaPendentes.has(p.id))) return;

            const geoJsonValido = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: {},
                        geometry: routeGeoJSON.geometry,
                    },
                ],
            };

            const paradas: ParadaNavegacao[] = [
                ...pendentes.map((p, i) => ({
                    passageiroId: p.id,
                    nome: p.nome,
                    ponto: pontosAjustados[i + 1],
                    indiceRota: indicesWaypoints[i + 1],
                })),
                {
                    passageiroId: null,
                    nome: 'Destino final',
                    ponto: pontosAjustados[pontosAjustados.length - 1],
                    indiceRota: indicesWaypoints[indicesWaypoints.length - 1],
                },
            ];
            aplicarGeometria(geoJsonValido, coordenadas, manobrasCalculadas, paradas);
            const turmaId = turmaIdRef.current;
            if (turmaId !== null) {
                await salvarCache(CACHE_KEYS.geometria(turmaId, direcaoAtualRef.current), {
                    geoJson: geoJsonValido, coordenadas, manobras: manobrasCalculadas,
                    paradas, passageirosIds: rotaRef.current.map(p => p.id),
                } as GeometriaSalva);
            }

            primeiroTickForaRotaRef.current = null;

            setForaDaRota(false);
            setErroRede(null);
        } catch {
            if (montadoRef.current) {
                setErroRede(
                    'Falha ao recalcular a rota automaticamente.'
                );
            }
        } finally {
            recalculandoRef.current = false;

            if (montadoRef.current) {
                setRecalculandoRota(false);
            }
        }
    }

    useEffect(() => {
        montadoRef.current = true;

        let locationSubscription:
            | Location.LocationSubscription
            | null = null;

        const iniciarSistema = async () => {
            let direcaoDefinitiva: Sentido =
                (sentido as Sentido) || 'ida';

            const { status } =
                await Location.requestForegroundPermissionsAsync();

            if (!montadoRef.current) return;

            if (status !== 'granted') {
                Alert.alert(
                    'Permissão negada',
                    'Ative o acesso à localização para usar o painel de navegação.'
                );

                setLoading(false);
                return;
            }

            let posicaoInicial: LatLng | null = null;

            try {
                const locAtual =
                    await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                    });

                console.log('GPS INICIAL:', {
                    latitude: locAtual.coords.latitude,
                    longitude: locAtual.coords.longitude,
                    precisao: locAtual.coords.accuracy,
                });

                if (locAtual) {
                    posicaoInicial = {
                        latitude: locAtual.coords.latitude,
                        longitude: locAtual.coords.longitude,
                    };

                    setLocalizacao(posicaoInicial);

                    posicaoApresentadaRef.current =
                        posicaoInicial;

                    setPosicaoSuave(posicaoInicial);
                }
            } catch {
                const ultima = await Location.getLastKnownPositionAsync().catch(() => null);
                if (ultima) {
                    posicaoInicial = {
                        latitude: ultima.coords.latitude,
                        longitude: ultima.coords.longitude,
                    };
                    setLocalizacao(posicaoInicial);
                    posicaoApresentadaRef.current = posicaoInicial;
                    setPosicaoSuave(posicaoInicial);
                }
            }

            if (!posicaoInicial) {
                Alert.alert('GPS indisponível', 'Não foi possível obter uma posição para iniciar a navegação.');
                setLoading(false);
                return;
            }

            await carregarGaragemERota(
                direcaoDefinitiva,
                posicaoInicial
            );

            if (!montadoRef.current) return;

            if (cameraRef.current) {
                cameraRef.current.setCamera({
                    centerCoordinate: [
                        posicaoInicial.longitude,
                        posicaoInicial.latitude,
                    ],
                    zoomLevel: 18,
                    pitch: 65,
                    animationDuration: 1000,
                });
            }

            locationSubscription =
                await Location.watchPositionAsync(
                    {
                        accuracy:
                            Location.Accuracy.BestForNavigation,
                        timeInterval: 2000,
                        distanceInterval: 1,
                    },
                    (loc) => {
                        if (!montadoRef.current) return;

                        const pontoBruto: LatLng = {
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                        };

                        const velocidadeKmh =
                            loc.coords.speed &&
                                loc.coords.speed > 0
                                ? Number(
                                    (
                                        loc.coords.speed * 3.6
                                    ).toFixed(0)
                                )
                                : 0;

                        setLocalizacao(pontoBruto);
                        setVelocidadeAtual(velocidadeKmh);

                        let posicaoFinal = pontoBruto;

                        let projecao: Projecao | null = null;

                        const coords =
                            coordenadasRotaRef.current;

                        if (coords.length > 1 && paradasRef.current.length > 0) {
                            let parada = paradasRef.current[0];
                            const proximaDistancia = distanciaMetros(pontoBruto, parada.ponto);
                            const precisao = loc.coords.accuracy ?? Infinity;
                            const chegadaValida =
                                parada.passageiroId !== null &&
                                proximaDistancia <= RAIO_CHEGADA_PARADA_METROS &&
                                precisao <= PRECISAO_MAXIMA_CHEGADA_METROS &&
                                velocidadeKmh <= VELOCIDADE_MAXIMA_CHEGADA_KMH;

                            leiturasChegadaRef.current = chegadaValida
                                ? leiturasChegadaRef.current + 1 : 0;

                            if (leiturasChegadaRef.current >= LEITURAS_PARA_CHEGADA) {
                                const visitada = paradasRef.current.shift();
                                if (visitada) {
                                    void registrarParadaVisitada(visitada);
                                    indiceMinimoRef.current = Math.min(
                                        Math.max(0, coords.length - 2), visitada.indiceRota
                                    );
                                    ultimoIndiceProjecaoRef.current = indiceMinimoRef.current;
                                }
                                leiturasChegadaRef.current = 0;
                                setProximaParada(paradasRef.current[0]?.nome || null);
                                setParadasRestantes(paradasRef.current.length);
                                parada = paradasRef.current[0];
                            }

                            const limite = parada
                                ? Math.max(indiceMinimoRef.current, parada.indiceRota - 1)
                                : coords.length - 2;
                            projecao = encontrarProjecaoNaRota(
                                coords, pontoBruto, ultimoIndiceProjecaoRef.current,
                                indiceMinimoRef.current, limite
                            );

                            if (projecao && projecao.distancia <= RAIO_DESVIO_ROTA_METROS) {
                                ultimoIndiceProjecaoRef.current = projecao.indice;
                                posicaoFinal = projecao.ponto;
                                primeiroTickForaRotaRef.current = null;
                                setForaDaRota(false);
                                const restante = distanciaRestanteDesde(
                                    coords, projecao.indice, projecao.t
                                );
                                setDistanciaRestante(restante);
                                const velocidadeParaCalculo = velocidadeKmh > 5 ? velocidadeKmh : 25;
                                setEtaMinutos(Math.max(0, Math.ceil(
                                    (restante / 1000 / velocidadeParaCalculo) * 60
                                )));
                            } else {
                                if (primeiroTickForaRotaRef.current === null) {
                                    primeiroTickForaRotaRef.current = Date.now();
                                }
                                if (Date.now() - primeiroTickForaRotaRef.current >= LIMIAR_TEMPO_FORA_ROTA_MS) {
                                    setForaDaRota(true);
                                    const agora = Date.now();
                                    if (!recalculandoRef.current &&
                                        (ultimaRecalculacaoRef.current === null ||
                                            agora - ultimaRecalculacaoRef.current > COOLDOWN_RECALCULO_MS)) {
                                        ultimaRecalculacaoRef.current = agora;
                                        void recalcularRotaAPartirDe(pontoBruto);
                                    }
                                }
                            }
                        }

                        animarParaNovaPosicao(posicaoFinal);

                        cameraRef.current?.setCamera({
                            centerCoordinate: [
                                posicaoFinal.longitude,
                                posicaoFinal.latitude,
                            ],
                            zoomLevel: 18,
                            pitch: 65,
                            animationDuration: 1800,
                        });

                        let headingAlvo: number | null = null;

                        if (
                            loc.coords.heading !== null &&
                            loc.coords.heading >= 0 &&
                            velocidadeKmh > 3
                        ) {
                            headingAlvo = loc.coords.heading;
                        } else if (
                            projecao &&
                            projecao.distancia <=
                            RAIO_DESVIO_ROTA_METROS
                        ) {
                            headingAlvo = projecao.bearing;
                        }

                        if (headingAlvo !== null) {
                            let diff =
                                headingAlvo - headingRef.current;

                            diff =
                                ((diff + 180) % 360 + 360) % 360 -
                                180;

                            const novoHeading =
                                (headingRef.current +
                                    diff * 0.3 +
                                    360) %
                                360;

                            headingRef.current = novoHeading;

                            setHeadingAtual(novoHeading);
                        }

                        const manobrasAtuais =
                            manobrasRef.current;

                        if (
                            manobrasAtuais.length > 0 &&
                            projecao
                        ) {
                            const proxima =
                                manobrasAtuais.find(
                                    (m) =>
                                        m.indiceRota >=
                                        projecao!.indice
                                ) ||
                                manobrasAtuais[
                                manobrasAtuais.length - 1
                                ];

                            setManobraAtual(proxima);
                        }

                        // A proximidade do GPS não confirma embarque.
                        // A confirmação será implementada com persistência no backend.

                        enviarLocalizacao(pontoBruto)
                            .then(() => {
                                if (montadoRef.current) {
                                    setErroRede(null);
                                }
                            })
                            .catch(() => {
                                if (montadoRef.current) {
                                    setErroRede(
                                        'Sinal instável. Localização em fila para reenvio.'
                                    );
                                }
                            });
                    }
                );
        };

        iniciarSistema();

        return () => {
            montadoRef.current = false;

            if (locationSubscription) {
                locationSubscription.remove();
            }

            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }

            controladoresAtivosRef.current.forEach((c) =>
                c.abort()
            );

            controladoresAtivosRef.current.clear();
        };
    }, []);

    async function carregarGaragemERota(
        direcaoUsada: Sentido,
        posicaoInicial: LatLng
    ) {
        let garagemCarregada: LatLng | null = null;
        let destinoCarregado: LatLng | null = null;

        let rotaCarregada: PassageiroRota[] = [];

        try {
            if (!user?.id) {
                throw new Error('Usuário não autenticado');
            }

            const resTurmas = await fetchComTimeout(
                `${API_URL}/turmas/motorista/${user.id}`,
                {
                    headers: HEADERS_PADRAO,
                }
            );

            if (!resTurmas.ok) {
                throw new Error(
                    'Erro ao buscar turmas do motorista'
                );
            }

            const turmas = await readApiJson<any>(resTurmas);

            if (!turmas || turmas.length === 0) {
                throw new Error(
                    'Nenhuma turma encontrada para este motorista'
                );
            }

            // O contrato do backend exige turmaId. Consulta após localizar as turmas.
            let turmaIdAtiva: number | null = null;
            for (const turma of turmas) {
                const resStatus = await fetchComTimeout(
                    `${API_URL}/rota/status-atual?turmaId=${turma.id}`,
                    { headers: HEADERS_PADRAO }, 6000
                );
                if (!resStatus.ok) continue;
                const status = await readApiJson<any>(resStatus);
                if (status.status === 'ATIVA') {
                    turmaIdAtiva = Number(turma.id);
                    const sentidoServidor = String(status.sentido || '').toLowerCase();
                    if (sentidoServidor === 'ida' || sentidoServidor === 'volta') {
                        direcaoUsada = sentidoServidor;
                    }
                    break;
                }
            }
            const idSolicitado = turmaId ? Number(turmaId) : null;

            const idEscolhido = turmaIdAtiva ?? idSolicitado;

            const turmaAtual = idEscolhido !== null
                ? turmas.find((t: any) => Number(t.id) === idEscolhido)
                : null;

            if (!turmaAtual) {
                throw new Error(
                    'Turma da viagem ativa não encontrada'
                );
            }

            // DIAGNÓSTICO DAS COORDENADAS
            console.log('DIAGNÓSTICO TURMA:', {
                id: turmaAtual.id,
                nome: turmaAtual.nome,
                origemNome: turmaAtual.origemNome,
                origemLatitude: turmaAtual.origemLatitude,
                origemLongitude: turmaAtual.origemLongitude,
                destinoNome: turmaAtual.destinoNome,
                destinoLatitude: turmaAtual.destinoLatitude,
                destinoLongitude: turmaAtual.destinoLongitude,
            });

            setTurmaIdAtual(turmaAtual.id);
            turmaIdRef.current = turmaAtual.id;

            const visitadasSalvas = await lerCache<number[]>(
                CACHE_KEYS.visitadas(Number(turmaAtual.id), direcaoUsada)
            );
            visitadosRef.current = new Set(visitadasSalvas || []);

            const origemLat = Number(
                turmaAtual.origemLatitude
            );

            const origemLng = Number(
                turmaAtual.origemLongitude
            );

            if (
                !Number.isFinite(origemLat) ||
                !Number.isFinite(origemLng) ||
                (origemLat === 0 && origemLng === 0)
            ) {
                throw new Error(
                    'Coordenadas de origem da turma inválidas'
                );
            }

            garagemCarregada = {
                latitude: origemLat,
                longitude: origemLng,
            };

            const destinoLat = Number(
                turmaAtual.destinoLatitude
            );

            const destinoLng = Number(
                turmaAtual.destinoLongitude
            );

            if (
                !Number.isFinite(destinoLat) ||
                !Number.isFinite(destinoLng) ||
                (destinoLat === 0 && destinoLng === 0)
            ) {
                throw new Error(
                    'Coordenadas de destino da turma inválidas'
                );
            }

            destinoCarregado = {
                latitude: destinoLat,
                longitude: destinoLng,
            };

            const urlOtimizar =
                `${API_URL}/rota/otimizar` +
                `?sentido=${direcaoUsada}&turmaId=${turmaAtual.id}`;

            console.log(
                'Buscando rota otimizada:',
                urlOtimizar
            );

            const resPassageiros = await fetchComTimeout(
                urlOtimizar,
                {
                    headers: HEADERS_PADRAO,
                }
            );

            if (!resPassageiros.ok) {
                const respostaErro = (await readApiError(resPassageiros)).message;

                let mensagem = respostaErro;

                try {
                    const dados = JSON.parse(respostaErro);
                    mensagem = dados.erro || dados.message || respostaErro;
                } catch {
                    // Mantém a resposta original.
                }

                console.error('ERRO OTIMIZAÇÃO:', {
                    turmaId: turmaAtual.id,
                    sentido: direcaoUsada,
                    status: resPassageiros.status,
                    mensagem,
                });

                throw new Error(`Falha na otimização: ${mensagem}`);
            }

            const lista = await readApiJson<any>(resPassageiros);

            console.log(
                'Passageiros retornados pelo otimizar:',
                lista
            );

            if (!Array.isArray(lista)) {
                throw new Error(
                    'Resposta inválida da otimização de rota'
                );
            }

            rotaCarregada = lista
                .map((p: any) => ({
                    id: Number(p.id || p.usuarioId),
                    nome: p.nome || 'Passageiro',
                    latitude: Number(
                        p.latitude ?? p.lat ?? 0
                    ),
                    longitude: Number(
                        p.longitude ?? p.lng ?? 0
                    ),
                    embarcado: false,
                }))
                .filter(
                    (p: PassageiroRota) =>
                        Number.isFinite(p.id) &&
                        Number.isFinite(p.latitude) &&
                        Number.isFinite(p.longitude) &&
                        p.latitude !== 0 &&
                        p.longitude !== 0
                );

            await salvarCache(
                CACHE_KEYS.garagem(Number(turmaAtual.id)), garagemCarregada
            );

            await salvarCache(
                CACHE_KEYS.destino(Number(turmaAtual.id)), destinoCarregado
            );

            await salvarCache(
                CACHE_KEYS.rota(Number(turmaAtual.id), direcaoUsada), rotaCarregada
            );
        } catch (e) {
            console.log(
                'Erro em carregarGaragemERota:',
                e
            );

            const idCache = turmaIdRef.current;
            if (idCache !== null) {
                garagemCarregada = await lerCache<LatLng>(CACHE_KEYS.garagem(idCache));
                destinoCarregado = await lerCache<LatLng>(CACHE_KEYS.destino(idCache));
                rotaCarregada = (await lerCache<PassageiroRota[]>(
                    CACHE_KEYS.rota(idCache, direcaoUsada)
                )) || [];
            }

            if (montadoRef.current) {
                setErroRede(
                    idCache !== null ? 'Falha ao carregar dados. Tentando cache da turma.' : 'Não foi possível identificar a turma. Verifique a conexão.'
                );
            }
        }

        if (!montadoRef.current) return;

        if (!garagemCarregada || !destinoCarregado) {
            Alert.alert(
                'Endereço não cadastrado',
                'Você precisa configurar a origem e o destino da sua turma para traçar a rota corretamente.'
            );

            setLoading(false);
            return;
        }

        setGaragem(garagemCarregada);
        garagemRef.current = garagemCarregada;

        setDestino(destinoCarregado);
        destinoRef.current = destinoCarregado;

        setRota(rotaCarregada);
        rotaRef.current = rotaCarregada;

        setDirecaoAtual(direcaoUsada);
        direcaoAtualRef.current = direcaoUsada;

        await carregarGeometriaRota(
            direcaoUsada,
            garagemCarregada,
            destinoCarregado,
            rotaCarregada.filter(p => !visitadosRef.current.has(p.id)),
            posicaoInicial
        );

        if (montadoRef.current) {
            setLoading(false);
        }
    }

    async function carregarGeometriaRota(
        direcaoUsada: Sentido,
        garagemPonto: LatLng,
        destinoPonto: LatLng,
        passageiros: PassageiroRota[],
        posicaoAtual: LatLng
    ) {
        const destinoFinal =
            direcaoUsada === 'ida'
                ? destinoPonto
                : garagemPonto;

        // O backend já retorna os passageiros na ordem otimizada.
        // Não invertemos novamente a lista na VOLTA.
        const pontosOrdenados: LatLng[] = [
            posicaoAtual,
            ...passageiros,
            destinoFinal,
        ];

        try {
            const {
                routeGeoJSON,
                coordenadas,
                manobras: manobrasCalculadas,
                pontosAjustados,
                indicesWaypoints,
            } = await buscarRotaMapbox(pontosOrdenados);

            if (!montadoRef.current) return;

            const geoJsonValido = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: {},
                        geometry: routeGeoJSON.geometry,
                    },
                ],
            };

            const paradas: ParadaNavegacao[] = [
                ...passageiros.map((p, i) => ({
                    passageiroId: p.id, nome: p.nome,
                    ponto: pontosAjustados[i + 1], indiceRota: indicesWaypoints[i + 1],
                })),
                {
                    passageiroId: null, nome: 'Destino final',
                    ponto: pontosAjustados[pontosAjustados.length - 1],
                    indiceRota: indicesWaypoints[indicesWaypoints.length - 1],
                },
            ];
            aplicarGeometria(geoJsonValido, coordenadas, manobrasCalculadas, paradas);
            if (turmaIdRef.current !== null) {
                await salvarCache(CACHE_KEYS.geometria(turmaIdRef.current, direcaoUsada), {
                    geoJson: geoJsonValido, coordenadas, manobras: manobrasCalculadas,
                    paradas, passageirosIds: rotaRef.current.map(p => p.id),
                } as GeometriaSalva);
            }
        } catch {
            if (
                pontosOrdenados.length >
                LIMITE_WAYPOINTS_MAPBOX
            ) {
                Alert.alert(
                    'Rota muito extensa',
                    `Esta rota tem ${pontosOrdenados.length} pontos, acima do limite de ${LIMITE_WAYPOINTS_MAPBOX} da API de direções.`
                );
            }

            const turmaId = turmaIdRef.current;
            const cache = turmaId === null ? null : await lerCache<GeometriaSalva>(
                CACHE_KEYS.geometria(turmaId, direcaoUsada)
            );
            if (!montadoRef.current) return;
            const idsAtuais = rotaRef.current.map(p => p.id);
            if (cache &&
                JSON.stringify(cache.passageirosIds) === JSON.stringify(idsAtuais) &&
                cache.paradas?.length === passageiros.length + 1 &&
                cache.coordenadas?.length > 1) {
                aplicarGeometria(cache.geoJson, cache.coordenadas, cache.manobras, cache.paradas);
                setErroRede('Navegação offline com geometria salva.');
            } else {
                setErroRede('Não foi possível montar a rota. Cache incompatível ou indisponível.');
            }
        }
    }

    async function handleEncerrarViagem() {
        if (!online) {
            return Alert.alert(
                'Conexão Necessária',
                'Conecte-se à internet para sincronizar o encerramento.'
            );
        }

        Alert.alert(
            'Encerrar Viagem',
            'Você tem certeza de que deseja encerrar a rota atual?',
            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: 'Sim, Encerrar',
                    style: 'destructive',

                    onPress: async () => {
                        try {
                            const turmaIdParam = turmaIdRef.current;
                            const motoristaIdParam = user?.id;
                            if (!turmaIdParam || !motoristaIdParam) {
                                Alert.alert('Erro', 'Turma ou motorista não identificado.');
                                return;
                            }

                            const res = await fetchComTimeout(
                                `${API_URL}/rota/encerrar?turmaId=${turmaIdParam}&motoristaId=${motoristaIdParam}`,
                                {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type':
                                            'application/json',
                                        ...HEADERS_PADRAO,
                                    },
                                    body: JSON.stringify({
                                        turmaId: Number(
                                            turmaIdParam
                                        ),
                                        motoristaId: Number(
                                            motoristaIdParam
                                        ),
                                    }),
                                }
                            );

                            if (res.ok) {
                                await AsyncStorage.removeItem(
                                    '@vanbora:viagem_ativa'
                                );

                                router.replace('/(tabs)/home');
                            } else {
                                Alert.alert(
                                    'Erro',
                                    'O servidor não conseguiu encerrar a viagem.'
                                );
                            }
                        } catch {
                            if (montadoRef.current) {
                                setErroRede(
                                    'Não foi possível encerrar a viagem. Tente novamente.'
                                );
                            }
                        }
                    },
                },
            ]
        );
    }

    const centralizarNaVan = useCallback(() => {
        const pos = posicaoSuave || localizacao;

        if (pos && cameraRef.current) {
            cameraRef.current.setCamera({
                centerCoordinate: [
                    pos.longitude,
                    pos.latitude,
                ],
                zoomLevel: 18,
                animationDuration: 700,
                pitch: 65,
            });
        }
    }, [posicaoSuave, localizacao]);

    const passageirosGeoJSON = useMemo(
        () => ({
            type: 'FeatureCollection' as const,

            features: rota
                .filter(
                    (p) =>
                        p.latitude &&
                        p.longitude &&
                        p.latitude !== 0 &&
                        p.longitude !== 0
                )
                .map((p, index) => ({
                    type: 'Feature' as const,

                    properties: {
                        id: p.id,
                        label: p.embarcado
                            ? '✓'
                            : String(index + 1),
                        cor: p.embarcado
                            ? '#10B981'
                            : '#3B82F6',
                    },

                    geometry: {
                        type: 'Point' as const,
                        coordinates: [
                            Number(p.longitude),
                            Number(p.latitude),
                        ],
                    },
                })),
        }),
        [rota]
    );

    let geometriaPercorrida: any = null;
    let geometriaRestante: any = geometriaRota;

    if (
        localizacao &&
        coordenadasRota.length > 1 &&
        ultimoIndiceProjecaoRef.current !== null
    ) {
        const idx = ultimoIndiceProjecaoRef.current;

        if (idx > 0) {
            geometriaPercorrida = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'LineString',
                            coordinates: coordenadasRota.slice(
                                0,
                                idx + 1
                            ),
                        },
                    },
                ],
            };
        }

        geometriaRestante = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: coordenadasRota.slice(idx),
                    },
                },
            ],
        };
    }

    if (loading || !garagem || !destino) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator
                    size="large"
                    color="#00D2FF"
                />

                <Text style={styles.loadingText}>
                    Carregando telemetria...
                </Text>
            </View>
        );
    }

    const posicaoExibida =
        posicaoSuave || localizacao;

    return (
        <View style={styles.fullScreenContainer}>
            <StatusBar
                barStyle="light-content"
                backgroundColor="transparent"
                translucent
            />

            <CabecalhoMapa
                onBack={() =>
                    router.replace('/(tabs)/home')
                }
                online={online}
                direcaoAtual={direcaoAtual}
                horarioAtual={horarioAtual}
            />

            <PainelManobra
                manobraAtual={manobraAtual}
                velocidadeAtual={velocidadeAtual}
            />

            {recalculandoRota ? (
                <View
                    style={[
                        styles.bannerNotificacao,
                        {
                            top: insets.top + 215,
                            backgroundColor: '#0D2B3A',
                            borderColor: '#29B6F6',
                        },
                    ]}
                >
                    <ActivityIndicator
                        size="small"
                        color="#29B6F6"
                        style={styles.bannerIcon}
                    />

                    <Text
                        style={[
                            styles.bannerText,
                            { color: '#29B6F6' },
                        ]}
                    >
                        Recalculando rota...
                    </Text>
                </View>
            ) : foraDaRota ? (
                <View
                    style={[
                        styles.bannerNotificacao,
                        {
                            top: insets.top + 215,
                            backgroundColor: '#3A1A00',
                            borderColor: '#FF9800',
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.bannerText,
                            { color: '#FF9800' },
                        ]}
                    >
                        Fora da rota planejada. Recalculando
                        automaticamente...
                    </Text>
                </View>
            ) : erroRede ? (
                <View
                    style={[
                        styles.bannerNotificacao,
                        {
                            top: insets.top + 215,
                            backgroundColor: '#1E293B',
                            borderColor: '#3B82F6',
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.bannerText,
                            { color: '#60A5FA' },
                        ]}
                    >
                        {erroRede}
                    </Text>
                </View>
            ) : null}

            <MapboxGL.MapView
                style={styles.mapa}
                styleURL={MapboxGL.StyleURL.Dark}
                logoEnabled={false}
                attributionEnabled={false}
                compassEnabled={false}

                onDidFinishLoadingMap={() => {
                    const pos = posicaoApresentadaRef.current;

                    if (pos) {
                        cameraRef.current?.setCamera({
                            centerCoordinate: [
                                pos.longitude,
                                pos.latitude,
                            ],
                            zoomLevel: 18,
                            pitch: 65,
                            animationDuration: 800,
                        });
                    }
                }}
            >
                <MapboxGL.Camera
                    ref={cameraRef}
                    zoomLevel={18}
                    pitch={65}
                    centerCoordinate={[
                        garagem.longitude,
                        garagem.latitude,
                    ]}
                />

                {geometriaPercorrida && (
                    <MapboxGL.ShapeSource
                        id="rotaPercorridaSource"
                        shape={geometriaPercorrida}
                    >
                        <MapboxGL.LineLayer
                            id="rotaPercorridaLine"
                            style={{
                                lineColor: '#334155',
                                lineWidth: 6,
                                lineCap: 'round',
                                lineJoin: 'round',
                                lineOpacity: 0.8,
                            }}
                        />
                    </MapboxGL.ShapeSource>
                )}

                {geometriaRestante && (
                    <MapboxGL.ShapeSource
                        id="rotaRestanteSource"
                        shape={geometriaRestante}
                    >
                        <MapboxGL.LineLayer
                            id="rotaCasing"
                            style={{
                                lineColor: '#0088CC',
                                lineWidth: 10,
                                lineCap: 'round',
                                lineJoin: 'round',
                                lineOpacity: 0.4,
                            }}
                        />

                        <MapboxGL.LineLayer
                            id="rotaLine"
                            style={{
                                lineColor: '#00D2FF',
                                lineWidth: 6,
                                lineCap: 'round',
                                lineJoin: 'round',
                            }}
                        />
                    </MapboxGL.ShapeSource>
                )}

                {posicaoExibida && (
                    <MapboxGL.PointAnnotation
                        id="van-marker"
                        coordinate={[
                            posicaoExibida.longitude,
                            posicaoExibida.latitude,
                        ]}
                        anchor={{
                            x: 0.5,
                            y: 0.5,
                        }}
                    >
                        <View
                            style={{
                                transform: [
                                    {
                                        rotate: `${headingAtual}deg`,
                                    },
                                ],
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <View style={styles.markerVanCircle}>
                                <Ionicons
                                    name="navigate"
                                    size={18}
                                    color="#FFC107"
                                    style={{
                                        transform: [
                                            {
                                                rotate: '-45deg',
                                            },
                                        ],
                                    }}
                                />
                            </View>
                        </View>
                    </MapboxGL.PointAnnotation>
                )}

                <MapboxGL.PointAnnotation
                    id="garagem"
                    coordinate={[
                        garagem.longitude,
                        garagem.latitude,
                    ]}
                >
                    <View style={styles.markerPontoBox}>
                        <Text style={styles.markerEmoji}>
                            🏠
                        </Text>
                    </View>
                </MapboxGL.PointAnnotation>

                <MapboxGL.PointAnnotation
                    id="destino"
                    coordinate={[
                        destino.longitude,
                        destino.latitude,
                    ]}
                >
                    <View
                        style={[
                            styles.markerPontoBox,
                            styles.markerDestino,
                        ]}
                    >
                        <Text style={styles.markerEmoji}>
                            🏁
                        </Text>
                    </View>
                </MapboxGL.PointAnnotation>

                <MapboxGL.ShapeSource
                    id="passageirosSource"
                    shape={passageirosGeoJSON}
                >
                    <MapboxGL.CircleLayer
                        id="passageirosCirculo"
                        style={{
                            circleRadius: 14,
                            circleColor: ['get', 'cor'],
                            circleStrokeWidth: 2,
                            circleStrokeColor: '#0F172A',
                        }}
                    />

                    <MapboxGL.SymbolLayer
                        id="passageirosLabel"
                        style={{
                            textField: ['get', 'label'],
                            textSize: 12,
                            textColor: '#FFFFFF',
                            textAllowOverlap: true,
                            iconAllowOverlap: true,
                            textIgnorePlacement: true,
                        }}
                    />
                </MapboxGL.ShapeSource>
            </MapboxGL.MapView>

            <TouchableOpacity
                style={[
                    styles.locateButton,
                    {
                        bottom: insets.bottom + 170,
                    },
                ]}
                onPress={centralizarNaVan}
                activeOpacity={0.8}
            >
                <Ionicons
                    name="locate"
                    size={22}
                    color="#00D2FF"
                />
            </TouchableOpacity>

            {proximaParada && (
                <View style={[styles.proximaParadaBox, { bottom: insets.bottom + 116 }]}>
                    <Text style={styles.proximaParadaTexto} numberOfLines={1}>
                        Próxima parada: {proximaParada} ({paradasRestantes} restantes)
                    </Text>
                </View>
            )}

            <ControlesViagem
                distanciaRestante={distanciaRestante}
                etaMinutos={etaMinutos}
                viagemAtiva={viagemAtiva}
                onIniciarViagem={() => { }}
                onEncerrarViagem={handleEncerrarViagem}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    fullScreenContainer: {
        flex: 1,
        backgroundColor: '#0F172A',
        padding: 0,
        margin: 0,
    },

    mapa: {
        flex: 1,
    },

    loadingContainer: {
        flex: 1,
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
    },

    loadingText: {
        color: '#94A3B8',
        marginTop: theme.spacing.sm,
        fontSize: theme.typography.size.small,
        fontWeight: '600',
    },

    bannerNotificacao: {
        position: 'absolute',
        left: theme.spacing.md,
        right: theme.spacing.md,
        zIndex: 9,
        borderWidth: 1,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.xs + 2,
        flexDirection: 'row',
        alignItems: 'center',
    },

    bannerIcon: {
        marginRight: theme.spacing.xs,
    },

    bannerText: {
        fontSize: theme.typography.size.small,
        fontWeight: '700',
    },

    markerVanCircle: {
        backgroundColor: '#0F172A',
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 3,
        borderColor: '#FFC107',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
    },

    markerPontoBox: {
        backgroundColor: '#1E293B',
        padding: 8,
        borderRadius: theme.borderRadius.pill,
        borderColor: '#00D2FF',
        borderWidth: 2,
    },

    markerDestino: {
        backgroundColor: '#EF4444',
        borderColor: '#FFFFFF',
    },

    markerEmoji: {
        fontSize: 14,
    },

    proximaParadaBox: {
        position: 'absolute', left: theme.spacing.md, right: theme.spacing.md,
        backgroundColor: '#0F172A', borderRadius: 10, padding: 10,
        zIndex: 10, borderWidth: 1, borderColor: '#00D2FF',
    },
    proximaParadaTexto: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    locateButton: {
        position: 'absolute',
        right: theme.spacing.md,
        zIndex: 20,
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: '#334155',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
