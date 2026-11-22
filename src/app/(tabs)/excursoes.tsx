import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { listarExcursoes, listarExecucoes } from '../../services/excursoes';
import { AsyncState } from '../../components/AsyncState';
import { Notice, Pagination, RemoteLoading } from '../../components/ui/Primitives';
import { BlocoViagem, CabecalhoViagem, CartaoViagem, PaginaViagem, trip } from '../../components/excursoes/ViagemUI';
import { useNetInfo } from '@react-native-community/netinfo';
import { AcessoPassageiro } from '../../components/excursoes/AcessoPassageiro';
export default function ExcursoesTab() {
    const {user}=useAuth(),router=useRouter(),network=useNetInfo();
    const [page,setPage]=useState(0);
    const {data,error,reload}=useRemoteResource(user.tipo==='MOTORISTA'?`excursoes:${page}`:false,signal=>listarExcursoes(page,signal));
    const ids=data?.itens.filter(e=>e.estado!=='CANCELADA'&&e.estado!=='CONCLUIDA').map(e=>e.id)||[];
    // Query only the displayed page. Failed status reads never invent an execution.
    const operacao=useRemoteResource(user.tipo==='MOTORISTA'&&ids.length?`execucoes-lista:${ids.join(',')}`:false,async signal=>{
        const active:number[]=[],unavailable:number[]=[];
        for(let i=0;i<ids.length;i+=4){
            if(signal.aborted)throw new Error('Consulta interrompida.');
            const batch=ids.slice(i,i+4),results=await Promise.allSettled(batch.map(id=>listarExecucoes(id,signal)));
            results.forEach((r,j)=>{if(r.status==='fulfilled'){if(r.value.some(e=>e.estado==='EM_ANDAMENTO'))active.push(batch[j]);}else unavailable.push(batch[j]);});
        }
        return {active,unavailable};
    },60000);
    const grupos=data?[
        {title:'Em viagem',itens:data.itens.filter(e=>operacao.data?.active.includes(e.id))},
        {title:'Planejadas e publicadas',itens:data.itens.filter(e=>!['CANCELADA','CONCLUIDA'].includes(e.estado)&&!operacao.data?.active.includes(e.id))},
        {title:'Viagens encerradas',itens:data.itens.filter(e=>['CANCELADA','CONCLUIDA'].includes(e.estado))},
    ]:[];
    return <PaginaViagem tabs title="Excursões">
        <CabecalhoViagem eyebrow="Leve o grupo mais longe" title="Qual é o próximo destino?" subtitle={user.tipo==='MOTORISTA'?'Planeje encontros. Colecione caminhos.':'Consulte o convite do organizador e prepare sua próxima viagem.'}/>
        {user.tipo!=='MOTORISTA'?<AcessoPassageiro key={user.id}/>:<>
            <Pressable accessibilityRole="button" accessibilityLabel="Criar excursão" onPress={()=>router.push('/editar-excursao')} style={[trip.hero,{flexDirection:'row',alignItems:'center',gap:18}]}><View style={[trip.heroIcon,{width:56,height:56}]}><Ionicons name="add" size={32} color="#fff"/></View><View style={{flex:1,gap:6}}><Text style={[trip.heroTitle,{fontSize:22,lineHeight:28}]}>Montar uma viagem</Text><Text style={trip.heroSubtitle}>Comece escolhendo o destino</Text></View></Pressable>
            {(network.isConnected===false||network.isInternetReachable===false)&&<Notice>Sem conexão. Reconecte para atualizar suas viagens.</Notice>}
            {error?<AsyncState message={error} onRetry={reload}/>:!data?<RemoteLoading/>:<>
                {!data.itens.length&&<View style={[trip.travelCard,{alignItems:'center',paddingVertical:32}]}><Ionicons name="compass-outline" size={44} color="#14253A"/><Text style={trip.sectionTitle}>O primeiro destino é com você</Text><Text style={[trip.muted,{textAlign:'center'}]}>Escolha o lugar, combine o dia e organize os embarques. O convite vem depois.</Text></View>}
                {grupos.filter(g=>g.itens.length).map(g=><BlocoViagem key={g.title} title={g.title}>{g.itens.map(e=><CartaoViagem key={e.id} e={e} emAndamento={g.title==='Em viagem'} onPress={()=>router.push({pathname:'/editar-excursao',params:{id:String(e.id)}})}/>)}</BlocoViagem>)}
                {!!operacao.data?.unavailable.length&&<Text style={trip.caption}>Não foi possível verificar algumas execuções. Abra a viagem para atualizar o acompanhamento.</Text>}
                {data.totalPaginas>1&&<Text style={trip.caption}>Os grupos mostram as viagens desta página.</Text>}
                <Pagination page={page} pages={data.totalPaginas} onChange={setPage}/>
            </>}
        </>}
    </PaginaViagem>;
}
