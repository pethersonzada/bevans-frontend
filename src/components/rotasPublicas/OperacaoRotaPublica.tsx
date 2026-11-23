import { useThemeRevision } from '../../hooks/useThemeRevision';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { consultarEstadoViagem } from '../../services/viagens';
import { confirmarExecucaoPublica, iniciarTrechoPublico, revisarInicioPublico, type RevisaoInicioPublico } from '../../services/inicioRotaPublica';
import { dataLocal } from '../../services/dataOperacao';
import { errorMessage } from '../../config/api';
import type { RotaPublica } from '../../types/rotaPublica';
import { ActionButton, Notice, RemoteLoading, ui } from '../ui/Primitives';
import { AsyncState } from '../AsyncState';

export function OperacaoRotaPublica({ rota, bloqueada, offline }: { rota: RotaPublica; bloqueada: boolean; offline: boolean }) {
    useThemeRevision();
    const router=useRouter();
    const [revisao,setRevisao]=useState<RevisaoInicioPublico|null>(null),[erro,setErro]=useState(''),[busy,setBusy]=useState(false),[incerto,setIncerto]=useState(false);
    const pending=useRef(false),mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    const estado=useRemoteResource(`operacao-publica:${rota.id}`,()=>consultarEstadoViagem(rota.turmaId),15000);
    const run=async(task:()=>Promise<void>)=>{
        if(pending.current)return;pending.current=true;setBusy(true);setErro('');
        try{await task();}catch(e){if(mounted.current)setErro(errorMessage(e));}
        finally{pending.current=false;if(mounted.current){setBusy(false);estado.reload();}}
    };
    const navegar=async(controle:boolean)=>{
        const confirmada=await confirmarExecucaoPublica(rota);
        if(!mounted.current)return;
        router.push(controle?{pathname:'/controle-viagem',params:{tipo:'VIAGEM',id:String(confirmada.viagemId)}}:{pathname:'/mapa',params:{modalidade:'PUBLICA',rotaId:String(rota.id),turmaId:String(rota.turmaId),viagemId:String(confirmada.viagemId),sentido:confirmada.sentido!.toLowerCase()}});
    };
    return <View style={{gap:16}}>
        <Text style={ui.body}>Data para revisão: {dataLocal().split('-').reverse().join('/')} (relógio do aparelho). O servidor confirma a operação ao iniciar.</Text>
        {!!erro&&<Notice>{erro}</Notice>}
        {estado.error?<AsyncState message={estado.error} onRetry={estado.reload}/>:!estado.data?<RemoteLoading/>:null}
        {incerto&&<><Notice>O início pode ter sido registrado. Confira o servidor antes de qualquer nova tentativa.</Notice><ActionButton title="Conferir início da rota" disabled={busy||offline} onPress={()=>void run(async()=>{const atual=await consultarEstadoViagem(rota.turmaId);if(mounted.current){setIncerto(false);setRevisao(null);}if(atual.status==='ATIVA')await navegar(false);})}/></>}
        {(['IDA','VOLTA'] as const).map(sentido=>{
            const ativa=estado.data?.status==='ATIVA'&&estado.data.sentido===sentido;
            const horario=sentido==='IDA'?rota.horarioIda:rota.horarioVolta;
            const impedimento=bloqueada?'Confirme as alterações salvas antes de iniciar.':!rota.ativa||!rota.publicada?'Publique uma rota ativa para iniciar.':!rota.vagas.configurada?'Configure a capacidade da turma.':!horario?'Este sentido não tem horário configurado.':estado.data?.status==='ATIVA'?'Já há uma viagem em andamento nesta turma.':null;
            return <View key={sentido} style={ui.section}>
                <Text accessibilityRole="header" style={ui.sectionTitle}>{sentido==='IDA'?'Ida':'Volta'} · {ativa?'Em andamento':!estado.data||estado.error?'Estado não confirmado':impedimento?'Indisponível':'Revisar para iniciar'}</Text>
                <Text style={ui.body}>{sentido==='IDA'?rota.origemNome:rota.destinoNome} → {sentido==='IDA'?rota.destinoNome:rota.origemNome}</Text>
                <Text style={ui.caption}>{horario?.slice(0,5)||'Horário não configurado'} · {rota.paradas.length} paradas cadastradas · {rota.modo==='FIXA'?'Fixa':'Flexível'}</Text>
                {ativa?<><ActionButton title="Abrir navegação" variant="primary" disabled={busy||offline} onPress={()=>void run(()=>navegar(false))}/><ActionButton title="Controle de embarques" disabled={busy||offline} onPress={()=>void run(()=>navegar(true))}/></>:<>
                    {impedimento&&<Text style={ui.body}>{impedimento}</Text>}
                    {!impedimento&&<ActionButton title={`Revisar viagem ${sentido}`} disabled={busy||offline||incerto||!estado.data||!!estado.error} onPress={()=>void run(async()=>{const r=await revisarInicioPublico(rota,sentido);if(mounted.current)setRevisao(r);})}/>}
                </>}
                {revisao?.sentido===sentido && !ativa && !impedimento && estado.data?.status !== 'ATIVA' && <>
                    <Text style={ui.label}>Revisão confirmada pelo servidor</Text><Text style={ui.body}>{revisao.aprovados} embarques aprovados · {revisao.pontos.length-2} pontos intermediários</Text>
                    {revisao.pontos.map((p,i)=><Text key={i} style={ui.body}>{i+1}. {p.nome}</Text>)}
                    <ActionButton variant="primary" title={`Confirmar início ${sentido}`} disabled={busy||offline||incerto||bloqueada} onPress={()=>void run(async()=>{
                        try{await iniciarTrechoPublico(revisao);if(mounted.current){setRevisao(null);await navegar(false);}}
                        catch(e){const {status,inicioSolicitado}=e as {status?:number;inicioSolicitado?:boolean};if(mounted.current&&inicioSolicitado&&(!status||status>=500))setIncerto(true);throw e;}
                    })}/><ActionButton title="Cancelar revisão" disabled={busy} onPress={()=>setRevisao(null)}/>
                </>}
            </View>;
        })}
    </View>;
}
