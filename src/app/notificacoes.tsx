import { useRef,useState } from 'react';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { Button,ScrollView,Switch,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { localizarNotificacao,listarNotificacoes,lerNotificacao,preferenciasNotificacao,salvarPreferenciasNotificacao,destinoNotificacao,type PreferenciasNotificacao,type Notificacao } from '../services/notificacoes';
import { AsyncState } from '../components/AsyncState';
import { errorMessage } from '../config/api';
import { globalStyles as s } from '../styles/globalStyles';
import { PreferenciaPush } from '../components/PreferenciaPush';
export default function Notificacoes(){
    const {notificacaoId}=useLocalSearchParams<{notificacaoId?:string}>();
    const destino=useRemoteResource(notificacaoId?`push:${notificacaoId}`:false,signal=>localizarNotificacao(notificacaoId!,signal));
    const router=useRouter();const [page,setPage]=useState(0),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false);const pending=useRef(false);
    const {data,error,reload}=useRemoteResource(`notificacoes:${page}`,async signal=>{const [avisos,prefs]=await Promise.all([listarNotificacoes(page,signal),preferenciasNotificacao(signal)]);return {avisos,prefs};});
    const run=async(task:()=>Promise<void>)=>{if(pending.current)return;pending.current=true;setBusy(true);setFeedback('');try{await task();reload();}catch(e){setFeedback(errorMessage(e));}finally{pending.current=false;setBusy(false);}};
    const open=(n:Notificacao)=>void run(async()=>{await lerNotificacao(n.id);router.push(destinoNotificacao(n));});
    const prefer=(prefs:PreferenciasNotificacao)=>void run(()=>salvarPreferenciasNotificacao(prefs));
    return <SafeAreaView style={{flex:1}}><ScrollView contentContainerStyle={{padding:16,gap:12}}><Button title="Voltar" onPress={()=>router.back()}/><Text style={s.title}>Notificações</Text><PreferenciaPush/><Text accessibilityLiveRegion="polite">{feedback}</Text>
        {error?<AsyncState message={error} onRetry={reload}/>:!data?<AsyncState loading/>:<>
            {notificacaoId&&(destino.error?<AsyncState message={destino.error} onRetry={destino.reload}/>:destino.data?<Button title={`Abrir viagem: ${destino.data.titulo}`} disabled={busy} onPress={()=>open(destino.data!)}/>:<AsyncState loading title="Localizando aviso autorizado"/>)}
            <Text>Push operacional</Text><Switch accessibilityLabel="Push operacional" disabled={busy} value={data.prefs.pushOperacional} onValueChange={pushOperacional=>prefer({...data.prefs,pushOperacional})}/>
            <Text>Push informativo</Text><Switch accessibilityLabel="Push informativo" disabled={busy} value={data.prefs.pushInformativo} onValueChange={pushInformativo=>prefer({...data.prefs,pushInformativo})}/>
            <Text>As preferências não removem os avisos operacionais desta central.</Text>
            {!data.avisos.itens.length&&<AsyncState status="empty" title="Nenhuma notificação"/>}
            {data.avisos.itens.map(n=><View key={n.id} style={s.card}><Text>{n.lidaEm?'Lida':'Não lida'} · {n.contextoTipo}</Text><Text accessibilityRole="header">{n.titulo}</Text><Text>{n.mensagem}</Text><Button title="Abrir contexto" disabled={busy} onPress={()=>open(n)}/>{!n.lidaEm&&<Button title="Marcar como lida" disabled={busy} onPress={()=>void run(()=>lerNotificacao(n.id))}/>}</View>)}
            <Button title="Anterior" disabled={page===0} onPress={()=>setPage(v=>v-1)}/><Button title="Próxima" disabled={page+1>=data.avisos.totalPaginas} onPress={()=>setPage(v=>v+1)}/>
        </>}
    </ScrollView></SafeAreaView>;
}
