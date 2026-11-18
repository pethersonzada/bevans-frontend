import { useEffect, useState } from 'react';
import { onNotificacoesChanged } from '../services/notificacoes';
export function useNotificacoesRevision(){
    const [revision,setRevision]=useState(0);
    useEffect(()=>{
        let timer:ReturnType<typeof setTimeout>|undefined;
        const unsubscribe=onNotificacoesChanged(()=>{
            if(timer!==undefined)return;
            timer=setTimeout(()=>{timer=undefined;setRevision(value=>value+1);},150);
        });
        return()=>{unsubscribe();if(timer!==undefined)clearTimeout(timer);};
    },[]);
    return revision;
}
