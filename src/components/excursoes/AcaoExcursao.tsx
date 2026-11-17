import { useContext, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { errorMessage } from '../../config/api';
import { ExcursaoActionContext } from '../ExcursaoActionContext';
import { ActionButton, trip } from './ViagemUI';
export function AsyncAction({title,action,confirmMessage,disabled=false,variant='primary'}:{title:string;action:()=>Promise<void>;confirmMessage?:string;disabled?:boolean;variant?:'primary'|'secondary'|'danger'}) {
    const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmar,setConfirmar]=useState(false);
    const pending=useRef(false),mounted=useRef(true),lock=useContext(ExcursaoActionContext);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    return <View style={{gap:10}}>{confirmar&&<Text style={trip.body} accessibilityLiveRegion="polite">{confirmMessage}</Text>}
        <ActionButton title={confirmar?'Confirmar: '+title:title} variant={variant} busy={busy} disabled={disabled} onPress={()=>{
            if(disabled||pending.current||lock?.current)return;
            if(confirmMessage&&!confirmar){setConfirmar(true);return;}
            pending.current=true;if(lock)lock.current=true;setBusy(true);setError('');
            void action().catch(e=>{if(mounted.current)setError(errorMessage(e));})
                .finally(()=>{pending.current=false;if(lock)lock.current=false;if(mounted.current){setBusy(false);setConfirmar(false);}});
        }}/>
        {confirmar&&<ActionButton title="Cancelar ação" disabled={busy} onPress={()=>setConfirmar(false)}/>}
        {!!error&&<Text accessibilityLiveRegion="polite" style={trip.body}>{error}</Text>}
    </View>;
}
