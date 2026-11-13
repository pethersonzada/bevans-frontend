import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { AsyncState } from '../components/AsyncState';
import { errorMessage } from '../config/api';
import { listarMinhasRotas } from '../services/rotasPublicas';
import { listarTurmasMotorista } from '../services/turmas';
import type { RotaPublica } from '../types/rotaPublica';
import type { Turma } from '../types/turma';
import { globalStyles as s } from '../styles/globalStyles';

export default function RotasPublicasMotorista() {
    const {user,isLoading}=useAuth();const router=useRouter();const insets=useSafeAreaInsets();
    const [rotas,setRotas]=useState<RotaPublica[]>([]),[turmas,setTurmas]=useState<Turma[]>([]);
    const [loading,setLoading]=useState(true),[erro,setErro]=useState(''),[tentativa,setTentativa]=useState(0);
    useFocusEffect(useCallback(()=>{
        if(isLoading || !user.id || user.tipo!=='MOTORISTA')return;
        let ativo=true;setLoading(true);setErro('');
        Promise.all([listarMinhasRotas(),listarTurmasMotorista(user.id)]).then(([r,t])=>{if(ativo){setRotas(r);setTurmas(t);}})
            .catch(e=>{if(ativo)setErro(errorMessage(e));}).finally(()=>{if(ativo)setLoading(false);});
        return ()=>{ativo=false;};
    },[user.id,user.tipo,isLoading,tentativa]));
    if(isLoading || !user.id || user.tipo!=='MOTORISTA')return <AsyncState loading={isLoading} message="Entre como motorista para gerenciar Rotas Públicas."/>;
    return <ScrollView style={[s.container,{paddingTop:insets.top}]} contentContainerStyle={{paddingBottom:insets.bottom+40}}>
        <TouchableOpacity accessibilityRole="button" onPress={()=>router.back()}><Text>Voltar</Text></TouchableOpacity>
        <Text style={s.title}>Rotas Públicas</Text>
        <Text>Transporte urbano com publicação explícita. Suas turmas privadas continuam privadas.</Text>
        {loading?<AsyncState loading title="Carregando rotas..."/>:erro?<AsyncState message={erro} onRetry={()=>setTentativa(v=>v+1)}/>:<>
            {rotas.map(r=><TouchableOpacity key={r.id} accessibilityRole="button" style={s.card}
                onPress={()=>router.push({pathname:'/editar-rota-publica',params:{id:String(r.id)}})}>
                <Text>{r.nome} · {r.cidade}</Text><Text>{r.modo} · {r.publicada?'Publicada':'Não publicada'}</Text>
                <Text>{r.vagas.ocupados} aprovados / {r.vagas.capacidade??'capacidade não configurada'}</Text>
            </TouchableOpacity>)}
            {!rotas.length&&<AsyncState status="empty" title="Nenhuma rota configurada" message="Escolha uma turma abaixo para configurar um serviço urbano."/>}
            <Text style={s.title}>Criar rota a partir de uma turma</Text>
            {turmas.filter(t=>!rotas.some(r=>r.turmaId===t.id)).map(t=><TouchableOpacity key={t.id} accessibilityRole="button" style={s.card}
                onPress={()=>router.push({pathname:'/editar-rota-publica',params:{turmaId:String(t.id)}})}><Text>{t.nome} · {t.turno}</Text></TouchableOpacity>)}
            {!turmas.length&&<TouchableOpacity accessibilityRole="button" style={s.buttonPrimary} onPress={()=>router.push('/cadastro-turma')}><Text style={s.buttonText}>Criar uma turma</Text></TouchableOpacity>}
        </>}
        <View style={{height:20}}/>
    </ScrollView>;
}
