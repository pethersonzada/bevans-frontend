import { Button } from 'react-native';
import { useRouter } from 'expo-router';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { contarNaoLidas } from '../services/notificacoes';
import { SafeAreaView } from 'react-native-safe-area-context';
export function AtalhoNotificacoes(){const router=useRouter();const {data}=useRemoteResource('notificacoes:contador',contarNaoLidas);return <SafeAreaView edges={['top','left','right']}><Button title={`Notificações${data!=null?` (${data})`:''}`} onPress={()=>router.push('/notificacoes')}/></SafeAreaView>;}
