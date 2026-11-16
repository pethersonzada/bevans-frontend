import { View } from 'react-native';
import type { Excursao, ExecucaoExcursao } from '../../services/excursoes';
import type { Momento } from './Planejamento';
import { ActionButton, AtalhoViagem, BlocoViagem, DestinoHero, DadoViagem, EditarLink, ItinerarioViagem, dataViagem, horaViagem, trip } from './ViagemUI';
type Gestao='participantes'|'convites'|'operacao'|'publicacao';
export function VisaoGeralViagem({e,active,dirty,onEdit,onSection,onResume,onRefresh}:{e:Excursao;active?:ExecucaoExcursao;dirty:boolean;onEdit:(m:Momento)=>void;onSection:(s:Gestao)=>void;onResume:()=>void;onRefresh:()=>void}) {
    const origem=e.origemNome&&e.origemLatitude!=null&&e.origemLongitude!=null?{nome:e.origemNome,latitude:e.origemLatitude,longitude:e.origemLongitude}:null;
    const destino={nome:e.destinoNome,latitude:e.destinoLatitude,longitude:e.destinoLongitude};
    const editable=!['CANCELADA','CONCLUIDA'].includes(e.estado)&&!active;
    return <>
        <DestinoHero destino={e.destinoNome} titulo={e.titulo} estado={e.estado}/>
        {dirty&&<AtalhoViagem title="Seu planejamento está aqui" detail="Retomar alterações ainda não salvas" icon="create-outline" onPress={onResume}/>}
        <BlocoViagem title="Quando vamos" action={editable?<EditarLink onPress={()=>onEdit('Datas')}/>:undefined}>
            <View style={trip.travelCard}><DadoViagem icon="calendar-outline" text={`${dataViagem(e.partidaEm,{weekday:'long',day:'numeric',month:'long'})} · ${horaViagem(e.partidaEm)}`}/>{e.retornoEm&&<DadoViagem icon="return-down-back-outline" text={`Retorno ${dataViagem(e.retornoEm)} · ${horaViagem(e.retornoEm)}`}/>}<DadoViagem icon="people-outline" text={`${e.capacidade} lugares no total`}/></View>
        </BlocoViagem>
        {active?<AtalhoViagem title="A viagem está acontecendo" detail={`${active.sentido==='IDA'?'Ida':'Volta'} · acompanhar embarques`} icon="navigate" onPress={()=>onSection('operacao')}/>:e.estado==='RASCUNHO'?<ActionButton variant="primary" title="Preparar publicação" icon="checkmark-circle-outline" onPress={()=>onSection('publicacao')}/>:e.estado==='PUBLICADA'?<ActionButton variant="primary" title="Convidar o grupo" icon="paper-plane-outline" onPress={()=>onSection('convites')}/>:null}
        <BlocoViagem title="Nosso itinerário" action={editable?<EditarLink onPress={()=>onEdit('Destino')}/>:undefined}>
            <ItinerarioViagem origem={origem} destino={destino} paradas={e.paradas} mapa/>
        </BlocoViagem>
        {editable&&<AtalhoViagem title="Organizar embarques" detail={e.modoColeta==='PORTA_A_PORTA'?'Porta a porta · cada pessoa confirma seu ponto':`${e.paradas.length} ${e.paradas.length===1?'ponto de encontro':'pontos de encontro'}`} icon="location-outline" onPress={()=>onEdit(e.modoColeta==='PORTA_A_PORTA'?'Embarque':'Pontos')}/>}
        <BlocoViagem title="Organize o grupo">
            <AtalhoViagem title="Participantes e reservas" detail="Inscrições e confirmações" icon="people-outline" onPress={()=>onSection('participantes')}/>
            <AtalhoViagem title="Convites" detail="Compartilhar, recuperar e revogar links" icon="ticket-outline" onPress={()=>onSection('convites')}/>
            <AtalhoViagem title="Acompanhar viagem" detail="Ida, volta e controle de embarque" icon="bus-outline" onPress={()=>onSection('operacao')}/>
        </BlocoViagem>
        <BlocoViagem title="Planejamento">
            {editable&&<AtalhoViagem title="Editar a viagem" detail="Destino, datas e organização dos embarques" icon="options-outline" onPress={()=>onEdit('Destino')}/>}
            <ActionButton title="Atualizar versão salva" icon="refresh-outline" onPress={onRefresh}/>
        </BlocoViagem>
    </>;
}
