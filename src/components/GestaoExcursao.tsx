import { useContext,useEffect,useRef,useState } from 'react';
import { Button,Text,View } from 'react-native';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { participantesExcursao,confirmarParticipante,convitesExcursao,planejarExcursao } from '../services/excursoes';
import { onConvitesChanged,conviteDisponivelEmMemoria,revogarConviteRecuperado } from '../services/convitesCompartilhamento';
import type { PontoPublico } from '../types/rotaPublica';
import MapaPreviaPublica from './MapaPreviaPublica';
import { AsyncState } from './AsyncState';
import { errorMessage } from '../config/api';
import { ExcursaoActionContext } from './ExcursaoActionContext';
export function GestaoExcursao({id}:{id:number}){
    const [,setRevision]=useState(0);
    useEffect(()=>onConvitesChanged(()=>setRevision(v=>v+1)),[]);
    const lock=useContext(ExcursaoActionContext);
    const [revogar,setRevogar]=useState<number|null>(null);
    const [page,setPage]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[pontos,setPontos]=useState<PontoPublico[]>([]);const pending=useRef(false);
    const {data,error,reload}=useRemoteResource(`gestao-excursao:${id}:${page}`,async signal=>{const [participantes,convites]=await Promise.all([participantesExcursao(id,page,signal),convitesExcursao(id,signal)]);return {participantes,convites};});
    const run=async(task:()=>Promise<unknown>)=>{if(pending.current||lock?.current)return;pending.current=true;if(lock)lock.current=true;setBusy(true);setMessage('');try{await task();reload();}catch(e){setMessage(errorMessage(e));}finally{pending.current=false;if(lock)lock.current=false;setBusy(false);}};
    return <View style={{gap:8}}><Text accessibilityRole="header">Participantes e convites</Text><Button title="Atualizar participantes e convites" disabled={busy} onPress={reload}/><Text accessibilityLiveRegion="polite">{message}</Text>
        {error?<AsyncState message={error} onRetry={reload}/>:!data?<AsyncState loading/>:<>
            {!data.participantes.itens.length&&<AsyncState status="empty" title="Nenhum participante nesta página"/>}
            {data.participantes.itens.map(p=><View key={p.id}><Text>{p.nome} · {p.estado} · {p.nomePonto||'Parada atribuída'}</Text>{p.estado==='SOLICITADA'&&<Button title="Confirmar reserva" disabled={busy} onPress={()=>void run(()=>confirmarParticipante(id,p.id))}/>}</View>)}
            <Button title="Participantes anteriores" disabled={page===0} onPress={()=>setPage(v=>v-1)}/><Button title="Próximos participantes" disabled={page+1>=data.participantes.totalPaginas} onPress={()=>setPage(v=>v+1)}/>
            {data.convites.map(c=><View key={c.id} style={{gap:8,paddingVertical:8}}><Text>Convite · válido até {new Date(c.expiraEm).toLocaleString('pt-BR')} · {c.revogadoEm?'Revogado':Date.parse(c.expiraEm)<=Date.now()?'Expirado':'Emitido'}</Text>{!c.revogadoEm&&Date.parse(c.expiraEm)>Date.now()&&<Text>{conviteDisponivelEmMemoria(id,c.id)?'Link recuperável nesta sessão na seção Convites.':'Link não disponível nesta sessão. A listagem não recupera o segredo; revogue e emita outro se precisar de um novo link.'}</Text>}{!c.revogadoEm&&<Button title="Revogar convite" disabled={busy} onPress={()=>setRevogar(c.id)}/>}</View>)}
            {revogar!=null&&<><Text>Revogar este convite impede novos acessos. Inscrições existentes não serão apagadas.</Text><Button title="Confirmar revogação" disabled={busy} onPress={()=>void run(async()=>{await revogarConviteRecuperado(id,revogar);setRevogar(null);})}/><Button title="Manter convite" disabled={busy} onPress={()=>setRevogar(null)}/></>}
        </>}
        <Text>A prévia não altera a ordem persistida. Otimização usa o serviço do roteiro.</Text>
        {(['IDA','VOLTA'] as const).map(sentido=><View key={sentido}><Button title={`Prévia ${sentido} na ordem cadastrada`} disabled={busy} onPress={()=>void run(async()=>setPontos(await planejarExcursao(id,sentido,false)))}/><Button title={`Otimizar prévia ${sentido}`} disabled={busy} onPress={()=>void run(async()=>setPontos(await planejarExcursao(id,sentido,true)))}/></View>)}
        <MapaPreviaPublica pontos={pontos}/>
    </View>;
}
