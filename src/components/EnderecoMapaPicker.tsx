
import MapboxGL from '@rnmapbox/maps';
import { getCurrentCoordinates } from '../services/location';

import { useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
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
    selecionouRef.current = endereco !== null;

    setCandidato(endereco);
    const confirmado = endereco?.precisao === 'endereco' || endereco?.precisao === 'manual' ? endereco : null;
    setSelecionado(confirmado);
    onChange(confirmado);

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
        />
      </View>

      <View style={styles.info}>
        {candidato && !selecionado && (
          <>
            <Text style={styles.descricao}>Resultado aproximado. Toque no mapa para marcar o local exato ou confirme explicitamente o ponto mostrado.</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Confirmar ponto mostrado no mapa"
              onPress={() => marcarPonto(candidato.longitude, candidato.latitude)} style={styles.confirmar}>
              <Text style={styles.titulo}>Confirmar este ponto</Text>
            </TouchableOpacity>
          </>
        )}
        <Text style={styles.titulo}>
          {selecionado
            ? 'Nova localização selecionada'
            : posicaoSalva
              ? 'Localização cadastrada'
              : posicaoGPS
                ? 'Mapa na sua localização atual'
                : 'Selecionar localização'}
        </Text>

        <Text style={styles.descricao}>
          {selecionado
            ? selecionado.nome
            : posicaoSalva
              ? 'O marcador mostra o endereço salvo. Pesquise outro endereço para alterá-lo.'
              : 'Pesquise um endereço ou toque no mapa para marcar o local exato. Arraste o marcador para ajustar.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmar: { minHeight: 48, justifyContent: 'center', padding: theme.spacing.sm },
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
