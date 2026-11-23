import { useThemeRevision } from '../hooks/useThemeRevision';
import { useEffect, useRef, useState } from 'react';
import { useThemePreference } from '../contexts/ThemeContext';
import type { PreferenciaAparencia } from '../services/aparencia';
import { Choice, Notice, Section } from './ui/Primitives';

export function PreferenciaAparencia() {
    useThemeRevision();
    const {preference,setPreference,error}=useThemePreference(),[busy,setBusy]=useState(false),lock=useRef(false),mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    async function escolher(next:PreferenciaAparencia){if(lock.current)return;lock.current=true;setBusy(true);try{await setPreference(next);}catch{/* Context displays a generic storage error. */}finally{lock.current=false;if(mounted.current)setBusy(false);}}
    return <Section title="Aparência" description="Escolha como você prefere ver o aplicativo. A mudança mantém seus dados em edição.">
        {([['system','Sistema'],['light','Claro'],['dark','Escuro']] as const).map(([value,label])=><Choice key={value} label={label} selected={preference===value} disabled={busy} onPress={()=>void escolher(value)}/>)}
        {!!error&&<Notice>{error}</Notice>}
    </Section>;
}
