import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../config/api';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { useThemeRevision } from '../hooks/useThemeRevision';
import { listarMinhasRotas } from '../services/rotasPublicas';
import {
    analisarVinculo,
    listarVinculosPendentes,
} from '../services/solicitacoes';
import { theme } from '../styles/theme';
import { themedStyles } from '../styles/themedStyles';
import { AsyncState } from './AsyncState';
import { PedidosRota } from './PedidosRota';
import { Choice, Notice, RemoteLoading, ui } from './ui/Primitives';

type Props = {
    usuarioId?: string;
    foco?: { contexto: string; id: string } | null;
    offline: boolean;
    revision: number;
};

export function PedidosNaCentral({
    usuarioId,
    foco,
    offline,
    revision,
}: Props) {
    useThemeRevision();

    const [busy, setBusy] = useState<number | null>(null);
    const [erro, setErro] = useState('');
    const [publicas, setPublicas] = useState(
        foco?.contexto === 'EMBARQUE'
    );

    const [rotaSelecionada, setRotaSelecionada] =
        useState<number | null>(null);

    const pending = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (foco?.contexto === 'EMBARQUE') {
            setPublicas(true);
        }
    }, [foco]);

    const vinculos = useRemoteResource(
        usuarioId ? `central:vinculos:${revision}` : false,
        signal => listarVinculosPendentes(usuarioId!, signal)
    );

    const rotas = useRemoteResource(
        usuarioId && publicas
            ? `central:rotas:${revision}`
            : false,
        () => listarMinhasRotas()
    );

    const analisar = async (
        id: number,
        status: 'APROVADO' | 'REJEITADO'
    ) => {
        if (pending.current || offline) return;

        pending.current = true;
        setBusy(id);
        setErro('');

        try {
            await analisarVinculo(id, status);

            if (mounted.current) {
                vinculos.reload();
            }
        } catch (e) {
            if (mounted.current) {
                setErro(errorMessage(e));
            }
        } finally {
            pending.current = false;

            if (mounted.current) {
                setBusy(null);
            }
        }
    };

    if (!usuarioId) {
        return (
            <Notice>
                Entre novamente para consultar suas solicitações.
            </Notice>
        );
    }

    const pedidos = [...(vinculos.data || [])].sort(
        (a, b) =>
            Number(
                String(b.id) === foco?.id &&
                foco?.contexto === 'SOLICITACAO_VAGA'
            ) -
            Number(
                String(a.id) === foco?.id &&
                foco?.contexto === 'SOLICITACAO_VAGA'
            )
    );

    return (
        <View style={styles.root}>
            <View style={styles.heading}>
                <Text
                    accessibilityRole="header"
                    style={styles.headingText}
                >
                    Entrada nas turmas
                </Text>

                <Text style={ui.caption}>
                    {vinculos.data
                        ? `${vinculos.data.length} pendente(s)`
                        : 'Consultando'}
                </Text>
            </View>

            {!!erro && <Notice>{erro}</Notice>}

            {vinculos.error ? (
                <AsyncState
                    message={vinculos.error}
                    onRetry={vinculos.reload}
                />
            ) : !vinculos.data ? (
                <RemoteLoading />
            ) : (
                <>
                    {!pedidos.length && (
                        <AsyncState
                            status="empty"
                            title="Nenhum pedido pendente"
                            message="Quando um passageiro pedir para entrar em uma turma, ele aparecerá aqui."
                        />
                    )}

                    {pedidos.map(p => (
                        <View
                            key={p.id}
                            style={[
                                styles.request,
                                foco?.contexto ===
                                    'SOLICITACAO_VAGA' &&
                                    String(p.id) === foco.id &&
                                    styles.focus,
                            ]}
                        >
                            <View style={styles.person}>
                                <View style={styles.avatar}>
                                    <Text style={styles.initial}>
                                        {p.aluno?.nome
                                            ?.trim()
                                            .charAt(0)
                                            .toUpperCase() || 'P'}
                                    </Text>
                                </View>

                                <View style={{ flex: 1, gap: 4 }}>
                                    <Text style={styles.name}>
                                        {p.aluno?.nome || 'Passageiro'}
                                    </Text>

                                    <Text style={ui.caption}>
                                        {p.turma.nome || 'Turma'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.actions}>
                                {(
                                    ['REJEITADO', 'APROVADO'] as const
                                ).map(status => (
                                    <Pressable
                                        key={status}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${
                                            status === 'APROVADO'
                                                ? 'Aprovar'
                                                : 'Recusar'
                                        } ${p.aluno?.nome || 'passageiro'}`}
                                        accessibilityState={{
                                            disabled:
                                                offline || busy !== null,
                                            busy: busy === p.id,
                                        }}
                                        disabled={
                                            offline || busy !== null
                                        }
                                        onPress={() =>
                                            void analisar(p.id, status)
                                        }
                                        style={[
                                            styles.action,
                                            status === 'APROVADO' &&
                                                styles.approve,
                                            (offline || busy !== null) && {
                                                opacity: 0.5,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.actionText,
                                                {
                                                    color:
                                                        status === 'APROVADO'
                                                            ? theme.colors.surface
                                                            : theme.colors.danger,
                                                },
                                            ]}
                                        >
                                            {status === 'APROVADO'
                                                ? 'Aprovar'
                                                : 'Recusar'}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    ))}
                </>
            )}

            <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: publicas }}
                onPress={() => setPublicas(v => !v)}
                style={styles.publicRow}
            >
                <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.headingText}>
                        Embarques em rotas públicas
                    </Text>

                    <Text style={ui.caption}>
                        Consultar por rota, data e sentido
                    </Text>
                </View>

                <Ionicons
                    name={publicas ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.colors.primary}
                />
            </Pressable>

            {publicas && (
                <>
                    {foco?.contexto === 'EMBARQUE' && (
                        <Text style={ui.caption}>
                            Selecione a rota, a data e o sentido do
                            pedido recebido.
                        </Text>
                    )}

                    {rotas.error ? (
                        <AsyncState
                            message={rotas.error}
                            onRetry={rotas.reload}
                        />
                    ) : !rotas.data ? (
                        <RemoteLoading />
                    ) : (
                        <>
                            {!rotas.data.length && (
                                <Text style={ui.caption}>
                                    Nenhuma rota pública cadastrada.
                                </Text>
                            )}

                            {rotas.data.map(r => (
                                <Choice
                                    key={r.id}
                                    label={r.nome}
                                    description={r.cidade}
                                    selected={rotaSelecionada === r.id}
                                    disabled={offline}
                                    onPress={() =>
                                        setRotaSelecionada(r.id)
                                    }
                                />
                            ))}

                            {rotaSelecionada !== null &&
                                rotas.data.some(
                                    r => r.id === rotaSelecionada
                                ) &&
                                !offline && (
                                    <PedidosRota
                                        key={rotaSelecionada}
                                        rotaId={rotaSelecionada}
                                    />
                                )}
                        </>
                    )}
                </>
            )}
        </View>
    );
}

const styles = themedStyles(() =>
    StyleSheet.create({
        root: {
            gap: 14,
        },

        heading: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
        },

        headingText: {
            color: theme.colors.text,
            fontWeight: '700',
            fontSize: 17,
        },

        request: {
            gap: 12,
            paddingVertical: 14,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
        },

        focus: {
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.primary,
            paddingLeft: 10,
        },

        person: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },

        avatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.subtle,
        },

        initial: {
            color: theme.colors.primary,
            fontSize: 17,
            fontWeight: '700',
        },

        name: {
            color: theme.colors.text,
            fontSize: 16,
            fontWeight: '700',
        },

        actions: {
            flexDirection: 'row',
            gap: 10,
            flexWrap: 'wrap',
        },

        action: {
            flex: 1,
            minWidth: 100,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: 8,
        },

        approve: {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
        },

        actionText: {
            fontSize: 15,
            fontWeight: '700',
        },

        publicRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 56,
            marginTop: 8,
            paddingVertical: 10,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
        },
    })
);