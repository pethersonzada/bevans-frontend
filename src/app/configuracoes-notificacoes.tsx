import { theme } from '../styles/theme';
import { useThemeRevision } from '../hooks/useThemeRevision';
import { useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { preferenciasNotificacao, salvarPreferenciasNotificacao, mensagemErroNotificacao, type PreferenciasNotificacao } from '../services/notificacoes';
import { PreferenciaPush } from '../components/PreferenciaPush';
import { AsyncState } from '../components/AsyncState';
import { Screen, Section, Notice, ui } from '../components/ui/Primitives';
export default function ConfiguracoesNotificacoes() {
    useThemeRevision();
    const { user } = useAuth();
    return <Preferencias key={user.id} />;
}
export function Preferencias() {
    useThemeRevision();
    const router = useRouter(), connection = useNetInfo();
    const offline = connection.isConnected === false || connection.isInternetReachable === false;
    const { data, error, reload } = useRemoteResource('notificacoes:preferencias', preferenciasNotificacao);
    const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState('');
    const pending = useRef(false), mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const save = async (value: PreferenciasNotificacao) => {
        if (pending.current || offline) return;
        pending.current = true; setBusy(true); setFeedback('');
        try { await salvarPreferenciasNotificacao(value); if (mounted.current) { reload(); setFeedback('Preferências salvas.'); } }
        catch (e) { if (mounted.current) setFeedback(mensagemErroNotificacao(e)); }
        finally { pending.current = false; if (mounted.current) setBusy(false); }
    };
    return <Screen title="Preferências" subtitle="Configure notificações e gerencie este aparelho." onBack={() => router.back()}>
        {offline && <Notice>Sem conexão. Reconecte para alterar as preferências da conta.</Notice>}
        <Section title="Recebimento" description="Estas opções controlam o envio de push. O histórico continua disponível na central.">
            {error ? <AsyncState message={error} onRetry={reload} /> : !data ? offline ? <Text style={{ color: theme.colors.text }}>Preferências indisponíveis sem conexão.</Text> : <AsyncState loading /> : <>
                {([['Avisos de viagem', 'pushOperacional'], ['Avisos informativos', 'pushInformativo']] as const).map(([label, field]) => <View key={field} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}><Text style={[ui.label, { flex: 1 }]}>{label}</Text><Switch accessibilityLabel={label} disabled={busy || offline} value={data[field]} onValueChange={value => void save({ ...data, [field]: value })} /></View>)}
            </>}
            {!!feedback && <Text accessibilityLiveRegion="polite" style={ui.body}>{feedback}</Text>}
        </Section>
        <Section title="Neste aparelho" description="A permissão só será solicitada ao tocar em Permitir. Você pode revogar o registro a qualquer momento."><PreferenciaPush /></Section>
    </Screen>;
}
