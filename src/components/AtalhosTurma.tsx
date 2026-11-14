import { Button,View,Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { apiRequest } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { ContatoProtegido } from './ContatoProtegido';
export function AtalhosTurma({turmaId}:{turmaId:number}) {
    const {user}=useAuth();const router=useRouter();const {data}=useRemoteResource(`status-operacao:${turmaId}`,signal=>apiRequest<{status:string;viagemId:number}>(`/rota/status-atual?turmaId=${turmaId}`,{signal}),15000);
    return <View><Button title="Paradas e modo de coleta privada" onPress={()=>router.push({pathname:'/coleta-privada',params:{turmaId:String(turmaId)}})}/>{user.tipo!=='MOTORISTA'&&<ContatoProtegido tipo="turmas" id={turmaId}/>} {data?.status==='ATIVA'&&data.viagemId&&<Button title="Controle e acompanhamento da viagem" onPress={()=>router.push({pathname:'/controle-viagem',params:{tipo:'VIAGEM',id:String(data.viagemId)}})}/>}</View>;
}
