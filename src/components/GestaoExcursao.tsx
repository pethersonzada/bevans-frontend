import { useThemeRevision } from '../hooks/useThemeRevision';
import { RemoteLoading, ActionButton as Button, Choice, Section, Pagination, ui } from './ui/Primitives';
import { Ionicons } from '@expo/vector-icons';
import { trip } from './excursoes/ViagemUI';
import { theme } from '../styles/theme';
import { useContext,useEffect,useRef,useState } from 'react';
import { Text,View } from 'react-native';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { participantesExcursao,confirmarParticipante,convitesExcursao,planejarExcursao,type Excursao } from '../services/excursoes';
import { pontosSalvosExcursao,type PontoMapaExcursao } from '../services/mapaExcursao';
import { onConvitesChanged,conviteDisponivelEmMemoria,revogarConviteRecuperado } from '../services/convitesCompartilhamento';
import MapaPreviaPublica from './MapaPreviaPublica';
import { AsyncState } from './AsyncState';
import { errorMessage } from '../config/api';
import { ExcursaoActionContext } from './ExcursaoActionContext';
export function GestaoExcursao({id,excursao,secao='participantes',origemConfigurada=true,onConfigurarOrigem,onEditarPontos,executados=[]}:{
    id:number;
    excursao?:Excursao;
    secao?:'participantes'|'convites'|'roteiro';
    origemConfigurada?:boolean;
    onConfigurarOrigem?:()=>void;
    onEditarPontos?:()=>void;
    executados?:string[];
}){
    useThemeRevision();
    const [,setRevision]=useState(0);
    useEffect(()=>onConvitesChanged(()=>setRevision(v=>v+1)),[]);
    const lock=useContext(ExcursaoActionContext);
    const [revogar,setRevogar]=useState<number|null>(null);
    const [sentido,setSentido]=useState<'IDA'|'VOLTA'>('IDA');
    const [page,setPage]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const pending=useRef(false);
    const [consulta,setConsulta]=useState<{contexto:string;estado:'carregando'|'pronto'|'vazio'|'erro';pontos:PontoMapaExcursao[];erro?:string;codigo?:string;http?:number}|null>(null);
    const pedido=useRef<AbortController|null>(null);
    const contexto=`${id}:${secao}:${sentido}:${excursao?.versao}:${executados.join(',')}`;
    const atual=useRef(contexto);atual.current=contexto;
    const mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    useEffect(()=>{setMessage('');setConsulta(null);return()=>pedido.current?.abort();},[contexto]);
    const participantes=useRemoteResource(secao==='participantes'?`participantes-excursao:${id}:${page}`:false,signal=>participantesExcursao(id,page,signal));
    const convites=useRemoteResource(secao==='convites'?`convites-excursao:${id}`:false,signal=>convitesExcursao(id,signal));
    const error=secao==='participantes'?participantes.error:convites.error;
    const reload=secao==='participantes'?participantes.reload:secao==='convites'?convites.reload:()=>{};
    const run=async(task:()=>Promise<unknown>)=>{if(pending.current||lock?.current)return;pending.current=true;if(lock)lock.current=true;setBusy(true);setMessage('');try{await task();if(mounted.current&&atual.current===contexto)reload();}catch(e){if(mounted.current&&atual.current===contexto)setMessage(errorMessage(e));}finally{pending.current=false;if(lock)lock.current=false;if(mounted.current)setBusy(false);}};
    const consultarRoteiro=async(otimizar:boolean)=>{
        const controller=new AbortController();pedido.current?.abort();pedido.current=controller;
        setConsulta({contexto,estado:'carregando',pontos:[]});
        try{
            const resultado=await planejarExcursao(id,sentido,otimizar,controller.signal);
            if(mounted.current&&atual.current===contexto&&!controller.signal.aborted)setConsulta({contexto,estado:resultado.length?'pronto':'vazio',pontos:resultado});
        }catch(e){
            if(mounted.current&&atual.current===contexto&&!controller.signal.aborted){
                const detalhe=e as {code?:string;status?:number};
                setConsulta({contexto,estado:'erro',pontos:[],erro:errorMessage(e),codigo:detalhe.code,http:detalhe.status});
            }
        }
    };
    const roteiro=consulta?.contexto===contexto?consulta:null;
    const pontos=roteiro?.estado==='pronto'?roteiro.pontos:pontosSalvosExcursao(excursao,sentido);
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
        {secao==='roteiro'&&<><View style={{flexDirection:'row',gap:12}}>{(['IDA','VOLTA'] as const).map(s=><View key={s} style={{flex:1}}><Choice label={s==='IDA'?'Ida':'Volta'} selected={sentido===s} disabled={busy} onPress={()=>setSentido(s)}/></View>)}</View>
        <MapaPreviaPublica pontos={pontos}/>
        <Text style={trip.caption}>{roteiro?.estado==='pronto'?'Pontos do roteiro consultado no servidor.':'Locais salvos da excursão; o roteiro operacional ainda não foi confirmado.'} Nenhum trajeto pelas ruas foi calculado.</Text>
        {!roteiro&&<Text style={trip.body}>Consulte a sequência para conferir o roteiro de {sentido==='IDA'?'ida':'volta'} com os participantes confirmados.</Text>}
        {roteiro?.estado==='carregando'&&<RemoteLoading title="Consultando planejamento…"/>}
        {roteiro?.estado==='vazio'&&<Text accessibilityLiveRegion="polite">Nenhum ponto retornado. Revise os locais e participantes da excursão. Os locais salvos continuam no mapa.</Text>}
        {roteiro?.estado==='erro'&&<><Text accessibilityRole="alert" style={trip.body}>Erro de planejamento: {roteiro.erro}</Text>
            {(roteiro.codigo||roteiro.http)&&<Text style={trip.caption}>{roteiro.codigo}{roteiro.http?` (HTTP ${roteiro.http})`:''}</Text>}
            <Text style={trip.body}>Os locais salvos continuam disponíveis. Revise os pontos e participantes e consulte novamente.</Text></>}
        {onEditarPontos&&<Button title="Editar locais da excursão" disabled={busy} onPress={onEditarPontos}/>}
        {!origemConfigurada&&<><Text style={trip.body}>Para otimizar, configure o ponto de saída da excursão.</Text>
            {onConfigurarOrigem&&<Button title="Configurar ponto de saída" onPress={onConfigurarOrigem} disabled={busy}/>}</>}
        {executados.includes(sentido)&&<Text style={trip.body}>Este trecho já possui execução. O roteiro exibido será o snapshot salvo; não é possível reotimizar uma viagem iniciada.</Text>}
        <Button title={executados.includes(sentido)?"Ver roteiro da execução":"Ver sequência dos pontos"} disabled={busy} onPress={()=>void run(()=>consultarRoteiro(false))}/>
        {!executados.includes(sentido)&&<Button title="Otimizar prévia dos pontos" disabled={busy||!origemConfigurada} onPress={()=>void run(()=>consultarRoteiro(true))}/>}
        {roteiro?.estado==='pronto'&&<Text style={trip.caption}>Roteiro consultado no servidor. Nenhuma parada foi alterada.</Text>}</>}
    </Section>;
}
