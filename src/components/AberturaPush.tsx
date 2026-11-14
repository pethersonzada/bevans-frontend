import { useEffect,useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
export function AberturaPush(){const {user}=useAuth();const router=useRouter();const last=useRef('');
    useEffect(()=>{if(!user.id||Platform.OS==='web')return;let active=true;const open=(response:Notifications.NotificationResponse|null)=>{if(!active||!response)return;const key=response.notification.request.identifier;if(last.current===key)return;const id=String(response.notification.request.content.data?.notificacaoId||'');if(!/^[1-9]\d*$/.test(id))return;last.current=key;router.push({pathname:'/notificacoes',params:{notificacaoId:id}});};
        const subscription=Notifications.addNotificationResponseReceivedListener(open);void Notifications.getLastNotificationResponseAsync().then(open).catch(()=>{});return()=>{active=false;subscription.remove();};
    },[user.id,router]);return null;}
