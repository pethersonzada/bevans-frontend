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
import { auth } from '../config/firebase';
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

type LatLng = { latitude: number; longitude: number };
type Sentido = 'ida' | 'volta';
type Manobra = { instrucao: string; tipo: string; coordenada: [number, number]; indiceRota: number };
type Projecao = { ponto: LatLng; distancia: number; bearing: number; indice: number };

const CACHE_KEYS = {
    garagem: '@rota_estudantil:garagem',
    rota: (sentido: string) => `@rota_estudantil:rota:${sentido}`,
    geometria: (sentido: string) => `@rota_estudantil:geometria:${sentido}`,
    filaLocalizacoes: '@rota_estudantil:fila_localizacoes',
};

const UNI_CARUARU: LatLng = { latitude: -8.302755, longitude: -35.991248 };
const RAIO_EMBARQUE_METROS = 45;
const RAIO_DESVIO_ROTA_METROS = 80;
const DURACAO_ANIMACAO_MS = 1900;
const JANELA_BUSCA_PROJECAO = 40;
const LIMITE_WAYPOINTS_MAPBOX = 25;
const LIMIAR_TEMPO_FORA_ROTA_MS = 6000;
const COOLDOWN_RECALCULO_MS = 20000;

async function salvarCache<T>(chave: string, valor: T) {
    try { await AsyncStorage.setItem(chave, JSON.stringify(valor)); } catch { }
}

async function lerCache<T>(chave: string): Promise<T | null> {
    try {
        const raw = await AsyncStorage.getItem(chave);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch { return null; }
}

const HEADERS_PADRAO = { 'Bypass-Tunnel-Reminder': 'true' };

function distanciaMetros(a: LatLng, b: LatLng): number {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad;
    const dLng = (b.longitude - a.longitude) * rad;
    const lat1 = a.latitude * rad;
    const lat2 = b.latitude * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function projetarNoSegmento(p: LatLng, a: LatLng, b: LatLng): { ponto: LatLng; distancia: number; t: number; bearing: number } {
    const metrosPorGrauLat = 111320;
    const metrosPorGrauLng = 111320 * Math.cos((a.latitude * Math.PI) / 180);
    const toXY = (pt: LatLng) => ({
        x: (pt.longitude - a.longitude) * metrosPorGrauLng,
        y: (pt.latitude - a.latitude) * metrosPorGrauLat,
    });
    const P = toXY(p);
    const B = toXY(b);
    const ABx = B.x;
    const ABy = B.y;
    const comprimentoQuad = ABx * ABx + ABy * ABy;
    let t = comprimentoQuad === 0 ? 0 : (P.x * ABx + P.y * ABy) / comprimentoQuad;
    t = Math.max(0, Math.min(1, t));
    const projX = ABx * t;
    const projY = ABy * t;
    const latitude = a.latitude + projY / metrosPorGrauLat;
    const longitude = a.longitude + projX / metrosPorGrauLng;
    const ponto = { latitude, longitude };
    const distancia = distanciaMetros(p, ponto);
    const bearing = (Math.atan2(ABx, ABy) * 180 / Math.PI + 360) % 360;
    return { ponto, distancia, t, bearing };
}

function encontrarProjecaoNaRota(coordenadas: [number, number][], ponto: LatLng, indiceAnterior: number | null): Projecao | null {
    if (coordenadas.length < 2) return null;
    const avaliarFaixa = (inicio: number, fim: number) => {
        let melhor: Projecao | null = null;
        for (let i = inicio; i <= fim; i++) {
            const a = { longitude: coordenadas[i][0], latitude: coordenadas[i][1] };
            const b = { longitude: coordenadas[i + 1][0], latitude: coordenadas[i + 1][1] };
            const proj = projetarNoSegmento(ponto, a, b);
            if (!melhor || proj.distancia < melhor.distancia) {
                melhor = { ponto: proj.ponto, distancia: proj.distancia, bearing: proj.bearing, indice: i };
            }
        }
        return melhor;
    };
    let melhor: Projecao | null;
    if (indiceAnterior !== null) {
        const inicio = Math.max(0, indiceAnterior - 5);
        const fim = Math.min(coordenadas.length - 2, indiceAnterior + JANELA_BUSCA_PROJECAO);
        melhor = avaliarFaixa(inicio, fim);
    } else {
        melhor = avaliarFaixa(0, coordenadas.length - 2);
    }
    if (!melhor || melhor.distancia > RAIO_DESVIO_ROTA_METROS * 3) {
        const completa = avaliarFaixa(0, coordenadas.length - 2);
        if (completa && (!melhor || completa.distancia < melhor.distancia)) melhor = completa;
    }
    return melhor;
}

function distanciaRestanteDesde(coordenadas: [number, number][], indiceSegmento: number, t: number): number {
    const [lngA, latA] = coordenadas[indiceSegmento];
    const [lngB, latB] = coordenadas[Math.min(indiceSegmento + 1, coordenadas.length - 1)];
    const segmentoTotal = distanciaMetros({ latitude: latA, longitude: lngA }, { latitude: latB, longitude: lngB });
    let total = segmentoTotal * (1 - t);
    for (let i = indiceSegmento + 1; i < coordenadas.length - 1; i++) {
        const [lA, laA] = coordenadas[i];
        const [lB, laB] = coordenadas[i + 1];
        total += distanciaMetros({ latitude: laA, longitude: lA }, { latitude: laB, longitude: lB });
    }
    return total;
}

export default function Mapa() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { sentido } = useLocalSearchParams<{ sentido: string }>();
    const { user } = useAuth();
    const cameraRef = useRef<MapboxGL.Camera>(null);
    
    const [direcaoAtual, setDirecaoAtual] = useState<Sentido>((sentido as Sentido) || 'ida');
    const [localizacao, setLocalizacao] = useState<LatLng | null>(null);
    const [posicaoSuave, setPosicaoSuave] = useState<LatLng | null>(null);
    const [headingAtual, setHeadingAtual] = useState(0);
    const [rota, setRota] = useState<PassageiroRota[]>([]);
    const [garagem, setGaragem] = useState<LatLng | null>(null);
    const [geometriaRota, setGeometriaRota] = useState<any>(null);
    const [coordenadasRota, setCoordenadasRota] = useState<[number, number][]>([]);
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
    const [distanciaRestante, setDistanciaRestante] = useState<number | null>(null);
    const [etaMinutos, setEtaMinutos] = useState<number | null>(null);
    const [turmaIdAtual, setTurmaIdAtual] = useState<number | null>(null);
    
    const montadoRef = useRef(true);
    const coordenadasRotaRef = useRef<[number, number][]>([]);
    const manobrasRef = useRef<Manobra[]>([]);
    const direcaoAtualRef = useRef<Sentido>(direcaoAtual);
    const rotaRef = useRef<PassageiroRota[]>([]);
    const garagemRef = useRef<LatLng | null>(null);
    const ultimoIndiceProjecaoRef = useRef<number | null>(null);
    const headingRef = useRef(0);
    const posicaoApresentadaRef = useRef<LatLng | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const controladoresAtivosRef = useRef<Set<AbortController>>(new Set());
    const primeiroTickForaRotaRef = useRef<number | null>(null);
    const recalculandoRef = useRef(false);
    const ultimaRecalculacaoRef = useRef<number | null>(null);
    const turmaIdRef = useRef<number | null>(null);

    useEffect(() => { coordenadasRotaRef.current = coordenadasRota; }, [coordenadasRota]);
    useEffect(() => { manobrasRef.current = manobras; }, [manobras]);
    useEffect(() => { direcaoAtualRef.current = direcaoAtual; }, [direcaoAtual]);
    useEffect(() => { rotaRef.current = rota; }, [rota]);
    useEffect(() => { garagemRef.current = garagem; }, [garagem]);
    useEffect(() => { turmaIdRef.current = turmaIdAtual; }, [turmaIdAtual]);

    async function fetchComTimeout(url: string, options: RequestInit = {}, timeoutMs = 20000) {
        const controller = new AbortController();
        controladoresAtivosRef.current.add(controller);
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
            if (API_URL && url.startsWith(API_URL)) {
                const token = await auth.currentUser?.getIdToken();
                if (token) headers.Authorization = `Bearer ${token}`;
            }
            return await fetch(url, { ...options, headers, signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
            controladoresAtivosRef.current.delete(controller);
        }
    }

    async function buscarRotaMapbox(pontos: LatLng[]): Promise<{ routeGeoJSON: any; coordenadas: [number, number][]; manobras: Manobra[] }> {
        if (pontos.length > LIMITE_WAYPOINTS_MAPBOX) {
            throw new Error(`Limite de ${LIMITE_WAYPOINTS_MAPBOX} pontos excedido (${pontos.length} fornecidos)`);
        }
        if (!MAPBOX_TOKEN) {
            throw new Error('Token do Mapbox ausente');
        }
        
        const waypoints = pontos.map((p) => `${p.longitude},${p.latitude}`).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?geometries=geojson&overview=full&steps=true&language=pt-BR&access_token=${MAPBOX_TOKEN}`;
        
        const res = await fetchComTimeout(url, {}, 15000);
        const data = await res.json();
        
        if (data.code !== 'Ok' || !data.routes?.length) {
            throw new Error(data.message || 'Directions API não retornou rota válida');
        }
        
        const rotaEscolhida = data.routes[0];
        const routeGeoJSON = { type: 'Feature', properties: {}, geometry: rotaEscolhida.geometry };
        const geometryCoords = rotaEscolhida.geometry.coordinates;
        
        const manobras: Manobra[] = [];
        rotaEscolhida.legs?.forEach((leg: any) => {
            leg.steps?.forEach((s: any) => {
                if (s.maneuver?.instruction) {
                    const loc = s.maneuver.location;
                    let idxRota = geometryCoords.findIndex((c: any) => c[0] === loc[0] && c[1] === loc[1]);
                    
                    if (idxRota === -1) {
                        let minD = Infinity;
                        for (let i = 0; i < geometryCoords.length; i++) {
                            const d = distanciaMetros({longitude: geometryCoords[i][0], latitude: geometryCoords[i][1]}, {longitude: loc[0], latitude: loc[1]});
                            if (d < minD) { minD = d; idxRota = i; }
                        }
                    }

                    manobras.push({
                        instrucao: s.maneuver.instruction,
                        tipo: s.maneuver.type + (s.maneuver.modifier ? `_${s.maneuver.modifier}` : ''),
                        coordenada: loc,
                        indiceRota: idxRota
                    });
                }
            });
        });
        
        manobras.sort((a, b) => a.indiceRota - b.indiceRota);
        return { routeGeoJSON, coordenadas: geometryCoords, manobras };
    }

    useEffect(() => {
        const atualizarRelogio = () => {
            const agora = new Date();
            setHorarioAtual(agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        };
        atualizarRelogio();
        const timer = setInterval(atualizarRelogio, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            const estaOnline = !!state.isConnected && !!state.isInternetReachable;
            setOnline((prev) => {
                if (!prev && estaOnline) esvaziarFilaLocalizacoes();
                return estaOnline;
            });
        });
        return () => unsubscribe();
    }, []);

    async function enfileirarLocalizacao(ponto: LatLng) {
        const fila = (await lerCache<LatLng[]>(CACHE_KEYS.filaLocalizacoes)) || [];
        fila.push(ponto);
        await salvarCache(CACHE_KEYS.filaLocalizacoes, fila.slice(-50));
    }

    async function esvaziarFilaLocalizacoes() {
        const fila = (await lerCache<LatLng[]>(CACHE_KEYS.filaLocalizacoes)) || [];
        if (fila.length === 0) return;
        const restantes: LatLng[] = [];
        for (const ponto of fila) {
            try { await enviarLocalizacao(ponto); }
            catch { restantes.push(ponto); }
        }
        await salvarCache(CACHE_KEYS.filaLocalizacoes, restantes);
    }

    async function enviarLocalizacao(ponto: LatLng) {
        const turmaId = turmaIdRef.current;
        const queryTurma = turmaId ? `?turmaId=${turmaId}&latitude=${ponto.latitude}&longitude=${ponto.longitude}` : `?latitude=${ponto.latitude}&longitude=${ponto.longitude}`;
        
        try {
            const res = await fetchComTimeout(
                `${API_URL}/rota/localizacao-van${queryTurma}`,
                { method: 'POST', headers: { Accept: 'application/json', ...HEADERS_PADRAO } },
                10000 
            );
            if (!res.ok) throw new Error('Falha ao enviar localização');
        } catch (error) {
            enfileirarLocalizacao(ponto);
        }
    }

    function animarParaNovaPosicao(novaPos: LatLng) {
        const origem = posicaoApresentadaRef.current || novaPos;
        const inicio = Date.now();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        const passo = () => {
            if (!montadoRef.current) return;
            const t = Math.min(1, (Date.now() - inicio) / DURACAO_ANIMACAO_MS);
            const lat = origem.latitude + (novaPos.latitude - origem.latitude) * t;
            const lng = origem.longitude + (novaPos.longitude - origem.longitude) * t;
            const atual = { latitude: lat, longitude: lng };
            posicaoApresentadaRef.current = atual;
            setPosicaoSuave(atual);
            if (t < 1) animFrameRef.current = requestAnimationFrame(passo);
        };
        passo();
    }

    async function recalcularRotaAPartirDe(origemAtual: LatLng) {
        if (recalculandoRef.current) return;
        const garagemAtual = garagemRef.current;
        if (!garagemAtual) return;
        
        recalculandoRef.current = true;
        if (montadoRef.current) setRecalculandoRota(true);
        
        try {
            const emOrdemDeVisita = direcaoAtualRef.current === 'ida'
                ? rotaRef.current
                : [...rotaRef.current].reverse();
            const pendentes = emOrdemDeVisita.filter((p) => !p.embarcado);
            const destinoFinal = direcaoAtualRef.current === 'ida' ? UNI_CARUARU : garagemAtual;
            const pontosOrdenados = [origemAtual, ...pendentes, destinoFinal];
            const { routeGeoJSON, coordenadas, manobras: manobrasCalculadas } = await buscarRotaMapbox(pontosOrdenados);
            
            if (!montadoRef.current) return;
            
            const geoJsonValido = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: {},
                        geometry: routeGeoJSON.geometry
                    }
                ]
            };

            setGeometriaRota(geoJsonValido);
            setCoordenadasRota(coordenadas);
            coordenadasRotaRef.current = coordenadas;
            ultimoIndiceProjecaoRef.current = null;
            setManobras(manobrasCalculadas);
            manobrasRef.current = manobrasCalculadas;
            if (manobrasCalculadas[0]) setManobraAtual(manobrasCalculadas[0]);
            
            await salvarCache(CACHE_KEYS.geometria(direcaoAtualRef.current), geoJsonValido);
            primeiroTickForaRotaRef.current = null;
            setForaDaRota(false);
            setErroRede(null);
        } catch {
            if (montadoRef.current) setErroRede('Falha ao recalcular a rota automaticamente.');
        } finally {
            recalculandoRef.current = false;
            if (montadoRef.current) setRecalculandoRota(false);
        }
    }

    useEffect(() => {
        montadoRef.current = true;
        let locationSubscription: Location.LocationSubscription | null = null;
        
        const iniciarSistema = async () => {
            let direcaoDefinitiva: Sentido = (sentido as Sentido) || 'ida';
            try {
                const resStatus = await fetchComTimeout(`${API_URL}/rota/status-atual`, { headers: HEADERS_PADRAO }, 6000);
                if (!montadoRef.current) return;
                if (resStatus.ok) {
                    const dataStatus = await resStatus.json();
                    if (dataStatus.status === 'ATIVA' && dataStatus.sentido) {
                        direcaoDefinitiva = dataStatus.sentido.toLowerCase();
                    }
                }
            } catch { }
            
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (!montadoRef.current) return;
            if (status !== 'granted') {
                Alert.alert('Permissão negada', 'Ative o acesso à localização para usar o painel de navegação.');
                setLoading(false);
                return;
            }

            let posicaoInicial: LatLng = { latitude: -8.303, longitude: -35.992 };
            try {
                const locAtual = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                if (locAtual) {
                    posicaoInicial = { latitude: locAtual.coords.latitude, longitude: locAtual.coords.longitude };
                    setLocalizacao(posicaoInicial);
                    posicaoApresentadaRef.current = posicaoInicial;
                    setPosicaoSuave(posicaoInicial);
                }
            } catch { }
            
            await carregarGaragemERota(direcaoDefinitiva, posicaoInicial);
            if (!montadoRef.current) return;

            if (cameraRef.current) {
                cameraRef.current.setCamera({
                    centerCoordinate: [posicaoInicial.longitude, posicaoInicial.latitude],
                    zoomLevel: 18,
                    pitch: 65,
                    animationDuration: 1000,
                });
            }
            
            locationSubscription = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 1 },
                (loc) => {
                    if (!montadoRef.current) return;
                    const pontoBruto: LatLng = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                    const velocidadeKmh = loc.coords.speed && loc.coords.speed > 0 ? Number((loc.coords.speed * 3.6).toFixed(0)) : 0;
                    
                    setLocalizacao(pontoBruto);
                    setVelocidadeAtual(velocidadeKmh);
                    
                    let posicaoFinal = pontoBruto;
                    let projecao: Projecao | null = null;
                    const coords = coordenadasRotaRef.current;
                    
                    if (coords.length > 1) {
                        projecao = encontrarProjecaoNaRota(coords, pontoBruto, ultimoIndiceProjecaoRef.current);
                        if (projecao) {
                            ultimoIndiceProjecaoRef.current = projecao.indice;
                            if (projecao.distancia <= RAIO_DESVIO_ROTA_METROS) {
                                posicaoFinal = projecao.ponto;
                                primeiroTickForaRotaRef.current = null;
                                setForaDaRota(false);
                                const restante = distanciaRestanteDesde(coords, projecao.indice, 0);
                                setDistanciaRestante(restante);
                                const velocidadeParaCalculo = velocidadeKmh > 5 ? velocidadeKmh : 25;
                                setEtaMinutos(Math.max(1, Math.round((restante / 1000) / velocidadeParaCalculo * 60)));
                            } else {
                                if (primeiroTickForaRotaRef.current === null) {
                                    primeiroTickForaRotaRef.current = Date.now();
                                }
                                const tempoForaMs = Date.now() - primeiroTickForaRotaRef.current;
                                if (tempoForaMs >= LIMIAR_TEMPO_FORA_ROTA_MS) {
                                    setForaDaRota(true);
                                    const agora = Date.now();
                                    const podeRecalcular = !recalculandoRef.current &&
                                        (ultimaRecalculacaoRef.current === null || agora - ultimaRecalculacaoRef.current > COOLDOWN_RECALCULO_MS);
                                    if (podeRecalcular) {
                                        ultimaRecalculacaoRef.current = agora;
                                        recalcularRotaAPartirDe(pontoBruto);
                                    }
                                }
                            }
                        }
                    }
                    
                    animarParaNovaPosicao(posicaoFinal);
                    
                    let headingAlvo: number | null = null;
                    if (loc.coords.heading !== null && loc.coords.heading >= 0 && velocidadeKmh > 3) {
                        headingAlvo = loc.coords.heading;
                    } else if (projecao && projecao.distancia <= RAIO_DESVIO_ROTA_METROS) {
                        headingAlvo = projecao.bearing;
                    }
                    
                    if (headingAlvo !== null) {
                        let diff = headingAlvo - headingRef.current;
                        diff = ((diff + 180) % 360 + 360) % 360 - 180;
                        const novoHeading = (headingRef.current + diff * 0.3 + 360) % 360;
                        headingRef.current = novoHeading;
                        setHeadingAtual(novoHeading);
                    }
                    
                    const manobrasAtuais = manobrasRef.current;
                    if (manobrasAtuais.length > 0 && projecao) {
                        const proxima = manobrasAtuais.find(m => m.indiceRota >= projecao!.indice) || manobrasAtuais[manobrasAtuais.length - 1];
                        setManobraAtual(proxima);
                    }
                    
                    setRota((prev) => prev.map((p) => {
                        if (p.embarcado) return p;
                        const dist = distanciaMetros(pontoBruto, { latitude: p.latitude, longitude: p.longitude });
                        return dist < RAIO_EMBARQUE_METROS ? { ...p, embarcado: true } : p;
                    }));
                    
                    enviarLocalizacao(pontoBruto)
                        .then(() => { if (montadoRef.current) setErroRede(null); })
                        .catch(() => {
                            enfileirarLocalizacao(pontoBruto);
                            if (montadoRef.current) setErroRede('Sinal instável. Localização em fila para reenvio.');
                        });
                }
            );
        };
        
        iniciarSistema();
        
        return () => {
            montadoRef.current = false;
            if (locationSubscription) locationSubscription.remove();
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            controladoresAtivosRef.current.forEach((c) => c.abort());
            controladoresAtivosRef.current.clear();
        };
    }, []);

    async function carregarGaragemERota(direcaoUsada: Sentido, posicaoInicial: LatLng) {
        let garagemCarregada: LatLng | null = null;
        let rotaCarregada: PassageiroRota[] = [];
        
        try {
            await AsyncStorage.removeItem(CACHE_KEYS.rota(direcaoUsada));
            await AsyncStorage.removeItem(CACHE_KEYS.geometria(direcaoUsada));
            
            if (!user?.id) throw new Error('Usuário não autenticado');

            const resStatus = await fetchComTimeout(`${API_URL}/rota/status-atual`, { headers: HEADERS_PADRAO });
            let turmaIdAtiva: number | null = null;
            
            if (resStatus.ok) {
                const dadosStatus = await resStatus.json();
                if (dadosStatus.turmaId) {
                    turmaIdAtiva = Number(dadosStatus.turmaId);
                }
                if (dadosStatus.sentido) {
                    direcaoUsada = dadosStatus.sentido.toLowerCase() as Sentido;
                    setDirecaoAtual(direcaoUsada);
                    direcaoAtualRef.current = direcaoUsada;
                }
            }

            const resTurmas = await fetchComTimeout(`${API_URL}/turmas/motorista/${user.id}`, { headers: HEADERS_PADRAO });
            if (!resTurmas.ok) throw new Error('Erro ao buscar turmas do motorista');
            
            const turmas = await resTurmas.json();
            if (!turmas || turmas.length === 0) throw new Error('Nenhuma turma encontrada para este motorista');
            
            const turmaAtual = turmaIdAtiva 
                ? (turmas.find((t: any) => t.id === turmaIdAtiva) || turmas[0]) 
                : turmas[0];

            setTurmaIdAtual(turmaAtual.id);

            const lat = Number(turmaAtual.origemLatitude);
            const lng = Number(turmaAtual.origemLongitude);

            if (!lat || !lng || (lat === 0 && lng === 0)) {
                throw new Error('Coordenadas de origem da turma inválidas');
            }

            garagemCarregada = { latitude: lat, longitude: lng };

            // 1. TENTA BUSCAR PRIMEIRO PELO OTIMIZAR
            const urlOtimizar = `${API_URL}/rota/otimizar?sentido=${direcaoUsada}&turmaId=${turmaAtual.id}`;
            console.log("Buscando rota otimizada em:", urlOtimizar);
            
            const resPassageiros = await fetchComTimeout(urlOtimizar, { headers: HEADERS_PADRAO });

            if (resPassageiros.ok) {
                const lista = await resPassageiros.json();
                console.log("Passageiros retornados pelo otimizar:", lista);
                
                rotaCarregada = lista
                    .map((p: any) => ({
                        id: p.id || p.usuarioId,
                        nome: p.nome || 'Passageiro',
                        latitude: Number(p.latitude ?? p.lat ?? 0),
                        longitude: Number(p.longitude ?? p.lng ?? 0),
                        embarcado: false
                    }))
                    .filter((p: PassageiroRota) => p.latitude !== 0 && p.longitude !== 0 && !isNaN(p.latitude) && !isNaN(p.longitude));
            } else {
                console.log("Otimizar falhou, status:", resPassageiros.status);
            }

            // 2. FALLBACK DIRETO NA LISTA DE PASSAGEIROS DA TURMA SE O OTIMIZAR ESTIVER VAZIO
            if (rotaCarregada.length === 0) {
                console.log("Fallback: Buscando passageiros diretos da turma...");
                const resFallback = await fetchComTimeout(`${API_URL}/turmas/${turmaAtual.id}/passageiros`, { headers: HEADERS_PADRAO });
                if (resFallback.ok) {
                    const listaFb = await resFallback.json();
                    console.log("Passageiros do fallback:", listaFb);
                    rotaCarregada = listaFb
                        .map((p: any) => ({
                            id: p.id || p.usuarioId || p.aluno?.id,
                            nome: p.nome || p.aluno?.nome || 'Passageiro',
                            latitude: Number(p.latitude ?? p.enderecoLatitude ?? p.aluno?.latitude ?? p.aluno?.endereco?.latitude ?? 0),
                            longitude: Number(p.longitude ?? p.enderecoLongitude ?? p.aluno?.longitude ?? p.aluno?.endereco?.longitude ?? 0),
                            embarcado: false
                        }))
                        .filter((p: PassageiroRota) => p.latitude !== 0 && p.longitude !== 0 && !isNaN(p.latitude) && !isNaN(p.longitude));
                }
            }
            
            await salvarCache(CACHE_KEYS.garagem, garagemCarregada);
            await salvarCache(CACHE_KEYS.rota(direcaoUsada), rotaCarregada);
        } catch (e) {
            console.log("Erro em carregarGaragemERota:", e);
            garagemCarregada = await lerCache<LatLng>(CACHE_KEYS.garagem);
            rotaCarregada = (await lerCache<PassageiroRota[]>(CACHE_KEYS.rota(direcaoUsada))) || [];
            if (montadoRef.current) setErroRede('Sem conexão ou dados incompletos. Usando cache.');
        }
        
        if (!montadoRef.current) return;
        
        if (!garagemCarregada || (garagemCarregada.latitude === 0 && garagemCarregada.longitude === 0)) {
            Alert.alert(
                'Endereço não cadastrado', 
                'Você precisa definir a origem (garagem) nas configurações da sua turma para traçar a rota corretamente.'
            );
            setLoading(false);
            return;
        }
        
        setGaragem(garagemCarregada);
        garagemRef.current = garagemCarregada;
        setRota(rotaCarregada);
        rotaRef.current = rotaCarregada;
        setDirecaoAtual(direcaoUsada);
        direcaoAtualRef.current = direcaoUsada;
        
        await carregarGeometriaRota(direcaoUsada, garagemCarregada, rotaCarregada, posicaoInicial);
        if (montadoRef.current) setLoading(false);
    }

    async function carregarGeometriaRota(direcaoUsada: Sentido, garagemPonto: LatLng, passageiros: PassageiroRota[], posicaoAtual: LatLng) {
        const pontosOrdenados: LatLng[] = direcaoUsada === 'ida'
            ? [posicaoAtual, ...passageiros, UNI_CARUARU]
            : [UNI_CARUARU, ...[...passageiros].reverse(), posicaoAtual];

        try {
            const { routeGeoJSON, coordenadas, manobras: manobrasCalculadas } = await buscarRotaMapbox(pontosOrdenados);
            if (!montadoRef.current) return;
            
            const geoJsonValido = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: {},
                        geometry: routeGeoJSON.geometry
                    }
                ]
            };

            setGeometriaRota(geoJsonValido);
            setCoordenadasRota(coordenadas);
            coordenadasRotaRef.current = coordenadas;
            await salvarCache(CACHE_KEYS.geometria(direcaoUsada), geoJsonValido);
            
            setManobras(manobrasCalculadas);
            manobrasRef.current = manobrasCalculadas;
            if (manobrasCalculadas[0]) setManobraAtual(manobrasCalculadas[0]);
        } catch {
            if (pontosOrdenados.length > LIMITE_WAYPOINTS_MAPBOX) {
                Alert.alert(
                    'Rota muito extensa',
                    `Esta rota tem ${pontosOrdenados.length} pontos, acima do limite de ${LIMITE_WAYPOINTS_MAPBOX} da API de direções.`
                );
            }
            const geometriaCache = await lerCache<any>(CACHE_KEYS.geometria(direcaoUsada));
            if (!montadoRef.current) return;
            if (geometriaCache) {
                setGeometriaRota(geometriaCache);
                const coords = geometriaCache.geometry?.coordinates || geometriaCache.features?.[0]?.geometry?.coordinates || [];
                setCoordenadasRota(coords);
                coordenadasRotaRef.current = coords;
                setManobraAtual({ instrucao: 'Navegação em modo offline (rota salva)', tipo: 'straight', coordenada: [0, 0], indiceRota: 0 });
            } else {
                setErroRede('Não foi possível calcular a rota. Verifique o token do Mapbox e a conexão.');
            }
        }
    }

    async function handleEncerrarViagem() {
        if (!online) return Alert.alert('Conexão Necessária', 'Conecte-se à internet para sincronizar o encerramento.');
        
        Alert.alert(
            'Encerrar Viagem',
            'Você tem certeza de que deseja encerrar a rota atual?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { 
                    text: 'Sim, Encerrar', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const turmaIdParam = turmaIdAtual || 1;
                            const motoristaIdParam = user?.id || 1;

                            const res = await fetchComTimeout(
                                `${API_URL}/rota/encerrar?turmaId=${turmaIdParam}&motoristaId=${motoristaIdParam}`, 
                                { 
                                    method: 'POST', 
                                    headers: { 
                                        'Content-Type': 'application/json', 
                                        ...HEADERS_PADRAO 
                                    },
                                    body: JSON.stringify({
                                        turmaId: Number(turmaIdParam),
                                        motoristaId: Number(motoristaIdParam)
                                    })
                                }
                            );

                            if (res.ok) {
                                await AsyncStorage.removeItem('@vanbora:viagem_ativa');
                                router.replace('/(tabs)/home');
                            } else {
                                Alert.alert('Erro', 'O servidor não conseguiu encerrar a viagem.');
                            }
                        } catch {
                            if (montadoRef.current) setErroRede('Não foi possível encerrar a viagem. Tente novamente.');
                        }
                    }
                }
            ]
        );
    }

    const centralizarNaVan = useCallback(() => {
        const pos = posicaoSuave || localizacao;
        if (pos && cameraRef.current) {
            cameraRef.current.setCamera({
                centerCoordinate: [pos.longitude, pos.latitude],
                zoomLevel: 18,
                animationDuration: 700,
                pitch: 65,
            });
        }
    }, [posicaoSuave, localizacao]);

    const passageirosGeoJSON = useMemo(() => ({
        type: 'FeatureCollection' as const,
        features: rota
            .filter((p) => p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0)
            .map((p, index) => ({
                type: 'Feature' as const,
                properties: {
                    id: p.id,
                    label: p.embarcado ? '✓' : String(index + 1),
                    cor: p.embarcado ? '#10B981' : '#3B82F6',
                },
                geometry: { type: 'Point' as const, coordinates: [Number(p.longitude), Number(p.latitude)] },
            })),
    }), [rota]);

    let geometriaPercorrida: any = null;
    let geometriaRestante: any = geometriaRota;
    
    if (localizacao && coordenadasRota.length > 1 && ultimoIndiceProjecaoRef.current !== null) {
        const idx = ultimoIndiceProjecaoRef.current;
        if (idx > 0) {
            geometriaPercorrida = {
                type: 'FeatureCollection',
                features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coordenadasRota.slice(0, idx + 1) } }]
            };
        }
        geometriaRestante = {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coordenadasRota.slice(idx) } }]
        };
    }

    if (loading || !garagem) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00D2FF" />
                <Text style={styles.loadingText}>Carregando telemetria...</Text>
            </View>
        );
    }

    const posicaoExibida = posicaoSuave || localizacao;

    return (
        <View style={styles.fullScreenContainer}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            
            <CabecalhoMapa 
                onBack={() => router.replace('/(tabs)/home')} 
                online={online} 
                direcaoAtual={direcaoAtual} 
                horarioAtual={horarioAtual} 
            />
            
            <PainelManobra 
                manobraAtual={manobraAtual} 
                velocidadeAtual={velocidadeAtual} 
            />
            
            {recalculandoRota ? (
                <View style={[styles.bannerNotificacao, { top: insets.top + 215, backgroundColor: '#0D2B3A', borderColor: '#29B6F6' }]}>
                    <ActivityIndicator size="small" color="#29B6F6" style={styles.bannerIcon} />
                    <Text style={[styles.bannerText, { color: '#29B6F6' }]}>Recalculando rota...</Text>
                </View>
            ) : foraDaRota ? (
                <View style={[styles.bannerNotificacao, { top: insets.top + 215, backgroundColor: '#3A1A00', borderColor: '#FF9800' }]}>
                    <Text style={[styles.bannerText, { color: '#FF9800' }]}>Fora da rota planejada. Recalculando automaticamente...</Text>
                </View>
            ) : erroRede ? (
                <View style={[styles.bannerNotificacao, { top: insets.top + 215, backgroundColor: '#1E293B', borderColor: '#3B82F6' }]}>
                    <Text style={[styles.bannerText, { color: '#60A5FA' }]}>{erroRede}</Text>
                </View>
            ) : null}
            
            <MapboxGL.MapView style={styles.mapa} styleURL={MapboxGL.StyleURL.Dark} logoEnabled={false} attributionEnabled={false} compassEnabled={false}>
                <MapboxGL.Camera
                    ref={cameraRef}
                    zoomLevel={18}
                    pitch={65}
                />
                
                {geometriaPercorrida && (
                    <MapboxGL.ShapeSource id="rotaPercorridaSource" shape={geometriaPercorrida}>
                        <MapboxGL.LineLayer id="rotaPercorridaLine" style={{ lineColor: '#334155', lineWidth: 6, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.8 }} />
                    </MapboxGL.ShapeSource>
                )}
                
                {geometriaRestante && (
                    <MapboxGL.ShapeSource id="rotaRestanteSource" shape={geometriaRestante}>
                        <MapboxGL.LineLayer id="rotaCasing" style={{ lineColor: '#0088CC', lineWidth: 10, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.4 }} />
                        <MapboxGL.LineLayer id="rotaLine" style={{ lineColor: '#00D2FF', lineWidth: 6, lineCap: 'round', lineJoin: 'round' }} />
                    </MapboxGL.ShapeSource>
                )}
                
                {posicaoExibida && (
                    <MapboxGL.PointAnnotation id="van-marker" coordinate={[posicaoExibida.longitude, posicaoExibida.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
                        <View style={{ transform: [{ rotate: `${headingAtual}deg` }], justifyContent: 'center', alignItems: 'center' }}>
                            <View style={styles.markerVanCircle}>
                                <Ionicons name="navigate" size={18} color="#FFC107" style={{ transform: [{ rotate: '-45deg' }] }} />
                            </View>
                        </View>
                    </MapboxGL.PointAnnotation>
                )}
                
                <MapboxGL.PointAnnotation id="garagem" coordinate={[garagem.longitude, garagem.latitude]}>
                    <View style={styles.markerPontoBox}>
                        <Text style={styles.markerEmoji}>🏠</Text>
                    </View>
                </MapboxGL.PointAnnotation>
                
                <MapboxGL.PointAnnotation id="uninassau" coordinate={[UNI_CARUARU.longitude, UNI_CARUARU.latitude]}>
                    <View style={[styles.markerPontoBox, styles.markerDestino]}>
                        <Text style={styles.markerEmoji}>🏁</Text>
                    </View>
                </MapboxGL.PointAnnotation>
                
                <MapboxGL.ShapeSource id="passageirosSource" shape={passageirosGeoJSON}>
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
                style={[styles.locateButton, { bottom: insets.bottom + 170 }]} 
                onPress={centralizarNaVan}
                activeOpacity={0.8}
            >
                <Ionicons name="locate" size={22} color="#00D2FF" />
            </TouchableOpacity>
            
            <ControlesViagem 
                distanciaRestante={distanciaRestante}
                etaMinutos={etaMinutos}
                viagemAtiva={viagemAtiva}
                onIniciarViagem={() => {}}
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