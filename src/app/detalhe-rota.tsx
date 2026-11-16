import { RemoteLoading, Screen, Section, ActionButton as Button, Field, Choice, Notice, ui } from '../components/ui/Primitives';
import { useRef,useState } from 'react';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { ScrollView,Text,TextInput,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buscarRotaPublica } from '../services/rotasPublicas';
import { meusEmbarques,solicitarEmbarque,solicitarVagaRota } from '../services/embarques';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { AsyncState } from '../components/AsyncState';
import EnderecoMapaPicker from '../components/EnderecoMapaPicker';
import MapaPreviaPublica from '../components/MapaPreviaPublica';
import type { EnderecoEncontrado } from '../services/enderecoSearch';
import { errorMessage } from '../config/api';
import { globalStyles as s } from '../styles/globalStyles';
import { ContatoProtegido } from '../components/ContatoProtegido';

export default function DetalheRota() {
    const dias:Record<string,string>={MONDAY:'Seg',TUESDAY:'Ter',WEDNESDAY:'Qua',THURSDAY:'Qui',FRIDAY:'Sex',SATURDAY:'Sáb',SUNDAY:'Dom'};
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
    return <Screen title="Detalhes da rota" subtitle="Conheça o trajeto antes de solicitar sua vaga." onBack={()=>router.back()}>
        {error?<AsyncState message={error} onRetry={reload}/>:!data?<RemoteLoading/>:<>
            <Section title={data.rota.nome}><Text style={ui.body}>{data.rota.cidade} · {data.rota.modo==='FIXA'?'Trajeto fixo':'Trajeto flexível'} · {data.rota.destinoNome}</Text>
            <ContatoProtegido key={data.rota.id} tipo="rotas-publicas" id={data.rota.id}/>
            <Text style={ui.body}>{data.rota.dias.map(d=>dias[d]||d).join(', ')} · Ida {data.rota.horarioIda||'—'} · Volta {data.rota.horarioVolta||'—'}</Text>
            <MapaPreviaPublica pontos={data.rota.paradas.map(p=>({...p,paradaId:p.id}))}/>
            </Section><Section title="Viajar nesta rota" description="O vínculo com a rota e a solicitação para uma data são etapas distintas. A aprovação depende do motorista.">
            <Button title="Solicitar vínculo com esta rota" disabled={busy} onPress={()=>{if(pending.current)return;pending.current=true;setBusy(true);void solicitarVagaRota(data.rota.id).then(r=>{setFeedback(`Vínculo ${r.status}.`);reload();}).catch(e=>setFeedback(errorMessage(e))).finally(()=>{pending.current=false;setBusy(false);});}}/>
            <Field label="Data do embarque" accessibilityLabel="Data da viagem no formato AAAA-MM-DD" placeholder="AAAA-MM-DD" value={dataOperacao} onChangeText={setData}/>
            <Button title={`Sentido: ${sentido}`} onPress={()=>setSentido(sentido==='IDA'?'VOLTA':'IDA')}/>
            {data.rota.paradas.map(p=><Choice key={p.id} selected={parada===p.id} label={p.nome} description={p.horario||undefined} onPress={()=>{setParada(p.id);setPonto(null);}}/>)}
            {data.rota.modo==='FLEXIVEL'&&<><Button title="Escolher ponto flexível" onPress={()=>setParada(null)}/>{!parada&&<EnderecoMapaPicker onChange={setPonto}/>}</>}
            <Button variant="primary" title={busy?'Enviando…':'Solicitar vaga neste embarque'} disabled={busy||!/^\d{4}-\d{2}-\d{2}$/.test(dataOperacao)||(!parada&&!ponto)} onPress={()=>void send()}/>
            <Text accessibilityLiveRegion="polite">{feedback}</Text>
            </Section><Section title="Meus pedidos nesta rota">{!data.pedidos.some(p=>p.rotaId===data.rota.id)&&<Text style={ui.body}>Você ainda não solicitou embarques nesta rota.</Text>}
            {data.pedidos.filter(p=>p.rotaId===data.rota.id).map(p=><View key={p.id} style={ui.section}><Text style={ui.body}>{p.dataOperacao} · {p.sentido} · {p.status}</Text></View>)}
        </Section></>}
    </Screen>;
}
