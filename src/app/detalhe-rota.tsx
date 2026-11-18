import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { buscarRotaPublica } from '../services/rotasPublicas';
import { meusEmbarques, solicitarEmbarque, solicitarVagaRota } from '../services/embarques';
import { minhasTurmasPassageiro } from '../services/solicitacoes';
import { consultarEstadoViagem } from '../services/viagens';
import { validarPedidoPublico } from '../services/pedidoPublico';
import { dataLocal } from '../services/dataOperacao';
import { errorMessage } from '../config/api';
import type { EnderecoEncontrado } from '../services/enderecoSearch';
import { AsyncState } from '../components/AsyncState';
import EnderecoMapaPicker from '../components/EnderecoMapaPicker';
import MapaPreviaPublica from '../components/MapaPreviaPublica';
import { SeletorDataOperacao } from '../components/SeletorDataOperacao';
import { RastreamentoViagem } from '../components/RastreamentoViagem';
import { ContatoProtegido } from '../components/ContatoProtegido';
import { Screen, Section, ActionButton as Button, Choice, Notice, RemoteLoading, ui } from '../components/ui/Primitives';

export default function DetalheRota() {
    const {id}=useLocalSearchParams<{id:string}>(),{user}=useAuth();
    return <RotaPassageiro key={`${user.id}:${id}`} id={id} usuarioId={user.id} motorista={user.tipo==='MOTORISTA'}/>;
}
export function RotaPassageiro({id,usuarioId,motorista}:{id:string;usuarioId:string|null;motorista:boolean}) {
    const router=useRouter();
    const rota=useRemoteResource(usuarioId?`rota:${id}`:false,()=>buscarRotaPublica(id));
    const pedidos=useRemoteResource(usuarioId&&!motorista?'pedidos-publicos':false,meusEmbarques);
    const vinculos=useRemoteResource(usuarioId&&!motorista?'vinculos-publicos':false,signal=>minhasTurmasPassageiro(usuarioId!,signal));
    const vinculada=!!rota.data&&!!vinculos.data?.some(t=>t.id===rota.data!.turmaId);
    const viagem=useRemoteResource(vinculada?`status-publico:${rota.data!.turmaId}`:false,()=>consultarEstadoViagem(rota.data!.turmaId),10000);
    const [parada,setParada]=useState<number|null>(null),[ponto,setPonto]=useState<EnderecoEncontrado|null>(null),[flexivel,setFlexivel]=useState(false);
    const [dataOperacao,setData]=useState(()=>dataLocal()),[sentido,setSentido]=useState<'IDA'|'VOLTA'>('IDA');
    const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');const pending=useRef(false),mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    const run=async(task:()=>Promise<void>)=>{if(pending.current)return;pending.current=true;setBusy(true);setFeedback('');try{await task();}catch(e){if(mounted.current)setFeedback(errorMessage(e));}finally{pending.current=false;if(mounted.current){setBusy(false);pedidos.reload();vinculos.reload();}}};
    const r=rota.data;
    const dias:Record<string,string>={MONDAY:'Seg',TUESDAY:'Ter',WEDNESDAY:'Qua',THURSDAY:'Qui',FRIDAY:'Sex',SATURDAY:'Sáb',SUNDAY:'Dom'};
    const meus=pedidos.data?.filter(p=>p.rotaId===r?.id);
    const aberto=meus?.find(p=>p.dataOperacao===dataOperacao&&p.sentido===sentido&&['PENDENTE','APROVADO'].includes(p.status));
    return <Screen title="Detalhes da rota" subtitle="Trajeto, vínculo e embarques para cada viagem." onBack={()=>router.back()}>
        {rota.error?<AsyncState message={rota.error} onRetry={rota.reload}/>:!r?<RemoteLoading/>:<>
            <Section title={r.nome} description={`${r.cidade} · ${r.modo==='FIXA'?'Fixa':'Flexível'}`}>
                <Text style={ui.body}>{r.origemNome} → {r.destinoNome}</Text>
                <Text style={ui.body}>{r.dias.map(d=>dias[d]).join(' · ')} · Ida {r.horarioIda?.slice(0,5)||'—'} · Volta {r.horarioVolta?.slice(0,5)||'—'}</Text>
                <Text style={ui.body}>{r.vagas.disponiveis??'Capacidade não configurada'}{r.vagas.disponiveis!=null?' vagas disponíveis':''}</Text>
                <ContatoProtegido key={r.id} tipo="rotas-publicas" id={r.id}/>
            </Section>
            <Section title="Mapa e paradas" description="Locais cadastrados. O mapa não representa navegação viária.">
                <MapaPreviaPublica pontos={[{nome:r.origemNome,latitude:r.origemLatitude,longitude:r.origemLongitude,paradaId:null},...r.paradas.map(p=>({...p,paradaId:p.id})),{nome:r.destinoNome,latitude:r.destinoLatitude,longitude:r.destinoLongitude,paradaId:null}]}/>
                {r.paradas.map((p,i)=><Text key={p.id} style={ui.body}>{i+1}. {p.nome}{p.horario?` · ${p.horario.slice(0,5)}`:''}</Text>)}
            </Section>
            {motorista?<Button title="Gerenciar esta rota" onPress={()=>router.push({pathname:'/editar-rota-publica',params:{id}})}/>:<>
                <Section title="Vínculo com a rota" description="Aprovação do vínculo permite participar da turma. Cada embarque tem uma solicitação própria.">
                    {vinculos.error?<AsyncState message={vinculos.error} onRetry={vinculos.reload}/>:!vinculos.data?<RemoteLoading/>:<Text style={ui.body}>{vinculada?'Vínculo aprovado':'Nenhum vínculo aprovado confirmado. Pedidos pendentes dependem da análise do motorista.'}</Text>}
                    {!vinculada&&<Button title="Solicitar vínculo com esta rota" disabled={busy||!r.ativa||!r.publicada} onPress={()=>void run(async()=>{const v=await solicitarVagaRota(r.id);if(mounted.current)setFeedback(v.status==='APROVADO'?'Vínculo aprovado.':'Pedido de vínculo enviado. Aguarde a aprovação do motorista.');})}/>}
                </Section>
                <Section title="Solicitação de embarque" description="Escolha data, sentido e ponto. O pedido fica pendente até a aprovação do motorista.">
                    <SeletorDataOperacao label="Data do embarque" value={dataOperacao} onChange={setData} disabled={busy}/>
                    {(['IDA','VOLTA'] as const).map(s=><Choice key={s} label={s==='IDA'?'Ida':'Volta'} description={(s==='IDA'?r.horarioIda:r.horarioVolta)?.slice(0,5)||'Horário indisponível'} selected={sentido===s} disabled={busy||!(s==='IDA'?r.horarioIda:r.horarioVolta)} onPress={()=>setSentido(s)}/>)}
                    {r.paradas.map(p=><Choice key={p.id} selected={parada===p.id&&!flexivel} label={p.nome} description={p.horario?.slice(0,5)} disabled={busy} onPress={()=>{setParada(p.id);setPonto(null);setFlexivel(false);}}/>)}
                    {(r.modo==='FLEXIVEL'||r.permitePontoExcepcional)&&<><Button title={flexivel?'Fechar escolha de ponto':'Escolher ponto flexível'} disabled={busy} onPress={()=>{setFlexivel(v=>!v);setParada(null);setPonto(null);}}/>{flexivel&&<EnderecoMapaPicker onChange={setPonto}/>}</>}
                    {aberto&&<Notice>Já existe um pedido {aberto.status==='PENDENTE'?'pendente de aprovação':'aprovado'} para esta data e sentido. Consulte-o abaixo.</Notice>}
                    <Button variant="primary" title={busy?'Enviando…':'Solicitar embarque'} disabled={busy||!!aberto||!pedidos.data||!!pedidos.error||!r.ativa||!r.publicada||(!parada&&!ponto)} onPress={()=>void run(async()=>{validarPedidoPublico(r,dataOperacao,sentido,parada,ponto);const pedido=await solicitarEmbarque(r.id,{dataOperacao,sentido,...(parada?{paradaId:parada}:{nomePonto:ponto!.nome,latitude:ponto!.latitude,longitude:ponto!.longitude,pontoConfirmado:true})});if(mounted.current)setFeedback(pedido.status==='PENDENTE'?'Pedido de embarque enviado. Aguarde a aprovação do motorista.':'Embarque autorizado. Confirme que embarcou somente ao entrar na van.');})}/>
                </Section>
                <Section title="Meus pedidos nesta rota">
                    {pedidos.error?<AsyncState message={pedidos.error} onRetry={pedidos.reload}/>:!meus?<RemoteLoading/>:!meus.length?<Text style={ui.body}>Você ainda não solicitou embarques nesta rota.</Text>:meus.map(p=><View key={p.id} style={ui.section}><Text style={ui.label}>{p.status==='PENDENTE'?'Pendente de aprovação':p.status==='APROVADO'?'Embarque autorizado':p.status==='REJEITADO'?'Pedido recusado':'Pedido cancelado'}</Text><Text style={ui.body}>{p.dataOperacao.split('-').reverse().join('/')} · {p.sentido} · {p.nomePonto||`Parada ${p.paradaId}`}</Text></View>)}
                </Section>
                {vinculada&&<Section title="Acompanhar viagem">
                    {viagem.error?<AsyncState message={viagem.error} onRetry={viagem.reload}/>:!viagem.data?<RemoteLoading/>:viagem.data.status==='ATIVA'?<><Text style={ui.body}>Viagem em andamento · {viagem.data.sentido}</Text><RastreamentoViagem key={viagem.data.viagemId} tipo="VIAGEM" id={String(viagem.data.viagemId)} motorista={false}/><Button title="Meu embarque nesta viagem" onPress={()=>router.push({pathname:'/controle-viagem',params:{tipo:'VIAGEM',id:String(viagem.data!.viagemId)}})}/></>:<Text style={ui.body}>{viagem.data.estado==='FINALIZADA'?'Viagem finalizada':viagem.data.estado==='CANCELADA'?'Viagem cancelada':'Nenhuma viagem iniciada'}</Text>}
                </Section>}
            </>}
        </>}
        {!!feedback&&<Notice>{feedback}</Notice>}
    </Screen>;
}
