import { useThemeRevision } from '../hooks/useThemeRevision';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { AsyncState } from '../components/AsyncState';
import { errorMessage } from '../config/api';
import { listarMinhasRotas } from '../services/rotasPublicas';
import { listarVinculosPendentes } from '../services/solicitacoes';
import { useRemoteResource } from '../hooks/useRemoteResource';
import type { RotaPublica } from '../types/rotaPublica';
import { RemoteLoading, Screen, Section, ActionButton, Notice, ui } from '../components/ui/Primitives';
export default function RotasPublicasMotorista() {
    useThemeRevision();
    const {user,isLoading}=useAuth(),router=useRouter();
    const [rotas,setRotas]=useState<RotaPublica[]>([]),[loading,setLoading]=useState(true),[erro,setErro]=useState(''),[tentativa,setTentativa]=useState(0);
    const pendentes=useRemoteResource(user.id&&user.tipo==='MOTORISTA'?`rotas:vinculos:${tentativa}`:false,signal=>listarVinculosPendentes(user.id!,signal),60000);
    useFocusEffect(useCallback(()=>{
        if(isLoading||!user.id||user.tipo!=='MOTORISTA')return;
        let active=true;setLoading(true);setErro('');
        listarMinhasRotas().then(r=>{if(active)setRotas(r);}).catch(e=>{if(active)setErro(errorMessage(e));}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;};
    },[user.id,user.tipo,isLoading,tentativa]));
    return <Screen tabs title="Rotas públicas" subtitle="Seus serviços de transporte, horários e paradas.">
        {isLoading||!user.id||user.tipo!=='MOTORISTA'?<AsyncState loading={isLoading} message="Entre como motorista para gerenciar suas rotas."/>:<>
            <ActionButton variant="primary" icon="add" title="Criar rota pública" onPress={()=>router.push('/editar-rota-publica')}/>
            <ActionButton icon="people-outline" title="Solicitações recebidas" onPress={()=>router.push('/solicitacoes')}/>
            {loading?<RemoteLoading title="Carregando suas rotas"/>:erro?<AsyncState message={erro} onRetry={()=>setTentativa(v=>v+1)}/>:<>
                {!rotas.length&&<Section title="Seu próximo serviço começa aqui" description="Cadastre o trajeto e os horários. Revise os dados antes de disponibilizar a rota aos passageiros."><Notice>Nenhuma rota pública criada. Suas turmas privadas continuam na aba principal.</Notice></Section>}
                {rotas.map(r=><Section key={r.id} title={r.nome} description={r.cidade+' · '+(r.modo==='FIXA'?'Trajeto fixo':'Trajeto flexível')}>
                    <Text style={ui.body}>{r.origemNome} · {r.destinoNome}</Text>
                    <Text style={ui.caption}>{r.publicada?'Publicada no catálogo':'Não publicada'} · {r.vagas.disponiveis??'—'} vagas disponíveis</Text>
                    <Text style={ui.caption}>Ida {r.horarioIda||'não informada'} · Volta {r.horarioVolta||'não informada'}</Text>
                    {pendentes.data&&<Text style={ui.caption}>{pendentes.data.filter(p=>p.turma.id===r.turmaId).length} vínculos pendentes de análise</Text>}
                    {pendentes.error&&<Text style={ui.caption}>Pedidos de vínculo indisponíveis. Consulte as solicitações para tentar novamente.</Text>}
                    <ActionButton title="Gerenciar rota" icon="chevron-forward" onPress={()=>router.push({pathname:'/editar-rota-publica',params:{id:String(r.id)}})}/>
                </Section>)}
            </>}
        </>}
    </Screen>;
}
