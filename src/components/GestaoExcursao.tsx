import { useRef,useState } from 'react';
import { Button,Text,View } from 'react-native';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { participantesExcursao,confirmarParticipante,convitesExcursao,revogarConviteExcursao,planejarExcursao } from '../services/excursoes';
import type { PontoPublico } from '../types/rotaPublica';
import MapaPreviaPublica from './MapaPreviaPublica';
import { AsyncState } from './AsyncState';
import { errorMessage } from '../config/api';
export function GestaoExcursao({id}:{id:number}){
    const [page,setPage]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[pontos,setPontos]=useState<PontoPublico[]>([]);const pending=useRef(false);
    const {data,error,reload}=useRemoteResource(`gestao-excursao:${id}:${page}`,async signal=>{const [participantes,convites]=await Promise.all([participantesExcursao(id,page,signal),convitesExcursao(id,signal)]);return {participantes,convites};});
    const run=async(task:()=>Promise<unknown>)=>{if(pending.current)return;pending.current=true;setBusy(true);setMessage('');try{await task();reload();}catch(e){setMessage(errorMessage(e));}finally{pending.current=false;setBusy(false);}};
    return <View style={{gap:8}}><Text accessibilityRole="header">Participantes e convites</Text><Text accessibilityLiveRegion="polite">{message}</Text>
        {error?<AsyncState message={error} onRetry={reload}/>:!data?<AsyncState loading/>:<>
            {!data.participantes.itens.length&&<AsyncState status="empty" title="Nenhum participante nesta página"/>}
            {data.participantes.itens.map(p=><View key={p.id}><Text>{p.nome} · {p.estado} · {p.nomePonto||'Parada atribuída'}</Text>{p.estado==='SOLICITADA'&&<Button title="Confirmar reserva" disabled={busy} onPress={()=>void run(()=>confirmarParticipante(id,p.id))}/>}</View>)}
            <Button title="Participantes anteriores" disabled={page===0} onPress={()=>setPage(v=>v-1)}/><Button title="Próximos participantes" disabled={page+1>=data.participantes.totalPaginas} onPress={()=>setPage(v=>v+1)}/>
            {data.convites.map(c=><View key={c.id}><Text>Convite · válido até {new Date(c.expiraEm).toLocaleString('pt-BR')} · {c.revogadoEm?'Revogado':'Emitido'}</Text>{!c.revogadoEm&&<Button title="Revogar convite" disabled={busy} onPress={()=>void run(()=>revogarConviteExcursao(id,c.id))}/>}</View>)}
        </>}
        <Text>A prévia não altera a ordem persistida. Otimização usa o serviço do roteiro.</Text>
        {(['IDA','VOLTA'] as const).map(sentido=><View key={sentido}><Button title={`Prévia ${sentido} na ordem cadastrada`} disabled={busy} onPress={()=>void run(async()=>setPontos(await planejarExcursao(id,sentido,false)))}/><Button title={`Otimizar prévia ${sentido}`} disabled={busy} onPress={()=>void run(async()=>setPontos(await planejarExcursao(id,sentido,true)))}/></View>)}
        <MapaPreviaPublica pontos={pontos}/>
    </View>;
}
