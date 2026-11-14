import { useRef,useState } from 'react';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { ScrollView,Text,Button,View,TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { consultarOperacao,alterarEstadoOperacional,type RegistroOperacional,type EstadoOperacional } from '../services/operacoes';
import { AsyncState } from '../components/AsyncState';
import { errorMessage } from '../config/api';
import { globalStyles as s } from '../styles/globalStyles';
import { RastreamentoViagem } from '../components/RastreamentoViagem';
export default function ControleViagem() {
    const {tipo,id}=useLocalSearchParams<{tipo:string;id:string}>();const {user}=useAuth();const router=useRouter();const motorista=user.tipo==='MOTORISTA';
    const {data,error,reload}=useRemoteResource(`operacao:${tipo}:${id}:${motorista}`,signal=>consultarOperacao(tipo,id,motorista,signal),10000);
    const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');const pending=useRef(false);
    const [motivo,setMotivo]=useState('');
    const alterar=async(r:RegistroOperacional,estado:EstadoOperacional,correcao=false)=>{
        if(pending.current)return;pending.current=true;setBusy(true);setFeedback('');
        try{await alterarEstadoOperacional(tipo,id,r,motorista,estado,correcao?motivo:undefined);setFeedback('Estado confirmado pelo servidor.');}
        catch(e){setFeedback(errorMessage(e));}finally{reload();pending.current=false;setBusy(false);}
    };
    const registros=data?('registros'in data?data.registros:[data]):[];
    return <SafeAreaView style={{flex:1}}><ScrollView contentContainerStyle={{padding:16,gap:12}}>
        <Button title="Voltar" onPress={()=>router.back()}/><Text style={s.title}>Controle da viagem</Text>
        <Text>{tipo} · execução {id}</Text><Text>Presença planejada e GPS não confirmam embarque.</Text>
        <RastreamentoViagem key={`${tipo}:${id}`} tipo={tipo} id={id} motorista={motorista}/>
        <Text accessibilityLiveRegion="polite">{feedback}</Text>
        {error?<AsyncState message={error} onRetry={reload}/>:!data?<AsyncState loading/>:<>
            {'contadores'in data&&<Text>{data.sentido} · Esperados {data.contadores.esperados} · Aguardando {data.contadores.aguardando} · Na van {data.contadores.naVan} · Não embarcaram {data.contadores.naoEmbarcaram} · Desembarcados {data.contadores.desembarcados}</Text>}
            {motorista&&<TextInput style={s.input} accessibilityLabel="Motivo da correção" placeholder="Motivo obrigatório para corrigir" value={motivo} maxLength={500} onChangeText={setMotivo}/>}
            {registros.map(r=><View key={r.id} style={s.card}><Text>{motorista?r.nome:'Meu estado'} · {r.estado}</Text><Text>{r.autor} · {r.atualizadoEm?new Date(r.atualizadoEm).toLocaleString('pt-BR'):''}</Text>
                <Button title={motorista?'Confirmar embarque':'Embarquei'} disabled={busy||r.estado!=='AGUARDANDO'} onPress={()=>void alterar(r,'EMBARCADO')}/>
                <Button title={motorista?'Confirmar desembarque':'Desembarquei'} disabled={busy||r.estado!=='EMBARCADO'} onPress={()=>void alterar(r,'DESEMBARCADO')}/>
                {motorista&&<><Button title="Não embarcou" disabled={busy||r.estado!=='AGUARDANDO'} onPress={()=>void alterar(r,'NAO_EMBARCOU')}/><Button title="Corrigir para aguardando" disabled={busy||!motivo.trim()} onPress={()=>void alterar(r,'AGUARDANDO',true)}/></>}
            </View>)}
        </>}
    </ScrollView></SafeAreaView>;
}
