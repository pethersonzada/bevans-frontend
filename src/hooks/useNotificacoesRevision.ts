import { useEffect, useState } from 'react';
import { onNotificacoesChanged } from '../services/notificacoes';
export function useNotificacoesRevision(){
    const [revision,setRevision]=useState(0);
    useEffect(()=>onNotificacoesChanged(()=>setRevision(value=>value+1)),[]);
    return revision;
}
