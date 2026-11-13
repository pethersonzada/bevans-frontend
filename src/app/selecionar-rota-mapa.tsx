import { useAppAlert } from '../contexts/AppAlertContext';

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  
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

import { errorMessage } from '../config/api';
import { buscarTurmaMotorista, salvarPontoTurma } from '../services/turmas';
import { useAuth } from '../contexts/AuthContext';
import { AsyncState } from '../components/AsyncState';
import { theme } from '../styles/theme';

export default function SelecionarRotaMapa() {
    const Alert = useAppAlert();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const operacao = useRef(false);
  const montada = useRef(true);
  const [pontoSalvo, setPontoSalvo] = useState<{ latitude: number | null | undefined; longitude: number | null | undefined } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const insets = useSafeAreaInsets();

  const { turmaId, tipo } = useLocalSearchParams<{
    turmaId: string;
    tipo: 'ORIGEM' | 'DESTINO';
  }>();

  const [endereco, setEndereco] =
    useState<EnderecoEncontrado | null>(null);

  const [salvando, setSalvando] = useState(false);

  const origem = tipo === 'ORIGEM';
  const contexto = user.id + ':' + turmaId + ':' + tipo;
  const contextoAtual = useRef(contexto);
  contextoAtual.current = contexto;

  useEffect(() => { montada.current = true; return () => { montada.current = false; }; }, []);
  useEffect(() => {
    if (isLoading) return;
    let ativo = true;
    setCarregando(true);
    setErroCarga('');
    setEndereco(null);
    setPontoSalvo(null);
    if (!user.id || user.tipo !== 'MOTORISTA' || !['ORIGEM', 'DESTINO'].includes(tipo)) {
      setErroCarga('Sessão ou ponto de rota inválido.');
      setCarregando(false);
      return;
    }
    buscarTurmaMotorista(user.id, turmaId).then(turma => {
      if (!ativo) return;
      setPontoSalvo(origem ? { latitude: turma.origemLatitude, longitude: turma.origemLongitude }
        : { latitude: turma.destinoLatitude, longitude: turma.destinoLongitude });
    }).catch(erro => { if (ativo) setErroCarga(errorMessage(erro)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [isLoading, user.id, user.tipo, turmaId, tipo, origem, tentativa]);

  async function confirmar() {
    if (operacao.current || carregando || isLoading || erroCarga || !user.id || user.tipo !== 'MOTORISTA') return;
    if (
      !endereco ||
      !turmaId ||
      !['ORIGEM', 'DESTINO'].includes(tipo)
    ) {
      Alert.alert(
        'Atenção',
        'Selecione ou marque um ponto válido no mapa.'
      );
      return;
    }

    const contextoPedido = contexto;
    operacao.current = true;
    setSalvando(true);

    try {
      await salvarPontoTurma(user.id, turmaId, tipo, endereco);
      if (!montada.current || contextoAtual.current !== contextoPedido) return;

      Alert.alert(
        'Sucesso',
        `${origem ? 'Origem' : 'Destino'} atualizado!`,
        [
          {
            text: 'OK',
            onPress: () => { if (montada.current && contextoAtual.current === contextoPedido) router.back(); },
          },
        ]
      );
    } catch (e) {
      if (!montada.current || contextoAtual.current !== contextoPedido) return;
      Alert.alert(
        'Erro ao salvar',
        e instanceof Error
          ? e.message
          : 'Falha de conexão.'
      );
    } finally {
      operacao.current = false;
      if (montada.current) setSalvando(false);
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

      {carregando || isLoading ? <AsyncState loading title="Carregando ponto salvo..." /> : erroCarga ?
        <AsyncState title="Não foi possível abrir o mapa" message={erroCarga} onRetry={() => setTentativa(value => value + 1)} /> :
        <EnderecoMapaPicker key={turmaId + tipo} tipo={origem ? 'origem' : 'destino'} localizacaoInicial={pontoSalvo} onChange={setEndereco} />}

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
          disabled={!endereco || salvando || carregando || !!erroCarga || isLoading}
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
