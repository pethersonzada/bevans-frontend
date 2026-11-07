
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

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

type Endereco = {
  id: number;
  apelido: string;
  rua: string;
  numero: string;
  bairro: string;
  latitude?: number | null;
  longitude?: number | null;
};

export default function GerenciarEnderecos() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [enderecos, setEnderecos] =
    useState<Endereco[]>([]);

  const carregarEnderecos = useCallback(async () => {
    setLoading(true);

    try {
      const userId = await AsyncStorage.getItem('userId');

      if (!userId) {
        throw new Error('Usuário não identificado.');
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
          `Erro HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Resposta inválida do servidor.');
      }

      setEnderecos(data);
    } catch (error) {
      console.error('Erro ao carregar endereços:', error);

      Alert.alert(
        'Erro',
        'Não foi possível carregar os endereços.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarEnderecos();
    }, [carregarEnderecos])
  );

  function editarEndereco(endereco: Endereco) {
    router.push({
      pathname: '/editar-endereco',
      params: {
        id: String(endereco.id),
      },
    });
  }

  function excluirEndereco(endereco: Endereco) {
    Alert.alert(
      'Excluir endereço',
      `Deseja excluir "${endereco.apelido || 'Endereço'}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiFetch(
                `/enderecos/${endereco.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Bypass-Tunnel-Reminder': 'true',
                  },
                }
              );

              if (!response.ok) {
                throw new Error(
                  'Não foi possível excluir o endereço.'
                );
              }

              await carregarEnderecos();

              Alert.alert(
                'Sucesso',
                'Endereço excluído.'
              );
            } catch (error) {
              Alert.alert(
                'Erro',
                error instanceof Error
                  ? error.message
                  : 'Falha de conexão.'
              );
            }
          },
        },
      ]
    );
  }

  if (loading && enderecos.length === 0) {
    return (
      <View
        style={[
          globalStyles.container,
          styles.center,
        ]}
      >
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      <View
        style={[
          styles.header,
          {
            paddingTop:
              insets.top + theme.spacing.xs,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.text}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Meus Endereços
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={styles.loading}
          />
        )}

        {enderecos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="location-outline"
              size={36}
              color={theme.colors.textLight}
            />

            <Text style={styles.emptyText}>
              Nenhum endereço cadastrado.
            </Text>
          </View>
        ) : (
          enderecos.map((endereco) => (
            <View
              key={endereco.id}
              style={styles.addressCard}
            >
              <View style={styles.addressInfo}>
                <Text style={styles.addressTitle}>
                  {endereco.apelido || 'Endereço'}
                </Text>

                <Text style={styles.addressSubtext}>
                  {endereco.rua}
                  {endereco.numero
                    ? `, ${endereco.numero}`
                    : ''}
                  {endereco.bairro
                    ? ` - ${endereco.bairro}`
                    : ''}
                </Text>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  onPress={() =>
                    editarEndereco(endereco)
                  }
                  style={styles.actionButton}
                  accessibilityLabel="Editar endereço"
                >
                  <Ionicons
                    name="pencil-outline"
                    size={21}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    excluirEndereco(endereco)
                  }
                  style={styles.actionButton}
                  accessibilityLabel="Excluir endereço"
                >
                  <Ionicons
                    name="trash-outline"
                    size={21}
                    color={theme.colors.danger}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity
          style={styles.buttonAdd}
          onPress={() =>
            router.push('/cadastro-endereco')
          }
        >
          <Ionicons
            name="add"
            size={22}
            color={theme.colors.surface}
          />

          <Text style={styles.buttonText}>
            Adicionar Novo Endereço
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  backButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.sm,
  },

  headerTitle: {
    fontSize: theme.typography.size.large,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
  },

  content: {
    padding: theme.spacing.lg,
  },

  loading: {
    marginBottom: theme.spacing.md,
  },

  emptyContainer: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.xl,
  },

  emptyText: {
    color: theme.colors.textLight,
    fontSize: theme.typography.size.regular,
  },

  addressCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  addressInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },

  addressTitle: {
    color: theme.colors.text,
    fontWeight: theme.typography.weight.bold,
    fontSize: theme.typography.size.regular,
    marginBottom: theme.spacing.xs,
  },

  addressSubtext: {
    color: theme.colors.textLight,
    fontSize: theme.typography.size.small,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },

  actionButton: {
    padding: theme.spacing.sm,
  },

  buttonAdd: {
    height: 54,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },

  buttonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.size.regular,
    fontWeight: theme.typography.weight.bold,
  },
});
