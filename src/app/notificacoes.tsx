import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AsyncState } from '../components/AsyncState';
import { PedidosNaCentral } from '../components/PedidosNaCentral';
import {
    ActionButton,
    IconButton,
    Pagination,
    Screen,
    ui,
} from '../components/ui/Primitives';

import { useAuth } from '../contexts/AuthContext';
import { useNotificacoesRevision } from '../hooks/useNotificacoesRevision';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { useThemeRevision } from '../hooks/useThemeRevision';

import {
    contarNaoLidas,
    destinoAutorizadoNotificacao,
    lerNotificacao,
    listarNotificacoes,
    localizarNotificacao,
    mensagemErroNotificacao,
    tituloEvento,
    type Notificacao,
} from '../services/notificacoes';

import { theme } from '../styles/theme';
import { themedStyles } from '../styles/themedStyles';

type Aba = 'avisos' | 'pedidos';

const contextos: Record<string, string> = {
    VIAGEM: 'Viagem',
    EXCURSAO: 'Excursão',
    EXECUCAO_EXCURSAO: 'Viagem de excursão',
    ROTA_PUBLICA: 'Rota pública',
    TURMA: 'Turma',
    EMBARQUE: 'Embarque',
    SOLICITACAO_VAGA: 'Entrada na turma',
};

const contextoPedido = (n: Notificacao) =>
    n.contextoTipo === 'SOLICITACAO_VAGA' ||
    n.contextoTipo === 'EMBARQUE';

function dataAviso(value: string) {
    const data = new Date(value);

    const hora = data.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });

    if (data.toDateString() === new Date().toDateString()) {
        return `Hoje, ${hora}`;
    }

    return `${data.toLocaleDateString('pt-BR')}, ${hora}`;
}

export default function Notificacoes() {
    useThemeRevision();

    const { notificacaoId, aba } = useLocalSearchParams<{
        notificacaoId?: string;
        aba?: string;
    }>();

    const { user } = useAuth();

    return (
        <Central
            key={user.id}
            usuarioId={user.id || undefined}
            motorista={user.tipo === 'MOTORISTA'}
            notificacaoId={notificacaoId}
            abaInicial={aba === 'pedidos' ? 'pedidos' : 'avisos'}
        />
    );
}

export function Central({
    motorista,
    notificacaoId,
    usuarioId,
    abaInicial = 'avisos',
}: {
    motorista: boolean;
    notificacaoId?: string;
    usuarioId?: string;
    abaInicial?: Aba;
}) {
    useThemeRevision();

    const connection = useNetInfo();

    const offline =
        connection.isConnected === false ||
        connection.isInternetReachable === false;

    const router = useRouter();
    const revision = useNotificacoesRevision();

    const [aba, setAba] = useState<Aba>(abaInicial);

    const [foco, setFoco] = useState<{
        contexto: string;
        id: string;
    } | null>(null);

    const [page, setPage] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [busy, setBusy] = useState(false);
    const [expanded, setExpanded] = useState<number | null>(null);

    const pending = useRef(false);
    const mounted = useRef(true);
    const opened = useRef('');

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (motorista) {
            setAba(abaInicial);
        }
    }, [abaInicial, motorista]);

    const avisos = useRemoteResource(
        `notificacoes:${page}:${revision}`,
        async signal => {
            try {
                return await listarNotificacoes(page, signal);
            } catch (e) {
                throw new Error(mensagemErroNotificacao(e));
            }
        }
    );

    const naoLidas = useRemoteResource(
        `central:nao-lidas:${revision}`,
        contarNaoLidas
    );

    const destino = useRemoteResource(
        notificacaoId ? `push:${notificacaoId}` : false,
        async signal => {
            try {
                return await localizarNotificacao(
                    notificacaoId!,
                    signal
                );
            } catch (e) {
                throw new Error(mensagemErroNotificacao(e));
            }
        }
    );

    const run = async (task: () => Promise<void>) => {
        if (pending.current || offline) return;

        pending.current = true;
        setBusy(true);
        setFeedback('');

        try {
            await task();
        } catch (e) {
            if (mounted.current) {
                setFeedback(mensagemErroNotificacao(e));
            }
        } finally {
            pending.current = false;

            if (mounted.current) {
                avisos.reload();
                naoLidas.reload();
                setBusy(false);
            }
        }
    };

    const open = (n: Notificacao) =>
        void run(async () => {
            const target = await destinoAutorizadoNotificacao(
                n,
                motorista,
                usuarioId
            );

            if (!mounted.current) return;

            if (!n.lidaEm) {
                await lerNotificacao(n.id);
            }

            if (!mounted.current) return;

            if (motorista && contextoPedido(n)) {
                setFoco({
                    contexto: n.contextoTipo,
                    id: String(n.contextoId),
                });

                setAba('pedidos');
            } else {
                router.push(target);
            }
        });

    useEffect(() => {
        if (
            !offline &&
            destino.data &&
            notificacaoId &&
            opened.current !== notificacaoId &&
            !pending.current
        ) {
            opened.current = notificacaoId;
            open(destino.data);
        }
    }, [destino.data, notificacaoId, offline, busy]);

    const read = (n: Notificacao) => {
        setExpanded(v => (v === n.id ? null : n.id));

        if (!n.lidaEm && !offline) {
            void run(() => lerNotificacao(n.id));
        }
    };

    const refresh = () => {
        avisos.reload();
        naoLidas.reload();
    };

    return (
        <Screen
            title="Notificações"
            onBack={() => router.back()}
            action={
                <IconButton
                    icon="settings-outline"
                    label="Configurações de notificações"
                    onPress={() =>
                        router.push('/configuracoes-notificacoes')
                    }
                />
            }
        >
            {offline && (
                <Text
                    style={ui.body}
                    accessibilityLiveRegion="polite"
                >
                    Sem conexão. Reconecte para atualizar seus
                    avisos e solicitações.
                </Text>
            )}

            {motorista && (
                <View style={styles.tabs}>
                    {(['avisos', 'pedidos'] as const).map(a => (
                        <Pressable
                            key={a}
                            accessibilityRole="tab"
                            accessibilityState={{
                                selected: aba === a,
                            }}
                            onPress={() => {
                                setFeedback('');
                                setAba(a);
                            }}
                            style={[
                                styles.tab,
                                aba === a && styles.activeTab,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    aba === a && styles.activeText,
                                ]}
                            >
                                {a === 'avisos'
                                    ? 'Avisos'
                                    : 'Solicitações'}
                            </Text>

                            {a === 'avisos' && !!naoLidas.data && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {naoLidas.data > 99
                                            ? '99+'
                                            : naoLidas.data}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    ))}
                </View>
            )}

            {!!feedback && (
                <Text
                    style={styles.error}
                    accessibilityLiveRegion="polite"
                >
                    {feedback}
                </Text>
            )}

            {notificacaoId && destino.error && (
                <AsyncState
                    message={destino.error}
                    onRetry={destino.reload}
                />
            )}

            {notificacaoId &&
                !destino.data &&
                !destino.error &&
                !offline && (
                    <AsyncState
                        loading
                        title="Localizando seu aviso"
                    />
                )}

            {notificacaoId && destino.data && !!feedback && (
                <ActionButton
                    title="Tentar abrir aviso novamente"
                    onPress={() => open(destino.data!)}
                    disabled={busy || offline}
                />
            )}

            {motorista && aba === 'pedidos' ? (
                <PedidosNaCentral
                    usuarioId={usuarioId}
                    foco={foco}
                    offline={offline}
                    revision={revision}
                />
            ) : (
                <>
                    <View style={styles.toolbar}>
                        <Text style={ui.caption}>
                            {naoLidas.error
                                ? 'Contagem indisponível'
                                : naoLidas.data == null
                                  ? 'Atualizando avisos'
                                  : `${naoLidas.data} não lida${
                                        naoLidas.data === 1 ? '' : 's'
                                    }`}
                        </Text>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Atualizar notificações"
                            disabled={offline || busy}
                            onPress={refresh}
                            style={styles.refresh}
                        >
                            <Ionicons
                                name="refresh-outline"
                                size={21}
                                color={theme.colors.primary}
                            />

                            <Text style={styles.link}>
                                Atualizar
                            </Text>
                        </Pressable>
                    </View>

                    {avisos.error ? (
                        <AsyncState
                            message={avisos.error}
                            onRetry={refresh}
                        />
                    ) : !avisos.data ? (
                        offline ? (
                            <Text style={ui.body}>
                                Reconecte para carregar seu histórico
                                de notificações.
                            </Text>
                        ) : (
                            <AsyncState loading />
                        )
                    ) : (
                        <>
                            {!avisos.data.itens.length && (
                                <AsyncState
                                    status="empty"
                                    title="Nenhum aviso por enquanto"
                                    message="As atualizações das suas viagens e solicitações aparecerão aqui."
                                />
                            )}

                            {avisos.data.itens.map(n => (
                                <View
                                    key={n.id}
                                    style={styles.notice}
                                >
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`${tituloEvento(n)}, ${
                                            n.lidaEm
                                                ? 'lida'
                                                : 'não lida'
                                        }`}
                                        accessibilityState={{
                                            expanded: expanded === n.id,
                                        }}
                                        onPress={() => read(n)}
                                        style={styles.row}
                                    >
                                        <View
                                            style={[
                                                styles.icon,
                                                !n.lidaEm &&
                                                    styles.unreadIcon,
                                            ]}
                                        >
                                            <Ionicons
                                                name={
                                                    contextoPedido(n)
                                                        ? 'person-add-outline'
                                                        : n.contextoTipo ===
                                                            'VIAGEM'
                                                          ? 'bus-outline'
                                                          : 'notifications-outline'
                                                }
                                                size={23}
                                                color={theme.colors.primary}
                                            />
                                        </View>

                                        <View style={styles.copy}>
                                            <Text style={styles.meta}>
                                                {contextos[
                                                    n.contextoTipo
                                                ] || 'Aviso'}{' '}
                                                · {dataAviso(n.criadaEm)}
                                            </Text>

                                            <Text style={styles.title}>
                                                {tituloEvento(n)}
                                            </Text>

                                            <Text
                                                numberOfLines={
                                                    expanded === n.id
                                                        ? undefined
                                                        : 2
                                                }
                                                style={styles.message}
                                            >
                                                {n.mensagem}
                                            </Text>
                                        </View>

                                        {!n.lidaEm && (
                                            <View style={styles.dot} />
                                        )}
                                    </Pressable>

                                    {expanded === n.id && (
                                        <View style={styles.details}>
                                            <ActionButton
                                                title={
                                                    motorista &&
                                                    contextoPedido(n)
                                                        ? 'Ver solicitações'
                                                        : 'Abrir detalhes'
                                                }
                                                onPress={() => open(n)}
                                                disabled={offline || busy}
                                            />
                                        </View>
                                    )}
                                </View>
                            ))}

                            <Pagination
                                page={page}
                                pages={avisos.data.totalPaginas}
                                onChange={v => {
                                    setExpanded(null);
                                    setPage(v);
                                }}
                                disabled={busy || offline}
                            />
                        </>
                    )}
                </>
            )}
        </Screen>
    );
}

const styles = themedStyles(() =>
    StyleSheet.create({
        tabs: {
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },

        tab: {
            flex: 1,
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 50,
            borderBottomWidth: 3,
            borderBottomColor: 'transparent',
            paddingHorizontal: 4,
        },

        activeTab: {
            borderBottomColor: theme.colors.primary,
        },

        tabText: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.textLight,
        },

        activeText: {
            color: theme.colors.primary,
            fontWeight: '700',
        },

        badge: {
            backgroundColor: theme.colors.primary,
            borderRadius: 12,
            paddingHorizontal: 6,
            minWidth: 22,
            alignItems: 'center',
        },

        badgeText: {
            color: theme.colors.surface,
            fontSize: 12,
            fontWeight: '700',
        },

        toolbar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
        },

        refresh: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
        },

        link: {
            fontWeight: '600',
            color: theme.colors.primary,
        },

        notice: {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
        },

        row: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            paddingBottom: 16,
        },

        icon: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },

        unreadIcon: {
            backgroundColor: theme.colors.subtle,
        },

        copy: {
            flex: 1,
            minWidth: 0,
            gap: 5,
        },

        meta: {
            color: theme.colors.textLight,
            fontSize: 12,
        },

        title: {
            color: theme.colors.text,
            fontSize: 16,
            fontWeight: '700',
        },

        message: {
            color: theme.colors.textLight,
            fontSize: 14,
            lineHeight: 20,
        },

        dot: {
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: theme.colors.primary,
            marginTop: 8,
        },

        details: {
            marginLeft: 56,
            paddingBottom: 12,
        },

        error: {
            color: theme.colors.danger,
            fontSize: 14,
        },
    })
);