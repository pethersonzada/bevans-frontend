import { useContext, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, ScrollView, Text, TextInput, View, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { buscarExcursao, salvarExcursao, acaoExcursao, salvarColetaExcursao, listarExecucoes, iniciarExcursao, finalizarExcursao, type Excursao, type DadosExcursao, type ParadaExcursao } from '../services/excursoes';
import { useAuth } from '../contexts/AuthContext';
import { AsyncState } from '../components/AsyncState';
import EnderecoMapaPicker from '../components/EnderecoMapaPicker';
import { errorMessage } from '../config/api';
import { globalStyles as s } from '../styles/globalStyles';
import { GestaoExcursao } from '../components/GestaoExcursao';
import { SeletorDataHora } from '../components/SeletorDataHora';
import { modosColeta, validarDatasExcursao, compartilharConviteSeguro } from '../services/excursaoFormulario';
import { estadoConviteCompartilhamento, onConvitesChanged, prepararConviteCompartilhamento, recuperarLinkConvite, autorizarNovaEmissaoAposRevisao } from '../services/convitesCompartilhamento';

import { ExcursaoActionContext as ActionLock } from '../components/ExcursaoActionContext';
const etapas = ['Dados', 'Embarques', 'Publicação', 'Convites', 'Execução'] as const;
export default function EditarExcursao() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const { user } = useAuth();
    return <TelaExcursao key={`${user.id}:${id || 'nova'}`} id={id} motorista={user.tipo === 'MOTORISTA'} />;
}
export function TelaExcursao({ id, motorista }: { id?: string; motorista: boolean }) {
    const router = useRouter();
    const [editorRevision, setEditorRevision] = useState(0), [etapa, setEtapa] = useState<string>('Dados');
    const [snapshot, setSnapshot] = useState<Excursao | null>(null), [descartar, setDescartar] = useState(false);
    const lock = useRef(false);
    const { data, error, reload } = useRemoteResource(id && motorista ? `excursao:${id}` : false, async signal => {
        const excursao = await buscarExcursao(id!, signal);
        const execucoes = await listarExecucoes(excursao.id, signal);
        return { excursao, execucoes };
    });
    useEffect(() => { if (data && !snapshot) setSnapshot(data.excursao); }, [data, snapshot]);
    const atualizar = async (newId: number, salvo?: Excursao) => {
        if (!id) { router.replace({ pathname: '/editar-excursao', params: { id: String(newId) } }); return; }
        const atual = salvo || await buscarExcursao(String(newId));
        setSnapshot(atual); reload();
    };
    if (!motorista) return <AsyncState message="A gestão exige perfil de motorista." />;
    return <ActionLock.Provider value={lock}><SafeAreaView style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Button title="Voltar" onPress={() => router.back()} /><Text style={s.title}>{id ? 'Gerenciar excursão' : 'Criar excursão'}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{etapas.map(nome => <Button key={nome} title={nome} accessibilityLabel={nome === etapa ? nome + ' selecionada' : nome} onPress={() => setEtapa(nome)} />)}</View>
        <Button title="Recarregar dados e descartar rascunho" onPress={() => setDescartar(true)} />
        {descartar && <><Text>Descartar as alterações ainda não salvas?</Text><AsyncAction title="Confirmar descarte" action={async () => { if (id) await atualizar(Number(id)); setEditorRevision(v => v + 1); setDescartar(false); }} /><Button title="Manter rascunho" onPress={() => setDescartar(false)} /></>}
        {error && <AsyncState message={error} onRetry={reload} />}
        {id && !snapshot ? <AsyncState loading /> : <Editor key={editorRevision} etapa={etapa} excursao={snapshot || undefined} versaoAtual={data?.excursao.versao} onSaved={atualizar} />}
        {etapa === 'Execução' && data?.execucoes.map(e => <View key={e.id} style={s.card}><Text>{e.sentido} · {e.estado === 'EM_ANDAMENTO' ? 'Em andamento' : e.estado === 'FINALIZADA' ? 'Finalizada' : 'Cancelada'}</Text><Button title="Controle de embarque" onPress={() => router.push({ pathname: '/controle-viagem', params: { tipo: 'EXCURSAO', id: String(e.id) } })} />
            {e.estado === 'EM_ANDAMENTO' && <AsyncAction title="Finalizar execução" confirmMessage="Encerrar esta execução? Confirme os desembarques reais antes de finalizar." action={async () => { await finalizarExcursao(data.excursao.id, e.id); reload(); }} />}</View>)}
        {data && (etapa === 'Convites' || etapa === 'Embarques') && <GestaoExcursao key={data.excursao.id} id={data.excursao.id} />}
    </ScrollView></SafeAreaView></ActionLock.Provider>;
}
export function AsyncAction({ title, action, confirmMessage }: { title: string; action: () => Promise<void>; confirmMessage?: string }) {
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmar, setConfirmar] = useState(false);
    const pending = useRef(false), mounted = useRef(true), lock = useContext(ActionLock);
    useEffect(() => () => { mounted.current = false; }, []);
    return <View style={{ gap: 8, paddingVertical: 8 }}>{confirmar && <Text accessibilityLiveRegion="polite">{confirmMessage}</Text>}<Button title={busy ? 'Aguarde…' : confirmar ? 'Confirmar: ' + title : title} disabled={busy} onPress={() => {
        if (pending.current || lock?.current) return;
        if (confirmMessage && !confirmar) { setConfirmar(true); return; }
        pending.current = true; if (lock) lock.current = true; setBusy(true); setError('');
        void action().catch(e => { if (mounted.current) setError((e as { status?: number })?.status === 409 ? 'Os dados mudaram ou a operação está bloqueada. Seu rascunho foi preservado; recarregue para revisar a versão oficial.' : errorMessage(e)); })
            .finally(() => { pending.current = false; if (lock) lock.current = false; if (mounted.current) { setBusy(false); setConfirmar(false); } });
    }} />{confirmar && <Button title="Cancelar ação" disabled={busy} onPress={() => setConfirmar(false)} />}<Text accessibilityLiveRegion="polite">{error}</Text></View>;
}
export function Editor({ excursao: initial, onSaved, etapa, versaoAtual }: { excursao?: Excursao; onSaved: (id: number, salvo?: Excursao) => Promise<void>; etapa: string; versaoAtual?: number }) {
    const [e, setE] = useState(initial);
    useEffect(() => { setE(initial); }, [initial]);
    const [titulo, setTitulo] = useState(e?.titulo || ''), [partida, setPartida] = useState(e?.partidaEm || ''), [retorno, setRetorno] = useState(e?.retornoEm || ''), [capacidade, setCapacidade] = useState(String(e?.capacidade || ''));
    const [destino, setDestino] = useState<{ nome: string; latitude: number; longitude: number } | null>(e ? { nome: e.destinoNome, latitude: e.destinoLatitude, longitude: e.destinoLongitude } : null);
    const [origem, setOrigem] = useState<{ nome: string; latitude: number; longitude: number } | null>(e?.origemNome && e.origemLatitude != null && e.origemLongitude != null ? { nome: e.origemNome, latitude: e.origemLatitude, longitude: e.origemLongitude } : null);
    const [modo, setModo] = useState<Excursao['modoColeta']>(e?.modoColeta || 'PORTA_A_PORTA'), [paradas, setParadas] = useState<ParadaExcursao[]>(e?.paradas || []);
    const [novoPonto, setNovoPonto] = useState<{ nome: string; latitude: number; longitude: number } | null>(null), [expira, setExpira] = useState('');
    const [reposicionar, setReposicionar] = useState<number | null>(null);
    const [convitePendente,setConvitePendente]=useState<ReturnType<typeof estadoConviteCompartilhamento>>(null);
    useEffect(()=>{
        const update=()=>setConvitePendente(e?estadoConviteCompartilhamento(e.id):null);
        update();return onConvitesChanged(update);
    },[e?.id]);
    const dados: DadosExcursao = { titulo, destinoNome: destino?.nome || '', destinoLatitude: destino?.latitude ?? NaN, destinoLongitude: destino?.longitude ?? NaN, origemNome: origem?.nome ?? null, origemLatitude: origem?.latitude ?? null, origemLongitude: origem?.longitude ?? null, partidaEm: partida, retornoEm: retorno || null, capacidade: Number(capacidade), versao: e?.versao };
    const salvar = async () => {
        if (!destino || !titulo.trim() || !/^[1-9]\d*$/.test(capacidade.trim())) throw new Error('Informe título, destino confirmado e quantidade inteira de lugares.');
        validarDatasExcursao(partida, retorno || null, Number(capacidade));
        const r = await salvarExcursao(e?.id ?? null, dados); await onSaved(r.id,r);
    };
    return <>
        {e && <Text>{e.estado === 'RASCUNHO' ? 'Rascunho' : e.estado === 'PUBLICADA' ? 'Publicada' : e.estado === 'CANCELADA' ? 'Cancelada' : 'Concluída'}</Text>}
        {e && versaoAtual !== undefined && e.versao !== versaoAtual && <Text accessibilityLiveRegion="polite">Os dados mudaram em outra sessão. Seu rascunho foi preservado; recarregue para revisar antes de salvar.</Text>}
        <View style={{ display: etapa === 'Dados' ? 'flex' : 'none', gap: 12 }}>
            <Text style={s.title} accessibilityRole="header">Dados da excursão</Text>
            <TextInput style={s.input} accessibilityLabel="Título da excursão" placeholder="Título" value={titulo} onChangeText={setTitulo} />
            <Text>Destino: {destino?.nome || 'confirme no mapa'}</Text><EnderecoMapaPicker localizacaoInicial={destino} onChange={setDestino} />
            <Text>Origem operacional opcional: {origem?.nome || 'não configurada'}</Text><EnderecoMapaPicker localizacaoInicial={origem} onChange={setOrigem} /><Button title="Remover origem operacional" onPress={() => setOrigem(null)} />
            <SeletorDataHora label="Partida" value={partida} onChange={setPartida} /><SeletorDataHora label="Retorno" value={retorno} onChange={setRetorno} optional />
            <TextInput style={s.input} accessibilityLabel="Capacidade" placeholder="Lugares" keyboardType="number-pad" value={capacidade} onChangeText={setCapacidade} />
            <AsyncAction title="Salvar dados da excursão" action={salvar} />
        </View>
        {!e && etapa !== 'Dados' && <Text>Salve os dados da excursão para continuar nesta etapa.</Text>}
        {e && <>
            <View style={{ display: etapa === 'Embarques' ? 'flex' : 'none', gap: 12 }}>
                <Text style={s.title} accessibilityRole="header">Pontos de embarque</Text>
                {(Object.keys(modosColeta) as Excursao['modoColeta'][]).map(m => <Button key={m} title={`${modo === m ? '✓ ' : ''}${modosColeta[m].nome}`} onPress={() => setModo(m)} />)}
                <Text>{modosColeta[modo].descricao}</Text><Text>A ordem muda apenas pelos controles abaixo e é persistida ao salvar.</Text>
                {modo !== 'PORTA_A_PORTA' && <><EnderecoMapaPicker onChange={setNovoPonto} /><Button title="Adicionar ponto confirmado" disabled={!novoPonto} onPress={() => { if (novoPonto) { setParadas([...paradas, { ...novoPonto, id: null, horario: null, instrucoes: null }]); setNovoPonto(null); } }} />
                    {paradas.map((p, i) => <View key={p.id ?? `nova-${i}`} style={s.card}>
                        <TextInput accessibilityLabel={`Nome da parada ${i + 1}`} value={p.nome} onChangeText={nome => setParadas(paradas.map((v, j) => i === j ? { ...v, nome } : v))} />
                        <TextInput accessibilityLabel={`Horário da parada ${i + 1}`} placeholder="HH:mm" value={p.horario || ''} onChangeText={horario => setParadas(paradas.map((v, j) => i === j ? { ...v, horario: horario || null } : v))} />
                        <Button title="Mover para cima" disabled={i === 0} onPress={() => { const next = [...paradas]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; setParadas(next); }} />
                        <Button title={`Reposicionar ${p.nome}`} onPress={() => setReposicionar(i)} /><Button title="Remover parada do rascunho" onPress={() => setParadas(paradas.filter((_, j) => j !== i))} />
                    </View>)}
                </>}
                {reposicionar != null && <><Text>Confirme a nova posição de {paradas[reposicionar]?.nome}</Text><EnderecoMapaPicker onChange={ponto => { if (ponto) { setParadas(paradas.map((p, i) => i === reposicionar ? { ...p, latitude: ponto.latitude, longitude: ponto.longitude } : p)); setReposicionar(null); } }} /><Button title="Cancelar reposicionamento" onPress={() => setReposicionar(null)} /></>}
                <AsyncAction title="Salvar modo e paradas" confirmMessage="Salvar esta configuração na ordem exibida? Alterações incompatíveis com inscrições serão recusadas pelo servidor." action={async () => { const r = await salvarColetaExcursao(e.id, modo, e.versao, modo === 'PORTA_A_PORTA' ? [] : paradas); await onSaved(r.id,r); }} />
            </View>
            <View style={{ display: etapa === 'Publicação' ? 'flex' : 'none', gap: 12 }}>
                <Text style={s.title}>Revisão e publicação</Text><Text>{titulo} · {destino?.nome} · {partida ? new Date(partida).toLocaleString('pt-BR') : ''} · {capacidade} lugares</Text>
                <Text>Salve as alterações antes de publicar. A publicação utiliza os dados já persistidos no servidor.</Text>
                <AsyncAction title="Publicar excursão" confirmMessage="Publicar os dados salvos desta excursão?" action={async () => { const r = await acaoExcursao(e.id, 'publicacao', e.versao); await onSaved(r.id,r); }} />
            </View>
            <View style={{ display: etapa === 'Convites' ? 'flex' : 'none', gap: 12 }}>
                <Text style={s.title}>Convites</Text><SeletorDataHora label="Validade do convite" value={expira} onChange={setExpira} />
                <Text>A inscrição pelo link depende da página de inscrições na web estar disponível. A gestão da excursão continua no aplicativo.</Text>
                {!process.env.EXPO_PUBLIC_CONVITE_WEB_URL&&<Text accessibilityLiveRegion="polite">A página de inscrições ainda não está configurada. Configure-a antes de gerar links; convites existentes podem ser consultados ou revogados abaixo.</Text>}
                <AsyncAction title={convitePendente?.id ? 'Compartilhar convite criado novamente' : 'Gerar e compartilhar convite'} action={async () => {
                    const convite=await prepararConviteCompartilhamento(e.id,expira,e.partidaEm,process.env.EXPO_PUBLIC_CONVITE_WEB_URL);
                    convite.registrarResultado(await compartilharConviteSeguro(convite.link, link => Share.share({ message: link }), Share.sharedAction));
                }} />
                {convitePendente?.id&&<AsyncAction title="Copiar link do convite recuperado" action={async()=>{
                    const convite=await recuperarLinkConvite(e.id,process.env.EXPO_PUBLIC_CONVITE_WEB_URL);
                    try{await Clipboard.setStringAsync(convite.link);}catch{throw new Error('Não foi possível copiar o link. O convite continua disponível nesta sessão.');}
                    convite.registrarResultado('Link copiado. Isso não confirma envio ou inscrição.');
                }}/>}
                {convitePendente?.incerto&&<AsyncAction title="Autorizar outra emissão após revisar a lista" confirmMessage="A criação anterior pode ter sido registrada sem retornar o link. Revise a lista e revogue convites sem link. Deseja permitir uma nova emissão manual?" action={()=>autorizarNovaEmissaoAposRevisao(e.id)}/>}
                <Text accessibilityLiveRegion="polite">{convitePendente?.aviso}</Text><Text>Cancelar o compartilhamento não revoga o convite criado. O link pode ser recuperado ao voltar a esta excursão enquanto esta sessão do aplicativo continuar aberta. Após sair da conta ou fechar o app, revogue convites sem link e emita outro quando necessário.</Text>
            </View>
            <View style={{ display: etapa === 'Execução' ? 'flex' : 'none', gap: 12 }}>
                <Text style={s.title}>Execução</Text>
                {(['IDA', 'VOLTA'] as const).map(sentido => <AsyncAction key={sentido} title={`Iniciar execução ${sentido}`} confirmMessage="Iniciar com os participantes confirmados? A execução bloqueia alterações de coleta." action={async () => { await iniciarExcursao(e.id, sentido); await onSaved(e.id); }} />)}
                <AsyncAction title="Cancelar excursão" confirmMessage="Cancelar esta excursão e afetar suas inscrições? Esta ação não reabre a excursão." action={async () => { const r = await acaoExcursao(e.id, 'cancelamento', e.versao); await onSaved(r.id,r); }} />
            </View>
        </>}
    </>;

}
