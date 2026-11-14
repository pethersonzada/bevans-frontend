import { useEffect,useRef,useState } from 'react';
import { Button,Text,View,AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useIsFocused } from 'expo-router/react-navigation';
import { useAuth } from '../contexts/AuthContext';
import { ativarPushAndroid,desativarPush } from '../services/push';
import { registrarDispositivo } from '../services/notificacoes';
import { errorMessage } from '../config/api';
export function PreferenciaPush(){const {user}=useAuth();const focused=useIsFocused();const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[id,setId]=useState('');
    const current=useRef(user.id);current.current=user.id;const pending=useRef(false);
    useEffect(()=>()=>{current.current=null;},[]);
    useEffect(()=>{if(!focused||!user.id||!id)return;const subscription=Notifications.addPushTokenListener(token=>{if(token.type==='android'&&typeof token.data==='string'&&current.current===user.id&&AppState.currentState==='active')void registrarDispositivo(id,token.data).catch(()=>setMessage('Não foi possível renovar o token. Ative novamente para tentar.'));});return()=>subscription.remove();},[focused,user.id,id]);
    const run=async(activate:boolean)=>{if(!user.id||pending.current)return;pending.current=true;setBusy(true);const owner=user.id;try{if(activate){setId(await ativarPushAndroid(owner,()=>current.current===owner));setMessage('Dispositivo registrado. O recebimento depende do FCM no ambiente de testes.');}else{await desativarPush(owner);setId('');setMessage('Dispositivo revogado.');}}catch(e){setMessage(errorMessage(e));}finally{pending.current=false;setBusy(false);}};
    return <View><Button title="Permitir e registrar push Android" disabled={busy} onPress={()=>void run(true)}/><Button title="Revogar push deste dispositivo" disabled={busy} onPress={()=>void run(false)}/><Text accessibilityLiveRegion="polite">{message}</Text></View>;
}
