import { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFocusedPolling } from './useFocusedPolling';
import { errorMessage } from '../config/api';

// A key includes the authenticated account so a late response cannot cross sessions.
export function useRemoteResource<T>(resourceKey: string | false, load: (signal: AbortSignal) => Promise<T>, interval = 30000) {
    const { user } = useAuth();
    const [revision, setRevision] = useState(0);
    const key = resourceKey && user.id ? JSON.stringify([user.id,resourceKey,revision]) : false;
    const current = useRef(key); current.current=key;
    const [result,setResult]=useState<{key:string;data:T} | null>(null);
    const [failure,setFailure]=useState<{key:string;message:string} | null>(null);
    useFocusedPolling(async signal=>{
        if (!key) return;
        try { const data=await load(signal); if (!signal.aborted && current.current===key) {setResult({key,data});setFailure(null);} }
        catch(e) {if (!signal.aborted && current.current===key) {setResult(null);setFailure({key,message:errorMessage(e)});} }
    },interval,key);
    return {data:result?.key===key?result.data:null,error:failure?.key===key?failure.message:'',reload:()=>setRevision(v=>v+1)};
}
