import { RemoteLoading, Screen, Section, ActionButton as Button, Pagination, ui } from '../../components/ui/Primitives';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { listarExcursoes } from '../../services/excursoes';
import { AsyncState } from '../../components/AsyncState';
import { globalStyles as s } from '../../styles/globalStyles';
export default function ExcursoesTab() {
    const {user}=useAuth();const router=useRouter();const [page,setPage]=useState(0);
    const {data,error,reload}=useRemoteResource(user.tipo==='MOTORISTA'?`excursoes:${page}`:false,signal=>listarExcursoes(page,signal));
    return <Screen tabs title="Excursões" subtitle="Viagens planejadas, do convite ao desembarque.">

        {user.tipo!=='MOTORISTA'?<AsyncState status="empty" title="Acesso por convite" message="A inscrição é feita no link seguro compartilhado pelo organizador. Consulte seus dados na página da sua inscrição; o serviço ainda não oferece uma lista de excursões para a conta do aplicativo."/>:<>
            <Button variant="primary" icon="add" title="Criar excursão" onPress={()=>router.push('/editar-excursao')}/>
            {error?<AsyncState message={error} onRetry={reload}/>:!data?<RemoteLoading/>:<>
                {!data.itens.length&&<AsyncState status="empty" title="Sua primeira excursão" message="Crie a viagem e configure os embarques antes de publicar."/>}
                {data.itens.map(e=><Section key={e.id} title={e.titulo} description={e.estado==='RASCUNHO'?'Rascunho':e.estado==='PUBLICADA'?'Publicada':e.estado==='CANCELADA'?'Cancelada':'Concluída'}><Text>{e.destinoNome} · {new Date(e.partidaEm).toLocaleString('pt-BR')}</Text><Text>{e.capacidade} lugares · {e.modoColeta==='PORTA_A_PORTA'?'Porta a porta':e.modoColeta==='PARADA_UNICA'?'Parada única':'Múltiplas paradas'}</Text><Button title="Gerenciar excursão" onPress={()=>router.push({pathname:'/editar-excursao',params:{id:String(e.id)}})}/></Section>)}
                <Pagination page={page} pages={data.totalPaginas} onChange={setPage}/>
            </>}
        </>}
    </Screen>;
}
