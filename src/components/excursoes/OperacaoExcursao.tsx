import { useThemeRevision } from '../../hooks/useThemeRevision';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { buscarExecucaoExcursao, listarExecucoes, iniciarExcursao, finalizarExcursao, type Excursao, type ExecucaoExcursao } from '../../services/excursoes';
import { impedimentoInicioExcursao } from '../../services/excursaoValidacao';
import { Notice } from '../ui/Primitives';
import { AsyncAction } from './AcaoExcursao';
import { ActionButton, BlocoViagem, trip } from './ViagemUI';
import type { Momento } from './Planejamento';
import { RoteiroExecucaoExcursao } from './RoteiroExecucaoExcursao';
import { revisarTrechoExcursao, conferirRevisaoTrecho, type RevisaoTrechoExcursao } from '../../services/inicioExcursao';

export function OperacaoExcursao({e,execucoes,offline,dirty,onRefresh,onEdit,onPublicar,onControle}:{e:Excursao;execucoes:ExecucaoExcursao[]|null;offline:boolean;dirty:boolean;onRefresh:()=>void;onEdit?:(m:Momento)=>void;onPublicar:()=>void;onControle:(id:number)=>void}) {
    useThemeRevision();
    const [incerto,setIncerto]=useState<'IDA'|'VOLTA'|null>(null),[roteiro,setRoteiro]=useState<number|null>(null);
    const [revisao,setRevisao]=useState<RevisaoTrechoExcursao|null>(null);
    const pending=useRef(false);
    const mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    return <>
        {execucoes?.map(v=><View key={v.id} style={trip.travelCard}>
            <Text style={trip.eyebrow}>{v.sentido==='IDA'?'Ida':'Volta'} · {v.estado==='EM_ANDAMENTO'?'Em andamento':v.estado==='FINALIZADA'?'Finalizada':'Cancelada'}</Text>
            <Text style={trip.label}>{v.pontos[0]?.nome||'Origem não informada'} → {v.pontos[v.pontos.length-1]?.nome||'Destino não informado'}</Text>
            <Text style={trip.caption}>{v.sentido==='IDA'?new Date(e.partidaEm).toLocaleString('pt-BR'):e.retornoEm?new Date(e.retornoEm).toLocaleString('pt-BR'):'Retorno não configurado'} · {Math.max(0,v.pontos.length-2)} pontos intermediários no roteiro oficial</Text>
            {v.pontos.every(p=>Array.isArray(p.participantes))&&<Text style={trip.caption}>{new Set(v.pontos.flatMap(p=>p.participantes!.map(a=>a.inscricaoId))).size} participantes autorizados</Text>}
            <ActionButton variant={v.estado==='EM_ANDAMENTO'?'primary':'secondary'} title="Controle de embarque" onPress={()=>onControle(v.id)}/>
            <ActionButton title={roteiro===v.id?'Ocultar roteiro da execução':'Ver roteiro da execução'} onPress={()=>setRoteiro(roteiro===v.id?null:v.id)}/>
            {roteiro===v.id&&<RoteiroExecucaoExcursao execucao={v}/>}
            {v.estado==='EM_ANDAMENTO'&&<AsyncAction variant="secondary" title="Finalizar execução" disabled={offline} confirmMessage="Encerrar este trecho? Confirme os desembarques reais antes de finalizar." action={async()=>{
                try{await finalizarExcursao(e.id,v.id);const atual=await buscarExecucaoExcursao(e.id,v.id);if(atual.estado!=='FINALIZADA')throw new Error('A finalização ainda não foi confirmada na consulta. Atualize a viagem.');}finally{onRefresh();}
            }}/>}
        </View>)}
        {incerto&&<View style={{gap:8}}><Notice>O resultado do início precisa ser conferido. Atualize as execuções antes de tentar novamente; nenhuma viagem será anunciada como iniciada sem confirmação.</Notice>
            <AsyncAction variant="secondary" title="Conferir início da execução" disabled={offline} action={async()=>{const atuais=await listarExecucoes(e.id);if(!mounted.current)return;const encontrada=atuais.find(v=>v.sentido===incerto);onRefresh();setIncerto(null);if(encontrada?.estado==='EM_ANDAMENTO')onControle(encontrada.id);}}/>
        </View>}
        <BlocoViagem title="Escolha o trecho da viagem">
            {dirty&&<Notice>Salve ou descarte as alterações do planejamento antes de iniciar.</Notice>}
            {(['IDA','VOLTA'] as const).map(sentido=>{
                if(execucoes?.some(v=>v.sentido===sentido))return null;
                const impedimento=impedimentoInicioExcursao(e,sentido,execucoes);
                return <View key={sentido} style={trip.travelCard}>
                    <Text accessibilityRole="header" style={trip.sectionTitle}>{sentido==='IDA'?'Ida':'Volta'} · {!execucoes?'Estado não confirmado':impedimento?'Indisponível':'Pronta para revisão'}</Text>
                    <Text style={trip.label}>{sentido==='IDA'?e.origemNome||'Origem operacional a conferir':e.destinoNome} → {sentido==='IDA'?e.destinoNome:e.origemNome||'Destino operacional não configurado'}</Text>
                    <Text style={trip.caption}>{sentido==='IDA'?new Date(e.partidaEm).toLocaleString('pt-BR'):e.retornoEm?new Date(e.retornoEm).toLocaleString('pt-BR'):'Dia e horário de retorno não configurados'}</Text>
                    {sentido==='VOLTA'&&onEdit&&!e.retornoEm&&<ActionButton title="Configurar retorno antes da ida" onPress={()=>onEdit('Datas')}/>}
                    {!impedimento&&<AsyncAction variant="secondary" title={`Revisar trecho ${sentido}`} disabled={offline||dirty||!!incerto} action={async()=>{const r=await revisarTrechoExcursao(e,sentido);if(mounted.current)setRevisao(r);}}/>}
                    {revisao?.sentido===sentido&&<>
                    <Text style={trip.label}>Planejamento confirmado pelo servidor</Text>
                    <Text style={trip.caption}>{revisao.autorizados===null?'Quantidade de autorizados não informada':`${revisao.autorizados} participantes autorizados`} · {revisao.pontos.length-2} pontos intermediários</Text>
                    {revisao.pontos.map((p,i)=><Text key={i} style={trip.body}>{i+1}. {p.nome}</Text>)}
                    <AsyncAction title={`Iniciar execução ${sentido}`} disabled={offline||dirty||!!incerto||!!impedimento||revisao.versao!==e.versao} confirmMessage={`Iniciar o trecho de ${sentido==='IDA'?'ida':'volta'} acima? Os embarques ficarão bloqueados para edição.`} action={async()=>{
                        if(pending.current)return;pending.current=true;
                        let inicioSolicitado=false;
                        try{
                            await conferirRevisaoTrecho(e,revisao);
                            inicioSolicitado=true;
                            const iniciada=await iniciarExcursao(e.id,sentido);
                            const confirmada=await buscarExecucaoExcursao(e.id,iniciada.id);
                            if(confirmada.estado!=='EM_ANDAMENTO'||confirmada.sentido!==sentido)throw new Error('Confira o estado da execução antes de continuar.');
                            if(mounted.current){setRevisao(null);onControle(confirmada.id);}
                        }catch(error){const status=(error as {status?:number}).status;if(mounted.current&&inicioSolicitado&&(!status||status>=500))setIncerto(sentido);throw error;}
                        finally{pending.current=false;if(mounted.current)onRefresh();}
                    }}/><ActionButton title="Cancelar revisão do trecho" onPress={()=>setRevisao(null)}/></>}
                    {impedimento&&<><Text style={trip.caption}>{impedimento.mensagem}</Text>
                        {impedimento.etapa==='publicacao'?<ActionButton title="Revisar publicação" onPress={onPublicar}/>:impedimento.etapa&&(onEdit?<ActionButton title="Completar configuração da viagem" onPress={()=>onEdit(impedimento.etapa as Momento)}/>:<Notice>A configuração não pode ser alterada após o início da excursão. Planeje a volta antes de iniciar a ida.</Notice>)}</>}
                </View>;
            })}
        </BlocoViagem>
    </>;
}
