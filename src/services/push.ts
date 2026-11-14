import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registrarDispositivo,revogarDispositivo } from './notificacoes';
const key=(userId:string)=>`@bevans:push:${userId}`;
export async function ativarPushAndroid(userId:string,isCurrent:()=>boolean) {
    if(Platform.OS!=='android')throw new Error('O token FCM nativo para iOS ainda precisa ser configurado. A central in-app continua disponível.');
    await Notifications.setNotificationChannelAsync('operacional',{name:'Viagens',importance:Notifications.AndroidImportance.DEFAULT});
    const permission=await Notifications.requestPermissionsAsync();if(permission.status!=='granted')throw new Error('Push não autorizado. A central in-app continua disponível.');
    const token=await Notifications.getDevicePushTokenAsync();if(!isCurrent())throw new Error('A sessão mudou.');
    if(token.type!=='android'||typeof token.data!=='string')throw new Error('Token FCM indisponível.');
    const stored=await AsyncStorage.getItem(key(userId));const instalacaoId=stored||`bevans_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    if(!isCurrent())throw new Error('A sessão mudou.');
    await registrarDispositivo(instalacaoId,token.data);await AsyncStorage.setItem(key(userId),instalacaoId);
    if(!isCurrent()){await revogarDispositivo(instalacaoId);throw new Error('A sessão mudou.');}return instalacaoId;
}
export async function desativarPush(userId:string) {
    const id=await AsyncStorage.getItem(key(userId));if(!id)return;
    await revogarDispositivo(id);await AsyncStorage.removeItem(key(userId));
}
