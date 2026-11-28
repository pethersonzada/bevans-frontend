import { themedStyles } from '../styles/themedStyles';
import { useThemeRevision } from '../hooks/useThemeRevision';
﻿import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, Pressable, View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { consultarOperacao, alterarEstadoOperacional, mensagemErroOperacao, rotulosEstado, type RegistroOperacional, type EstadoOperacional } from '../services/operacoes';
import { AsyncState } from '../components/AsyncState';
import { RastreamentoViagem } from '../components/RastreamentoViagem';
import { theme } from '../styles/theme';
import { buscarExecucaoExcursao } from '../services/excursoes';
import { RoteiroExecucaoExcursao } from '../components/excursoes/RoteiroExecucaoExcursao';

export default function ControleViagem() {
    useThemeRevision();
    const { tipo, id, excursaoId, finalidade } = useLocalSearchParams<{ tipo: string; id: string; excursaoId?:string; finalidade?:string }>();
    const { user } = useAuth();
    return <Painel key={`${user.id}:${tipo}:${id}`} tipo={tipo} id={id} excursaoId={excursaoId} finalidade={finalidade} motorista={user.tipo === 'MOTORISTA'} />;
}
type Acao = { registro: RegistroOperacional; estado: EstadoOperacional; correcao: boolean };
export function Painel({ tipo, id, motorista, excursaoId, finalidade }: { tipo: string; id: string; motorista: boolean; excursaoId?:string; finalidade?:string }) {
    useThemeRevision();
    const router = useRouter();
    const { data, error, reload } = useRemoteResource(`operacao:${tipo}:${id}:${motorista}`, async signal => {
        try { return await consultarOperacao(tipo, id, motorista, signal); }
        catch (e) { throw new Error(mensagemErroOperacao(e,'consulta')); }
    }, 10000);
    const execucao=useRemoteResource(tipo==='EXCURSAO'&&motorista&&excursaoId?`snapshot-excursao:${excursaoId}:${id}`:false,signal=>buscarExecucaoExcursao(Number(excursaoId),Number(id),signal),10000);
    const [finalizada,setFinalizada]=useState(false);
    const operacaoBloqueada=finalizada||(tipo==='EXCURSAO'&&motorista&&(!execucao.data||execucao.data.estado!=='EM_ANDAMENTO'));
    const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState('');
    const [motivo, setMotivo] = useState(''), [confirmacao, setConfirmacao] = useState<Acao | null>(null);
    const [correcaoAberta, setCorrecaoAberta] = useState<number | null>(null);
    const [historicoAberto, setHistoricoAberto] = useState(false);
    const pending = useRef(false), mounted = useRef(true);
    const bloqueada=useRef(operacaoBloqueada);bloqueada.current=operacaoBloqueada;
    const aoFinalizar=useCallback(()=>{bloqueada.current=true;setFinalizada(true);setConfirmacao(null);},[]);
    useEffect(() => () => { mounted.current = false; }, []);
    const alterar = async (acao: Acao) => {
        if (pending.current||bloqueada.current) return;
        pending.current = true; setBusy(true); setFeedback('');
        try {
            await alterarEstadoOperacional(tipo, id, acao.registro, motorista, acao.estado, acao.correcao ? motivo.trim() : undefined);
            if (mounted.current) { setFeedback('Confirmação recebida. Consultando o estado oficial…'); setMotivo(''); setCorrecaoAberta(null); }
        } catch (e) { if (mounted.current) setFeedback(mensagemErroOperacao(e)); }
        finally { pending.current = false; if (mounted.current) { setConfirmacao(null); reload(); setBusy(false); } }
    };
    const solicitar = (registro: RegistroOperacional, estado: EstadoOperacional, correcao = false) => {
        if(bloqueada.current || pending.current)return;
        const acao = { registro, estado, correcao };
        if (estado === 'EMBARCADO') void alterar(acao); else setConfirmacao(acao);
    };
    const voltaPrivada = motorista && tipo === 'VIAGEM' && !!data && 'registros' in data && data.modalidade === 'PRIVADA' && data.sentido === 'VOLTA';
    const registros = data ? ('registros' in data ? [...data.registros].sort((a,b) => a.ordem - b.ordem) : [data]) : [];
    const botao = (titulo: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} style={[styles.button, (disabled || busy) && styles.disabled]} onPress={onPress}><Text style={styles.buttonText}>{titulo}</Text></Pressable>;
    const acaoOperacional=(titulo:string,onPress:()=>void,disabled=false)=>botao(titulo,onPress,disabled||operacaoBloqueada);
    // O motorista precisa ver as pendências reais, não uma grade de ações inválidas.
    // A tela individual do passageiro e o controle de excursão mantêm seus fluxos.
    if (motorista && tipo === 'VIAGEM') {
        const operacao = data && 'registros' in data ? data : null;
        const naVan = registros.filter(r => r.estado === 'EMBARCADO');
        const aguardando = registros.filter(r => r.estado === 'AGUARDANDO');
        const resolvidos = registros.filter(r => r.estado === 'DESEMBARCADO' || r.estado === 'NAO_EMBARCOU');
        const cancelamento = finalidade === 'cancelar';
        const quantidadeNaVan = Math.max(naVan.length, operacao?.contadores.naVan ?? 0);
        const acaoPendente = (r: RegistroOperacional, estado: EstadoOperacional, correcao = false) => {
            if (!operacaoBloqueada && !pending.current) setConfirmacao({ registro: r, estado, correcao });
        };
        const linha = (r: RegistroOperacional) => {
            const corrigindo = correcaoAberta === r.id;
            const acao = confirmacao?.registro.id === r.id ? confirmacao : null;
            const indisponivel = operacaoBloqueada || busy || !!confirmacao;
            return <View key={r.id} style={styles.driverCard}>
                <View style={styles.driverRow}>
                    <View style={styles.driverFlex}>
                        <Text style={styles.driverName}>{r.nome}</Text>
                        <Text style={[styles.driverSecondary, r.estado === 'EMBARCADO' && { color: theme.colors.danger }]}>
                            {voltaPrivada && r.estado === 'AGUARDANDO' ? 'Desembarque pendente' : rotulosEstado[r.estado]}
                        </Text>
                    </View>
                    {!operacaoBloqueada && <Pressable accessibilityRole="button" accessibilityLabel={`Corrigir registro de ${r.nome}`}
                        disabled={busy || !!confirmacao} onPress={() => { setCorrecaoAberta(corrigindo ? null : r.id); setMotivo(''); }}
                        style={styles.driverGear}>
                        <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.textLight} />
                    </Pressable>}
                </View>
                {!acao && !corrigindo && !operacaoBloqueada && <>
                    {r.estado === 'EMBARCADO' && acaoOperacional('Confirmar desembarque', () => acaoPendente(r, 'DESEMBARCADO'), indisponivel)}
                    {r.estado === 'AGUARDANDO' && !cancelamento && <View style={styles.driverActions}>
                        <Pressable accessibilityRole="button" accessibilityLabel={voltaPrivada ? 'Confirmar desembarque' : 'Confirmar embarque'}
                            disabled={indisponivel} style={[styles.button, styles.driverFlex, indisponivel && styles.disabled]}
                            onPress={() => voltaPrivada ? acaoPendente(r, 'DESEMBARCADO') : solicitar(r, 'EMBARCADO')}>
                            <Text style={styles.buttonText}>{voltaPrivada ? 'Confirmar desembarque' : 'Confirmar embarque'}</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" disabled={indisponivel} style={[styles.driverOutline, indisponivel && styles.disabled]}
                            onPress={() => acaoPendente(r, 'NAO_EMBARCOU')}><Text style={styles.driverOutlineText}>Não embarcou</Text></Pressable>
                    </View>}
                </>}
                {corrigindo && !acao && !operacaoBloqueada && <>
                    <Text style={styles.driverSecondary}>Use apenas para corrigir uma confirmação registrada por engano.</Text>
                    <TextInput style={styles.input} accessibilityLabel="Motivo da correção" placeholder="Motivo da correção" placeholderTextColor={theme.colors.textLight}
                        value={motivo} maxLength={500} onChangeText={setMotivo} editable={!busy && !confirmacao} />
                    {r.estado !== 'AGUARDANDO' && acaoOperacional('Corrigir para aguardando', () => acaoPendente(r, 'AGUARDANDO', true), !motivo.trim() || !!confirmacao)}
                    <Pressable accessibilityRole="button" onPress={() => { setCorrecaoAberta(null); setMotivo(''); }} style={styles.driverOutline}><Text style={styles.driverOutlineText}>Fechar correção</Text></Pressable>
                </>}
                {acao && <View style={styles.driverConfirm} accessibilityLiveRegion="polite">
                    <Text style={styles.driverName}>{acao.estado === 'DESEMBARCADO' ? 'O passageiro já saiu da van?' : acao.estado === 'NAO_EMBARCOU' ? 'O passageiro não embarcou?' : 'Confirma a correção do registro?'}</Text>
                    <Text style={styles.driverSecondary}>{acao.correcao ? `Motivo: ${motivo}` : 'Registre apenas o que aconteceu nesta viagem.'}</Text>
                    <View style={styles.driverActions}>
                        <Pressable accessibilityRole="button" disabled={busy || operacaoBloqueada} style={[styles.button, styles.driverFlex, (busy || operacaoBloqueada) && styles.disabled]}
                            onPress={() => void alterar(acao)}><Text style={styles.buttonText}>{busy ? 'Confirmando…' : 'Sim, confirmar'}</Text></Pressable>
                        <Pressable accessibilityRole="button" disabled={busy} style={styles.driverOutline} onPress={() => setConfirmacao(null)}><Text style={styles.driverOutlineText}>Voltar</Text></Pressable>
                    </View>
                </View>}
            </View>;
        };
        return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.driverContent} keyboardShouldPersistTaps="handled">
            <View style={styles.driverHeader}>
                <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.driverGear}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </Pressable>
                <View style={styles.driverFlex}>
                    <Text accessibilityRole="header" style={styles.title}>Controle da viagem</Text>
                    <Text style={styles.driverSecondary}>Viagem #{id}{operacao?.sentido ? ` · ${operacao.sentido === 'VOLTA' ? 'Volta' : 'Ida'}` : ''}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Atualizar passageiros" onPress={reload} disabled={busy} style={styles.driverGear}>
                    <Ionicons name="refresh-outline" size={22} color={theme.colors.text} />
                </Pressable>
            </View>
            {!!feedback && <Text accessibilityLiveRegion="polite" style={styles.driverSecondary}>{feedback}</Text>}
            {error ? <AsyncState message={error} onRetry={reload} /> : !operacao ? <AsyncState loading /> : <>
                <View style={[styles.driverNotice, quantidadeNaVan > 0 && !operacaoBloqueada && { borderColor: theme.colors.danger }]}>
                    <Text style={[styles.driverNoticeTitle, quantidadeNaVan > 0 && !operacaoBloqueada && { color: theme.colors.danger }]}>
                        {operacaoBloqueada ? 'Viagem encerrada' : quantidadeNaVan > 0 ? `${quantidadeNaVan} ${quantidadeNaVan === 1 ? 'passageiro ainda está' : 'passageiros ainda estão'} na van` : 'Nenhum passageiro embarcado'}
                    </Text>
                    <Text style={styles.driverSecondary}>{operacaoBloqueada ? 'Os registros estão disponíveis para consulta.' : quantidadeNaVan > 0
                        ? 'O encerramento ou cancelamento fica bloqueado enquanto houver passageiros registrados como embarcados. Confirme os desembarques abaixo somente após a saída real da van.'
                        : cancelamento ? 'Não há desembarques bloqueando o cancelamento. Volte à Home e cancele a viagem.'
                        : 'O controle de desembarques está em dia. O encerramento normal da ida ainda exige chegar ao destino.'}</Text>
                    {!operacaoBloqueada && cancelamento && quantidadeNaVan === 0 && botao('Voltar para cancelar a viagem', () => router.back(), busy || !!confirmacao)}
                </View>
                <View style={styles.driverSummary}>
                    {([['Na van', quantidadeNaVan], ['Pendentes', aguardando.length], ['Desembarcados', operacao.contadores.desembarcados]] as const).map(([label,total]) => (
                        <View key={label} style={styles.driverStat}><Text style={styles.driverStatValue}>{total}</Text><Text style={styles.driverSecondary}>{label}</Text></View>
                    ))}
                </View>
                {!!naVan.length && <>
                    <Text accessibilityRole="header" style={styles.driverSection}>Desembarques necessários</Text>
                    {naVan.map(linha)}
                </>}
                {!cancelamento && !!aguardando.length && <>
                    <Text accessibilityRole="header" style={styles.driverSection}>{voltaPrivada ? 'Entregas pendentes' : 'Embarques pendentes'}</Text>
                    {aguardando.map(linha)}
                </>}
                {cancelamento && !!aguardando.length && <Text style={styles.driverSecondary}>{aguardando.length} aguardando não bloqueiam o cancelamento.</Text>}
                {!!resolvidos.length && <>
                    <Pressable accessibilityRole="button" accessibilityState={{expanded: historicoAberto}} onPress={() => setHistoricoAberto(v => !v)} style={styles.driverHistory}>
                        <Text style={styles.driverSection}>Registros concluídos ({resolvidos.length})</Text>
                        <Ionicons name={historicoAberto ? 'chevron-up' : 'chevron-down'} color={theme.colors.textLight} size={20} />
                    </Pressable>
                    {historicoAberto && resolvidos.map(linha)}
                </>}
                {!registros.length && <AsyncState status="empty" title="Nenhum passageiro nesta operação" />}
            </>}
            <RastreamentoViagem key={`${tipo}:${id}`} tipo={tipo} id={id} motorista={motorista} onFinalizada={aoFinalizar} />
        </ScrollView></SafeAreaView>;
    }
    return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {botao('Voltar', () => router.back())}
        <Text style={styles.title} accessibilityRole="header">Controle da viagem</Text>
        <Text style={{ color: theme.colors.text }}>{tipo === 'EXCURSAO' ? 'Excursão' : 'Viagem'} #{id}{data && 'sentido' in data ? ` · ${data.sentido}` : ''}</Text>
        <Text style={{ color: theme.colors.text }}>{voltaPrivada ? 'Confirme apenas o desembarque ou a ausência de cada passageiro.' : 'GPS e presença planejada não confirmam embarque.'}</Text>
        <Text style={{ color: theme.colors.text }} accessibilityLiveRegion="polite">{feedback}</Text>
        {tipo==='EXCURSAO'&&motorista&&<>
            {!excursaoId&&<Text style={{ color: theme.colors.text }}>Reabra o controle pela excursão para consultar sua execução.</Text>}
            {!!excursaoId&&!execucao.data&&!execucao.error&&<AsyncState loading/>}
            {execucao.error&&<AsyncState message={execucao.error} onRetry={execucao.reload}/>}
            {execucao.data&&<><Text style={{ color: theme.colors.text }}>{execucao.data.estado==='EM_ANDAMENTO'?'Execução em andamento':execucao.data.estado==='FINALIZADA'?'Execução finalizada':'Execução cancelada'}</Text><RoteiroExecucaoExcursao execucao={execucao.data}/></>}
        </>}
        {error ? <AsyncState message={error} onRetry={reload} /> : !data ? <AsyncState loading /> : <>
            {'contadores' in data && <View style={styles.counters}>{([
                ['Esperados', data.contadores.esperados], [voltaPrivada ? 'Desembarques pendentes' : 'Aguardando', data.contadores.aguardando], ['Na van', data.contadores.naVan],
                ['Não embarcaram', data.contadores.naoEmbarcaram], ['Desembarcados', data.contadores.desembarcados],
            ] as const).map(([label, total]) => <View key={label} style={styles.counter} accessible accessibilityLabel={`${label}: ${total}`}><Text style={styles.total}>{total}</Text><Text style={{ color: theme.colors.text }}>{label}</Text></View>)}</View>}
            <Text style={{ color: theme.colors.text }}>A lista segue a ordem planejada; passageiros aguardando estão destacados.</Text>
            {motorista && <TextInput style={styles.input} accessibilityLabel="Motivo da correção" placeholder="Motivo obrigatório para corrigir" placeholderTextColor={theme.colors.textLight} value={motivo} maxLength={500} onChangeText={setMotivo} editable={!busy && !confirmacao} />}
            {confirmacao && <View style={styles.confirmation} accessibilityLiveRegion="polite">
                <Text style={{ color: theme.colors.text }} accessibilityRole="header">Confirmar {rotulosEstado[confirmacao.estado].toLowerCase()}?</Text>
                <Text style={{ color: theme.colors.text }}>{motorista ? confirmacao.registro.nome : 'Seu registro'}{confirmacao.correcao ? ` · Correção auditada: ${motivo}` : ''}. Confirme apenas o que ocorreu nesta viagem.</Text>
                {acaoOperacional('Confirmar alteração', () => void alterar(confirmacao))}{botao('Cancelar alteração', () => setConfirmacao(null))}
            </View>}
            {!registros.length && <AsyncState status="empty" title="Nenhum passageiro nesta operação" />}
            {registros.map(r => <View key={r.id} style={[styles.card, r.estado === 'AGUARDANDO' && styles.waiting]}>
                <Text style={styles.name} accessibilityRole="header">{motorista ? r.nome : 'Meu embarque'}</Text>
                <Text style={styles.state}>{voltaPrivada && r.estado === 'AGUARDANDO' ? 'Desembarque pendente' : rotulosEstado[r.estado] || 'Estado indisponível'}</Text>
                {motorista && <Text style={{ color: theme.colors.text }}>Ordem planejada: {r.ordem}</Text>}
                <Text style={{ color: theme.colors.text }}>Confirmado por: {r.autor || 'Ainda sem confirmação'}</Text>
                {r.atualizadoEm && <Text style={{ color: theme.colors.text }}>{new Date(r.atualizadoEm).toLocaleString('pt-BR')}</Text>}
                {!voltaPrivada && acaoOperacional(motorista ? 'Confirmar embarque' : 'Embarquei', () => solicitar(r, 'EMBARCADO'), r.estado !== 'AGUARDANDO' || !!confirmacao)}
                {acaoOperacional(motorista ? 'Confirmar desembarque' : 'Desembarquei', () => solicitar(r, 'DESEMBARCADO'), (r.estado !== 'EMBARCADO' && !(voltaPrivada && r.estado === 'AGUARDANDO')) || !!confirmacao)}
                {motorista ? <>
                    {acaoOperacional('Não embarcou', () => solicitar(r, 'NAO_EMBARCOU'), r.estado !== 'AGUARDANDO' || !!confirmacao)}
                    {acaoOperacional('Corrigir para aguardando', () => solicitar(r, 'AGUARDANDO', true), !motivo.trim() || !!confirmacao)}
                </> : <Text style={{ color: theme.colors.text }}>Em caso de toque acidental, peça uma correção ao motorista.</Text>}
            </View>)}
        </>}
        {(tipo === 'VIAGEM' || motorista) && <RastreamentoViagem key={`${tipo}:${id}`} tipo={tipo} id={id} motorista={motorista} onFinalizada={aoFinalizar} />}
    </ScrollView></SafeAreaView>;
}
const styles = themedStyles(() => StyleSheet.create({
    driverContent: { padding: 16, gap: 12, paddingBottom: 32 },
    driverHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    driverFlex: { flex: 1, minWidth: 0 },
    driverGear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    driverNotice: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 14, gap: 8, backgroundColor: theme.colors.surface },
    driverNoticeTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 17 },
    driverSecondary: { color: theme.colors.textLight, fontSize: 13, lineHeight: 19 },
    driverSummary: { flexDirection: 'row', gap: 8 },
    driverStat: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: theme.colors.surface },
    driverStatValue: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
    driverSection: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
    driverCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    driverName: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    driverActions: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
    driverOutline: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
    driverOutlineText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
    driverConfirm: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderColor: theme.colors.border },
    driverHistory: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
    screen: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: 16, gap: 12, paddingBottom: 32 },
    title: { fontSize: 24, fontWeight: '700', color: theme.colors.text }, counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    counter: { flexGrow: 1, flexBasis: '45%', padding: 16, backgroundColor: theme.colors.surface, borderRadius: 12 },
    total: { fontSize: 28, fontWeight: '700', color: theme.colors.primary },
    card: { padding: 16, gap: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
    waiting: { borderLeftWidth: 5, borderLeftColor: theme.colors.primary }, name: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
    state: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
    input: { minHeight: 52, borderWidth: 1, borderColor: theme.colors.border, padding: 12, borderRadius: 8, color: theme.colors.text, backgroundColor: theme.colors.surface },
    confirmation: { padding: 16, gap: 12, borderWidth: 2, borderColor: theme.colors.primary, borderRadius: 12 },
    button: { minHeight: 52, padding: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: theme.colors.primary },
    buttonText: { color: theme.colors.surface, fontSize: 16, fontWeight: '600', textAlign: 'center' }, disabled: { opacity: 0.45 },
}));
