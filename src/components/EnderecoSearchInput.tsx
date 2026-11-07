
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
  localizarNumero,
  pesquisarEnderecos,
} from '../services/enderecoSearch';

import { theme } from '../styles/theme';

type Props = {
  onSelecionar: (endereco: EnderecoEncontrado | null) => void;
  placeholder?: string;
};

export default function EnderecoSearchInput({
  onSelecionar,
  placeholder = 'Rua, número ou nome do local',
}: Props) {
  const [texto, setTexto] = useState('');
  const [numero, setNumero] = useState('');
  const [resultados, setResultados] =
    useState<EnderecoEncontrado[]>([]);
  const [base, setBase] =
    useState<EnderecoEncontrado | null>(null);

  const [selecionado, setSelecionado] =
    useState<EnderecoEncontrado | null>(null);

  const [buscando, setBuscando] = useState(false);
  const [resolvendo, setResolvendo] = useState(false);
  const [erro, setErro] = useState('');

  const requisicaoId = useRef(0);

  useEffect(() => {
    if (base) return;

    const termo = texto.trim();

    if (termo.length < 3) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setBuscando(true);
      setErro('');

      try {
        const itens = await pesquisarEnderecos(
          termo,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setResultados(itens);

          if (!itens.length) {
            setErro(
              'Nenhum resultado. Tente incluir a cidade.'
            );
          }
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
  }, [texto, base]);

  function alterarTexto(valor: string) {
    requisicaoId.current++;

    setTexto(valor);
    setNumero('');
    setBase(null);
    setSelecionado(null);
    setResultados([]);
    setErro('');

    onSelecionar(null);
  }

  function alterarNumero(valor: string) {
    requisicaoId.current++;

    setNumero(valor);
    setSelecionado(null);
    setErro('');

    onSelecionar(null);
  }

  function selecionarResultado(item: EnderecoEncontrado) {
    requisicaoId.current++;

    setBase(item);
    setTexto(item.nome);
    setNumero(item.numero === 'S/N' ? '' : item.numero || '');
    setResultados([]);
    setErro('');

    const pronto =
      item.tipo === 'estabelecimento' ||
      (!!item.numero && item.numero !== 'S/N');

    if (pronto) {
      setSelecionado(item);
      onSelecionar(item);
    } else {
      setSelecionado(null);
      onSelecionar(null);
    }
  }

  async function confirmarNumero() {
    if (!base) {
      setErro('Selecione uma rua nas sugestões.');
      return;
    }

    if (!numero.trim()) {
      setErro('Informe o número do imóvel.');
      return;
    }

    const id = ++requisicaoId.current;

    setResolvendo(true);
    setSelecionado(null);
    setErro('');
    onSelecionar(null);

    try {
      const encontrado = await localizarNumero(
        base,
        numero
      );

      if (id !== requisicaoId.current) return;

      setSelecionado(encontrado);
      onSelecionar(encontrado);
    } catch (e) {
      if (id === requisicaoId.current) {
        setErro(
          e instanceof Error
            ? e.message
            : 'Número não localizado.'
        );
      }
    } finally {
      if (id === requisicaoId.current) {
        setResolvendo(false);
      }
    }
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
            color={theme.colors.primary}
            size="small"
          />
        )}

        {!!texto && (
          <TouchableOpacity
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

      {base && base.tipo !== 'estabelecimento' && (
        <View style={styles.numeroLinha}>
          <View style={styles.numeroCampo}>
            <Text style={styles.label}>
              Número do imóvel
            </Text>

            <TextInput
              style={styles.inputNumero}
              value={numero}
              onChangeText={alterarNumero}
              placeholder="Ex: 22"
              placeholderTextColor={
                theme.colors.map.textLight
              }
              autoCapitalize="characters"
              maxLength={16}
              editable={!resolvendo}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.buscarNumero,
              resolvendo && styles.desativado,
            ]}
            disabled={resolvendo}
            onPress={confirmarNumero}
          >
            {resolvendo ? (
              <ActivityIndicator
                color={theme.colors.map.text}
              />
            ) : (
              <Text style={styles.botaoTexto}>
                Localizar
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {selecionado && (
        <View style={styles.confirmacao}>
          <Ionicons
            name="checkmark-circle"
            size={17}
            color={theme.colors.success}
          />
          <Text style={styles.confirmacaoTexto}>
            Localização selecionada
          </Text>
        </View>
      )}

      {!!erro && <Text style={styles.erro}>{erro}</Text>}
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

  numeroLinha: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },

  numeroCampo: {
    flex: 1,
  },

  label: {
    color: theme.colors.map.textLight,
    fontSize: theme.typography.size.small,
    marginBottom: theme.spacing.xs,
  },

  inputNumero: {
    minHeight: 45,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.map.border,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.map.text,
    backgroundColor: theme.colors.map.input,
    fontSize: theme.typography.size.regular,
  },

  buscarNumero: {
    height: 45,
    minWidth: 95,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
  },

  botaoTexto: {
    color: theme.colors.map.text,
    fontWeight: theme.typography.weight.bold,
  },

  desativado: {
    opacity: 0.45,
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
