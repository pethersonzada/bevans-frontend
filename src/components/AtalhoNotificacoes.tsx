import { useThemeRevision } from '../hooks/useThemeRevision';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { contarNaoLidas } from '../services/notificacoes';
import { useNotificacoesRevision } from '../hooks/useNotificacoesRevision';
import { ui } from './ui/Primitives';
import { theme } from '../styles/theme';
export function AtalhoNotificacoes() {
    useThemeRevision();
    const revision=useNotificacoesRevision(), router=useRouter();
    const {data,error}=useRemoteResource('notificacoes:contador:'+revision,contarNaoLidas);
    return <Pressable accessibilityRole="button" accessibilityLabel={'Notificações'+(data!=null?', '+data+' não lidas':error?', contagem indisponível':', consultando contagem')} onPress={()=>router.push('/notificacoes')} style={[ui.iconButton,{flexShrink:0}]}>
        <Ionicons name="notifications-outline" size={24} color={theme.colors.primary}/>
        {!!data&&<View style={{position:'absolute',top:0,right:0,backgroundColor:theme.colors.primary,borderRadius:10,minWidth:20,paddingHorizontal:4}}><Text style={{color:theme.colors.surface,fontSize:11,textAlign:'center'}}>{data>99?'99+':data}</Text></View>}
    </Pressable>;
}
