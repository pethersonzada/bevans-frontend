import { theme } from '../styles/theme';
import { useThemeRevision } from '../hooks/useThemeRevision';
import { ActionButton as Button } from './ui/Primitives';
import { useRef,useState } from 'react';
import { Text,View,Linking } from 'react-native';
import { contatoAutorizado } from '../services/contatoMotorista';
import { errorMessage } from '../config/api';
export function ContatoProtegido({tipo,id}:{tipo:'turmas'|'rotas-publicas';id:number}){
    useThemeRevision();
    const [error,setError]=useState(''),[busy,setBusy]=useState(false);const pending=useRef(false);
    return <View><Button title="Contato comercial do motorista" disabled={busy} onPress={()=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');void contatoAutorizado(tipo,id).then(url=>Linking.openURL(url)).catch(e=>setError(errorMessage(e))).finally(()=>{pending.current=false;setBusy(false);});}}/><Text style={{ color: theme.colors.text }} accessibilityLiveRegion="polite">{error}</Text></View>;
}
