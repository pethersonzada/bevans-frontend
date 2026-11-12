
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { theme } from '../../styles/theme';

export type EnderecoPresenca = {
    id: number;
    apelido: string;
    rua: string;
    numero: string;
    bairro: string;
};

export type ConfirmacaoPresenca = {
    status: string;
    enderecoIda: EnderecoPresenca | null;
    enderecoVolta: EnderecoPresenca | null;
};

type Props = {
    confirmacao: ConfirmacaoPresenca | null;
    enderecos: EnderecoPresenca[];
    salvando?: boolean;
    onRegistrar: (
        status: string,
        enderecoIda?: number,
        enderecoVolta?: number
    ) => Promise<boolean>;
};

const OPCOES = [
    { key: 'IDA', label: 'Ida' },
    { key: 'VOLTA', label: 'Volta' },
    { key: 'AMBOS', label: 'Ambos' },
    { key: 'NAO_VOU', label: 'Não vou' },
];

const precisaIda = (status: string) =>
    status === 'IDA' || status === 'AMBOS';

const precisaVolta = (status: string) =>
    status === 'VOLTA' || status === 'AMBOS';

function nomeStatus(status: string) {
    return OPCOES.find(op => op.key === status)?.label
        ?? status;
}

function descricaoEndereco(endereco: EnderecoPresenca) {
    return `${endereco.rua}, ${endereco.numero} - ${endereco.bairro}`;
}

export function SeletorPresenca({
    confirmacao,
    enderecos,
    salvando = false,
    onRegistrar,
}: Props) {
    const [editando, setEditando] = useState(false);
    const [status, setStatus] = useState('');
    const [enderecoIda, setEnderecoIda] =
        useState<number | null>(null);
    const [enderecoVolta, setEnderecoVolta] =
        useState<number | null>(null);
    const [campoAberto, setCampoAberto] =
        useState<'ida' | 'volta' | null>(null);

    const statusSalvo = confirmacao?.status || '';
    const idaSalva = confirmacao?.enderecoIda?.id ?? null;
    const voltaSalva = confirmacao?.enderecoVolta?.id ?? null;

    useEffect(() => {
        // Polling may update the saved confirmation while a draft is open.
        if (editando) return;
        setStatus(statusSalvo);
        setEnderecoIda(idaSalva);
        setEnderecoVolta(voltaSalva);
        setCampoAberto(null);
    }, [statusSalvo, idaSalva, voltaSalva, editando]);

    const confirmado = Boolean(confirmacao?.status);
    const exibirFormulario = !confirmado || editando;

    const obterEndereco = (id: number | null) =>
        enderecos.find(e => e.id === id);

    const confirmar = async () => {
        if (!status) {
            Alert.alert('Atenção', 'Escolha uma opção.');
            return;
        }

        if (precisaIda(status) && !enderecoIda) {
            Alert.alert(
                'Atenção',
                'Selecione o endereço de embarque da ida.'
            );
            return;
        }

        if (precisaVolta(status) && !enderecoVolta) {
            Alert.alert(
                'Atenção',
                'Selecione o endereço de desembarque da volta.'
            );
            return;
        }

        const sucesso = await onRegistrar(
            status,
            precisaIda(status) ? enderecoIda! : undefined,
            precisaVolta(status) ? enderecoVolta! : undefined
        );

        if (sucesso) {
            setEditando(false);
            setCampoAberto(null);
        }
    };

    const renderEndereco = (
        sentido: 'ida' | 'volta',
        titulo: string,
        selecionadoId: number | null,
        selecionar: (id: number) => void
    ) => {
        const selecionado = obterEndereco(selecionadoId);
        const aberto = campoAberto === sentido;

        return (
            <View style={styles.enderecoGrupo}>
                <Text style={styles.label}>{titulo}</Text>

                <TouchableOpacity
                    style={styles.seletorEndereco}
                    onPress={() =>
                        setCampoAberto(aberto ? null : sentido)
                    }
                    disabled={salvando}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="location-outline"
                        size={19}
                        color={theme.colors.primary}
                    />

                    <View style={styles.enderecoTexto}>
                        <Text style={styles.apelido}>
                            {selecionado?.apelido ||
                                'Selecionar endereço'}
                        </Text>

                        {selecionado && (
                            <Text style={styles.detalhes}>
                                {descricaoEndereco(selecionado)}
                            </Text>
                        )}
                    </View>

                    <Ionicons
                        name={aberto
                            ? 'chevron-up'
                            : 'chevron-down'}
                        size={18}
                        color={theme.colors.textLight}
                    />
                </TouchableOpacity>

                {aberto && (
                    <View style={styles.lista}>
                        {enderecos.length === 0 ? (
                            <Text style={styles.aviso}>
                                Nenhum endereço cadastrado.
                            </Text>
                        ) : (
                            enderecos.map(endereco => (
                                <TouchableOpacity
                                    key={endereco.id}
                                    style={[
                                        styles.opcaoEndereco,
                                        selecionadoId === endereco.id &&
                                            styles.opcaoEnderecoAtiva,
                                    ]}
                                    onPress={() => {
                                        selecionar(endereco.id);
                                        setCampoAberto(null);
                                    }}
                                    disabled={salvando}
                                >
                                    <View style={styles.enderecoTexto}>
                                        <Text style={styles.apelido}>
                                            {endereco.apelido ||
                                                'Endereço'}
                                        </Text>
                                        <Text style={styles.detalhes}>
                                            {descricaoEndereco(endereco)}
                                        </Text>
                                    </View>

                                    {selecionadoId === endereco.id && (
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={20}
                                            color={theme.colors.primary}
                                        />
                                    )}
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.card}>
            <View style={styles.cabecalho}>
                <Text style={styles.titulo}>
                    Sua presença de hoje
                </Text>

                {confirmado && !editando && (
                    <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={theme.colors.success}
                    />
                )}
            </View>

            {!exibirFormulario ? (
                <>
                    <Text style={styles.statusConfirmado}>
                        {nomeStatus(confirmacao!.status)}
                    </Text>

                    {confirmacao?.enderecoIda && (
                        <View style={styles.resumo}>
                            <Text style={styles.label}>
                                Embarque na ida
                            </Text>
                            <Text style={styles.apelido}>
                                {confirmacao.enderecoIda.apelido}
                            </Text>
                            <Text style={styles.detalhes}>
                                {descricaoEndereco(
                                    confirmacao.enderecoIda
                                )}
                            </Text>
                        </View>
                    )}

                    {confirmacao?.enderecoVolta && (
                        <View style={styles.resumo}>
                            <Text style={styles.label}>
                                Desembarque na volta
                            </Text>
                            <Text style={styles.apelido}>
                                {confirmacao.enderecoVolta.apelido}
                            </Text>
                            <Text style={styles.detalhes}>
                                {descricaoEndereco(
                                    confirmacao.enderecoVolta
                                )}
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.botaoSecundario}
                        onPress={() => setEditando(true)}
                    >
                        <Text style={styles.textoSecundario}>
                            Alterar confirmação
                        </Text>
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <Text style={styles.descricao}>
                        Como você vai utilizar a van?
                    </Text>

                    <View style={styles.opcoes}>
                        {OPCOES.map(opcao => {
                            const ativo = status === opcao.key;

                            return (
                                <TouchableOpacity
                                    key={opcao.key}
                                    style={[
                                        styles.opcao,
                                        ativo && styles.opcaoAtiva,
                                    ]}
                                    onPress={() => {
                                        setEditando(true);
                                        setStatus(opcao.key);
                                        setCampoAberto(null);
                                    }}
                                    disabled={salvando}
                                >
                                    <Text style={[
                                        styles.textoOpcao,
                                        ativo && styles.textoOpcaoAtiva,
                                    ]}>
                                        {opcao.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {precisaIda(status) &&
                        renderEndereco(
                            'ida',
                            'Onde a van busca você?',
                            enderecoIda,
                            setEnderecoIda
                        )}

                    {precisaVolta(status) &&
                        renderEndereco(
                            'volta',
                            'Onde a van deixa você?',
                            enderecoVolta,
                            setEnderecoVolta
                        )}

                    <TouchableOpacity
                        style={[
                            styles.botaoConfirmar,
                            (!status || salvando) &&
                                styles.botaoDesabilitado,
                        ]}
                        onPress={confirmar}
                        disabled={!status || salvando}
                    >
                        {salvando ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.textoConfirmar}>
                                Salvar confirmação
                            </Text>
                        )}
                    </TouchableOpacity>

                    {confirmado && editando && (
                        <TouchableOpacity
                            style={styles.botaoCancelar}
                            onPress={() => setEditando(false)}
                            disabled={salvando}
                        >
                            <Text style={styles.textoSecundario}>
                                Cancelar
                            </Text>
                        </TouchableOpacity>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: theme.spacing.sm,
    },
    cabecalho: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titulo: {
        color: theme.colors.text,
        fontSize: theme.typography.size.large,
        fontWeight: '700',
    },
    descricao: {
        color: theme.colors.textLight,
        fontSize: theme.typography.size.small,
    },
    opcoes: {
        flexDirection: 'row',
        gap: 5,
        marginVertical: theme.spacing.sm,
    },
    opcao: {
        flex: 1,
        minHeight: 42,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    opcaoAtiva: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    textoOpcao: {
        color: theme.colors.text,
        fontSize: 12,
        fontWeight: '600',
    },
    textoOpcaoAtiva: {
        color: '#FFFFFF',
    },
    enderecoGrupo: {
        gap: 6,
        marginTop: theme.spacing.sm,
    },
    label: {
        color: theme.colors.textLight,
        fontSize: theme.typography.size.small,
        fontWeight: '600',
    },
    seletorEndereco: {
        minHeight: 58,
        padding: theme.spacing.sm,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.background,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    enderecoTexto: {
        flex: 1,
        gap: 3,
    },
    apelido: {
        color: theme.colors.text,
        fontSize: theme.typography.size.regular,
        fontWeight: '600',
    },
    detalhes: {
        color: theme.colors.textLight,
        fontSize: theme.typography.size.small,
    },
    lista: {
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
    },
    opcaoEndereco: {
        padding: theme.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
    },
    opcaoEnderecoAtiva: {
        backgroundColor: `${theme.colors.primary}12`,
    },
    aviso: {
        padding: theme.spacing.sm,
        color: theme.colors.danger,
    },
    statusConfirmado: {
        color: theme.colors.primary,
        fontSize: theme.typography.size.regular,
        fontWeight: '700',
    },
    resumo: {
        gap: 3,
        paddingVertical: theme.spacing.xs,
    },
    botaoConfirmar: {
        backgroundColor: theme.colors.primary,
        minHeight: 46,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: theme.spacing.sm,
    },
    botaoDesabilitado: {
        opacity: 0.5,
    },
    textoConfirmar: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    botaoSecundario: {
        alignSelf: 'flex-start',
        paddingVertical: theme.spacing.sm,
    },
    botaoCancelar: {
        alignSelf: 'center',
        padding: theme.spacing.sm,
    },
    textoSecundario: {
        color: theme.colors.primary,
        fontWeight: '600',
        fontSize: theme.typography.size.small,
    },
});
