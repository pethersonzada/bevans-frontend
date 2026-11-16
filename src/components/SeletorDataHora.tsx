import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Platform, Text, View } from 'react-native';
import { selecionarDataHora } from '../services/excursaoFormulario';

export function SeletorDataHora({label,value,onChange,optional=false}:{label:string;value:string;onChange:(value:string)=>void;optional?:boolean}) {
    const [modo,setModo]=useState<'date'|'time'|null>(null);
    const valido=Number.isFinite(Date.parse(value));
    const data=valido?new Date(value):new Date();
    return <View style={{gap:8,paddingVertical:8}}>
        <Text accessibilityRole="header">{label}</Text>
        <Text>{valido?data.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Não selecionado'}</Text>
        <Text>Fuso do aparelho: {Intl.DateTimeFormat().resolvedOptions().timeZone}</Text>
        <Button title={`Escolher data: ${label}`} onPress={()=>setModo('date')}/>
        <Button title={`Escolher horário: ${label}`} onPress={()=>setModo('time')}/>
        {optional&&!!value&&<Button title={`Remover ${label.toLowerCase()}`} onPress={()=>onChange('')}/>}
        {modo&&<DateTimePicker value={data} mode={modo} is24Hour onChange={(event,escolha)=>{
            const selecionado=modo;if(Platform.OS!=='ios'||event.type!=='set')setModo(null);
            if(event.type==='set'&&escolha)onChange(selecionarDataHora(value,escolha,selecionado));
        }}/>}
        {modo&&Platform.OS==='ios'&&<Button title="Concluir seleção" onPress={()=>setModo(null)}/>}
    </View>;
}
