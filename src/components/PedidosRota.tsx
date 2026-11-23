import { useThemeRevision } from '../hooks/useThemeRevision';
import { RemoteLoading, ActionButton as Button, Field, ui } from './ui/Primitives';
import { useRef,useState } from 'react';
import { Text,TextInput,View } from 'react-native';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { embarquesMotorista,analisarEmbarque } from '../services/embarques';
import { errorMessage } from '../config/api';
import { AsyncState } from './AsyncState';
import { SeletorDataOperacao } from './SeletorDataOperacao';
import { dataLocal } from '../services/dataOperacao';
export function PedidosRota({rotaId}:{rotaId:number}){
    useThemeRevision();
    const [date,setDate]=useState(()=>dataLocal()),[sentido,setSentido]=useState('IDA'),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
    const result=useRemoteResource(date?`pedidos:${rotaId}:${date}:${sentido}`:false,signal=>embarquesMotorista(rotaId,date,sentido,signal));
    const analisar=async(id:number,status:'APROVADO'|'REJEITADO')=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await analisarEmbarque(id,status);result.reload();}catch(e){setError(errorMessage(e));}finally{pending.current=false;setBusy(false);}};
    return <View style={{gap:12}}><Text accessibilityRole="header" style={ui.sectionTitle}>Pedidos de embarque</Text><SeletorDataOperacao label="Data dos pedidos" value={date} onChange={setDate} disabled={busy}/><Button title={`Sentido ${sentido}`} disabled={busy} onPress={()=>setSentido(sentido==='IDA'?'VOLTA':'IDA')}/><Text accessibilityLiveRegion="polite">{error}</Text>
        {date&&(result.error?<AsyncState message={result.error} onRetry={result.reload}/>:!result.data?<RemoteLoading/>:<>
            <Text style={ui.body}>{result.data.filter(p=>p.status==='PENDENTE').length} pedidos pendentes nesta data e sentido</Text>
            {!result.data.length?<AsyncState status="empty" title="Sem pedidos nesta data e sentido"/>:[...result.data].sort((a,b)=>Number(b.status==='PENDENTE')-Number(a.status==='PENDENTE')).map(p=><View key={p.id} style={ui.section}><Text style={ui.label}>{p.nomePonto||`Parada ${p.paradaId}`}</Text><Text style={ui.body}>{p.dataOperacao.split('-').reverse().join('/')} · {p.sentido} · {p.status}</Text>{p.status==='PENDENTE'&&<><Button title="Aprovar pedido" disabled={busy} onPress={()=>void analisar(p.id,'APROVADO')}/><Button title="Rejeitar pedido" disabled={busy} onPress={()=>void analisar(p.id,'REJEITADO')}/></>}</View>)}
        </>)}
    </View>;
}
