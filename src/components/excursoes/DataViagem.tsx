import { useState } from 'react';
import { Pressable, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { selecionarDataHora } from '../../services/excursaoFormulario';
import { ActionButton, dataViagem, horaViagem, trip } from './ViagemUI';
import { theme } from '../../styles/theme';
export function DataViagem({label,value,onChange,optional=false}:{label:string;value:string;onChange:(value:string)=>void;optional?:boolean}) {
    const [mode,setMode]=useState<'date'|'time'|null>(null);
    const valid=Number.isFinite(Date.parse(value));
    if(optional&&!valid&&!mode)return <ActionButton title={'Adicionar '+label.toLowerCase()+' (opcional)'} icon="add" onPress={()=>setMode('date')}/>;
    return <View style={{gap:12}}>
        <Text style={trip.eyebrow}>{label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={label+' - escolher data'} onPress={()=>setMode('date')} style={trip.shortcut}>
            <View style={trip.dateBadge}><Ionicons name="calendar-outline" size={26} color={theme.colors.primary}/></View><View style={{flex:1,gap:4}}><Text style={trip.label}>{valid?dataViagem(value,{day:'numeric',month:'long'}):'Escolher o dia'}</Text><Text style={trip.muted}>{valid?`${dataViagem(value,{weekday:'long'})} · ${dataViagem(value,{year:'numeric'})}`:'Abra o calendário'}</Text></View><Ionicons name="chevron-forward" size={20} color={theme.colors.textLight}/>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={label+' - escolher horário'} onPress={()=>setMode('time')} style={[trip.shortcut,{minHeight:64}]}><Ionicons name="time-outline" size={23} color={theme.colors.primary}/><Text style={[trip.label,{flex:1}]}>{horaViagem(value)}</Text><Text style={trip.link}>Alterar</Text></Pressable>
        {optional&&valid&&<ActionButton title="Sem retorno definido" onPress={()=>onChange('')}/>}
        {mode&&<DateTimePicker value={valid?new Date(value):new Date()} mode={mode} is24Hour onChange={(event,chosen)=>{
            if(Platform.OS!=='ios'||event.type!=='set')setMode(null);
            if(event.type==='set'&&chosen)onChange(selecionarDataHora(value,chosen,mode));
        }}/>}
        {mode&&Platform.OS==='ios'&&<ActionButton title="Concluir seleção" onPress={()=>setMode(null)}/>}
    </View>;
}
