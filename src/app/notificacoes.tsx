import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { useNotificacoesRevision } from '../hooks/useNotificacoesRevision';
import { localizarNotificacao, listarNotificacoes, lerNotificacao, preferenciasNotificacao, salvarPreferenciasNotificacao, destinoAutorizadoNotificacao, mensagemErroNotificacao, type PreferenciasNotificacao, type Notificacao } from '../services/notificacoes';
import { AsyncState } from '../components/AsyncState';
import { globalStyles as s } from '../styles/globalStyles';
import { theme } from '../styles/theme';
import { PreferenciaPush } from '../components/PreferenciaPush';

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
    const prefs = useRemoteResource('notificacoes:preferencias', preferenciasNotificacao);
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
    const prefer = (value: PreferenciasNotificacao) => void run(async () => { await salvarPreferenciasNotificacao(value); if (mounted.current) prefs.reload(); });
    const button = (title: string, action: () => void, disabled = false, networkRequired=true) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || (networkRequired&&(busy||offline)), busy }} disabled={disabled || (networkRequired&&(busy||offline))} onPress={action} style={{ minHeight: 48, padding: 12, borderRadius: 8, backgroundColor: theme.colors.primary, justifyContent: 'center', opacity: disabled || (networkRequired&&(busy||offline)) ? 0.5 : 1 }}><Text style={{ color: '#fff', textAlign: 'center' }}>{title}</Text></Pressable>;
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}><ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {button('Voltar', () => router.back(),false,false)}<Text style={s.title} accessibilityRole="header">Notificações</Text>
        {offline&&<Text accessibilityLiveRegion="polite">Sem conexão. Informações anteriores podem estar desatualizadas; a central será atualizada ao reconectar.</Text>}
        <PreferenciaPush /><Text accessibilityLiveRegion="polite">{feedback}</Text>
        {notificacaoId && (destino.error ? <AsyncState message={destino.error} onRetry={destino.reload} /> : destino.data ? button(`Abrir aviso: ${destino.data.titulo}`, () => open(destino.data!)) : offline?<Text>Reconecte para consultar o destino deste aviso com segurança.</Text>:<AsyncState loading title="Localizando seu aviso" />)}
        <Text accessibilityRole="header">Preferências da conta</Text>
        {prefs.error ? <AsyncState message={prefs.error} onRetry={prefs.reload} /> : !prefs.data ? offline?<Text>Preferências indisponíveis sem conexão.</Text>:<AsyncState loading title="Carregando preferências" /> : <>
            <Text>Avisos de viagem</Text><Switch accessibilityLabel="Avisos de viagem" disabled={busy||offline} value={prefs.data.pushOperacional} onValueChange={pushOperacional => prefer({ ...prefs.data!, pushOperacional })} />
            <Text>Avisos informativos</Text><Switch accessibilityLabel="Avisos informativos" disabled={busy||offline} value={prefs.data.pushInformativo} onValueChange={pushInformativo => prefer({ ...prefs.data!, pushInformativo })} />
        </>}
        <Text>As preferências de envio não removem o histórico da central.</Text>
        {avisos.error ? <AsyncState message={avisos.error} onRetry={avisos.reload} /> : !avisos.data ? offline?<AsyncState message="Reconecte para carregar seu histórico de notificações."/>:<AsyncState loading /> : <>
            {!avisos.data.itens.length && <AsyncState status="empty" title="Nenhuma notificação" />}
            {avisos.data.itens.map(n => <View key={n.id} style={[s.card, { gap: 8 }]}>
                <Text>{n.lidaEm ? 'Lida' : 'Não lida'} · {contextos[n.contextoTipo] || 'Aviso'}</Text><Text accessibilityRole="header" style={{ fontWeight: '700' }}>{n.titulo}</Text><Text>{n.mensagem}</Text>
                <Text>{new Date(n.criadaEm).toLocaleString('pt-BR')}</Text>
                {button('Abrir aviso', () => open(n))}{!n.lidaEm && button('Marcar como lida', () => void run(() => lerNotificacao(n.id)))}
            </View>)}
            {button('Anterior', () => setPage(v => v - 1), page === 0)}{button('Próxima', () => setPage(v => v + 1), page + 1 >= avisos.data.totalPaginas)}
        </>}
    </ScrollView></SafeAreaView>;
}
