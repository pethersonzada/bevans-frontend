import { RemoteLoading, ActionButton as Button, Section, ui } from './ui/Primitives';
import { useContext,useEffect,useRef,useState } from 'react';
import { Text,View } from 'react-native';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { participantesExcursao,confirmarParticipante,convitesExcursao,planejarExcursao } from '../services/excursoes';
import { onConvitesChanged,conviteDisponivelEmMemoria,revogarConviteRecuperado } from '../services/convitesCompartilhamento';
import type { PontoPublico } from '../types/rotaPublica';
import MapaPreviaPublica from './MapaPreviaPublica';
import { AsyncState } from './AsyncState';
import { errorMessage } from '../config/api';
import { ExcursaoActionContext } from './ExcursaoActionContext';
export function GestaoExcursao({id,secao='participantes'}:{id:number;secao?:'participantes'|'convites'|'roteiro'}){
    const [,setRevision]=useState(0);
    useEffect(()=>onConvitesChanged(()=>setRevision(v=>v+1)),[]);
    const lock=useContext(ExcursaoActionContext);
    const [revogar,setRevogar]=useState<number|null>(null);
    const [page,setPage]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[pontos,setPontos]=useState<PontoPublico[]>([]);const pending=useRef(false);
    const participantes=useRemoteResource(secao==='participantes'?`participantes-excursao:${id}:${page}`:false,signal=>participantesExcursao(id,page,signal));
    const convites=useRemoteResource(secao==='convites'?`convites-excursao:${id}`:false,signal=>convitesExcursao(id,signal));
    const error=secao==='participantes'?participantes.error:convites.error;
    const reload=secao==='participantes'?participantes.reload:convites.reload;
    const run=async(task:()=>Promise<unknown>)=>{if(pending.current||lock?.current)return;pending.current=true;if(lock)lock.current=true;setBusy(true);setMessage('');try{await task();reload();}catch(e){setMessage(errorMessage(e));}finally{pending.current=false;if(lock)lock.current=false;setBusy(false);}};
    const estados:Record<string,string>={SOLICITADA:'Reserva solicitada',CONFIRMADA:'Inscrição confirmada',CANCELADA:'Inscrição cancelada',EXPIRADA:'Reserva expirada'};
    return <Section title={secao==='participantes'?'Participantes':secao==='convites'?'Convites emitidos':'Roteiro e prévias'}>
        {secao!=='roteiro'&&<Button title="Atualizar dados" icon="refresh-outline" disabled={busy} onPress={reload}/>}
        {!!message&&<Text accessibilityLiveRegion="polite">{message}</Text>}
        {error&&<AsyncState message={error} onRetry={reload}/>}
            {secao==='participantes'&&(participantes.data?<>{!participantes.data.itens.length&&<AsyncState status="empty" title="Nenhum participante nesta página"/>}
            {participantes.data.itens.map(p=><View key={p.id} style={ui.section}><Text style={ui.label}>{p.nome}</Text><Text style={ui.body}>{estados[p.estado]||p.estado}</Text><Text style={ui.caption}>Embarque: {p.nomePonto||'Parada atribuída'}</Text>{p.estado==='SOLICITADA'&&<Button variant="primary" title="Confirmar reserva" accessibilityLabel={'Confirmar reserva de '+p.nome} disabled={busy} onPress={()=>void run(()=>confirmarParticipante(id,p.id))}/>}</View>)}
            <Button title="Participantes anteriores" disabled={page===0} onPress={()=>setPage(v=>v-1)}/><Button title="Próximos participantes" disabled={page+1>=participantes.data.totalPaginas} onPress={()=>setPage(v=>v+1)}/>
            </>:!error&&<RemoteLoading/>)}
            {secao==='convites'&&(convites.data?<>{!convites.data.length&&<AsyncState status="empty" title="Nenhum convite emitido"/>}{convites.data.map(c=><View key={c.id} style={{gap:8,paddingVertical:8}}><Text style={ui.body}>Convite · válido até {new Date(c.expiraEm).toLocaleString('pt-BR')} · {c.revogadoEm?'Revogado':Date.parse(c.expiraEm)<=Date.now()?'Expirado':'Emitido'}</Text>{!c.revogadoEm&&Date.parse(c.expiraEm)>Date.now()&&<Text style={ui.body}>{conviteDisponivelEmMemoria(id,c.id)?'Link recuperável nesta sessão na seção Convites.':'Link não disponível nesta sessão. A listagem não recupera o segredo; revogue e emita outro se precisar de um novo link.'}</Text>}{!c.revogadoEm&&<Button title="Revogar convite" disabled={busy} onPress={()=>setRevogar(c.id)}/>}</View>)}
            {revogar!=null&&<><Text style={ui.body}>Revogar este convite impede novos acessos. Inscrições existentes não serão apagadas.</Text><Button title="Confirmar revogação" disabled={busy} onPress={()=>void run(async()=>{await revogarConviteRecuperado(id,revogar);setRevogar(null);})}/><Button title="Manter convite" disabled={busy} onPress={()=>setRevogar(null)}/></>}
            </>:!error&&<RemoteLoading/>)}
        {secao==='roteiro'&&<><Text style={ui.body}>A prévia não altera a ordem persistida. Otimização usa o serviço do roteiro.</Text>
        {(['IDA','VOLTA'] as const).map(sentido=><View key={sentido}><Button title={`Prévia ${sentido} na ordem cadastrada`} disabled={busy} onPress={()=>void run(async()=>setPontos(await planejarExcursao(id,sentido,false)))}/><Button title={`Otimizar prévia ${sentido}`} disabled={busy} onPress={()=>void run(async()=>setPontos(await planejarExcursao(id,sentido,true)))}/></View>)}
        <MapaPreviaPublica pontos={pontos}/></>}
    </Section>;
}
