import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button,Text,TextInput,Switch,ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { consultarContatoComercial,salvarContatoComercial,type ContatoComercial } from '../services/contatoMotorista';
import { useAuth } from '../contexts/AuthContext';
import { AsyncState } from '../components/AsyncState';
import { errorMessage } from '../config/api';
export default function ContatoComercialScreen(){const {user}=useAuth();const router=useRouter();const {data,error,reload}=useRemoteResource(user.tipo==='MOTORISTA'?'contato-comercial':false,consultarContatoComercial);
    return <SafeAreaView style={{flex:1}}><ScrollView contentContainerStyle={{padding:16,gap:12}}><Button title="Voltar" onPress={()=>router.back()}/><Text>Contato comercial</Text>{user.tipo!=='MOTORISTA'?<AsyncState message="Disponível para motoristas."/>:error?<AsyncState message={error} onRetry={reload}/>:!data?<AsyncState loading/>:<Formulario key={data.versao} data={data} reload={reload}/>}</ScrollView></SafeAreaView>;}
function Formulario({data,reload}:{data:ContatoComercial;reload:()=>void}){const [telefone,setTelefone]=useState(data.telefone||''),[habilitado,setHabilitado]=useState(data.habilitado),[aceite,setAceite]=useState(false),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
    return <><TextInput accessibilityLabel="Telefone comercial com DDI 55" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad"/><Text>Habilitar contato comercial</Text><Switch value={habilitado} onValueChange={setHabilitado} accessibilityLabel="Habilitar contato comercial"/><Text>Autorizo divulgar este número comercial aos passageiros autorizados. Meu telefone pessoal não é utilizado automaticamente.</Text><Switch value={aceite} onValueChange={setAceite} accessibilityLabel="Aceite de divulgação comercial"/><Button title="Salvar contato" disabled={busy||(habilitado&&!aceite)} onPress={()=>{setBusy(true);void salvarContatoComercial({telefone,habilitado,aceiteDivulgacao:aceite,versao:data.versao}).then(()=>reload()).catch(e=>setFeedback(errorMessage(e))).finally(()=>setBusy(false));}}/><Text accessibilityLiveRegion="polite">{feedback}</Text></>;}
