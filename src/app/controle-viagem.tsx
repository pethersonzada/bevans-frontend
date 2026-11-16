import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, Pressable, View, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { consultarOperacao, alterarEstadoOperacional, mensagemErroOperacao, rotulosEstado, type RegistroOperacional, type EstadoOperacional } from '../services/operacoes';
import { AsyncState } from '../components/AsyncState';
import { RastreamentoViagem } from '../components/RastreamentoViagem';
import { theme } from '../styles/theme';

export default function ControleViagem() {
    const { tipo, id } = useLocalSearchParams<{ tipo: string; id: string }>();
    const { user } = useAuth();
    return <Painel key={`${user.id}:${tipo}:${id}`} tipo={tipo} id={id} motorista={user.tipo === 'MOTORISTA'} />;
}
type Acao = { registro: RegistroOperacional; estado: EstadoOperacional; correcao: boolean };
export function Painel({ tipo, id, motorista }: { tipo: string; id: string; motorista: boolean }) {
    const router = useRouter();
    const { data, error, reload } = useRemoteResource(`operacao:${tipo}:${id}:${motorista}`, async signal => {
        try { return await consultarOperacao(tipo, id, motorista, signal); }
        catch (e) { throw new Error(mensagemErroOperacao(e)); }
    }, 10000);
    const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState('');
    const [motivo, setMotivo] = useState(''), [confirmacao, setConfirmacao] = useState<Acao | null>(null);
    const pending = useRef(false), mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);
    const alterar = async (acao: Acao) => {
        if (pending.current) return;
        pending.current = true; setBusy(true); setFeedback('');
        try {
            await alterarEstadoOperacional(tipo, id, acao.registro, motorista, acao.estado, acao.correcao ? motivo.trim() : undefined);
            if (mounted.current) { setFeedback('Confirmação recebida. Consultando o estado oficial…'); setMotivo(''); }
        } catch (e) { if (mounted.current) setFeedback(mensagemErroOperacao(e)); }
        finally { pending.current = false; if (mounted.current) { setConfirmacao(null); reload(); setBusy(false); } }
    };
    const solicitar = (registro: RegistroOperacional, estado: EstadoOperacional, correcao = false) => {
        const acao = { registro, estado, correcao };
        if (estado === 'EMBARCADO') void alterar(acao); else setConfirmacao(acao);
    };
    const registros = data ? ('registros' in data ? [...data.registros].sort((a,b) => a.ordem - b.ordem) : [data]) : [];
    const botao = (titulo: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} style={[styles.button, (disabled || busy) && styles.disabled]} onPress={onPress}><Text style={styles.buttonText}>{titulo}</Text></Pressable>;
    return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {botao('Voltar', () => router.back())}
        <Text style={styles.title} accessibilityRole="header">Controle da viagem</Text>
        <Text>{tipo === 'EXCURSAO' ? 'Excursão' : 'Viagem'} · {data && 'sentido' in data ? data.sentido : ''}</Text>
        <Text>GPS e presença planejada não confirmam embarque.</Text>
        <Text accessibilityLiveRegion="polite">{feedback}</Text>
        {error ? <AsyncState message={error} onRetry={reload} /> : !data ? <AsyncState loading /> : <>
            {'contadores' in data && <View style={styles.counters}>{([
                ['Esperados', data.contadores.esperados], ['Aguardando', data.contadores.aguardando], ['Na van', data.contadores.naVan],
                ['Não embarcaram', data.contadores.naoEmbarcaram], ['Desembarcados', data.contadores.desembarcados],
            ] as const).map(([label, total]) => <View key={label} style={styles.counter} accessible accessibilityLabel={`${label}: ${total}`}><Text style={styles.total}>{total}</Text><Text>{label}</Text></View>)}</View>}
            <Text>A próxima parada não é informada neste contrato. A lista segue a ordem planejada; passageiros aguardando estão destacados.</Text>
            {motorista && <TextInput style={styles.input} accessibilityLabel="Motivo da correção" placeholder="Motivo obrigatório para corrigir" value={motivo} maxLength={500} onChangeText={setMotivo} editable={!busy && !confirmacao} />}
            {confirmacao && <View style={styles.confirmation} accessibilityLiveRegion="polite">
                <Text accessibilityRole="header">Confirmar {rotulosEstado[confirmacao.estado].toLowerCase()}?</Text>
                <Text>{motorista ? confirmacao.registro.nome : 'Seu registro'}{confirmacao.correcao ? ` · Correção auditada: ${motivo}` : ''}. Confirme apenas o que ocorreu nesta viagem.</Text>
                {botao('Confirmar alteração', () => void alterar(confirmacao))}{botao('Cancelar alteração', () => setConfirmacao(null))}
            </View>}
            {!registros.length && <AsyncState status="empty" title="Nenhum passageiro nesta operação" />}
            {registros.map(r => <View key={r.id} style={[styles.card, r.estado === 'AGUARDANDO' && styles.waiting]}>
                <Text style={styles.name} accessibilityRole="header">{motorista ? r.nome : 'Meu embarque'}</Text>
                <Text style={styles.state}>{rotulosEstado[r.estado] || 'Estado indisponível'}</Text>
                {motorista && <Text>Ordem planejada: {r.ordem}</Text>}
                <Text>Confirmado por: {r.autor || 'Ainda sem confirmação'}</Text>
                {r.atualizadoEm && <Text>{new Date(r.atualizadoEm).toLocaleString('pt-BR')}</Text>}
                {botao(motorista ? 'Confirmar embarque' : 'Embarquei', () => solicitar(r, 'EMBARCADO'), r.estado !== 'AGUARDANDO' || !!confirmacao)}
                {botao(motorista ? 'Confirmar desembarque' : 'Desembarquei', () => solicitar(r, 'DESEMBARCADO'), r.estado !== 'EMBARCADO' || !!confirmacao)}
                {motorista ? <>
                    {botao('Não embarcou', () => solicitar(r, 'NAO_EMBARCOU'), r.estado !== 'AGUARDANDO' || !!confirmacao)}
                    {botao('Corrigir para aguardando', () => solicitar(r, 'AGUARDANDO', true), !motivo.trim() || !!confirmacao)}
                </> : <Text>Em caso de toque acidental, peça uma correção ao motorista.</Text>}
            </View>)}
        </>}
        {(tipo === 'VIAGEM' || motorista) && <RastreamentoViagem key={`${tipo}:${id}`} tipo={tipo} id={id} motorista={motorista} />}
    </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: 16, gap: 12, paddingBottom: 32 },
    title: { fontSize: 24, fontWeight: '700', color: theme.colors.text }, counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    counter: { flexGrow: 1, flexBasis: '45%', padding: 16, backgroundColor: theme.colors.surface, borderRadius: 12 },
    total: { fontSize: 28, fontWeight: '700', color: theme.colors.primary },
    card: { padding: 16, gap: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
    waiting: { borderLeftWidth: 5, borderLeftColor: theme.colors.primary }, name: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
    state: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
    input: { minHeight: 52, borderWidth: 1, borderColor: theme.colors.border, padding: 12, borderRadius: 8 },
    confirmation: { padding: 16, gap: 12, borderWidth: 2, borderColor: theme.colors.primary, borderRadius: 12 },
    button: { minHeight: 52, padding: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: theme.colors.primary },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' }, disabled: { opacity: 0.45 },
});
