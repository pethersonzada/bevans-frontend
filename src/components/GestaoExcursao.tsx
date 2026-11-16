import { RemoteLoading, ActionButton as Button, Choice, Section, Pagination, ui } from './ui/Primitives';
import { Ionicons } from '@expo/vector-icons';
import { trip } from './excursoes/ViagemUI';
import { theme } from '../styles/theme';
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
export function GestaoExcursao({id,secao='participantes',origemConfigurada=true,onConfigurarOrigem,executados=[]}:{
    id:number;
    secao?:'participantes'|'convites'|'roteiro';
    origemConfigurada?:boolean;
    onConfigurarOrigem?:()=>void;
    executados?:string[];
}){
    const [,setRevision]=useState(0);
    useEffect(()=>onConvitesChanged(()=>setRevision(v=>v+1)),[]);
    const lock=useContext(ExcursaoActionContext);
    const [revogar,setRevogar]=useState<number|null>(null);
    const [sentido,setSentido]=useState<'IDA'|'VOLTA'>('IDA');
    const [page,setPage]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[pontos,setPontos]=useState<PontoPublico[]>([]);const pending=useRef(false);
    const participantes=useRemoteResource(secao==='participantes'?`participantes-excursao:${id}:${page}`:false,signal=>participantesExcursao(id,page,signal));
    const convites=useRemoteResource(secao==='convites'?`convites-excursao:${id}`:false,signal=>convitesExcursao(id,signal));
    const error=secao==='participantes'?participantes.error:convites.error;
    const reload=secao==='participantes'?participantes.reload:secao==='convites'?convites.reload:()=>{};
    const run=async(task:()=>Promise<unknown>)=>{if(pending.current||lock?.current)return;pending.current=true;if(lock)lock.current=true;setBusy(true);setMessage('');try{await task();reload();}catch(e){setMessage(errorMessage(e));}finally{pending.current=false;if(lock)lock.current=false;setBusy(false);}};
    const estados:Record<string,string>={SOLICITADA:'Reserva solicitada',CONFIRMADA:'Inscrição confirmada',CANCELADA:'Inscrição cancelada',EXPIRADA:'Reserva expirada'};
    return <Section title={secao==='participantes'?'Reservas do grupo':secao==='convites'?'Links do grupo':'Explore o roteiro'}>
        {secao!=='roteiro'&&<Button title={secao==='participantes'?'Atualizar reservas':'Atualizar convites'} icon="refresh-outline" disabled={busy} onPress={reload}/>}
        {!!message&&<Text accessibilityLiveRegion="polite">{message}</Text>}
        {!!error&&<AsyncState message={error} onRetry={reload}/>}
            {secao==='participantes'&&(participantes.data?<>{!participantes.data.itens.length&&<AsyncState status="empty" title="Nenhum participante nesta página"/>}
            <Text style={trip.caption}>{participantes.data.total} inscrições · estados conforme o servidor</Text>
            {participantes.data.itens.map(p=><View key={p.id} style={trip.travelCard}><View style={trip.cardTop}><View style={trip.dateBadge}><Text style={trip.day}>{(p.nome||'?').charAt(0).toUpperCase()}</Text></View><View style={{flex:1,gap:5}}><Text style={trip.label}>{p.nome}</Text><Text style={trip.muted}>{estados[p.estado]||p.estado}</Text></View></View><Text style={trip.caption}>Embarque: {p.nomePonto||'Parada atribuída'}</Text>{p.estado==='SOLICITADA'&&<Button variant="primary" title="Confirmar reserva" accessibilityLabel={'Confirmar reserva de '+p.nome} disabled={busy} onPress={()=>void run(()=>confirmarParticipante(id,p.id))}/>}</View>)}
            <Pagination page={page} pages={participantes.data.totalPaginas} onChange={setPage} disabled={busy}/>
            </>:!error&&<RemoteLoading/>)}
            {secao==='convites'&&(convites.data?<>{!convites.data.length&&<AsyncState status="empty" title="Nenhum convite emitido"/>}{convites.data.map(c=><View key={c.id} style={trip.travelCard}><View style={trip.cardTop}><Ionicons name="ticket-outline" size={28} color={theme.colors.primary}/><View style={{flex:1,gap:6}}><Text style={trip.label}>Link de inscrição</Text><Text style={trip.status}>{c.revogadoEm?'Revogado':Date.parse(c.expiraEm)<=Date.now()?'Expirado':'Ativo'}</Text></View></View><Text style={trip.body}>Até {new Date(c.expiraEm).toLocaleString('pt-BR')}</Text>{!c.revogadoEm&&Date.parse(c.expiraEm)>Date.now()&&<Text style={trip.muted}>{conviteDisponivelEmMemoria(id,c.id)?'Pronto para compartilhar novamente nesta sessão.':'Este link não está na memória da sessão. Para um novo link, revogue antes de emitir outro.'}</Text>}{!c.revogadoEm&&<Button title="Revogar convite" variant="danger" disabled={busy} onPress={()=>setRevogar(c.id)}/>}</View>)}
            {revogar!=null&&<><Text style={ui.body}>Revogar este convite impede novos acessos. Inscrições existentes não serão apagadas.</Text><Button title="Confirmar revogação" disabled={busy} onPress={()=>void run(async()=>{await revogarConviteRecuperado(id,revogar);setRevogar(null);})}/><Button title="Manter convite" disabled={busy} onPress={()=>setRevogar(null)}/></>}
            </>:!error&&<RemoteLoading/>)}
        {secao==='roteiro'&&<><View style={{flexDirection:'row',gap:12}}>{(['IDA','VOLTA'] as const).map(s=><View key={s} style={{flex:1}}><Choice label={s==='IDA'?'Ida':'Volta'} selected={sentido===s} disabled={busy} onPress={()=>{setSentido(s);setPontos([]);}}/></View>)}</View>
        <Text style={trip.caption}>A prévia mostra a ordem dos pontos de {sentido==='IDA'?'ida':'volta'}. A linha no mapa é esquemática; não segue as ruas.</Text>
        {!origemConfigurada&&<><Text style={trip.body}>Para otimizar, configure o ponto de saída da excursão.</Text>
            {onConfigurarOrigem&&<Button title="Configurar ponto de saída" onPress={onConfigurarOrigem} disabled={busy}/>}</>}
        {executados.includes(sentido)&&<Text style={trip.body}>Este trecho já possui execução. O roteiro exibido será o snapshot salvo; não é possível reotimizar uma viagem iniciada.</Text>}
        <Button title={executados.includes(sentido)?"Ver roteiro da execução":"Ver sequência dos pontos"} disabled={busy} onPress={()=>void run(async()=>{setPontos([]);setPontos(await planejarExcursao(id,sentido,false));})}/>
        {!executados.includes(sentido)&&<Button title="Otimizar prévia dos pontos" disabled={busy||!origemConfigurada} onPress={()=>void run(async()=>{setPontos([]);setPontos(await planejarExcursao(id,sentido,true));})}/>}
        {!!pontos.length&&<><MapaPreviaPublica pontos={pontos}/><Text style={trip.caption}>Roteiro consultado no servidor. Nenhuma parada foi alterada.</Text></>}</>}
    </Section>;
}
