
import MapboxGL from '@rnmapbox/maps';
import { getCurrentCoordinates } from '../services/location';

import { useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
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

    setSelecionado(endereco);
    onChange(endereco);

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

  const posicaoSelecionada = selecionado
    ? coordenadasValidas(
        selecionado.latitude,
        selecionado.longitude
      )
    : null;

  const centroMapa =
    posicaoSelecionada ||
    posicaoSalva ||
    posicaoGPS;

  return (
    <View style={styles.container}>
      {centroMapa ? (
        <MapboxGL.MapView
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

          {/* Pin do novo endereço selecionado */}
          {posicaoSelecionada && (
            <MapboxGL.PointAnnotation
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
              : 'Pesquise e selecione um endereço para posicionar o marcador.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
