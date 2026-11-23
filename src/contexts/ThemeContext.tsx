import { useThemeRevision } from '../hooks/useThemeRevision';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { applyTheme } from '../styles/theme';
import { APARENCIA_KEY, lerPreferenciaAparencia, resolverAparencia, type PreferenciaAparencia } from '../services/aparencia';
import { AsyncState } from '../components/AsyncState';

type ThemePreference = { preference: PreferenciaAparencia; setPreference: (next: PreferenciaAparencia) => Promise<void>; error: string };
const ThemeContext = createContext<ThemePreference | null>(null);
export function ThemeProvider({children}:{children:ReactNode}) {
    useThemeRevision();
    const system=useColorScheme(),[preference,setValue]=useState<PreferenciaAparencia>('system'),[ready,setReady]=useState(false),[error,setError]=useState('');
    const queue=useRef(Promise.resolve()),mounted=useRef(true);
    useEffect(()=>{
        mounted.current=true;
        void AsyncStorage.getItem(APARENCIA_KEY).then(value=>{if(mounted.current)setValue(lerPreferenciaAparencia(value));})
            .catch(()=>{if(mounted.current)setError('Não foi possível ler sua preferência. Usando o tema do sistema.');})
            .finally(()=>{if(mounted.current)setReady(true);});
        return()=>{mounted.current=false;};
    },[]);
    useEffect(()=>{applyTheme(resolverAparencia(preference,system));},[preference,system]);
    const setPreference=useCallback(async(next:PreferenciaAparencia)=>{
        const normalized=lerPreferenciaAparencia(next);
        const task=queue.current.catch(()=>{}).then(()=>AsyncStorage.setItem(APARENCIA_KEY,normalized));queue.current=task;
        try {await task;if(mounted.current){setValue(normalized);setError('');}}
        catch {if(mounted.current)setError('Não foi possível salvar a aparência. Tente novamente.');throw new Error('A aparência não foi salva.');}
    },[]);
    if(!ready)return <AsyncState loading title="Preparando aparência…"/>;
    return <ThemeContext.Provider value={{preference,setPreference,error}}>{children}</ThemeContext.Provider>;
}
export function useThemePreference() {
    const value=useContext(ThemeContext);
    if(!value)throw new Error('A preferência de aparência requer ThemeProvider.');
    return value;
}
