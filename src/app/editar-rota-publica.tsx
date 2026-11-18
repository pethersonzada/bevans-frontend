import { useEffect, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { buscarRotaPublica } from '../services/rotasPublicas';
import type { RotaPublica } from '../types/rotaPublica';
import { errorMessage } from '../config/api';
import { AsyncState } from '../components/AsyncState';
import { RemoteLoading } from '../components/ui/Primitives';
import { PaginaViagem } from '../components/excursoes/ViagemUI';
import { PlanejarRotaPublica } from '../components/rotasPublicas/PlanejarRotaPublica';

export default function EditarRotaPublica() {
    const {id,turmaId}=useLocalSearchParams<{id?:string;turmaId?:string}>(),{user,isLoading}=useAuth();
    if(isLoading)return <RemoteLoading/>;
    if(!user.id||user.tipo!=='MOTORISTA')return <AsyncState message="Entre como motorista para editar rotas."/>;
    return <CarregarRota key={`${user.id}:${id||'nova'}:${turmaId||''}`} id={id} turmaId={turmaId} motoristaId={user.id}/>;
}
export function CarregarRota({id,turmaId,motoristaId}:{id?:string;turmaId?:string;motoristaId:string}) {
    const router=useRouter(),navigation=useNavigation();
    // Keep native swipe-back from bypassing the draft's explicit exit confirmation.
    useEffect(()=>{navigation.setOptions({gestureEnabled:false});},[navigation]);
    const [rota,setRota]=useState<RotaPublica|null>(null),[erro,setErro]=useState(''),[retry,setRetry]=useState(0);
    useEffect(()=>{
        if(!id)return;let active=true;setErro('');
        void buscarRotaPublica(id).then(r=>{if(active)setRota(r);}).catch(e=>{if(active)setErro(errorMessage(e));});
        return()=>{active=false;};
    },[id,retry]);
    if(id&&!rota)return <PaginaViagem title="Editar rota pública" onBack={()=>router.back()}>{erro?<AsyncState message={erro} onRetry={()=>setRetry(v=>v+1)}/>:<RemoteLoading title="Carregando rota salva…"/>}</PaginaViagem>;
    return <PlanejarRotaPublica initial={rota||undefined} abrirGestao turmaId={turmaId?Number(turmaId):undefined} motoristaId={motoristaId} onExit={()=>router.back()}/>;
}
