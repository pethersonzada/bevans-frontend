
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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

type EnderecoSalvo = {
  id: number;
  apelido: string;
  rua: string;
  numero: string;
  bairro: string;
  latitude: number | null;
  longitude: number | null;
};

export default function EditarEndereco() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [enderecoAtual, setEnderecoAtual] =
    useState<EnderecoSalvo | null>(null);

  const [apelido, setApelido] = useState('');

  const [novaLocalizacao, setNovaLocalizacao] =
    useState<EnderecoEncontrado | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregarEndereco() {
      try {
        const userId =
          await AsyncStorage.getItem('userId');

        if (!userId || !id) {
          throw new Error(
            'Usuário ou endereço não identificado.'
          );
        }

        const response = await apiFetch(
          `/enderecos/usuario/${userId}`,
          {
            headers: {
              'Bypass-Tunnel-Reminder': 'true',
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            'Não foi possível carregar o endereço.'
          );
        }

        const lista: EnderecoSalvo[] =
          await response.json();

        if (!Array.isArray(lista)) {
          throw new Error(
            'Resposta inválida do servidor.'
          );
        }

        const encontrado = lista.find(
          (end) => String(end.id) === String(id)
        );

        if (!encontrado) {
          throw new Error(
            'Endereço não encontrado na sua conta.'
          );
        }

        if (!ativo) return;

        setEnderecoAtual(encontrado);
        setApelido(encontrado.apelido || '');
      } catch (error) {
        if (!ativo) return;

        Alert.alert(
          'Erro',
          error instanceof Error
            ? error.message
            : 'Falha ao carregar endereço.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    carregarEndereco();

    return () => {
      ativo = false;
    };
  }, [id, router]);

  const apelidoValido = apelido.trim().length > 0;

  const apelidoAlterado =
    enderecoAtual !== null &&
    apelido.trim() !==
    (enderecoAtual.apelido || '').trim();

  const temAlteracoes =
    apelidoAlterado || novaLocalizacao !== null;

  const podeSalvar =
    enderecoAtual !== null &&
    apelidoValido &&
    temAlteracoes &&
    !salvando;

  async function salvarAlteracoes() {
    if (!enderecoAtual || salvando) return;

    if (!apelido.trim()) {
      Alert.alert(
        'Atenção',
        'Informe o nome do local.'
      );
      return;
    }

    if (!temAlteracoes) {
      Alert.alert(
        'Atenção',
        'Nenhuma alteração foi realizada.'
      );
      return;
    }

    const payload: {
      apelido: string;
      rua?: string;
      numero?: string;
      bairro?: string;
      latitude?: number;
      longitude?: number;
    } = {
      apelido: apelido.trim(),
    };

    if (novaLocalizacao) {
      const {
        latitude,
        longitude,
        rua,
        numero,
        bairro,
        nome,
      } = novaLocalizacao;

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180 ||
        (latitude === 0 && longitude === 0)
      ) {
        Alert.alert(
          'Erro',
          'A localização selecionada possui coordenadas inválidas.'
        );
        return;
      }

      payload.rua = rua || nome;
      payload.numero = numero || 'S/N';
      payload.bairro = bairro || '';
      payload.latitude = latitude;
      payload.longitude = longitude;
    }

    setSalvando(true);

    try {
      const response = await apiFetch(
        `/enderecos/${enderecoAtual.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Bypass-Tunnel-Reminder': 'true',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const mensagem = await response.text();

        throw new Error(
          mensagem ||
          `Falha ao atualizar endereço: HTTP ${response.status}`
        );
      }

      Alert.alert(
        'Sucesso',
        'Endereço atualizado com sucesso!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error(
        'Erro ao atualizar endereço:',
        error
      );

      Alert.alert(
        'Erro ao salvar',
        error instanceof Error
          ? error.message
          : 'Falha de conexão.'
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <View style={styles.carregando}>
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
        />
      </View>
    );
  }

  if (!enderecoAtual) {
    return (
      <View style={styles.carregando}>
        <Text style={styles.erro}>
          Não foi possível carregar o endereço.
        </Text>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.voltarErro}
        >
          <Text style={styles.textoBotao}>
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View
        style={[
          styles.header,
          {
            paddingTop:
              insets.top + theme.spacing.sm,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          disabled={salvando}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.map.text}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Editar endereço
        </Text>
      </View>

      <View style={styles.formulario}>
        <Text style={styles.label}>
          Nome do local
        </Text>

        <TextInput
          style={styles.input}
          value={apelido}
          onChangeText={setApelido}
          placeholder="Casa, Trabalho, Faculdade..."
          placeholderTextColor={
            theme.colors.map.textLight
          }
          autoCapitalize="words"
          maxLength={30}
          editable={!salvando}
        />

        <Text style={styles.label}>
          Endereço atual
        </Text>

        <View style={styles.enderecoAtual}>
          <Ionicons
            name="location-outline"
            size={20}
            color={theme.colors.primary}
          />

          <View style={styles.enderecoTexto}>
            <Text style={styles.rua}>
              {enderecoAtual.rua}
              {enderecoAtual.numero
                ? `, ${enderecoAtual.numero}`
                : ''}
            </Text>

            {!!enderecoAtual.bairro && (
              <Text style={styles.bairro}>
                {enderecoAtual.bairro}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.labelMapa}>
          {novaLocalizacao
            ? 'Nova localização selecionada'
            : 'Alterar localização'}
        </Text>

        <Text style={styles.instrucao}>
          {novaLocalizacao
            ? 'Confira o marcador no mapa antes de salvar.'
            : 'Pesquise abaixo para escolher outra rua ou estabelecimento.'}
        </Text>
      </View>

      <View style={styles.mapaContainer}>
        <EnderecoMapaPicker
          tipo="endereco"
          localizacaoInicial={{
            latitude: enderecoAtual.latitude,
            longitude: enderecoAtual.longitude,
          }}
          onChange={setNovaLocalizacao}
        />
      </View>

      <View
        style={[
          styles.footer,
          {
            paddingBottom:
              insets.bottom + theme.spacing.md,
          },
        ]}
      >
        {novaLocalizacao && (
          <View style={styles.novoEndereco}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={theme.colors.success}
            />

            <Text
              style={styles.novoEnderecoTexto}
              numberOfLines={2}
            >
              {novaLocalizacao.nome}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.botaoSalvar,
            !podeSalvar && styles.botaoDesativado,
          ]}
          disabled={!podeSalvar}
          onPress={salvarAlteracoes}
        >
          {salvando ? (
            <ActivityIndicator
              color={theme.colors.map.text}
            />
          ) : (
            <>
              <Ionicons
                name="checkmark"
                size={20}
                color={theme.colors.map.text}
              />

              <Text style={styles.textoBotao}>
                Salvar alterações
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.map.background,
  },

  carregando: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.map.background,
  },

  erro: {
    color: theme.colors.map.text,
    fontSize: theme.typography.size.regular,
    textAlign: 'center',
  },

  voltarErro: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.map.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.map.border,
  },

  backButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },

  headerTitle: {
    color: theme.colors.map.text,
    fontSize: theme.typography.size.large,
    fontWeight: theme.typography.weight.bold,
  },

  formulario: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.map.surface,
  },

  label: {
    color: theme.colors.map.text,
    fontSize: theme.typography.size.small,
    fontWeight: theme.typography.weight.bold,
    marginBottom: theme.spacing.sm,
  },

  input: {
    height: 48,
    backgroundColor: theme.colors.map.input,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.map.border,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.map.text,
    fontSize: theme.typography.size.regular,
    marginBottom: theme.spacing.md,
  },

  enderecoAtual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.map.input,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.map.border,
  },

  enderecoTexto: {
    flex: 1,
  },

  rua: {
    color: theme.colors.map.text,
    fontSize: theme.typography.size.regular,
  },

  bairro: {
    color: theme.colors.map.textLight,
    fontSize: theme.typography.size.small,
    marginTop: theme.spacing.xs,
  },

  labelMapa: {
    color: theme.colors.map.text,
    fontSize: theme.typography.size.small,
    fontWeight: theme.typography.weight.bold,
    marginTop: theme.spacing.md,
  },

  instrucao: {
    color: theme.colors.map.textLight,
    fontSize: theme.typography.size.small,
    marginTop: theme.spacing.xs,
  },

  mapaContainer: {
    flex: 1,
    minHeight: 0,
  },

  footer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.map.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.map.border,
  },

  novoEndereco: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },

  novoEnderecoTexto: {
    flex: 1,
    color: theme.colors.map.text,
    fontSize: theme.typography.size.small,
  },

  botaoSalvar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
  },

  botaoDesativado: {
    opacity: 0.45,
  },

  textoBotao: {
    color: theme.colors.map.text,
    fontSize: theme.typography.size.regular,
    fontWeight: theme.typography.weight.bold,
  },
});
