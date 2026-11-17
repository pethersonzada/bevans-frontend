import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { buscarExecucaoExcursao, listarExecucoes, iniciarExcursao, finalizarExcursao, type Excursao, type ExecucaoExcursao } from '../../services/excursoes';
import { impedimentoInicioExcursao } from '../../services/excursaoValidacao';
import { Notice } from '../ui/Primitives';
import { AsyncAction } from './AcaoExcursao';
import { ActionButton, BlocoViagem, trip } from './ViagemUI';
import type { Momento } from './Planejamento';
import { RoteiroExecucaoExcursao } from './RoteiroExecucaoExcursao';

export function OperacaoExcursao({e,execucoes,offline,dirty,onRefresh,onEdit,onPublicar,onControle}:{e:Excursao;execucoes:ExecucaoExcursao[]|null;offline:boolean;dirty:boolean;onRefresh:()=>void;onEdit?:(m:Momento)=>void;onPublicar:()=>void;onControle:(id:number)=>void}) {
    const [incerto,setIncerto]=useState<'IDA'|'VOLTA'|null>(null),[roteiro,setRoteiro]=useState<number|null>(null);
    const pending=useRef(false);
    const mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    return <>
        {execucoes?.map(v=><View key={v.id} style={trip.travelCard}>
            <Text style={trip.eyebrow}>{v.sentido==='IDA'?'Ida':'Volta'} · {v.estado==='EM_ANDAMENTO'?'Em andamento':v.estado==='FINALIZADA'?'Finalizada':'Cancelada'}</Text>
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
        <BlocoViagem title="Iniciar um trecho">
            {dirty&&<Notice>Salve ou descarte as alterações do planejamento antes de iniciar.</Notice>}
            {(['IDA','VOLTA'] as const).map(sentido=>{
                const impedimento=impedimentoInicioExcursao(e,sentido,execucoes);
                return <View key={sentido} style={{gap:8}}>
                    <AsyncAction title={`Iniciar execução ${sentido}`} disabled={offline||dirty||!!incerto||!!impedimento} confirmMessage="Iniciar com o roteiro e os participantes confirmados no servidor? Os embarques ficarão bloqueados para edição." action={async()=>{
                        if(pending.current)return;pending.current=true;
                        try{
                            const iniciada=await iniciarExcursao(e.id,sentido);
                            const confirmada=await buscarExecucaoExcursao(e.id,iniciada.id);
                            if(confirmada.estado!=='EM_ANDAMENTO'||confirmada.sentido!==sentido)throw new Error('Confira o estado da execução antes de continuar.');
                            if(mounted.current)onControle(confirmada.id);
                        }catch(error){const status=(error as {status?:number}).status;if(mounted.current&&(!status||status>=500))setIncerto(sentido);throw error;}
                        finally{pending.current=false;if(mounted.current)onRefresh();}
                    }}/>
                    {impedimento&&<><Text style={trip.caption}>{impedimento.mensagem}</Text>
                        {impedimento.etapa==='publicacao'?<ActionButton title="Revisar publicação" onPress={onPublicar}/>:impedimento.etapa&&(onEdit?<ActionButton title="Completar configuração da viagem" onPress={()=>onEdit(impedimento.etapa as Momento)}/>:<Notice>A configuração não pode ser alterada após o início da excursão. Planeje a volta antes de iniciar a ida.</Notice>)}</>}
                </View>;
            })}
        </BlocoViagem>
    </>;
}
