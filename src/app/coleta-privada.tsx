import { useRef,useState } from 'react';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { ScrollView,Text,TextInput,Button,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { consultarColetaPrivada,salvarColetaPrivada,escolherParadaPrivada,type ColetaPrivada,type ParadaPrivada } from '../services/coletaPrivada';
import { AsyncState } from '../components/AsyncState';
import EnderecoMapaPicker from '../components/EnderecoMapaPicker';
import MapaPreviaPublica from '../components/MapaPreviaPublica';
import { errorMessage } from '../config/api';
import { globalStyles as s } from '../styles/globalStyles';
import { apiRequest } from '../config/api';
export default function ColetaPrivadaScreen(){
    const {turmaId}=useLocalSearchParams<{turmaId:string}>();const {user}=useAuth();const router=useRouter();
    const [sentido,setSentido]=useState<'IDA'|'VOLTA'>('IDA'),[enderecoConsulta,setEnderecoConsulta]=useState('');
    const enderecos=useRemoteResource(user.tipo!=='MOTORISTA'?'meus-enderecos-coleta':false,async signal=>{const r=await apiRequest<{id:number;apelido:string;rua:string}[]>(`/enderecos/usuario/${user.id}`,{signal});if(!Array.isArray(r))throw new Error('Não foi possível consultar seus endereços.');return r;});
    const {data,error,reload}=useRemoteResource(`coleta:${turmaId}:${sentido}:${enderecoConsulta}`,signal=>consultarColetaPrivada(turmaId,sentido,enderecoConsulta,signal));
    return <SafeAreaView style={{flex:1}}><ScrollView contentContainerStyle={{padding:16,gap:12}} keyboardShouldPersistTaps="handled"><Button title="Voltar" onPress={()=>router.back()}/><Text style={s.title}>Paradas da turma</Text>
        <Button title={`Sentido: ${sentido}`} onPress={()=>{setSentido(sentido==='IDA'?'VOLTA':'IDA');setEnderecoConsulta('');}}/>
        {user.tipo!=='MOTORISTA'&&<><Button title="Gerenciar meus endereços" onPress={()=>router.push('/gerenciar-enderecos')}/><Text>Escolha seu endereço para sugerir a parada mais próxima:</Text>{enderecos.error?<AsyncState message={enderecos.error} onRetry={enderecos.reload}/>:enderecos.data?.map(e=><Button key={e.id} title={`${enderecoConsulta===String(e.id)?'✓ ':''}${e.apelido||e.rua}`} onPress={()=>setEnderecoConsulta(String(e.id))}/>)}</>}
        {error?<AsyncState message={error} onRetry={reload}/>:!data?<AsyncState loading/>:<Coleta key={`${turmaId}:${sentido}:${data.versao}:${data.escolhidaId}`} data={data} motorista={user.tipo==='MOTORISTA'} reload={reload}/>}
    </ScrollView></SafeAreaView>;
}
function Coleta({data,motorista,reload}:{data:ColetaPrivada;motorista:boolean;reload:()=>void}){
    const router=useRouter();const [modo,setModo]=useState(data.modo),[paradas,setParadas]=useState(data.paradas),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false),[confirmar,setConfirmar]=useState(false);
    const [ponto,setPonto]=useState<{nome:string;latitude:number;longitude:number}|null>(null);const pending=useRef(false);
    const run=async(task:()=>Promise<unknown>)=>{if(pending.current)return;pending.current=true;setBusy(true);setFeedback('');try{await task();reload();}catch(e){setFeedback(errorMessage(e));}finally{pending.current=false;setBusy(false);}};
    return <><Text>{data.modo} · {data.viagemId?'Viagem ativa':'Viagem ainda não iniciada'}</Text><Text accessibilityLiveRegion="polite">{feedback}</Text>
        <MapaPreviaPublica pontos={data.paradas.map(p=>({...p,paradaId:p.id}))}/>
        {data.viagemId&&<Button title="Acompanhar e confirmar embarque" onPress={()=>router.push({pathname:'/controle-viagem',params:{tipo:'VIAGEM',id:String(data.viagemId)}})}/>}
        {data.sugestao&&<Text>Parada mais próxima: {data.sugestao.parada.nome} · aproximadamente {Math.round(data.sugestao.distanciaMetros)} m em linha reta. Sua escolha atual é preservada.</Text>}
        {modo==='PORTA_A_PORTA'&&<Text>Os endereços de embarque e desembarque continuam separados no Início.</Text>}
        {!motorista&&data.paradas.map(p=><Button key={p.id} title={`${data.escolhidaId===p.id?'✓ ':''}${p.nome} ${p.horario||''}`} disabled={busy||!!data.viagemId} onPress={()=>void run(()=>escolherParadaPrivada(String(data.turmaId),data.sentido,data.versao,p.id!))}/>)}
        {!data.paradas.length&&modo==='PARADAS_DEFINIDAS'&&<AsyncState status="empty" title="Nenhuma parada disponível"/>}
        {motorista&&<><Button title={`Modo: ${modo}`} disabled={!!data.viagemId} onPress={()=>{setModo(modo==='PORTA_A_PORTA'?'PARADAS_DEFINIDAS':'PORTA_A_PORTA');setConfirmar(false);}}/>
            {modo==='PARADAS_DEFINIDAS'&&<><EnderecoMapaPicker onChange={setPonto}/><Button title="Adicionar parada confirmada" disabled={!ponto||!!data.viagemId} onPress={()=>{if(ponto){setParadas([...paradas,{...ponto,id:null,horario:null}]);setPonto(null);}}}/>
                {paradas.map((p,i)=><View key={p.id??`nova-${i}`} style={s.card}><TextInput accessibilityLabel={`Nome da parada ${i+1}`} value={p.nome} onChangeText={nome=>setParadas(paradas.map((v,j)=>i===j?{...v,nome}:v))}/><Button title="Mover para cima" disabled={i===0} onPress={()=>{const next:ParadaPrivada[]=[...paradas];[next[i-1],next[i]]=[next[i],next[i-1]];setParadas(next);}}/><Button title="Remover" onPress={()=>setParadas(paradas.filter((_,j)=>j!==i))}/></View>)}
            </>}
            <Text>Alterações podem conflitar com escolhas e presenças futuras. O servidor preserva vínculos incompatíveis.</Text>
            <Button title={confirmar?'Confirmar e salvar configuração':'Revisar alteração da coleta'} disabled={busy||!!data.viagemId} onPress={()=>{if(!confirmar){setConfirmar(true);return;}void run(()=>salvarColetaPrivada(String(data.turmaId),data.sentido,data.versao,modo,paradas));}}/>
        </>}
    </>;
}
