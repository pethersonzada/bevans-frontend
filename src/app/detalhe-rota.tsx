import { useRef,useState } from 'react';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { ScrollView,Text,Button,TextInput,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buscarRotaPublica } from '../services/rotasPublicas';
import { meusEmbarques,solicitarEmbarque } from '../services/embarques';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { AsyncState } from '../components/AsyncState';
import EnderecoMapaPicker from '../components/EnderecoMapaPicker';
import MapaPreviaPublica from '../components/MapaPreviaPublica';
import type { EnderecoEncontrado } from '../services/enderecoSearch';
import { errorMessage } from '../config/api';
import { globalStyles as s } from '../styles/globalStyles';

export default function DetalheRota() {
    const {id}=useLocalSearchParams<{id:string}>();const router=useRouter();
    const {data,error,reload}=useRemoteResource(`rota:${id}`,async signal=>{const [rota,pedidos]=await Promise.all([buscarRotaPublica(id),meusEmbarques(signal)]);return {rota,pedidos};});
    const [parada,setParada]=useState<number|null>(null),[ponto,setPonto]=useState<EnderecoEncontrado|null>(null);
    const [dataOperacao,setData]=useState(''),[sentido,setSentido]=useState<'IDA'|'VOLTA'>('IDA');
    const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');const pending=useRef(false);
    const send=async()=>{
        if(!data||pending.current)return;pending.current=true;setBusy(true);setFeedback('');
        try {const pedido=await solicitarEmbarque(data.rota.id,{dataOperacao,sentido,...(parada?{paradaId:parada}:ponto?{nomePonto:ponto.nome,latitude:ponto.latitude,longitude:ponto.longitude,pontoConfirmado:true}:{})});setFeedback(`Solicitação ${pedido.status}. Aprovação não significa embarque.`);reload();}
        catch(e){setFeedback(errorMessage(e));}finally{pending.current=false;setBusy(false);}
    };
    return <SafeAreaView style={{flex:1}}><ScrollView contentContainerStyle={{padding:16,gap:12}} keyboardShouldPersistTaps="handled">
        <Button title="Voltar" onPress={()=>router.back()}/>
        {error?<AsyncState message={error} onRetry={reload}/>:!data?<AsyncState loading/>:<>
            <Text style={s.title}>{data.rota.nome}</Text><Text>{data.rota.cidade} · {data.rota.modo} · {data.rota.destinoNome}</Text>
            <Text>{data.rota.dias.join(', ')} · Ida {data.rota.horarioIda||'—'} · Volta {data.rota.horarioVolta||'—'}</Text>
            <MapaPreviaPublica pontos={data.rota.paradas.map(p=>({...p,paradaId:p.id}))}/>
            <Text accessibilityRole="header">Solicitar embarque</Text>
            <TextInput style={s.input} accessibilityLabel="Data da viagem no formato AAAA-MM-DD" placeholder="AAAA-MM-DD" value={dataOperacao} onChangeText={setData}/>
            <Button title={`Sentido: ${sentido}`} onPress={()=>setSentido(sentido==='IDA'?'VOLTA':'IDA')}/>
            {data.rota.paradas.map(p=><Button key={p.id} title={`${parada===p.id?'✓ ':''}${p.nome} ${p.horario||''}`} onPress={()=>{setParada(p.id);setPonto(null);}}/>)}
            {data.rota.modo==='FLEXIVEL'&&<><Button title="Escolher ponto flexível" onPress={()=>setParada(null)}/>{!parada&&<EnderecoMapaPicker onChange={setPonto}/>}</>}
            <Button title={busy?'Enviando…':'Solicitar vaga neste embarque'} disabled={busy||!/^\d{4}-\d{2}-\d{2}$/.test(dataOperacao)||(!parada&&!ponto)} onPress={()=>void send()}/>
            <Text accessibilityLiveRegion="polite">{feedback}</Text>
            <Text accessibilityRole="header">Meus pedidos nesta rota</Text>
            {data.pedidos.filter(p=>p.rotaId===data.rota.id).map(p=><View key={p.id} style={s.card}><Text>{p.dataOperacao} · {p.sentido} · {p.status}</Text></View>)}
        </>}
    </ScrollView></SafeAreaView>;
}
