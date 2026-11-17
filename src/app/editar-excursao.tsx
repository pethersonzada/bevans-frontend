import { VisaoGeralViagem } from '../components/excursoes/VisaoGeralViagem';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { buscarExcursao, acaoExcursao, listarExecucoes, iniciarExcursao, finalizarExcursao, type Excursao } from '../services/excursoes';
import { useNetInfo } from '@react-native-community/netinfo';
import { AsyncState } from '../components/AsyncState';
import { AppModal } from '../components/AppModal';
import { Notice, RemoteLoading } from '../components/ui/Primitives';
import { ExcursaoActionContext } from '../components/ExcursaoActionContext';
import { GestaoExcursao } from '../components/GestaoExcursao';
import { PlanejarExcursao } from '../components/excursoes/PlanejarExcursao';
import type { Momento } from '../components/excursoes/Planejamento';
import { ConvitesViagem } from '../components/excursoes/ConvitesViagem';
import { AsyncAction } from '../components/excursoes/AcaoExcursao';
import { ActionButton, BlocoViagem, CabecalhoViagem, DestinoHero, DadoViagem, PaginaViagem, dataViagem, horaViagem, trip } from '../components/excursoes/ViagemUI';
export { AsyncAction } from '../components/excursoes/AcaoExcursao';
export { PlanejarExcursao as Editor } from '../components/excursoes/PlanejarExcursao';
type Vista='visao'|'planejar'|'convites'|'participantes'|'operacao'|'publicacao';
export default function EditarExcursao() {
    const {id}=useLocalSearchParams<{id?:string}>(),{user}=useAuth();
    return <TelaExcursao key={`${user.id}:${id||'nova'}`} id={id} motorista={user.tipo==='MOTORISTA'}/>;
}
export function TelaExcursao({id,motorista}:{id?:string;motorista:boolean}) {
    const router=useRouter(),network=useNetInfo();
    const [snapshot,setSnapshot]=useState<Excursao|null>(null),[vista,setVista]=useState<Vista>(id?'visao':'planejar');
    const [momento,setMomento]=useState<Momento>('Destino'),[command,setCommand]=useState(0),[revision,setRevision]=useState(0);
    const [dirty,setDirty]=useState(false),[confirmarSaida,setConfirmarSaida]=useState(false),[descartar,setDescartar]=useState(false);
    const lock=useRef(false),mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    const effectiveId=id||(snapshot?String(snapshot.id):undefined);
    const resource=useRemoteResource(effectiveId&&motorista?`excursao:${effectiveId}`:false,signal=>buscarExcursao(effectiveId!,signal));
    const execucoes=useRemoteResource(effectiveId&&motorista?`execucoes-excursao:${effectiveId}`:false,signal=>listarExecucoes(Number(effectiveId),signal));
    useEffect(()=>{
        if(!resource.data)return;
        if(!snapshot){setSnapshot(resource.data);return;}
        // Refresh the read-only journey without replacing a plan being edited.
        if(!dirty&&vista!=='planejar'&&!lock.current&&(resource.data.versao>snapshot.versao||(resource.data.versao===snapshot.versao&&resource.data.estado!==snapshot.estado))){
            setSnapshot(resource.data);setRevision(v=>v+1);
        }
    },[resource.data,snapshot,dirty,vista]);
    const locked=useCallback(()=>lock.current,[]);
    const onDirty=useCallback((value:boolean)=>setDirty(value),[]);
    const edit=(m:Momento)=>{setMomento(m);setCommand(v=>v+1);setVista('planejar');};
    const leave=()=>{if(lock.current)return;if(dirty){setConfirmarSaida(true);return;}router.back();};
    const back=()=>{if(lock.current)return;if(vista==='visao'||(!snapshot&&vista==='planejar'))leave();else setVista('visao');};
    useFocusEffect(useCallback(()=>{
        if(vista==='planejar')return;
        const sub=BackHandler.addEventListener('hardwareBackPress',()=>{back();return true;});return()=>sub.remove();
    },[vista,dirty,router]));
    const saved=async(newId:number,e:Excursao)=>{
        if(!mounted.current)return;
        setSnapshot(e);setDirty(false);resource.reload();execucoes.reload();setVista('visao');
        if(!id)router.replace({pathname:'/editar-excursao',params:{id:String(newId)}});
    };
    const updateSaved=(e:Excursao)=>{if(mounted.current)setSnapshot(e);};
    const e=snapshot;
    const offline=network.isConnected===false||network.isInternetReachable===false;
    const active=execucoes.data?.find(v=>v.estado==='EM_ANDAMENTO');
    const idaFinalizada=execucoes.data?.some(v=>v.sentido==='IDA'&&v.estado==='FINALIZADA')===true;
    if(!motorista)return <PaginaViagem title="Excursão" onBack={()=>router.back()}><AsyncState message="A gestão exige perfil de motorista."/></PaginaViagem>;
    return <ExcursaoActionContext.Provider value={lock}>
        {(e||!id)&&<PlanejarExcursao key={revision} initial={e||undefined} visible={vista==='planejar'} initialMoment={momento} command={command} latestVersion={resource.data?.versao} onClose={back} onPersisted={updateSaved} onSaved={saved} onDirty={onDirty} locked={locked}/>}
        {vista!=='planejar'&&<PaginaViagem title={vista==='visao'?'Sua viagem':vista==='convites'?'Convites':vista==='participantes'?'Participantes':vista==='operacao'?'Acompanhar viagem':'Revisar publicação'} onBack={back}>
            {offline&&<Notice>Sem conexão. Os dados salvos podem estar desatualizados.</Notice>}
            {!!resource.error&&<AsyncState message={resource.error} onRetry={resource.reload}/>}
            {!e?!resource.error&&<RemoteLoading/>:<>
                {resource.data&&resource.data.versao>e.versao&&<Notice>Há uma versão mais recente no servidor. Atualize a versão salva para revisar, sem sobrescrever seu planejamento.</Notice>}
                {vista==='visao'&&<VisaoGeralViagem e={e} active={active} dirty={dirty} onEdit={edit} onSection={setVista} onResume={()=>edit(momento)} onRefresh={()=>setDescartar(true)}/>}
                {vista==='convites'&&<ConvitesViagem key={e.id} e={e}/>}
                {vista==='participantes'&&<><CabecalhoViagem title="Quem vai com a gente?" subtitle={e.titulo}/><GestaoExcursao key={e.id} id={e.id} secao="participantes"/></>}
                {vista==='publicacao'&&<><CabecalhoViagem title="Tudo pronto para convidar?" subtitle="Confira o que está salvo antes de publicar."/><DestinoHero destino={e.destinoNome} titulo={e.titulo} estado={e.estado}/><View style={trip.travelCard}><DadoViagem icon="calendar-outline" text={`${dataViagem(e.partidaEm)} · ${horaViagem(e.partidaEm)}`}/><DadoViagem icon="people-outline" text={`${e.capacidade} lugares no total`}/><DadoViagem icon="location-outline" text={e.modoColeta==='PORTA_A_PORTA'?'Porta a porta':`${e.paradas.length} pontos de encontro`}/></View>{dirty&&<Notice>Há alterações não salvas. Retome o planejamento antes de publicar.</Notice>}<AsyncAction title="Publicar excursão" disabled={dirty||offline} confirmMessage="Publicar a versão salva e permitir criar convites?" action={async()=>{const actual=await acaoExcursao(e.id,'publicacao',e.versao);await saved(actual.id,actual);}}/></>}
                {vista==='operacao'&&<>
                    <CabecalhoViagem title="Hora de viajar" subtitle={e.titulo}/>
                    {!!execucoes.error&&<AsyncState message={execucoes.error} onRetry={execucoes.reload}/>}
                    {!execucoes.data&&!execucoes.error&&<RemoteLoading/>}
                    {execucoes.data?.map(v=><View key={v.id} style={trip.travelCard}><Text style={trip.eyebrow}>{v.sentido==='IDA'?'Ida':'Volta'}</Text><Text style={trip.sectionTitle}>{v.estado==='EM_ANDAMENTO'?'Em andamento':v.estado==='FINALIZADA'?'Finalizada':'Cancelada'}</Text><ActionButton variant={v.estado==='EM_ANDAMENTO'?'primary':'secondary'} title="Controle de embarque" onPress={()=>router.push({pathname:'/controle-viagem',params:{tipo:'EXCURSAO',id:String(v.id)}})}/>{v.estado==='EM_ANDAMENTO'&&<AsyncAction variant="secondary" title="Finalizar execução" confirmMessage="Encerrar esta execução? Confirme os desembarques reais antes de finalizar." action={async()=>{await finalizarExcursao(e.id,v.id);resource.reload();execucoes.reload();}}/>}</View>)}
                    <BlocoViagem title="Iniciar um trecho">
                        {e.estado!=='PUBLICADA'&&<Notice>Publique a excursão antes de iniciar. O roteiro pode ser conferido abaixo.</Notice>}
                        {active&&<Notice>Há uma execução em andamento. Finalize-a e registre os desembarques antes de iniciar outro trecho.</Notice>}
                        {(['IDA','VOLTA'] as const).map(sentido=>{
                            const jaExecutada=execucoes.data?.some(v=>v.sentido===sentido)===true;
                            const faltaOrigem=sentido==='VOLTA'&&(e.retornoEm==null||e.origemLatitude==null||e.origemLongitude==null);
                            const faltaIda=sentido==='VOLTA'&&!idaFinalizada;
                            const permitido=!!execucoes.data&&!active&&!jaExecutada&&!faltaOrigem&&!faltaIda&&e.estado==='PUBLICADA';
                            const motivo=!execucoes.data?'Aguardando o estado da execução.':jaExecutada?'Este trecho já foi iniciado ou encerrado.':faltaIda?'Finalize a ida antes da volta.':faltaOrigem?'Configure a origem e o horário de retorno.':null;
                            return <View key={sentido} style={{gap:6}}>
                                <AsyncAction title={`Iniciar execução ${sentido}`} disabled={offline||dirty||!permitido} confirmMessage="Iniciar com os participantes confirmados? A execução bloqueia alterações dos embarques." action={async()=>{await iniciarExcursao(e.id,sentido);resource.reload();execucoes.reload();}}/>
                                {motivo&&<Text style={trip.caption}>{motivo}</Text>}
                            </View>;
                        })}
                    </BlocoViagem>
                    <GestaoExcursao id={e.id} secao="roteiro" origemConfigurada={e.origemLatitude!=null&&e.origemLongitude!=null} onConfigurarOrigem={()=>edit('Destino')} executados={execucoes.data?.map(v=>v.sentido)}/>
                    <AsyncAction variant="danger" title="Cancelar excursão" disabled={offline} confirmMessage="Cancelar esta viagem? A ação afeta as inscrições e não reabre a excursão." action={async()=>{const actual=await acaoExcursao(e.id,'cancelamento',e.versao);await saved(actual.id,actual);}}/>
                </>}
            </>}
        </PaginaViagem>}
        {vista==='planejar'&&id&&!e&&<PaginaViagem title="Sua viagem" onBack={back}>{resource.error?<AsyncState message={resource.error} onRetry={resource.reload}/>:<RemoteLoading/>}</PaginaViagem>}
        <AppModal visible={confirmarSaida||descartar} transparent animationType="fade" onRequestClose={()=>{setConfirmarSaida(false);setDescartar(false);}}>
            <View style={{flex:1,backgroundColor:'#0008',justifyContent:'center',padding:24}}><View style={trip.travelCard}><Text style={trip.sectionTitle}>{descartar?'Atualizar o planejamento?':'Sair desta viagem?'}</Text><Text style={trip.body}>{descartar?'A versão do servidor substituirá as alterações ainda não salvas.':'O planejamento ainda não salvo será perdido ao sair desta tela.'}</Text>
                {descartar?<AsyncAction title="Confirmar descarte" action={async()=>{if(effectiveId){const actual=await buscarExcursao(effectiveId);setSnapshot(actual);setRevision(v=>v+1);setDirty(false);resource.reload();}setDescartar(false);}}/>:<ActionButton title="Sair sem salvar" variant="danger" onPress={()=>{setConfirmarSaida(false);router.back();}}/>}
                <ActionButton title="Manter planejamento" onPress={()=>{setConfirmarSaida(false);setDescartar(false);}}/>
            </View></View>
        </AppModal>
    </ExcursaoActionContext.Provider>;
}
