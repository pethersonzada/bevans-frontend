import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { apiRequest } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { ContatoProtegido } from './ContatoProtegido';
import { MenuRow, ui } from './ui/Primitives';
export function AtalhosTurma({turmaId}:{turmaId:number}) {
    const {user}=useAuth(),router=useRouter();
    const {data}=useRemoteResource('status-operacao:'+turmaId,signal=>apiRequest<{status:string;viagemId:number}>('/rota/status-atual?turmaId='+turmaId,{signal}),15000);
    return <View style={ui.section}>
        <Text style={ui.sectionTitle}>Sua turma</Text>
        <Text style={ui.caption}>{data?.status==='ATIVA'?'Viagem em andamento':'Consulte o trajeto e as informações da turma.'}</Text>
        {user.tipo!=='MOTORISTA'&&<><MenuRow title="Meu embarque" description="Consulte as paradas e escolha onde embarcar." icon="location-outline" onPress={()=>router.push({pathname:'/coleta-privada',params:{turmaId:String(turmaId)}})}/><ContatoProtegido tipo="turmas" id={turmaId}/></>}
        {data?.status==='ATIVA'&&!!data.viagemId&&<MenuRow title="Acompanhar viagem" description="Embarques e situação atual." icon="navigate-outline" onPress={()=>router.push({pathname:'/controle-viagem',params:{tipo:'VIAGEM',id:String(data.viagemId)}})}/>}
    </View>;
}
