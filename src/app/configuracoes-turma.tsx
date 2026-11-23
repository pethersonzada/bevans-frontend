import { useThemeRevision } from '../hooks/useThemeRevision';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { buscarTurmaMotorista } from '../services/turmas';
import { AsyncState } from '../components/AsyncState';
import { RemoteLoading, Screen, Section, MenuRow, Notice, ui } from '../components/ui/Primitives';
export default function ConfiguracoesTurma() {
    useThemeRevision();
    const { turmaId } = useLocalSearchParams<{ turmaId: string }>(), { user } = useAuth(), router = useRouter();
    const allowed = user.tipo === 'MOTORISTA' && !!user.id;
    const { data, error, reload } = useRemoteResource(allowed ? `configuracoes-turma:${turmaId}` : false, () => buscarTurmaMotorista(user.id!, turmaId));
    return <Screen title="Configurações da turma" onBack={() => router.back()}>
        {!allowed ? <AsyncState message="Somente o motorista pode configurar a turma." /> : error ? <AsyncState message={error} onRetry={reload} /> : !data ? <RemoteLoading/> : <>
            <Text style={ui.sectionTitle}>{data.nome}</Text>
            <Section title="Organização"><MenuRow title="Dados e capacidade" description="Nome, turno e quantidade de assentos." icon="people-outline" onPress={() => router.push({ pathname: '/editar-turma', params: { id: turmaId } })} />
                <MenuRow title="Coleta e trajetos" description="Modo de coleta, paradas e sentidos de ida e volta." icon="map-outline" onPress={() => router.push({ pathname: '/coleta-privada', params: { turmaId } })} />
            </Section>
            <Notice>As configurações pertencem à turma privada. Alterações durante uma viagem ou incompatíveis com os vínculos podem ser recusadas.</Notice>
        </>}
    </Screen>;
}
