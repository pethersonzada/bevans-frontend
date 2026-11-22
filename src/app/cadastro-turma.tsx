import { useRouter } from 'expo-router';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAuth } from '../contexts/AuthContext';
import { useAppAlert } from '../contexts/AppAlertContext';
import { auth } from '../config/firebase';
import { AsyncState } from '../components/AsyncState';
import { FormularioTurma } from '../components/turmas/CadastroTurma';

export default function CadastroTurmaScreen() {
    const { user, isLoading } = useAuth(), router = useRouter(), alert = useAppAlert(), network = useNetInfo();
    if (isLoading) return <AsyncState loading title="Conferindo sua sessão…"/>;
    if (!user.id || user.tipo !== 'MOTORISTA') return <AsyncState title="Acesso restrito" message="Entre com uma conta de motorista para criar uma turma."/>;
    return <FormularioTurma key={`${user.id}:${auth.currentUser?.uid}`} userId={user.id} onExit={()=>router.back()} onColeta={id=>router.replace({pathname:'/coleta-privada',params:{turmaId:String(id)}})} alert={alert} offline={network.isConnected===false||network.isInternetReachable===false}/>;
}