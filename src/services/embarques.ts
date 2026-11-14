import { apiRequest } from '../config/api';
import { recursoId } from './catalogo';
export type PedidoEmbarque={id:number;rotaId:number;dataOperacao:string;sentido:string;status:string;paradaId:number|null;nomePonto:string|null};
export async function meusEmbarques(signal?:AbortSignal) {
    const r=await apiRequest<PedidoEmbarque[]>('/embarques/minhas',{signal});
    if(!Array.isArray(r))throw new Error('Resposta de solicitações inválida.');return r;
}
export async function solicitarEmbarque(rotaId:number, dados:{dataOperacao:string;sentido:'IDA'|'VOLTA';paradaId?:number;nomePonto?:string;latitude?:number;longitude?:number;pontoConfirmado?:boolean}) {
    const r=await apiRequest<PedidoEmbarque>(`/rotas-publicas/${recursoId(rotaId)}/embarques`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
    if(!r || r.rotaId!==rotaId || !r.id || !['PENDENTE','APROVADO'].includes(r.status))throw new Error('Solicitação não confirmada. Recarregue antes de tentar novamente.');return r;
}
