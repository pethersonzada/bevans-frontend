import { Button } from 'react-native';
import { useRouter } from 'expo-router';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { contarNaoLidas } from '../services/notificacoes';
export function AtalhoNotificacoes(){const router=useRouter();const {data}=useRemoteResource('notificacoes:contador',contarNaoLidas);return <Button title={`Notificações${data!=null?` (${data})`:''}`} onPress={()=>router.push('/notificacoes')}/>;}
