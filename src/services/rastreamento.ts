import { apiRequest } from '../config/api';
import { recursoId } from './catalogo';
export type Posicao={estado:string;latitude:number|null;longitude:number|null;observadoEm:string|null};
export function posicaoRecente(p:Posicao|null,agora=Date.now()) {
    if(!p||p.estado!=='ATUALIZADA'||typeof p.latitude!=='number'||typeof p.longitude!=='number'||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180)return null;
    const idade=agora-Date.parse(p.observadoEm||'');if(!Number.isFinite(idade)||idade< -5000||idade>=30000)return null;
    return {latitude:p.latitude,longitude:p.longitude};
}
export function caminhoGps(tipo:string,id:string|number) {if(tipo!=='VIAGEM'&&tipo!=='EXCURSAO')throw new Error('Modalidade inválida.');return `/${tipo==='VIAGEM'?'viagens':'execucoes-excursao'}/${recursoId(id)}/localizacao`;}
export async function consultarGps(tipo:string,id:string,signal?:AbortSignal) {
    const r=await apiRequest<Posicao>(caminhoGps(tipo,id),{signal});if(!r||!['ATUALIZADA','SEM_LOCALIZACAO','DESATUALIZADA','FINALIZADA'].includes(r.estado))throw new Error('Estado GPS inválido.');return r;
}
export async function publicarGps(tipo:string,id:string,ponto:{latitude:number;longitude:number;precisao:number;observadoEm:string;amostraId:string},signal?:AbortSignal) {
    return apiRequest(caminhoGps(tipo,id),{method:'PUT',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(ponto)});
}
