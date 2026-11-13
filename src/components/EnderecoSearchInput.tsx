
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type {
  EnderecoEncontrado,
} from '../services/enderecoSearch';
import {
  pesquisarEnderecos,
} from '../services/enderecoSearch';

import { theme } from '../styles/theme';
import { AsyncState } from './AsyncState';

type Props = {
  onSelecionar: (endereco: EnderecoEncontrado | null) => void;
  placeholder?: string;
};

export default function EnderecoSearchInput({
  onSelecionar,
  placeholder = 'Rua, número, bairro, cidade ou estabelecimento',
}: Props) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] =
    useState<EnderecoEncontrado[]>([]);
  const [base, setBase] =
    useState<EnderecoEncontrado | null>(null);

  const [selecionado, setSelecionado] =
    useState<EnderecoEncontrado | null>(null);

  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const [semResultados, setSemResultados] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const pesquisa = useRef<AbortController | null>(null);
  useEffect(() => {
    if (base) return;

    const termo = texto.trim();

    if (termo.length < 3) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    const controller = new AbortController();
    pesquisa.current = controller;

    const timer = setTimeout(async () => {
      setBuscando(true);
      setErro('');
      setSemResultados(false);

      try {
        const itens = await pesquisarEnderecos(
          termo,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setResultados(itens);

          setSemResultados(itens.length === 0);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao pesquisar endereço.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setBuscando(false);
        }
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [texto, base, tentativa]);

  function alterarTexto(valor: string) {
    pesquisa.current?.abort();
    setBuscando(false);
    setSemResultados(false);

    setTexto(valor);
    setBase(null);
    setSelecionado(null);
    setResultados([]);
    setErro('');

    onSelecionar(null);
  }

  function selecionarResultado(item: EnderecoEncontrado) {
    pesquisa.current?.abort();
    setBuscando(false);
    setSemResultados(false);

    setBase(item);
    setTexto(item.nome);
    setResultados([]);
    setErro('');

    // O picker recebe também resultados aproximados para centralizar o mapa.
    // Apenas o picker decide quando o ponto pode ser salvo.
    setSelecionado(item);
    onSelecionar(item);
  }

  return (
    <View style={styles.container}>
      <View style={styles.campoBusca}>
        <Ionicons
          name="search"
          size={20}
          color={theme.colors.map.textLight}
        />

        <TextInput
          accessibilityLabel="Pesquisar endereço ou estabelecimento"
          style={styles.inputBusca}
          value={texto}
          onChangeText={alterarTexto}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.map.textLight}
          autoCorrect={false}
          returnKeyType="search"
        />

        {buscando && (
          <ActivityIndicator
            accessibilityLabel="Pesquisando endereços"
            color={theme.colors.primary}
            size="small"
          />
        )}

        {!!texto && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Limpar endereço pesquisado"
            hitSlop={12}
            onPress={() => alterarTexto('')}
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={theme.colors.map.textLight}
            />
          </TouchableOpacity>
        )}
      </View>

      {resultados.length > 0 && (
        <View style={styles.lista}>
          {resultados.map((item) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={item.nome}
              key={item.id}
              style={styles.resultado}
              onPress={() => selecionarResultado(item)}
            >
              <Ionicons
                name={
                  item.tipo === 'estabelecimento'
                    ? 'business-outline'
                    : 'location-outline'
                }
                size={19}
                color={theme.colors.primary}
              />

              <Text style={styles.resultadoTexto}>
                {item.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {base?.tipo === 'estabelecimento' && (
        <Text style={styles.dica}>
          Local selecionado pelo nome. Confira o marcador
          no mapa antes de confirmar.
        </Text>
      )}

      {selecionado && (
        <View style={styles.confirmacao}>
          <Ionicons
            name="checkmark-circle"
            size={17}
            color={theme.colors.success}
          />
          <Text style={styles.confirmacaoTexto}>
            Resultado selecionado. Confira o ponto no mapa.
          </Text>
        </View>
      )}

      {semResultados && !buscando && <AsyncState appearance="map" status="empty" title="Nenhum endereço encontrado" message="Tente incluir o bairro ou a cidade na pesquisa." />}
      {!!erro && <AsyncState appearance="map" title="Confira o endereço" message={erro}
        onRetry={!base && texto.trim().length >= 3 ? () => setTentativa(value => value + 1) : undefined} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 20,
    backgroundColor: theme.colors.map.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.map.border,
  },

  campoBusca: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.map.input,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.map.border,
  },

  inputBusca: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.map.text,
    fontSize: theme.typography.size.regular,
  },

  lista: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.map.surface,
    borderWidth: 1,
    borderColor: theme.colors.map.border,
    borderRadius: theme.borderRadius.md,
    maxHeight: 220,
    overflow: 'hidden',
  },

  resultado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.map.border,
  },

  resultadoTexto: {
    color: theme.colors.map.text,
    fontSize: theme.typography.size.small,
    flex: 1,
  },

  erro: {
    color: theme.colors.danger,
    fontSize: theme.typography.size.small,
    marginTop: theme.spacing.sm,
  },

  dica: {
    color: theme.colors.map.textLight,
    fontSize: theme.typography.size.small,
    marginTop: theme.spacing.sm,
  },

  confirmacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },

  confirmacaoTexto: {
    fontSize: theme.typography.size.small,
    color: theme.colors.map.text,
  },
});
