
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

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

import EnderecoMapaPicker from '../components/EnderecoMapaPicker';
import type {
  EnderecoEncontrado,
} from '../services/enderecoSearch';

import { apiFetch } from '../config/api';
import { theme } from '../styles/theme';

export default function SelecionarRotaMapa() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { turmaId, tipo } = useLocalSearchParams<{
    turmaId: string;
    tipo: 'ORIGEM' | 'DESTINO';
  }>();

  const [endereco, setEndereco] =
    useState<EnderecoEncontrado | null>(null);

  const [salvando, setSalvando] = useState(false);

  const origem = tipo === 'ORIGEM';

  async function confirmar() {
    if (
      !endereco ||
      !turmaId ||
      !['ORIGEM', 'DESTINO'].includes(tipo)
    ) {
      Alert.alert(
        'Atenção',
        'Selecione um endereço válido na busca.'
      );
      return;
    }

    const dados = origem
      ? {
          origemNome: endereco.nome,
          origemLatitude: endereco.latitude,
          origemLongitude: endereco.longitude,
        }
      : {
          destinoNome: endereco.nome,
          destinoLatitude: endereco.latitude,
          destinoLongitude: endereco.longitude,
        };

    setSalvando(true);

    try {
      const response = await apiFetch(
        `/turmas/${turmaId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dados),
        }
      );

      if (!response.ok) {
        const mensagem = await response.text();

        throw new Error(
          mensagem || `HTTP ${response.status}`
        );
      }

      Alert.alert(
        'Sucesso',
        `${origem ? 'Origem' : 'Destino'} atualizado!`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e) {
      Alert.alert(
        'Erro ao salvar',
        e instanceof Error
          ? e.message
          : 'Falha de conexão.'
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={styles.tela}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <View
        style={[
          styles.cabecalho,
          {
            paddingTop:
              insets.top + theme.spacing.sm,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.voltar}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.map.text}
          />
        </TouchableOpacity>

        <Text style={styles.titulo}>
          {origem
            ? 'Endereço de saída'
            : 'Ponto final'}
        </Text>
      </View>

      <EnderecoMapaPicker
        tipo={origem ? 'origem' : 'destino'}
        onChange={setEndereco}
      />

      <View
        style={[
          styles.rodape,
          {
            paddingBottom:
              insets.bottom + theme.spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.botao,
            (!endereco || salvando) &&
              styles.inativo,
          ]}
          disabled={!endereco || salvando}
          onPress={confirmar}
        >
          {salvando ? (
            <ActivityIndicator
              color={theme.colors.map.text}
            />
          ) : (
            <Text style={styles.botaoTexto}>
              Confirmar {origem ? 'saída' : 'destino'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: theme.colors.map.background,
  },

  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.map.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.map.border,
  },

  voltar: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },

  titulo: {
    fontSize: theme.typography.size.large,
    color: theme.colors.map.text,
    fontWeight: theme.typography.weight.bold,
  },

  rodape: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.map.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.map.border,
  },

  botao: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary,
  },

  botaoTexto: {
    color: theme.colors.map.text,
    fontWeight: theme.typography.weight.bold,
    fontSize: theme.typography.size.regular,
  },

  inativo: {
    opacity: 0.45,
  },
});
