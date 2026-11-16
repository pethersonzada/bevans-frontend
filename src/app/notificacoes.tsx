import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { useNotificacoesRevision } from '../hooks/useNotificacoesRevision';
import { localizarNotificacao, listarNotificacoes, lerNotificacao, destinoAutorizadoNotificacao, mensagemErroNotificacao, type Notificacao } from '../services/notificacoes';
import { AsyncState } from '../components/AsyncState';
import { theme } from '../styles/theme';
import { Screen, Section, ActionButton, IconButton, Pagination, ui } from '../components/ui/Primitives';

export default function Notificacoes() {
    const { notificacaoId } = useLocalSearchParams<{ notificacaoId?: string }>();
    const { user } = useAuth();
    return <Central key={user.id} motorista={user.tipo === 'MOTORISTA'} notificacaoId={notificacaoId} />;
}
const contextos: Record<string, string> = { VIAGEM: 'Viagem', EXCURSAO: 'Excursão', EXECUCAO_EXCURSAO: 'Viagem de excursão', ROTA_PUBLICA: 'Rota pública', TURMA: 'Turma', EMBARQUE: 'Pedido de embarque', SOLICITACAO_VAGA: 'Solicitação de vaga' };
export function Central({ motorista, notificacaoId }: { motorista: boolean; notificacaoId?: string }) {
    const connection=useNetInfo();
    const offline=connection.isConnected===false||connection.isInternetReachable===false;
    const router = useRouter(), revision = useNotificacoesRevision();
    const [page, setPage] = useState(0), [feedback, setFeedback] = useState(''), [busy, setBusy] = useState(false);
    const pending = useRef(false), mounted = useRef(true), opened = useRef('');
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const avisos = useRemoteResource(`notificacoes:${page}:${revision}`, async signal => {
        try { return await listarNotificacoes(page, signal); } catch (e) { throw new Error(mensagemErroNotificacao(e)); }
    });

    const destino = useRemoteResource(notificacaoId ? `push:${notificacaoId}` : false, async signal => {
        try { return await localizarNotificacao(notificacaoId!, signal); } catch (e) { throw new Error(mensagemErroNotificacao(e)); }
    });
    const run = async (task: () => Promise<void>) => {
        if (pending.current) return;
        pending.current = true; setBusy(true); setFeedback('');
        try { await task(); } catch (e) { if (mounted.current) setFeedback(mensagemErroNotificacao(e)); }
        finally { pending.current = false; if (mounted.current) { avisos.reload(); setBusy(false); } }
    };
    const open = (n: Notificacao) => void run(async () => {
        const target = await destinoAutorizadoNotificacao(n, motorista);
        if (!mounted.current) return;
        await lerNotificacao(n.id);
        if (mounted.current) router.push(target);
    });
    useEffect(() => {
        if (destino.data && notificacaoId && opened.current !== notificacaoId && !pending.current) { opened.current = notificacaoId; open(destino.data); }
    }, [destino.data, notificacaoId]);
    const button = (title: string, action: () => void, disabled = false) => <ActionButton title={title} onPress={action} disabled={disabled || busy || offline} />;
    return <Screen title="Notificações" subtitle="Avisos e atualizações das suas viagens." onBack={() => router.back()} action={<IconButton icon="settings-outline" label="Configurações de notificações" onPress={() => router.push('/configuracoes-notificacoes')} />}>
        {offline&&<Text accessibilityLiveRegion="polite">Sem conexão. Informações anteriores podem estar desatualizadas; a central será atualizada ao reconectar.</Text>}
        <Text accessibilityLiveRegion="polite">{feedback}</Text>
        {notificacaoId && (destino.error ? <AsyncState message={destino.error} onRetry={destino.reload} /> : destino.data ? button(`Abrir aviso: ${destino.data.titulo}`, () => open(destino.data!)) : offline?<Text style={ui.body}>Reconecte para consultar o destino deste aviso com segurança.</Text>:<AsyncState loading title="Localizando seu aviso" />)}
        {avisos.error ? <AsyncState message={avisos.error} onRetry={avisos.reload} /> : !avisos.data ? offline?<Section title="Seu histórico"><Text style={ui.body}>Reconecte para carregar seu histórico de notificações.</Text></Section>:<AsyncState loading /> : <>
            {!avisos.data.itens.length && <AsyncState status="empty" title="Nenhuma notificação" />}
            {avisos.data.itens.map(n => <View key={n.id} style={[ui.section, !n.lidaEm && { borderLeftWidth: 4, borderLeftColor: theme.colors.primary }]}>
                <Text style={ui.body}>{n.lidaEm ? 'Lida' : 'Não lida'} · {contextos[n.contextoTipo] || 'Aviso'}</Text><Text accessibilityRole="header" style={{ fontWeight: '700' }}>{n.titulo}</Text><Text style={ui.body}>{n.mensagem}</Text>
                <Text style={ui.body}>{new Date(n.criadaEm).toLocaleString('pt-BR')}</Text>
                {button('Abrir aviso', () => open(n))}{!n.lidaEm && button('Marcar como lida', () => void run(() => lerNotificacao(n.id)))}
            </View>)}
            <Pagination page={page} pages={avisos.data.totalPaginas} onChange={setPage} disabled={busy||offline}/>
        </>}
    </Screen>;
}