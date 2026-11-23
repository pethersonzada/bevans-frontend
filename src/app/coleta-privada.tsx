import { theme } from '../styles/theme';
import { useThemeRevision } from '../hooks/useThemeRevision';
import { RemoteLoading, Screen, Section, ActionButton as Button, Choice, ui } from '../components/ui/Primitives';
import { useRef,useState } from 'react';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { ScrollView,Text,TextInput,View } from 'react-native';
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
    useThemeRevision();
    const {turmaId}=useLocalSearchParams<{turmaId:string}>();const {user}=useAuth();const router=useRouter();
    const [sentido,setSentido]=useState<'IDA'|'VOLTA'>('IDA'),[enderecoConsulta,setEnderecoConsulta]=useState('');
    const [editorRevision,setEditorRevision]=useState(0);
    const enderecos=useRemoteResource(user.tipo!=='MOTORISTA'?'meus-enderecos-coleta':false,async signal=>{const r=await apiRequest<{id:number;apelido:string;rua:string}[]>(`/enderecos/usuario/${user.id}`,{signal});if(!Array.isArray(r))throw new Error('Não foi possível consultar seus endereços.');return r;});
    const {data,error,reload}=useRemoteResource(`coleta:${turmaId}:${sentido}:${enderecoConsulta}`,signal=>consultarColetaPrivada(turmaId,sentido,enderecoConsulta,signal));
    return <Screen title={user.tipo==='MOTORISTA'?'Coleta e trajetos':'Meu embarque'} subtitle="Configure cada sentido separadamente." onBack={()=>router.back()}>
        <Button title={`Sentido: ${sentido}`} onPress={()=>{setSentido(sentido==='IDA'?'VOLTA':'IDA');setEnderecoConsulta('');}}/>
        {user.tipo!=='MOTORISTA'&&<><Button title="Gerenciar meus endereços" onPress={()=>router.push('/gerenciar-enderecos')}/><Text style={ui.body}>Escolha seu endereço para sugerir a parada mais próxima:</Text>{enderecos.error?<AsyncState message={enderecos.error} onRetry={enderecos.reload}/>:enderecos.data?.map(e=><Button key={e.id} title={`${enderecoConsulta===String(e.id)?'✓ ':''}${e.apelido||e.rua}`} onPress={()=>setEnderecoConsulta(String(e.id))}/>)}</>}
        <Button title="Recarregar e descartar alterações das paradas" onPress={()=>{setEditorRevision(v=>v+1);reload();}}/>
        {error?<AsyncState message={error} onRetry={reload}/>:!data?<RemoteLoading/>:<Coleta key={`${turmaId}:${sentido}:${editorRevision}`} data={data} motorista={user.tipo==='MOTORISTA'} reload={()=>{setEditorRevision(v=>v+1);reload();}}/>}
    </Screen>;
}
function Coleta({data,motorista,reload}:{data:ColetaPrivada;motorista:boolean;reload:()=>void}){
    useThemeRevision();
    const router=useRouter();const [modo,setModo]=useState(data.modo),[paradas,setParadas]=useState(data.paradas),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false),[confirmar,setConfirmar]=useState(false);
    const [ponto,setPonto]=useState<{nome:string;latitude:number;longitude:number}|null>(null);const pending=useRef(false);
    const [reposicionar,setReposicionar]=useState<number|null>(null);
    const [versaoBase]=useState(data.versao);
    const run=async(task:()=>Promise<unknown>)=>{if(pending.current)return;pending.current=true;setBusy(true);setFeedback('');try{await task();reload();}catch(e){setFeedback(errorMessage(e));}finally{pending.current=false;setBusy(false);}};
    return <Section title={motorista?'Configuração do trajeto':'Sua escolha de embarque'}><Text style={ui.body}>{data.modo==='PORTA_A_PORTA'?'Porta a porta':'Paradas definidas'} · {data.viagemId?'Viagem ativa':'Viagem ainda não iniciada'}</Text><Text style={{ color: theme.colors.text }} accessibilityLiveRegion="polite">{feedback}</Text>
        <MapaPreviaPublica pontos={data.paradas.map(p=>({...p,paradaId:p.id}))}/>
        {data.viagemId&&<Button title="Acompanhar e confirmar embarque" onPress={()=>router.push({pathname:'/controle-viagem',params:{tipo:'VIAGEM',id:String(data.viagemId)}})}/>}
        {data.sugestao&&<Text style={ui.body}>Parada mais próxima: {data.sugestao.parada.nome} · aproximadamente {Math.round(data.sugestao.distanciaMetros)} m em linha reta. Sua escolha atual é preservada.</Text>}
        {modo==='PORTA_A_PORTA'&&<Text style={ui.body}>Os endereços de embarque e desembarque continuam separados no Início.</Text>}
        {!motorista&&data.paradas.map(p=><Button key={p.id} title={`${data.escolhidaId===p.id?'✓ ':''}${p.nome} ${p.horario||''}`} disabled={busy||!!data.viagemId} onPress={()=>void run(()=>escolherParadaPrivada(String(data.turmaId),data.sentido,data.versao,p.id!))}/>)}
        {!data.paradas.length&&modo==='PARADAS_DEFINIDAS'&&<AsyncState status="empty" title="Nenhuma parada disponível"/>}
        {motorista&&<>{(['PORTA_A_PORTA','PARADAS_DEFINIDAS'] as const).map(m=><Choice key={m} label={m==='PORTA_A_PORTA'?'Porta a porta':'Paradas definidas'} selected={modo===m} disabled={busy||!!data.viagemId} onPress={()=>{setModo(m);setConfirmar(false);}}/>)}
            {modo==='PARADAS_DEFINIDAS'&&<><EnderecoMapaPicker onChange={setPonto}/><Button title="Adicionar parada confirmada" disabled={!ponto||!!data.viagemId} onPress={()=>{if(ponto){setParadas([...paradas,{...ponto,id:null,horario:null}]);setPonto(null);}}}/>
                {paradas.map((p,i)=><View key={p.id??`nova-${i}`} style={ui.section}><TextInput style={ui.input} accessibilityLabel={`Nome da parada ${i+1}`} value={p.nome} onChangeText={nome=>setParadas(paradas.map((v,j)=>i===j?{...v,nome}:v))}/><Button title="Mover para cima" disabled={i===0} onPress={()=>{const next:ParadaPrivada[]=[...paradas];[next[i-1],next[i]]=[next[i],next[i-1]];setParadas(next);}}/><Button title="Remover" onPress={()=>setParadas(paradas.filter((_,j)=>j!==i))}/></View>)}
            </>}
            <Text style={ui.body}>Alterações podem conflitar com escolhas e presenças futuras. O servidor preserva vínculos incompatíveis.</Text>
            {modo==='PARADAS_DEFINIDAS'&&paradas.map((p,i)=><Button key={`reposicionar-${i}`} title={`Reposicionar ${p.nome}`} disabled={!!data.viagemId} onPress={()=>setReposicionar(i)}/>)}
            {reposicionar!=null&&<><Text style={ui.body}>Confirme o novo ponto da parada</Text><EnderecoMapaPicker onChange={ponto=>{if(ponto){setParadas(paradas.map((p,i)=>i===reposicionar?{...p,latitude:ponto.latitude,longitude:ponto.longitude}:p));setReposicionar(null);}}}/><Button title="Cancelar reposicionamento" onPress={()=>setReposicionar(null)}/></>}
            {data.versao!==versaoBase&&<Text style={ui.body}>A configuração mudou em outro dispositivo. Seu rascunho foi preservado; recarregue para revisar a versão atual.</Text>}
            <Button variant="primary" title={confirmar?'Confirmar e salvar configuração':'Revisar alteração da coleta'} disabled={busy||!!data.viagemId} onPress={()=>{if(!confirmar){setConfirmar(true);return;}void run(()=>salvarColetaPrivada(String(data.turmaId),data.sentido,versaoBase,modo,paradas));}}/>
        </>}
    </Section>;
}
