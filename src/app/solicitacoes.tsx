import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { listarVinculosPendentes, analisarVinculo, minhasTurmasPassageiro } from '../services/solicitacoes';
import { meusEmbarques } from '../services/embarques';
import { listarMinhasRotas } from '../services/rotasPublicas';
import { errorMessage } from '../config/api';
import { AsyncState } from '../components/AsyncState';
import { PedidosRota } from '../components/PedidosRota';
import { Screen, Section, ActionButton, Choice, Notice, RemoteLoading, ui } from '../components/ui/Primitives';

export default function Solicitacoes() {
    const { user } = useAuth();
    return <PedidosConta key={user.id} usuarioId={user.id} motorista={user.tipo === 'MOTORISTA'} />;
}

export function PedidosConta({ usuarioId, motorista }: { usuarioId: string | null; motorista: boolean }) {
    const router = useRouter();
    const { contexto, avisoId } = useLocalSearchParams<{ contexto?: string; avisoId?: string }>();
    const [busy, setBusy] = useState(false), [erro, setErro] = useState('');
    const [rotaSelecionada, setRotaSelecionada] = useState<number | null>(null);
    const pending = useRef(false), mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const vinculos = useRemoteResource(usuarioId && motorista ? 'solicitacoes:vinculos' : false, signal => listarVinculosPendentes(usuarioId!, signal));
    const rotas = useRemoteResource(usuarioId && motorista ? 'solicitacoes:rotas' : false, () => listarMinhasRotas());
    const pessoais = useRemoteResource(usuarioId && !motorista ? 'solicitacoes:pessoais' : false, async signal => {
        const [turmas, pedidos] = await Promise.all([minhasTurmasPassageiro(usuarioId!, signal), meusEmbarques(signal)]);
        return { turmas, pedidos };
    });
    const analisar = async (id: number, status: 'APROVADO' | 'REJEITADO') => {
        if (pending.current) return;
        pending.current = true; setBusy(true); setErro('');
        try { await analisarVinculo(id, status); if (mounted.current) vinculos.reload(); }
        catch (e) { if (mounted.current) setErro(errorMessage(e)); }
        finally { pending.current = false; if (mounted.current) setBusy(false); }
    };
    return <Screen title="Solicitações" subtitle={motorista ? 'Vínculos e embarques são analisados separadamente.' : 'Consulte seus vínculos e pedidos de embarque.'} onBack={() => router.back()}>
        {!!erro && <Notice>{erro}</Notice>}
        {!usuarioId ? <Notice>Entre novamente para consultar seus pedidos.</Notice> : motorista ? <>
            <Section title="Pedidos de vínculo">
                {vinculos.error ? <AsyncState message={vinculos.error} onRetry={vinculos.reload} /> : !vinculos.data ? <RemoteLoading /> : <>
                    {!vinculos.data.length && <Text style={ui.body}>Nenhum vínculo pendente. Pedidos já analisados deixam esta lista.</Text>}
                    {vinculos.data.map(p => <View key={p.id} style={ui.section}>
                        <Text style={ui.label}>{p.turma.nome || 'Turma'} · {p.aluno?.nome || 'Passageiro'}</Text>
                        <Text style={ui.body}>{contexto === 'SOLICITACAO_VAGA' && String(p.id) === avisoId ? 'Pedido deste aviso · ' : ''}Pendente de aprovação de vínculo</Text>
                        <ActionButton title="Aprovar vínculo" disabled={busy} onPress={() => void analisar(p.id, 'APROVADO')} />
                        <ActionButton title="Recusar vínculo" disabled={busy} onPress={() => void analisar(p.id, 'REJEITADO')} />
                    </View>)}
                </>}
            </Section>
            <Section title="Pedidos de embarque">
                {contexto === 'EMBARQUE' && <Notice>Selecione a data e o sentido do pedido. O aviso não informa a data operacional; a lista consulta apenas suas rotas.</Notice>}
                {rotas.error ? <AsyncState message={rotas.error} onRetry={rotas.reload} /> : !rotas.data ? <RemoteLoading /> : <>
                    {!rotas.data.length && <Text style={ui.body}>Nenhuma rota pública cadastrada.</Text>}
                    {rotas.data.map(r => <Choice key={r.id} label={r.nome} description={r.cidade} selected={rotaSelecionada===r.id} onPress={()=>setRotaSelecionada(r.id)} />)}
                    {rotas.data.some(r=>r.id===rotaSelecionada) && <PedidosRota key={rotaSelecionada} rotaId={rotaSelecionada!} />}
                </>}
            </Section>
        </> : pessoais.error ? <AsyncState message={pessoais.error} onRetry={pessoais.reload} /> : !pessoais.data ? <RemoteLoading /> : <>
            <Section title="Meus vínculos"><Text style={ui.body}>As turmas abaixo possuem vínculo aprovado. Um vínculo não confirma um embarque para uma data.</Text>
                {!pessoais.data.turmas.length && <Text style={ui.body}>Nenhum vínculo aprovado disponível. Consulte seus pedidos pelo catálogo ou código da turma.</Text>}
                {pessoais.data.turmas.map(t => <Text key={t.id} style={ui.label}>{t.nome || 'Turma'} · {t.turno}</Text>)}
            </Section>
            <Section title="Meus pedidos de embarque">
                {!pessoais.data.pedidos.length && <Text style={ui.body}>Nenhum pedido de embarque recebido pelo servidor.</Text>}
                {pessoais.data.pedidos.map(p => <View key={p.id} style={ui.section}>
                    <Text style={ui.label}>{contexto === 'EMBARQUE' && String(p.id) === avisoId ? 'Pedido deste aviso · ' : ''}{p.status}</Text>
                    <Text style={ui.body}>{p.dataOperacao.split('-').reverse().join('/')} · {p.sentido} · {p.nomePonto || `Parada ${p.paradaId}`}</Text>
                    <ActionButton title="Abrir rota do pedido" onPress={() => router.push({ pathname: '/detalhe-rota', params: { id: String(p.rotaId) } })} />
                </View>)}
            </Section>
        </>}
    </Screen>;
}
