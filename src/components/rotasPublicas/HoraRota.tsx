import { useThemeRevision } from '../../hooks/useThemeRevision';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ActionButton, AtalhoViagem } from '../excursoes/ViagemUI';

export function HoraRota({label,value,onChange}:{label:string;value:string|null;onChange:(value:string|null)=>void}) {
    useThemeRevision();
    const [open,setOpen]=useState(false);
    const date=new Date();const [h,m,s]=(value||'07:00').split(':').map(Number);date.setHours(h,m,s||0,0);
    return <View style={{gap:8}}>
        <AtalhoViagem title={label} detail={value||'Escolher horário'} icon="time-outline" onPress={()=>setOpen(true)}/>
        {value&&<ActionButton title={`Remover ${label.toLowerCase()}`} onPress={()=>onChange(null)}/>}
        {open&&<DateTimePicker value={date} mode="time" is24Hour onChange={(event,selected)=>{
            if(Platform.OS!=='ios'||event.type!=='set')setOpen(false);
            if(event.type==='set'&&selected)onChange(`${String(selected.getHours()).padStart(2,'0')}:${String(selected.getMinutes()).padStart(2,'0')}`);
        }}/>}
        {open&&Platform.OS==='ios'&&<ActionButton title="Concluir seleção de horário" onPress={()=>setOpen(false)}/>}
    </View>;
}
