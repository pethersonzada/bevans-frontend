import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button,ScrollView,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { listarExcursoes } from '../../services/excursoes';
import { AsyncState } from '../../components/AsyncState';
import { globalStyles as s } from '../../styles/globalStyles';
export default function ExcursoesTab() {
    const {user}=useAuth();const router=useRouter();const [page,setPage]=useState(0);
    const {data,error,reload}=useRemoteResource(user.tipo==='MOTORISTA'?`excursoes:${page}`:false,signal=>listarExcursoes(page,signal));
    return <SafeAreaView edges={['top','left','right']} style={{flex:1}}><ScrollView contentContainerStyle={{padding:16,gap:12}}>
        <Text style={s.title} accessibilityRole="header">Excursões</Text>
        {user.tipo!=='MOTORISTA'?<AsyncState status="empty" title="Acesso por convite" message="A inscrição é feita no link seguro compartilhado pelo organizador. Consulte seus dados na página da sua inscrição; o serviço ainda não oferece uma lista de excursões para a conta do aplicativo."/>:<>
            <Button title="Criar excursão" onPress={()=>router.push('/editar-excursao')}/>
            {error?<AsyncState message={error} onRetry={reload}/>:!data?<AsyncState loading/>:<>
                {!data.itens.length&&<AsyncState status="empty" title="Nenhuma excursão criada"/>}
                {data.itens.map(e=><View key={e.id} style={s.card}><Text>{e.titulo} · {e.estado}</Text><Text>{e.destinoNome} · {new Date(e.partidaEm).toLocaleString('pt-BR')}</Text><Text>{e.capacidade} lugares · {e.modoColeta}</Text><Button title="Gerenciar excursão" onPress={()=>router.push({pathname:'/editar-excursao',params:{id:String(e.id)}})}/></View>)}
                <Button title="Anterior" disabled={page===0} onPress={()=>setPage(v=>v-1)}/><Button title="Próxima" disabled={page+1>=data.totalPaginas} onPress={()=>setPage(v=>v+1)}/>
            </>}
        </>}
    </ScrollView></SafeAreaView>;
}
