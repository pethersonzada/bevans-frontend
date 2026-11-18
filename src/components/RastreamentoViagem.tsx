import { useEffect,useState } from 'react';
import { useIsFocused } from 'expo-router/react-navigation';
import { Button,Text,View } from 'react-native';
import * as Location from 'expo-location';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { useFocusedPolling } from '../hooks/useFocusedPolling';
import { consultarGps,posicaoRecente,publicarGps } from '../services/rastreamento';
import { errorMessage } from '../config/api';
import MapaPreviaPublica from './MapaPreviaPublica';
export function RastreamentoViagem({tipo,id,motorista}:{tipo:string;id:string;motorista:boolean}) {
    const focused=useIsFocused();const [compartilhar,setCompartilhar]=useState(false),[erro,setErro]=useState(''),[agora,setAgora]=useState(Date.now());
    const [finalizada,setFinalizada]=useState(false);
    const {data,error}=useRemoteResource(finalizada?false:`gps:${tipo}:${id}`,async signal=>{const p=await consultarGps(tipo,id,signal);if(!signal.aborted&&p.estado==='FINALIZADA'){setFinalizada(true);setCompartilhar(false);}return p;},10000);
    useEffect(()=>{if(!focused)return;const timer=setInterval(()=>setAgora(Date.now()),1000);return()=>clearInterval(timer);},[focused]);
    useFocusedPolling(async signal=>{
        try {const permission=await Location.getForegroundPermissionsAsync();if(signal.aborted)return;if(permission.status!=='granted')throw new Error('Permissão de localização revogada.');
            if(!await Location.hasServicesEnabledAsync())throw new Error('GPS desligado.');
            const loc=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});if(signal.aborted)return;
            if(loc.coords.accuracy==null)throw new Error('Precisão do GPS indisponível.');
            await publicarGps(tipo,id,{latitude:loc.coords.latitude,longitude:loc.coords.longitude,precisao:loc.coords.accuracy,observadoEm:new Date(loc.timestamp).toISOString(),amostraId:`gps-${loc.timestamp}-${Math.random().toString(36).slice(2)}`},signal);if(!signal.aborted)setErro('');
        }catch(e){if(!signal.aborted){setErro(errorMessage(e));setCompartilhar(false);}}
    },10000,motorista&&compartilhar&&data&&!error&&!finalizada?`${tipo}:${id}`:false);
    const p=focused&&!error?posicaoRecente(data,agora):null;
    return <View style={{gap:8}}><Text>{finalizada?'Viagem encerrada':p?'Localização atualizada':'Localização indisponível ou desatualizada'}</Text>
        {data?.observadoEm&&<Text>Última atualização: {new Date(data.observadoEm).toLocaleString('pt-BR')}</Text>}
        <Text accessibilityLiveRegion="polite">{error||erro}</Text>
        {p&&<MapaPreviaPublica pontos={[{...p,nome:'Van',paradaId:null}]}/>}
        {motorista&&!finalizada&&<Button title={compartilhar?'Parar compartilhamento GPS':'Compartilhar GPS nesta viagem'} onPress={()=>{if(compartilhar){setCompartilhar(false);return;}void Location.requestForegroundPermissionsAsync().then(r=>{if(r.status==='granted')setCompartilhar(true);else setErro('Permissão de localização negada.');}).catch(e=>setErro(errorMessage(e)));}}/>}
    </View>;
}
