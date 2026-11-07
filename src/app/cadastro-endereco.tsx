
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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

export default function CadastroEndereco() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [endereco, setEndereco] =
    useState<EnderecoEncontrado | null>(null);

  const [modal, setModal] = useState(false);
  const [apelido, setApelido] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!endereco || !apelido.trim()) {
      Alert.alert(
        'Atenção',
        'Selecione um endereço e informe o nome do local.'
      );
      return;
    }

    setSalvando(true);

    try {
      const userId = await AsyncStorage.getItem('userId');

      if (!userId) {
        throw new Error(
          'Usuário não identificado. Entre novamente.'
        );
      }

      const payload = {
        apelido: apelido.trim(),
        rua: endereco.rua || endereco.nome,
        numero: endereco.numero || 'S/N',
        bairro: endereco.bairro || '',
        latitude: endereco.latitude,
        longitude: endereco.longitude,
      };

      const response = await apiFetch(
        `/enderecos/usuario/${userId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const mensagem = await response.text();

        throw new Error(
          mensagem || `Erro HTTP ${response.status}`
        );
      }

      await AsyncStorage.setItem(
        'userEndereco',
        endereco.nome
      );

      setModal(false);

      Alert.alert(
        'Sucesso',
        'Endereço cadastrado!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e) {
      Alert.alert(
        'Erro',
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
          Cadastrar endereço
        </Text>
      </View>

      <EnderecoMapaPicker
        tipo="endereco"
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
            !endereco && styles.inativo,
          ]}
          disabled={!endereco}
          onPress={() => setModal(true)}
        >
          <Text style={styles.botaoTexto}>
            Confirmar endereço
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!salvando) setModal(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.fundoModal}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <View style={styles.modal}>
            <Text style={styles.titulo}>
              Salvar endereço
            </Text>

            <Text style={styles.descricao}>
              Dê um nome para identificar o local.
              Exemplo: Casa, Trabalho ou Faculdade.
            </Text>

            <TextInput
              style={styles.input}
              value={apelido}
              onChangeText={setApelido}
              maxLength={30}
              placeholder="Nome do local"
              placeholderTextColor={
                theme.colors.map.textLight
              }
              editable={!salvando}
            />

            <View style={styles.botoesModal}>
              <TouchableOpacity
                style={[
                  styles.botaoSecundario,
                  styles.botaoModal,
                ]}
                disabled={salvando}
                onPress={() => setModal(false)}
              >
                <Text style={styles.textoSecundario}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.botao,
                  styles.botaoModal,
                  (!apelido.trim() || salvando) &&
                    styles.inativo,
                ]}
                disabled={!apelido.trim() || salvando}
                onPress={salvar}
              >
                {salvando ? (
                  <ActivityIndicator
                    color={theme.colors.map.text}
                  />
                ) : (
                  <Text style={styles.botaoTexto}>
                    Salvar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.map.text,
  },

  rodape: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.map.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.map.border,
  },

  botao: {
    height: 52,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoTexto: {
    color: theme.colors.map.text,
    fontWeight: theme.typography.weight.bold,
    fontSize: theme.typography.size.regular,
  },

  inativo: {
    opacity: 0.45,
  },

  fundoModal: {
    flex: 1,
    backgroundColor: theme.colors.map.overlay,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },

  modal: {
    backgroundColor: theme.colors.map.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },

  descricao: {
    color: theme.colors.map.textLight,
    fontSize: theme.typography.size.regular,
  },

  input: {
    height: 50,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.map.border,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.map.text,
    backgroundColor: theme.colors.map.input,
    fontSize: theme.typography.size.regular,
  },

  botoesModal: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },

  botaoModal: {
    flex: 1,
  },

  botaoSecundario: {
    borderWidth: 1,
    borderColor: theme.colors.map.border,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.lg,
  },

  textoSecundario: {
    color: theme.colors.map.text,
    fontWeight: theme.typography.weight.bold,
  },
});
