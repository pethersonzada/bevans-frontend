import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';


import type { useAppAlert } from '../../contexts/AppAlertContext';
import { auth } from '../../config/firebase';
import { errorMessage } from '../../config/api';
import { AsyncState } from '../../components/AsyncState';
import { Field, Choice, Notice } from '../../components/ui/Primitives';
import { ActionButton, AtalhoViagem, BlocoViagem, CabecalhoViagem, PaginaViagem, ProgressoViagem, trip } from '../../components/excursoes/ViagemUI';
import EnderecoMapaPicker from '../../components/EnderecoMapaPicker';
import { resolverEnderecoExcursao } from '../../services/enderecoReversoExcursao';
import { concluirCadastroTurma, etapasTurma, novoCadastroTurma, restaurarCadastroTurma, validarDadosTurma, validarTrajetoTurma, type CadastroTurma, type PontoTurma } from '../../services/cadastroTurma';

export function FormularioTurma({ userId, onExit, onColeta, alert, offline }: {
    userId: string; onExit: () => void; onColeta: (id: number) => void; alert: ReturnType<typeof useAppAlert>; offline: boolean;
}) {
    const key = `@bevans:cadastro-turma:v1:${userId}`;
    const [d, setD] = useState(novoCadastroTurma), [ready, setReady] = useState(false), [erro, setErro] = useState('');
    const [busy, setBusy] = useState(false), [mapa, setMapa] = useState<'origem'|'destino'|null>(null);
    const [candidato, setCandidato] = useState<PontoTurma|null>(null), [concluida, setConcluida] = useState<number|null>(null);
    const mounted = useRef(true), lock = useRef(false), draft = useRef(d), queue = useRef(Promise.resolve());
    const owner = useRef(auth.currentUser);
    const assertCurrent = useCallback(() => {
        if (!mounted.current || !owner.current || auth.currentUser !== owner.current) throw new Error('A sessão mudou. Entre novamente para retomar o cadastro.');
    }, []);
    const persist = useCallback((next: CadastroTurma) => {
        assertCurrent(); draft.current = next; setD(next);
        const task = queue.current.catch(()=>{}).then(()=>AsyncStorage.setItem(key, JSON.stringify(next)));
        queue.current = task;
        return task;
    }, [assertCurrent, key]);
    const restaurar = useCallback(async () => {
        setErro('');
        try { const raw=await AsyncStorage.getItem(key);assertCurrent();const next=restaurarCadastroTurma(raw);draft.current=next;setD(next);setReady(true); }
        catch(e) {if(mounted.current)setErro(errorMessage(e));}
    }, [key, assertCurrent]);
    useEffect(() => { mounted.current=true;void restaurar();return()=>{mounted.current=false;}; }, [restaurar]);
    const update = (patch: Partial<CadastroTurma>) => {
        if (lock.current || draft.current.anteriores !== null || draft.current.turmaId) return;
        setErro('');void persist({...draft.current,...patch}).catch(e=>{if(mounted.current)setErro(errorMessage(e));});
    };
    const sair = useCallback(() => {
        if (lock.current) return;
        if (mapa) {setMapa(null);setCandidato(null);return;}
        if (concluida) {onExit();return;}
        alert.alert('Sair do cadastro?', 'Seu rascunho fica salvo neste aparelho para continuar depois. A criação só é enviada na confirmação final.', [
            {text:'Continuar cadastro',style:'cancel'}, {text:'Salvar e sair',onPress:()=>{void queue.current.then(onExit).catch(e=>{if(mounted.current)setErro(errorMessage(e));});}},
        ]);
    }, [mapa, concluida, onExit, alert]);
    const back = useCallback(() => {
        if (lock.current) return;
        if (!mapa && d.etapa>0 && d.anteriores===null && !d.turmaId && !concluida) {
            void persist({...draft.current,etapa:d.etapa-1}).catch(e=>{if(mounted.current)setErro(errorMessage(e));});
        } else sair();
    }, [mapa, d.etapa, d.anteriores, d.turmaId, concluida, persist, sair]);
    useFocusEffect(useCallback(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{back();return true;});return()=>sub.remove();},[back]));
    async function salvar() {
        if (lock.current || offline || !ready) return;
        lock.current=true;setBusy(true);setErro('');
        try {
            await queue.current;assertCurrent();
            const turma=await concluirCadastroTurma(userId,draft.current,persist,assertCurrent);
            await AsyncStorage.removeItem(key);assertCurrent();setConcluida(turma.id);
        } catch(e) {if(mounted.current)setErro(errorMessage(e));}
        finally {lock.current=false;if(mounted.current)setBusy(false);}
    }
    const feedback=<>{!!erro&&<AsyncState message={erro}/>}{offline&&<Notice>Sem conexão. Você pode preparar o cadastro; reconecte para criar a turma.</Notice>}</>;
    if (!ready) return <PaginaViagem title="Nova turma privada" onBack={onExit}>{feedback}{!erro?<AsyncState loading title="Restaurando rascunho…"/>:<ActionButton title="Tentar restaurar novamente" onPress={()=>void restaurar()}/>}</PaginaViagem>;
    if (concluida) return <PaginaViagem title="Turma criada" onBack={onExit}>
        <CabecalhoViagem title="Tudo pronto para receber seu grupo" subtitle="Os dados e os dois pontos foram conferidos na sua conta."/>
        <View style={trip.hero}><Text style={trip.heroEyebrow}>TURMA PRIVADA</Text><Text style={trip.heroTitle}>{d.nome}</Text><Text style={trip.heroSubtitle}>{d.turno} · {d.capacidade} assentos</Text></View>
        <Notice>Configure a coleta por sentido para buscar em endereços individuais ou em paradas definidas.</Notice>
        <ActionButton title="Configurar coleta" variant="primary" onPress={()=>onColeta(concluida)}/><ActionButton title="Voltar às minhas turmas" onPress={onExit}/>
    </PaginaViagem>;
    if (mapa) return <PaginaViagem title={mapa==='origem'?'Escolher origem':'Escolher destino'} onBack={()=>setMapa(null)} footer={<>
        {!candidato&&<Text style={trip.caption}>Busque um lugar e confirme o ponto no mapa.</Text>}
        <ActionButton title="Usar este ponto" variant="primary" disabled={!candidato} onPress={()=>{if(candidato){update({[mapa]:candidato});setMapa(null);setCandidato(null);}}}/>
    </>}><Text style={trip.muted}>Confira o pin e o nome do local. Você pode voltar e alterar antes de criar a turma.</Text>
        <View style={{height:540}}><EnderecoMapaPicker key={mapa} tipo={mapa} localizacaoInicial={d[mapa]} resolverEndereco={resolverEnderecoExcursao} onChange={setCandidato}/></View>
    </PaginaViagem>;
    const enviada=d.anteriores!==null||!!d.turmaId;
    return <PaginaViagem key={d.etapa} title="Nova turma privada" onBack={back} footer={<>
        {d.etapa===2?<ActionButton title={enviada?'Conferir criação no servidor':'Criar turma'} variant="primary" busy={busy} disabled={offline} onPress={()=>void salvar()}/>:<ActionButton title="Continuar" variant="primary" icon="arrow-forward" disabled={busy} onPress={()=>{try{validarDadosTurma(d);if(d.etapa===1)validarTrajetoTurma(d);update({etapa:d.etapa+1});}catch(e){setErro(errorMessage(e));}}}/> }
        <ActionButton title={d.etapa?'Etapa anterior':'Salvar e sair'} disabled={busy||enviada} onPress={back}/>
    </>}>
        <ProgressoViagem steps={etapasTurma} current={d.etapa}/>{feedback}
        {enviada&&<Notice>A criação já foi enviada. Confira o resultado antes de editar ou iniciar outra turma.</Notice>}
        {d.etapa===0&&<><CabecalhoViagem eyebrow="Seu grupo, seu caminho" title="Vamos conhecer a turma" subtitle="Escolha um nome fácil de reconhecer e informe os assentos do veículo."/>
            <BlocoViagem title="Dados da turma"><Field label="Nome da turma" value={d.nome} onChangeText={nome=>update({nome})} placeholder="Ex.: Faculdade · Manhã"/>
                <Text style={trip.label}>Turno</Text>{['Manhã','Tarde','Noite','Personalizado'].map(turno=><Choice key={turno} label={turno} selected={turno==='Personalizado'?!['Manhã','Tarde','Noite',''].includes(d.turno):d.turno===turno} onPress={()=>update({turno:turno==='Personalizado'?'Outro':turno})}/>)}
                {!['Manhã','Tarde','Noite',''].includes(d.turno)&&<Field label="Informe o turno" value={d.turno} onChangeText={turno=>update({turno})}/>}
                <Field label="Quantidade de assentos" hint="Informe o total disponível para passageiros." keyboardType="number-pad" value={d.capacidade} onChangeText={capacidade=>update({capacidade})} placeholder="Ex.: 12"/>
            </BlocoViagem></>}
        {d.etapa===1&&<><CabecalhoViagem title="De onde até onde?" subtitle="Defina a saída e o destino da turma. Os pontos ficam no rascunho até a confirmação."/>
            {(['origem','destino'] as const).map(tipo=><AtalhoViagem key={tipo} icon={tipo==='origem'?'navigate-outline':'flag-outline'} title={d[tipo]?.nome||`Escolher ${tipo}`} detail={`${tipo==='origem'?'Saída':'Destino'} · escolher no mapa`} onPress={()=>{setCandidato(null);setMapa(tipo);}}/>)}
            <Notice>Depois de criar a turma, você pode configurar a coleta por endereços ou paradas para ida e volta.</Notice></>}
        {d.etapa===2&&<><CabecalhoViagem title="Confira antes de criar" subtitle="Revise os dados e volte às etapas anteriores se precisar corrigir algo."/>
            <BlocoViagem title="Dados da turma"><Text style={trip.label}>{d.nome}</Text><Text style={trip.body}>{d.turno} · {d.capacidade} assentos</Text><ActionButton title="Editar dados" disabled={busy||enviada} onPress={()=>update({etapa:0})}/></BlocoViagem>
            <BlocoViagem title="Trajeto"><Text style={trip.label}>Saída</Text><Text style={trip.body}>{d.origem?.nome}</Text><Text style={trip.label}>Destino</Text><Text style={trip.body}>{d.destino?.nome}</Text><ActionButton title="Editar trajeto" disabled={busy||enviada} onPress={()=>update({etapa:1})}/></BlocoViagem>
        </>}
    </PaginaViagem>;
}
