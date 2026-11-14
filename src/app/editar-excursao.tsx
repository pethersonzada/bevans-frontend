import { useRef,useState } from 'react';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { Button,ScrollView,Text,TextInput,View,Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { buscarExcursao,salvarExcursao,acaoExcursao,salvarColetaExcursao,listarExecucoes,iniciarExcursao,finalizarExcursao,criarConviteExcursao,linkConvite,type Excursao,type DadosExcursao,type ParadaExcursao } from '../services/excursoes';
import { useAuth } from '../contexts/AuthContext';
import { AsyncState } from '../components/AsyncState';
import EnderecoMapaPicker from '../components/EnderecoMapaPicker';
import { errorMessage } from '../config/api';
import { globalStyles as s } from '../styles/globalStyles';
import { GestaoExcursao } from '../components/GestaoExcursao';

export default function EditarExcursao() {
    const {id}=useLocalSearchParams<{id?:string}>();const {user}=useAuth();const router=useRouter();
    const [editorRevision,setEditorRevision]=useState(0);
    const {data,error,reload}=useRemoteResource(id&&user.tipo==='MOTORISTA'?`excursao:${id}`:false,async signal=>{
        const excursao=await buscarExcursao(id!,signal);const execucoes=await listarExecucoes(excursao.id,signal);return {excursao,execucoes};
    });
    if(user.tipo!=='MOTORISTA')return <AsyncState message="A gestão exige perfil de motorista."/>;
    return <SafeAreaView style={{flex:1}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:12}}>
        <Button title="Voltar" onPress={()=>router.back()}/><Text style={s.title}>{id?'Gerenciar excursão':'Criar excursão'}</Text>
        <Button title="Recarregar dados e descartar rascunho" onPress={()=>{setEditorRevision(v=>v+1);reload();}}/>
        {error?<AsyncState message={error} onRetry={reload}/>:id&&!data?<AsyncState loading/>:<Editor key={`${id||'nova'}:${editorRevision}`} excursao={data?.excursao} onSaved={newId=>{if(!id)router.replace({pathname:'/editar-excursao',params:{id:String(newId)}});else {setEditorRevision(v=>v+1);reload();}}}/>}
        {data?.execucoes.map(e=><View key={e.id} style={s.card}><Text>{e.sentido} · {e.estado}</Text><Button title="Controle de embarque" onPress={()=>router.push({pathname:'/controle-viagem',params:{tipo:'EXCURSAO',id:String(e.id)}})}/>
            {e.estado==='EM_ANDAMENTO'&&<AsyncAction title="Finalizar execução" action={async()=>{await finalizarExcursao(data.excursao.id,e.id);reload();}}/>}</View>)}
        {data&&<GestaoExcursao key={data.excursao.id} id={data.excursao.id}/>}
    </ScrollView></SafeAreaView>;
}
function AsyncAction({title,action}:{title:string;action:()=>Promise<void>}) {
    const [busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
    return <View><Button title={busy?'Aguarde…':title} disabled={busy} onPress={()=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');void action().catch(e=>setError(errorMessage(e))).finally(()=>{pending.current=false;setBusy(false);});}}/><Text accessibilityLiveRegion="polite">{error}</Text></View>;
}
function Editor({excursao:initial,onSaved}:{excursao?:Excursao;onSaved:(id:number)=>void}) {
    const [e]=useState(initial);
    const [titulo,setTitulo]=useState(e?.titulo||''),[partida,setPartida]=useState(e?.partidaEm||''),[retorno,setRetorno]=useState(e?.retornoEm||''),[capacidade,setCapacidade]=useState(String(e?.capacidade||''));
    const [destino,setDestino]=useState<{nome:string;latitude:number;longitude:number}|null>(e?{nome:e.destinoNome,latitude:e.destinoLatitude,longitude:e.destinoLongitude}:null);
    const [origem,setOrigem]=useState<{nome:string;latitude:number;longitude:number}|null>(e?.origemNome&&e.origemLatitude!=null&&e.origemLongitude!=null?{nome:e.origemNome,latitude:e.origemLatitude,longitude:e.origemLongitude}:null);
    const [modo,setModo]=useState<Excursao['modoColeta']>(e?.modoColeta||'PORTA_A_PORTA');const [paradas,setParadas]=useState<ParadaExcursao[]>(e?.paradas||[]);
    const [novoPonto,setNovoPonto]=useState<{nome:string;latitude:number;longitude:number}|null>(null),[expira,setExpira]=useState('');
    const [confirmarCancelamento,setConfirmarCancelamento]=useState(false);
    const [reposicionar,setReposicionar]=useState<number|null>(null);
    const dados:DadosExcursao={titulo,destinoNome:destino?.nome||'',destinoLatitude:destino?.latitude??NaN,destinoLongitude:destino?.longitude??NaN,origemNome:origem?.nome??null,origemLatitude:origem?.latitude??null,origemLongitude:origem?.longitude??null,partidaEm:partida,retornoEm:retorno||null,capacidade:Number(capacidade),versao:e?.versao};
    const salvar=async()=>{if(!destino||!titulo.trim()||!Number.isInteger(Number(capacidade))||Number(capacidade)<1||!Number.isFinite(Date.parse(partida)))throw new Error('Informe título, destino confirmado, partida ISO com fuso e capacidade positiva.');const r=await salvarExcursao(e?.id??null,dados);onSaved(r.id);};
    return <>
        {e&&<Text>{e.estado} · versão {e.versao}</Text>}
        <TextInput style={s.input} accessibilityLabel="Título da excursão" placeholder="Título" value={titulo} onChangeText={setTitulo}/>
        <Text>Destino: {destino?.nome||'confirme no mapa'}</Text><EnderecoMapaPicker localizacaoInicial={destino} onChange={setDestino}/>
        <Text>Origem operacional opcional: {origem?.nome||'não configurada'}</Text><EnderecoMapaPicker localizacaoInicial={origem} onChange={setOrigem}/><Button title="Remover origem operacional" onPress={()=>setOrigem(null)}/>
        <TextInput style={s.input} accessibilityLabel="Partida ISO com fuso" placeholder="Partida: AAAA-MM-DDTHH:mm:ss-03:00" value={partida} onChangeText={setPartida}/>
        <TextInput style={s.input} accessibilityLabel="Retorno opcional ISO com fuso" placeholder="Retorno opcional" value={retorno} onChangeText={setRetorno}/>
        <TextInput style={s.input} accessibilityLabel="Capacidade" placeholder="Lugares" keyboardType="number-pad" value={capacidade} onChangeText={setCapacidade}/>
        <AsyncAction title="Salvar dados da excursão" action={salvar}/>
        {e&&<>
            <Text accessibilityRole="header">Coleta</Text>
            {(['PORTA_A_PORTA','PARADA_UNICA','MULTIPLAS_PARADAS'] as const).map(m=><Button key={m} title={`${modo===m?'✓ ':''}${m}`} onPress={()=>setModo(m)}/>)}
            {modo!=='PORTA_A_PORTA'&&<><EnderecoMapaPicker onChange={setNovoPonto}/><Button title="Adicionar ponto confirmado" disabled={!novoPonto} onPress={()=>{if(novoPonto){setParadas([...paradas,{...novoPonto,id:null,horario:null,instrucoes:null}]);setNovoPonto(null);}}}/>
                {paradas.map((p,i)=><View key={p.id??`nova-${i}`} style={s.card}><TextInput accessibilityLabel={`Nome da parada ${i+1}`} value={p.nome} onChangeText={nome=>setParadas(paradas.map((v,j)=>i===j?{...v,nome}:v))}/><TextInput accessibilityLabel={`Horário da parada ${i+1}`} placeholder="HH:mm" value={p.horario||''} onChangeText={horario=>setParadas(paradas.map((v,j)=>i===j?{...v,horario:horario||null}:v))}/><Button title="Mover para cima" disabled={i===0} onPress={()=>{const next=[...paradas];[next[i-1],next[i]]=[next[i],next[i-1]];setParadas(next);}}/><Button title="Remover parada" onPress={()=>setParadas(paradas.filter((_,j)=>j!==i))}/></View>)}
            </>}
            {modo!=='PORTA_A_PORTA'&&paradas.map((p,i)=><Button key={`reposicionar-${i}`} title={`Reposicionar ${p.nome}`} onPress={()=>setReposicionar(i)}/>)}
            {reposicionar!=null&&<><Text>Confirme a nova posição de {paradas[reposicionar]?.nome}</Text><EnderecoMapaPicker onChange={ponto=>{if(ponto){setParadas(paradas.map((p,i)=>i===reposicionar?{...p,latitude:ponto.latitude,longitude:ponto.longitude}:p));setReposicionar(null);}}}/><Button title="Cancelar reposicionamento" onPress={()=>setReposicionar(null)}/></>}
            <AsyncAction title="Salvar modo e paradas" action={async()=>{const r=await salvarColetaExcursao(e.id,modo,e.versao,modo==='PORTA_A_PORTA'?[]:paradas);onSaved(r.id);}}/>
            <AsyncAction title="Publicar excursão" action={async()=>{const r=await acaoExcursao(e.id,'publicacao',e.versao);onSaved(r.id);}}/>
            <TextInput style={s.input} accessibilityLabel="Validade do convite ISO com fuso" placeholder="Expiração do convite ISO com fuso" value={expira} onChangeText={setExpira}/>
            <AsyncAction title="Gerar e compartilhar convite" action={async()=>{linkConvite(process.env.EXPO_PUBLIC_CONVITE_WEB_URL,'validacao');const convite=await criarConviteExcursao(e.id,expira);await Share.share({message:linkConvite(process.env.EXPO_PUBLIC_CONVITE_WEB_URL,convite.token)});}}/>
            {(['IDA','VOLTA'] as const).map(sentido=><AsyncAction key={sentido} title={`Iniciar execução ${sentido}`} action={async()=>{await iniciarExcursao(e.id,sentido);onSaved(e.id);}}/>)}
            <Button title="Cancelar excursão" onPress={()=>setConfirmarCancelamento(v=>!v)}/>
            {confirmarCancelamento&&<AsyncAction title="Confirmar cancelamento da excursão" action={async()=>{const r=await acaoExcursao(e.id,'cancelamento',e.versao);onSaved(r.id);}}/>}
        </>}
    </>;
}
