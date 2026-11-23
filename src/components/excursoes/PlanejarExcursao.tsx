import { useThemeRevision } from '../../hooks/useThemeRevision';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import EnderecoMapaPicker from '../EnderecoMapaPicker';
import { Field, Notice } from '../ui/Primitives';
import { salvarExcursao, salvarColetaExcursao, confirmarPersistenciaExcursao, type Excursao, type ParadaExcursao } from '../../services/excursoes';
import { errorMessage } from '../../config/api';
import { theme } from '../../styles/theme';
import { nomeLocalExibicao, nomeLocalGenerico, resolverEnderecoExcursao } from '../../services/enderecoReversoExcursao';
import { DataViagem } from './DataViagem';
import { AsyncAction } from './AcaoExcursao';
import { ActionButton, AtalhoViagem, BlocoViagem, CabecalhoViagem, DestinoHero, DadoViagem, EscolhaEmbarque, ItinerarioViagem, PaginaViagem, ProgressoViagem, dataViagem, horaViagem, trip, type PontoViagem } from './ViagemUI';
import { coletaMudou, coletaRascunho, dadosMudaram, dadosRascunho, momentos, rascunhoInicial, validarMomento, type Momento, type RascunhoViagem } from './Planejamento';
type EscolhaMapa={tipo:'destino'|'origem'|'parada';index?:number};
type Props={initial?:Excursao;visible?:boolean;initialMoment?:Momento;command?:number;latestVersion?:number;onClose:()=>void;onPersisted:(e:Excursao)=>void;onSaved:(id:number,e:Excursao)=>Promise<void>;onDirty?:(dirty:boolean)=>void;locked?:()=>boolean};
const descricoes={PORTA_A_PORTA:['home-outline','Porta a porta','Cada pessoa confirma seu próprio ponto na inscrição.'],PARADA_UNICA:['location-outline','Um ponto de encontro','A van encontra todo o grupo no mesmo lugar.'],MULTIPLAS_PARADAS:['map-outline','Vários pontos de encontro','Organize a sequência de embarques até o destino.']} as const;
export function PlanejarExcursao({initial,visible=true,initialMoment='Destino',command=0,latestVersion,onClose,onPersisted,onSaved,onDirty,locked}:Props) {
    useThemeRevision();
    const [d,setD]=useState<RascunhoViagem>(()=>rascunhoInicial(initial));
    const [base,setBase]=useState(initial),[momento,setMomento]=useState<Momento>(initialMoment),[erro,setErro]=useState('');
    const [mapa,setMapa]=useState<EscolhaMapa|null>(null),[candidato,setCandidato]=useState<PontoViagem|null>(null),[editando,setEditando]=useState<number|null>(null);
    const [busy,setBusy]=useState(false),[incerto,setIncerto]=useState(false),[parcial,setParcial]=useState(false);
    const [conferencia,setConferencia]=useState(false);
    const saved=useRef(initial),pending=useRef(false),mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    useEffect(()=>{if(visible){setMomento(initialMoment);setErro('');setMapa(null);}},[command]);
    const dirty=base?dadosMudaram(d,base)||coletaMudou(d,base):!!(d.titulo||d.destino||d.partida||d.capacidade);
    useEffect(()=>{onDirty?.(dirty);},[dirty,onDirty]);
    const steps=d.modo==='PORTA_A_PORTA'?momentos.filter(m=>m!=='Pontos'):[...momentos];
    const index=Math.max(0,steps.indexOf(momento));
    const update=(patch:Partial<RascunhoViagem>)=>{setD(v=>({...v,...patch}));setErro('');};
    const back=()=>{
        if(busy||locked?.())return;
        if(mapa){setMapa(null);setCandidato(null);return;}
        if(index>0){setMomento(steps[index-1]);setErro('');return;}
        onClose();
    };
    useFocusEffect(useCallback(()=>{
        if(!visible)return;
        const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{back();return true;});
        return()=>subscription.remove();
    },[visible,momento,mapa,busy,locked,onClose]));
    const advance=()=>{try{validarMomento(d,momento);setErro('');setMomento(steps[index+1]);}catch(e){setErro(errorMessage(e));}};
    const openMap=(tipo:EscolhaMapa['tipo'],i?:number)=>{setMapa({tipo,index:i});setCandidato(null);};
    const usePoint=()=>{
        if(!candidato||!mapa)return;
        if(mapa.tipo==='destino')update({destino:candidato});
        else if(mapa.tipo==='origem')update({origem:candidato});
        else if(mapa.index!=null)update({paradas:d.paradas.map((p,i)=>i===mapa.index?{...p,nome:candidato.nome,latitude:candidato.latitude,longitude:candidato.longitude}:p)});
        else update({paradas:[...d.paradas,{...candidato,id:null,horario:null,instrucoes:null}]});
        setMapa(null);setCandidato(null);
    };
    const move=(i:number,delta:number)=>{const next=[...d.paradas],to=i+delta;if(to<0||to>=next.length)return;[next[to],next[i]]=[next[i],next[to]];update({paradas:next});setEditando(null);};
    const changeStop=(i:number,patch:Partial<ParadaExcursao>)=>update({paradas:d.paradas.map((p,j)=>i===j?{...p,...patch}:p)});
    const persist=async()=>{
        if(pending.current)return;
        if(incerto)throw new Error('Confira suas viagens na lista antes de iniciar outra criação. O resultado anterior é desconhecido.');
        validarMomento(d,'Revisão');
        if(saved.current&&latestVersion!==undefined&&latestVersion>saved.current.versao)throw Object.assign(new Error('A versão salva mudou.'),{status:409});
        pending.current=true;setBusy(true);
        try{
            let actual=saved.current;
            if(!actual||dadosMudaram(d,actual)){
                try{actual=await salvarExcursao(actual?.id??null,dadosRascunho(d,actual?.versao));}
                catch(e){const status=(e as {status?:number}).status;if(!saved.current&&(!status||status>=500)){if(mounted.current)setIncerto(true);throw new Error('A criação pode ter sido registrada. Confira a lista de viagens; não repetiremos uma criação com resultado desconhecido.');}throw e;}
                saved.current=actual; // Keep the ID even if the next write or a refresh fails.
                if(!mounted.current)return;setBase(actual);setParcial(true);onPersisted(actual);
            }
            if(coletaMudou(d,actual)){
                actual=await salvarColetaExcursao(actual.id,d.modo,actual.versao,coletaRascunho(d));
                saved.current=actual;if(!mounted.current)return;setBase(actual);onPersisted(actual);
            }
            if(!mounted.current)return;
            setD(rascunhoInicial(actual));setBase(actual);setConferencia(true);
            const confirmado=await confirmarPersistenciaExcursao(actual.id,actual);
            if(!mounted.current)return;
            saved.current=confirmado;setD(rascunhoInicial(confirmado));setBase(confirmado);setParcial(false);setConferencia(false);
            await onSaved(confirmado.id,confirmado);
        }finally{pending.current=false;if(mounted.current)setBusy(false);}
    };
    if(!visible)return null;
    if(mapa){
        const current=mapa.tipo==='destino'?d.destino:mapa.tipo==='origem'?d.origem:mapa.index!=null?d.paradas[mapa.index]:null;
        return <PaginaViagem key={`mapa-${mapa.tipo}`} title={mapa.tipo==='destino'?'Nosso destino':mapa.tipo==='origem'?'Ponto de saída':'Ponto de embarque'} onBack={back} footer={<ActionButton variant="primary" title="Usar este ponto" disabled={!candidato} onPress={usePoint}/>}>
            <CabecalhoViagem title="Encontre o lugar" subtitle="Pesquise e confirme o pin no mapa."/>
            <View style={{minHeight:520,borderRadius:22,overflow:'hidden'}}><EnderecoMapaPicker localizacaoInicial={current} tipo={mapa.tipo==='destino'?'destino':mapa.tipo==='origem'?'origem':'endereco'} resolverEndereco={resolverEnderecoExcursao} onChange={setCandidato}/></View>
            {candidato&&<DadoViagem icon="location" text={candidato.nome}/>}
        </PaginaViagem>;
    }
    const footer=<>{momento==='Revisão'?<AsyncAction title={conferencia?'Conferir salvamento':base?'Salvar alterações':'Salvar viagem'} disabled={incerto||busy} confirmMessage={base&&coletaMudou(d,base)?'Salvar os embarques nesta ordem? Reservas existentes podem impedir a alteração.':undefined} action={persist}/>:<ActionButton variant="primary" title={momento==='Embarque'&&d.modo==='PORTA_A_PORTA'?'Revisar viagem':`Continuar${steps[index+1]==='Pontos'?' para os pontos':''}`} disabled={busy} icon="arrow-forward" onPress={advance}/>}
        <ActionButton title={index?'Etapa anterior':base?'Voltar à viagem':'Voltar'} disabled={busy} onPress={back}/></>;
    return <PaginaViagem key={momento} title={base?'Planejar viagem':'Nova viagem'} onBack={back} footer={footer}>
        <ProgressoViagem steps={steps} current={index}/>
        {!!erro&&<Notice>{erro}</Notice>}
        {conferencia&&<Notice>O salvamento foi recebido. Estamos conferindo os dados em uma nova consulta. Se a conexão falhar, use “Conferir salvamento”; a gravação já confirmada não será repetida.</Notice>}
        {d.retorno&&!d.origem&&<Notice>Para executar a volta, adicione o ponto de saída na etapa de destino. O grupo retornará a esse local.</Notice>}
        {d.modo==='PORTA_A_PORTA'&&d.paradas.length>0&&<Notice>Suas paradas continuam neste rascunho. Ao salvar porta a porta, elas sairão do cadastro. Volte ao modo anterior para mantê-las.</Notice>}
        <View pointerEvents={busy?'none':'auto'} style={{gap:16}}>
        {(nomeLocalGenerico(d.destino?.nome)&&!!d.destino||!!d.origem&&nomeLocalGenerico(d.origem.nome)||d.paradas.some(p=>nomeLocalGenerico(p.nome)))&&<Notice>Há locais sem endereço confirmado. Abra esses pontos no mapa para consultar e revisar a descrição antes de salvar.</Notice>}
        {latestVersion!==undefined&&base&&latestVersion>base.versao&&<Notice>A viagem mudou em outra sessão. Seu planejamento está aqui; volte à visão geral para atualizar a versão salva.</Notice>}
        {parcial&&<Notice>Os dados principais foram salvos. Confirme os embarques para concluir. A próxima tentativa usa a mesma viagem.</Notice>}
        {incerto&&<Notice>Confira a lista antes de criar outra viagem. A resposta da criação anterior não foi recebida.</Notice>}
        {momento==='Destino'&&<>
            <CabecalhoViagem eyebrow="Comece pelo lugar" title="Para onde vamos?" subtitle="Todo bom passeio começa com um destino."/>
            {d.destino?<><DestinoHero destino={d.destino.nome} titulo={d.titulo||'Sua próxima viagem'}/><ActionButton title="Trocar destino" icon="map-outline" onPress={()=>openMap('destino')}/><Field label="Nome da viagem" accessibilityLabel="Título da excursão" editable={!busy} placeholder="Como o grupo vai chamar essa viagem?" value={d.titulo} onChangeText={titulo=>update({titulo})}/></>:<Pressable accessibilityRole="button" accessibilityLabel="Escolher destino no mapa" onPress={()=>openMap('destino')} style={[trip.hero,{minHeight:230,justifyContent:'center',alignItems:'center'}]}><Ionicons name="compass-outline" size={58} color="#fff"/><Text style={trip.heroTitle}>Escolher destino</Text><Text style={trip.heroSubtitle}>Explore no mapa</Text></Pressable>}
            <AtalhoViagem title={d.origem?nomeLocalExibicao(d.origem.nome):'Adicionar ponto de saída'} detail="Opcional · diferente dos embarques" icon="navigate-outline" onPress={()=>openMap('origem')}/>
            {d.origem&&<ActionButton title="Remover ponto de saída" onPress={()=>update({origem:null})}/>}
        </>}
        {momento==='Datas'&&<>
            <CabecalhoViagem title="Quando vamos?" subtitle="Reserve o dia e o horário da aventura."/>
            <DataViagem label="Partida" value={d.partida} onChange={partida=>update({partida})}/><DataViagem label="Retorno" value={d.retorno} onChange={retorno=>update({retorno})} optional/>
            <BlocoViagem title="Quantas pessoas cabem na van?"><Field label="Lugares no total" accessibilityLabel="Capacidade" keyboardType="number-pad" placeholder="Quantidade de lugares" value={d.capacidade} onChangeText={capacidade=>update({capacidade})}/></BlocoViagem>
            <Text style={trip.caption}>Horários no fuso do aparelho: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</Text>
        </>}
        {momento==='Embarque'&&<>
            <CabecalhoViagem title="Como vamos nos encontrar?" subtitle="Escolha o embarque que combina com a viagem."/>
            {(Object.keys(descricoes) as Excursao['modoColeta'][]).map(m=><EscolhaEmbarque key={m} selected={d.modo===m} icon={descricoes[m][0]} title={descricoes[m][1]} description={descricoes[m][2]} onPress={()=>update({modo:m})}/>)}
        </>}
        {momento==='Pontos'&&<>
            <CabecalhoViagem title={d.modo==='PARADA_UNICA'?'Onde o grupo se encontra?':'Desenhe os encontros'} subtitle={d.modo==='PARADA_UNICA'?'Um lugar fácil de encontrar para todo mundo.':'Organize as paradas na ordem de embarque.'}/>
            <ItinerarioViagem origem={d.origem} destino={d.destino} paradas={d.paradas} mapa lista={false} onEditarPonto={openMap}/>
            {d.paradas.map((p,i)=><View key={p.id??`ponto-${i}`} style={trip.travelCard}>
                <View style={trip.cardTop}><View style={trip.dateBadge}><Text style={trip.day}>{i+1}</Text></View><View style={{flex:1,gap:4}}><Text style={trip.label}>{nomeLocalExibicao(p.nome)}</Text><Text style={trip.caption}>{p.horario||'Horário opcional'}</Text></View></View>
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><ActionButton title="Ajustar ponto" icon="create-outline" onPress={()=>setEditando(editando===i?null:i)}/><Pressable accessibilityRole="button" accessibilityLabel={`Mover ponto ${i+1} acima`} disabled={i===0} style={trip.iconButton} onPress={()=>move(i,-1)}><Ionicons name="arrow-up" size={22} color={i===0?theme.colors.border:theme.colors.primary}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Mover ponto ${i+1} abaixo`} disabled={i===d.paradas.length-1} style={trip.iconButton} onPress={()=>move(i,1)}><Ionicons name="arrow-down" size={22} color={i===d.paradas.length-1?theme.colors.border:theme.colors.primary}/></Pressable></View>
                {editando===i&&<><Field label="Nome do ponto" accessibilityLabel={`Nome da parada ${i+1}`} value={nomeLocalGenerico(p.nome)?'':p.nome} onChangeText={nome=>changeStop(i,{nome})}/><Field label="Horário do encontro" placeholder="HH:mm (opcional)" value={p.horario||''} onChangeText={horario=>changeStop(i,{horario:horario||null})}/><Field label="Como encontrar o ponto" placeholder="Instruções opcionais" value={p.instrucoes||''} onChangeText={instrucoes=>changeStop(i,{instrucoes:instrucoes||null})}/><ActionButton title="Mudar posição no mapa" onPress={()=>openMap('parada',i)}/><ActionButton variant="danger" title="Remover do planejamento" onPress={()=>{update({paradas:d.paradas.filter((_,j)=>j!==i)});setEditando(null);}}/></>}
            </View>)}
            <ActionButton title="Adicionar ponto no mapa" icon="add" disabled={d.paradas.length>=(d.modo==='PARADA_UNICA'?1:50)} onPress={()=>openMap('parada')}/>
        </>}
        {momento==='Revisão'&&<>
            <CabecalhoViagem title="Sua viagem está tomando forma" subtitle="Confira o plano antes de salvar."/>
            <DestinoHero destino={d.destino?.nome||'Escolha o destino'} titulo={d.titulo}/>
            <View style={trip.travelCard}><DadoViagem icon="calendar-outline" text={`${dataViagem(d.partida,{weekday:'short',day:'numeric',month:'long'})} · ${horaViagem(d.partida)}`}/>{!!d.retorno&&<DadoViagem icon="return-down-back-outline" text={`Retorno ${dataViagem(d.retorno)} · ${horaViagem(d.retorno)}`}/>}<DadoViagem icon="people-outline" text={`${d.capacidade||'—'} lugares no total`}/><DadoViagem icon={descricoes[d.modo][0]} text={descricoes[d.modo][1]}/></View>
            <BlocoViagem title="Nosso itinerário"><ItinerarioViagem origem={d.origem} destino={d.destino} paradas={coletaRascunho(d)} mapa/></BlocoViagem>
            <Text style={trip.muted}>Salvar não publica a viagem. Você decide quando abrir os convites.</Text>
        </>}
        </View>
    </PaginaViagem>;
}
