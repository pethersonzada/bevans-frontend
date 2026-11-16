import { RemoteLoading, ActionButton as Button, Field, ui } from './ui/Primitives';
import { useRef,useState } from 'react';
import { Text,TextInput,View } from 'react-native';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { embarquesMotorista,analisarEmbarque } from '../services/embarques';
import { errorMessage } from '../config/api';
import { AsyncState } from './AsyncState';
export function PedidosRota({rotaId}:{rotaId:number}){
    const [draft,setDraft]=useState(''),[date,setDate]=useState(''),[sentido,setSentido]=useState('IDA'),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
    const result=useRemoteResource(date?`pedidos:${rotaId}:${date}:${sentido}`:false,signal=>embarquesMotorista(rotaId,date,sentido,signal));
    const analisar=async(id:number,status:'APROVADO'|'REJEITADO')=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await analisarEmbarque(id,status);result.reload();}catch(e){setError(errorMessage(e));}finally{pending.current=false;setBusy(false);}};
    return <View style={{gap:8}}><Text accessibilityRole="header">Pedidos de embarque</Text><Field label="Data dos pedidos" accessibilityLabel="Data dos pedidos AAAA-MM-DD" placeholder="AAAA-MM-DD" value={draft} onChangeText={setDraft}/><Button title={`Sentido ${sentido}`} onPress={()=>setSentido(sentido==='IDA'?'VOLTA':'IDA')}/><Button title="Consultar pedidos" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(draft)} onPress={()=>setDate(draft)}/><Text accessibilityLiveRegion="polite">{error}</Text>
        {date&&(result.error?<AsyncState message={result.error} onRetry={result.reload}/>:!result.data?<RemoteLoading/>:!result.data.length?<AsyncState status="empty" title="Sem pedidos nesta data e sentido"/>:result.data.map(p=><View key={p.id}><Text style={ui.body}>{p.nomePonto||`Parada ${p.paradaId}`} · {p.status}</Text>{p.status==='PENDENTE'&&<><Button title="Aprovar pedido" disabled={busy} onPress={()=>void analisar(p.id,'APROVADO')}/><Button title="Rejeitar pedido" disabled={busy} onPress={()=>void analisar(p.id,'REJEITADO')}/></>}</View>))}
    </View>;
}
