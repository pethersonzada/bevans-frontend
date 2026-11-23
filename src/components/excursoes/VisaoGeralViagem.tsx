import { useThemeRevision } from '../../hooks/useThemeRevision';
import { View } from 'react-native';
import type { Excursao, ExecucaoExcursao } from '../../services/excursoes';
import type { Momento } from './Planejamento';
import { ActionButton, AtalhoViagem, BlocoViagem, DestinoHero, DadoViagem, EditarLink, ItinerarioViagem, dataViagem, horaViagem, trip } from './ViagemUI';
import { useNomesExcursao } from './useNomesExcursao';
import { Notice } from '../ui/Primitives';
type Gestao='participantes'|'convites'|'operacao'|'publicacao';
export function VisaoGeralViagem({e:original,active,dirty,onEdit,onSection,onResume,onRefresh,hasExecutions=false}:{e:Excursao;active?:ExecucaoExcursao;dirty:boolean;onEdit:(m:Momento)=>void;onSection:(s:Gestao)=>void;onResume:()=>void;onRefresh:()=>void;hasExecutions?:boolean}) {
    useThemeRevision();
    const {exibicao:e,consultando,consultados,falhas}=useNomesExcursao(original);
    const origem=e.origemNome&&e.origemLatitude!=null&&e.origemLongitude!=null?{nome:e.origemNome,latitude:e.origemLatitude,longitude:e.origemLongitude}:null;
    const destino={nome:e.destinoNome,latitude:e.destinoLatitude,longitude:e.destinoLongitude};
    const editable=!['CANCELADA','CONCLUIDA'].includes(e.estado)&&!active&&!hasExecutions&&Date.parse(e.partidaEm)>Date.now();
    return <>
        <DestinoHero destino={e.destinoNome} titulo={e.titulo} estado={e.estado}/>
        {consultando&&<Notice>Consultando os endereços que ainda não foram identificados.</Notice>}
        {consultados>0&&<Notice>Endereços consultados pelas coordenadas. Confirme os pontos no planejamento para salvar essas descrições.</Notice>}
        {falhas>0&&<Notice>Alguns endereços não puderam ser consultados. Abra os pontos no planejamento para informar uma descrição.</Notice>}
        {dirty&&<AtalhoViagem title="Seu planejamento está aqui" detail="Retomar alterações ainda não salvas" icon="create-outline" onPress={onResume}/>}
        <BlocoViagem title="Quando vamos" action={editable?<EditarLink onPress={()=>onEdit('Datas')}/>:undefined}>
            <View style={trip.travelCard}><DadoViagem icon="calendar-outline" text={`${dataViagem(e.partidaEm,{weekday:'long',day:'numeric',month:'long'})} · ${horaViagem(e.partidaEm)}`}/>{e.retornoEm&&<DadoViagem icon="return-down-back-outline" text={`Retorno ${dataViagem(e.retornoEm)} · ${horaViagem(e.retornoEm)}`}/>}<DadoViagem icon="people-outline" text={`${e.capacidade} lugares no total`}/></View>
        </BlocoViagem>
        {active?<AtalhoViagem title="A viagem está acontecendo" detail={`${active.sentido==='IDA'?'Ida':'Volta'} · acompanhar embarques`} icon="navigate" onPress={()=>onSection('operacao')}/>:e.estado==='RASCUNHO'?<ActionButton variant="primary" title="Preparar publicação" icon="checkmark-circle-outline" onPress={()=>onSection('publicacao')}/>:e.estado==='PUBLICADA'?<ActionButton variant="primary" title={hasExecutions?'Continuar a operação':'Convidar o grupo'} icon={hasExecutions?'bus-outline':'paper-plane-outline'} onPress={()=>onSection(hasExecutions?'operacao':'convites')}/>:null}
        <BlocoViagem title="Nosso itinerário" action={editable?<EditarLink onPress={()=>onEdit('Destino')}/>:undefined}>
            <ItinerarioViagem origem={origem} destino={destino} paradas={e.paradas} mapa/>
        </BlocoViagem>
        {editable&&<AtalhoViagem title="Organizar embarques" detail={e.modoColeta==='PORTA_A_PORTA'?'Porta a porta · cada pessoa confirma seu ponto':`${e.paradas.length} ${e.paradas.length===1?'ponto de encontro':'pontos de encontro'}`} icon="location-outline" onPress={()=>onEdit(e.modoColeta==='PORTA_A_PORTA'?'Embarque':'Pontos')}/>}
        <BlocoViagem title="Sua excursão em cinco partes">
            {editable&&<><AtalhoViagem title="1. Informações da viagem" detail="Nome, locais, datas, horários e capacidade" icon="calendar-outline" onPress={()=>onEdit('Destino')}/>
            <AtalhoViagem title="2. Embarques" detail="Como buscar o grupo e organizar as paradas" icon="location-outline" onPress={()=>onEdit('Embarque')}/>
            <AtalhoViagem title="3. Revisão" detail="Conferir os dados salvos antes de publicar" icon="checkmark-circle-outline" onPress={()=>onSection('publicacao')}/></>}
            <AtalhoViagem title="4. Participantes e convites" detail="Inscrições, confirmações e links do grupo" icon="people-outline" onPress={()=>onSection('participantes')}/>
            <AtalhoViagem title="5. Operação" detail="Conferir roteiro, iniciar e finalizar cada trecho" icon="bus-outline" onPress={()=>onSection('operacao')}/>
        </BlocoViagem>
        <BlocoViagem title="Planejamento">
            {!editable&&<Notice>A edição está encerrada para esta viagem. Consulte o roteiro salvo e o controle de embarque na operação.</Notice>}
            <ActionButton title="Atualizar versão salva" icon="refresh-outline" onPress={onRefresh}/>
        </BlocoViagem>
    </>;
}
