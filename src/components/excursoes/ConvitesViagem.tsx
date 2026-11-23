import { useThemeRevision } from '../../hooks/useThemeRevision';
import { useEffect, useState } from 'react';
import { Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Excursao } from '../../services/excursoes';
import { estadoConviteCompartilhamento, onConvitesChanged, prepararConviteCompartilhamento, recuperarLinkConvite, autorizarNovaEmissaoAposRevisao } from '../../services/convitesCompartilhamento';
import { compartilharConviteSeguro } from '../../services/excursaoFormulario';
import { Notice } from '../ui/Primitives';
import { GestaoExcursao } from '../GestaoExcursao';
import { AsyncAction } from './AcaoExcursao';
import { DataViagem } from './DataViagem';
import { ActionButton, CabecalhoViagem, trip } from './ViagemUI';
export function ConvitesViagem({e,execucoesCriadas=false,consultandoExecucoes=false}:{e:Excursao;execucoesCriadas?:boolean;consultandoExecucoes?:boolean}) {
    useThemeRevision();
    const [expira,setExpira]=useState(''),[help,setHelp]=useState(false);
    const [pendente,setPendente]=useState<ReturnType<typeof estadoConviteCompartilhamento>>(null);
    useEffect(()=>{const refresh=()=>setPendente(estadoConviteCompartilhamento(e.id));refresh();return onConvitesChanged(refresh);},[e.id]);
    const podeCompartilhar=e.estado==='PUBLICADA'&&!execucoesCriadas&&!consultandoExecucoes&&Date.parse(e.partidaEm)>Date.now()&&!!process.env.EXPO_PUBLIC_CONVITE_WEB_URL;
    return <>
        <CabecalhoViagem title="Chame o grupo" subtitle="Um link seguro para cada pessoa solicitar sua inscrição."/>
        {e.estado!=='PUBLICADA'&&<Notice>Publique a viagem antes de criar convites.</Notice>}
        {execucoesCriadas&&<Notice>As inscrições estão encerradas após o início da excursão. Os convites existentes podem ser consultados e revogados.</Notice>}
        {consultandoExecucoes&&<Notice>Consultando se as inscrições continuam abertas.</Notice>}
        <View style={trip.travelCard}>
            {podeCompartilhar&&!pendente?.id&&<DataViagem label="Validade do convite" value={expira} onChange={setExpira}/>}
            {!process.env.EXPO_PUBLIC_CONVITE_WEB_URL&&<Notice>A página de inscrições ainda não está configurada. Os convites existentes podem ser consultados e revogados.</Notice>}
            <AsyncAction title={pendente?.id?'Compartilhar convite criado novamente':'Gerar e compartilhar convite'} disabled={!podeCompartilhar} action={async()=>{
                const pronto=await prepararConviteCompartilhamento(e.id,expira,e.partidaEm,process.env.EXPO_PUBLIC_CONVITE_WEB_URL);
                pronto.registrarResultado(await compartilharConviteSeguro(pronto.link,link=>Share.share({message:link}),Share.sharedAction));
            }}/>
            {!!pendente?.id&&<AsyncAction variant="secondary" title="Copiar link do convite recuperado" disabled={!podeCompartilhar} action={async()=>{
                const pronto=await recuperarLinkConvite(e.id,process.env.EXPO_PUBLIC_CONVITE_WEB_URL);
                try{await Clipboard.setStringAsync(pronto.link);}catch{throw new Error('Não foi possível copiar. O convite continua nesta sessão.');}
                pronto.registrarResultado('Link copiado. Isso não confirma envio ou inscrição.');
            }}/>}
            {pendente?.incerto&&<AsyncAction variant="secondary" title="Autorizar outra emissão após revisar a lista" confirmMessage="Confira e revogue os convites sem link antes de permitir uma nova emissão manual." action={()=>autorizarNovaEmissaoAposRevisao(e.id)}/>}
            {!!pendente?.aviso&&<Text accessibilityLiveRegion="polite" style={trip.body}>{pendente.aviso}</Text>}
            <ActionButton title={help?'Ocultar orientações':'Sobre este link'} icon="information-circle-outline" onPress={()=>setHelp(v=>!v)}/>
            {help&&<Text style={trip.muted}>Cancelar o compartilhamento não revoga o convite. O link fica recuperável nesta sessão; sair da conta ou fechar o app perde a cópia em memória. A lista não recupera o segredo: revogue convites sem link antes de emitir outro.</Text>}
        </View>
        <GestaoExcursao id={e.id} secao="convites"/>
    </>;
}
