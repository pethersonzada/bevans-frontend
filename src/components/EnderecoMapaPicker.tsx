
import MapboxGL from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentCoordinates } from '../services/location';

import { useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';

import EnderecoSearchInput from './EnderecoSearchInput';
import MapMarker from './MapMarker';

import type {
  EnderecoEncontrado,
} from '../services/enderecoSearch';

import { theme } from '../styles/theme';
import type { TipoMarcador } from './MapMarker';

const TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

if (TOKEN) {
  MapboxGL.setAccessToken(TOKEN);
}

type Coordenadas = [number, number];

type LocalizacaoInicial = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  nome?: string;
};

type Props = {
  tipo?: TipoMarcador;

  // Endereço salvo anteriormente
  localizacaoInicial?: LocalizacaoInicial | null;

  // Só retorna um endereço quando o usuário
  // seleciona uma opção na pesquisa
  onChange: (
    endereco: EnderecoEncontrado | null
  ) => void;
  // Opt-in: excursion points review a reverse-geocoded address before saving.
  resolverEndereco?: (ponto: { latitude: number; longitude: number }, signal?: AbortSignal) => Promise<EnderecoEncontrado>;
};

function coordenadasValidas(
  latitude: unknown,
  longitude: unknown
): Coordenadas | null {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return null;
  }

  return [lng, lat];
}

export default function EnderecoMapaPicker({
  tipo = 'endereco',
  localizacaoInicial,
  onChange,
  resolverEndereco,
}: Props) {
  const camera = useRef<MapboxGL.Camera>(null);

  // Coordenadas previamente salvas no banco
  const posicaoSalva = coordenadasValidas(
    localizacaoInicial?.latitude,
    localizacaoInicial?.longitude
  );

  const [posicaoGPS, setPosicaoGPS] =
    useState<Coordenadas | null>(null);

  const [selecionado, setSelecionado] =
    useState<EnderecoEncontrado | null>(null);

  const [candidato, setCandidato] = useState<EnderecoEncontrado | null>(null);

  const [carregandoGPS, setCarregandoGPS] =
    useState(!posicaoSalva);

  const [erroGPS, setErroGPS] = useState('');
  const [descricao, setDescricao] = useState('');
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [erroEndereco, setErroEndereco] = useState('');
  const enderecoRequest = useRef(0), enderecoAbort = useRef<AbortController | null>(null);
  const pontoAtual = useRef<EnderecoEncontrado | null>(null), montado = useRef(true);
  const onChangeAtual = useRef(onChange); onChangeAtual.current = onChange;
  const nomeValido = (nome: string) => !!nome.trim() && nome.trim().toLocaleLowerCase('pt-BR') !== 'ponto marcado no mapa';
  function cancelarEndereco() { enderecoRequest.current++; enderecoAbort.current?.abort(); enderecoAbort.current = null; }
  useEffect(() => { montado.current = true; return () => { montado.current = false; cancelarEndereco(); }; }, []);

  function consultarEndereco(latitude: number, longitude: number) {
    if (!resolverEndereco) return;
    cancelarEndereco(); const request = enderecoRequest.current;
    const controller = new AbortController(); enderecoAbort.current = controller;
    const point: EnderecoEncontrado = { id: `manual:${longitude}:${latitude}`, latitude, longitude, nome: '', rua: '', numero: '', bairro: '', tipo: 'endereco', precisao: 'manual' };
    pontoAtual.current = point; selecionouRef.current = true;
    setSelecionado(point); setCandidato(point); setDescricao(''); setErroEndereco(''); setBuscandoEndereco(true); onChangeAtual.current(null);
    void resolverEndereco({ latitude, longitude }, controller.signal).then(address => {
      if (!montado.current || controller.signal.aborted || request !== enderecoRequest.current) return;
      // The geocoder supplies text, never replacement coordinates for the pin.
      const confirmed = { ...address, latitude, longitude, precisao: 'manual' as const };
      pontoAtual.current = confirmed; setSelecionado(confirmed); setCandidato(confirmed); setDescricao(confirmed.nome);
      onChangeAtual.current(nomeValido(confirmed.nome) ? confirmed : null);
    }).catch(() => {
      if (montado.current && !controller.signal.aborted && request === enderecoRequest.current) setErroEndereco('Não foi possível consultar o endereço. Informe uma descrição do local; o pin foi preservado.');
    }).finally(() => { if (montado.current && !controller.signal.aborted && request === enderecoRequest.current) setBuscandoEndereco(false); });
  }

  useEffect(() => {
    if (!resolverEndereco || !posicaoSalva) return;
    const [longitude, latitude] = posicaoSalva;
    if (nomeValido(localizacaoInicial?.nome || '')) {
      const point: EnderecoEncontrado = { id: `salvo:${longitude}:${latitude}`, latitude, longitude, nome: localizacaoInicial!.nome!, rua: '', numero: '', bairro: '', tipo: 'endereco', precisao: 'manual' };
      pontoAtual.current = point; setSelecionado(point); setCandidato(point); setDescricao(point.nome); onChangeAtual.current(point);
    } else consultarEndereco(latitude, longitude);
    return cancelarEndereco;
  }, [resolverEndereco, localizacaoInicial?.latitude, localizacaoInicial?.longitude, localizacaoInicial?.nome]);

  // Impede que o GPS sobrescreva a câmera
  // depois que o usuário selecionar um endereço
  const selecionouRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setErroGPS('');
    setCarregandoGPS(!posicaoSalva);
    if (posicaoSalva) return () => controller.abort();
    getCurrentCoordinates({ signal: controller.signal }).then(({ latitude, longitude }) => {
      if (controller.signal.aborted) return;
      const coordenadas: Coordenadas = [longitude, latitude];
      setPosicaoGPS(coordenadas);
      if (!selecionouRef.current) camera.current?.setCamera({
        centerCoordinate: coordenadas, zoomLevel: 17, animationDuration: 800,
      });
    }).catch(error => {
      if (!controller.signal.aborted) setErroGPS(error instanceof Error ? error.message : 'GPS indisponivel. Pesquise um endereco.');
    }).finally(() => {
      if (!controller.signal.aborted) setCarregandoGPS(false);
    });
    return () => controller.abort();
  }, [localizacaoInicial?.latitude, localizacaoInicial?.longitude]);

  function atualizarEndereco(
    endereco: EnderecoEncontrado | null
  ) {
    cancelarEndereco(); setBuscandoEndereco(false); setErroEndereco('');
    selecionouRef.current = endereco !== null;

    setCandidato(endereco);
    const confirmado = endereco?.precisao === 'endereco' || endereco?.precisao === 'manual' ? endereco : null;
    setSelecionado(confirmado);
    pontoAtual.current = confirmado;
    if (resolverEndereco) setDescricao(confirmado?.nome || '');
    onChange(resolverEndereco && confirmado && !nomeValido(confirmado.nome) ? null : confirmado);

    if (endereco) {
      // Selecionou uma opção na pesquisa:
      // centraliza e mostra o pin nesse endereço.
      camera.current?.setCamera({
        centerCoordinate: [
          endereco.longitude,
          endereco.latitude,
        ],
        zoomLevel: 17,
        animationDuration: 800,
      });
    } else {
      // Limpou a pesquisa:
      // volta para o endereço salvo ou GPS.
      const destino = posicaoSalva || posicaoGPS;

      if (destino) {
        camera.current?.setCamera({
          centerCoordinate: destino,
          zoomLevel: 17,
          animationDuration: 800,
        });
      }
    }
  }

  function marcarPonto(longitude: number, latitude: number) {
    if (!coordenadasValidas(latitude, longitude)) return;
    if (resolverEndereco) { consultarEndereco(latitude, longitude); return; }
    const base = candidato || selecionado;
    const manual: EnderecoEncontrado = {
      id: 'manual:' + longitude + ':' + latitude,
      nome: base?.nome || 'Ponto marcado no mapa',
      rua: base?.rua || 'Ponto marcado no mapa', numero: base?.numero || '', bairro: base?.bairro || '',
      latitude, longitude, tipo: base?.tipo || 'endereco', precisao: 'manual',
    };
    atualizarEndereco(manual);
  }

  const posicaoCandidata = candidato ? coordenadasValidas(candidato.latitude, candidato.longitude) : null;
  const posicaoSelecionada = selecionado
    ? coordenadasValidas(
        selecionado.latitude,
        selecionado.longitude
      )
    : null;

  const centroMapa =
    posicaoSelecionada ||
    posicaoCandidata ||
    posicaoSalva ||
    posicaoGPS;

  return (
    <View style={styles.container}>
      {centroMapa ? (
        <MapboxGL.MapView
          onPress={event => {
            if (event.geometry.type === 'Point') {
              const [longitude, latitude] = event.geometry.coordinates;
              marcarPonto(longitude, latitude);
            }
          }}
          style={styles.mapa}
          styleURL={MapboxGL.StyleURL.Dark}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled
        >
          <MapboxGL.Camera
            ref={camera}
            centerCoordinate={centroMapa}
            zoomLevel={17}
          />

          {/* Pin do endereço que já estava salvo */}
          {posicaoSalva && !selecionado && (
            <MapboxGL.PointAnnotation
              id={`endereco-salvo-${tipo}`}
              coordinate={posicaoSalva}
            >
              <MapMarker tipo={tipo} />
            </MapboxGL.PointAnnotation>
          )}

          {posicaoCandidata && !selecionado && (
            <MapboxGL.PointAnnotation id={`endereco-aproximado-${tipo}`} coordinate={posicaoCandidata}>
              <MapMarker tipo={tipo} />
            </MapboxGL.PointAnnotation>
          )}
          {/* Pin do novo endereço selecionado */}
          {posicaoSelecionada && (
            <MapboxGL.PointAnnotation
              draggable
              onDragEnd={event => {
                const [longitude, latitude] = event.geometry.coordinates;
                marcarPonto(longitude, latitude);
              }}
              id={`endereco-novo-${tipo}`}
              coordinate={posicaoSelecionada}
            >
              <MapMarker tipo={tipo} />
            </MapboxGL.PointAnnotation>
          )}

          {/*
            Sem endereço salvo e sem seleção:
            apenas o mapa centralizado no GPS.
            Nenhum pin é criado automaticamente.
          */}
        </MapboxGL.MapView>
      ) : (
        <View style={styles.estadoGPS}>
          {carregandoGPS && (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
            />
          )}

          <Text style={styles.mensagemGPS}>
            {carregandoGPS
              ? 'Obtendo sua localização...'
              : erroGPS ||
                'Pesquise um endereço para visualizar o mapa.'}
          </Text>
        </View>
      )}

      <View style={styles.busca}>
        <EnderecoSearchInput
          onSelecionar={atualizarEndereco}
          proximidade={centroMapa ? { latitude: centroMapa[1], longitude: centroMapa[0] } : undefined}
        />
      </View>

      <View style={styles.info}>
        {candidato && !selecionado && (
          <>
            <Text style={styles.descricao}>Resultado aproximado. Toque no mapa para marcar o local exato ou confirme explicitamente o ponto mostrado.</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Confirmar ponto mostrado no mapa"
              onPress={() => marcarPonto(candidato.longitude, candidato.latitude)} style={styles.confirmar} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle-outline" color="#fff" size={22} />
              <Text style={styles.confirmarTexto}>Confirmar este ponto</Text>
            </TouchableOpacity>
          </>
        )}
        <Text style={styles.titulo}>
          {selecionado
            ? 'Ponto confirmado'
            : candidato
              ? 'Confirme o ponto aproximado'
            : posicaoSalva
              ? 'Localização cadastrada'
              : posicaoGPS
                ? 'Mapa na sua localização atual'
                : 'Selecionar localização'}
        </Text>

        {resolverEndereco && selecionado ? <View style={{ gap: 8 }}>
          {buscandoEndereco && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator color={theme.colors.map.text}/><Text style={styles.descricao}>Buscando endereço do ponto…</Text></View>}
          <Text style={styles.titulo}>Nome ou endereço do local</Text>
          <TextInput accessibilityLabel="Nome ou endereço do local" value={descricao} placeholder="Informe uma descrição para este pin" placeholderTextColor={theme.colors.map.textLight}
            style={{ minHeight: 52, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.map.border, backgroundColor: theme.colors.map.input, color: theme.colors.map.text, fontSize: 15 }} multiline
            onChangeText={nome => {
              cancelarEndereco(); setBuscandoEndereco(false); setErroEndereco(''); setDescricao(nome);
              const point = pontoAtual.current; if (!point) return;
              const updated = { ...point, nome: nome.trim() }; pontoAtual.current = updated; setSelecionado(updated); setCandidato(updated);
              onChangeAtual.current(nomeValido(nome) ? updated : null);
            }}/>
          {!!erroEndereco && <Text accessibilityLiveRegion="polite" style={styles.descricao}>{erroEndereco}</Text>}
          <Text style={styles.descricao}>Revise a descrição antes de usar o ponto. Alterar o texto não move o pin.</Text>
        </View> : <Text style={styles.descricao}>
          {selecionado
            ? selecionado.nome
            : posicaoSalva
              ? 'O marcador mostra o endereço salvo. Pesquise outro endereço para alterá-lo.'
              : 'Pesquise um endereço ou toque no mapa para marcar o local exato. Arraste o marcador para ajustar.'}
        </Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmar: { minHeight: 52, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginVertical: 8, backgroundColor: '#177E72' },
  confirmarTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  container: {
    flex: 1,
    minHeight: 320,
    backgroundColor: theme.colors.map.background,
  },

  mapa: {
    flex: 1,
  },

  estadoGPS: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.map.background,
  },

  mensagemGPS: {
    color: theme.colors.map.textLight,
    fontSize: theme.typography.size.regular,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },

  busca: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 30,
    elevation: 30,
  },

  info: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.map.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.map.border,
  },

  titulo: {
    color: theme.colors.map.text,
    fontSize: theme.typography.size.regular,
    fontWeight: theme.typography.weight.bold,
    marginBottom: theme.spacing.xs,
  },

  descricao: {
    color: theme.colors.map.textLight,
    fontSize: theme.typography.size.small,
  },
});
