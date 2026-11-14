import { apiRequest } from '../config/api';
import { recursoId } from './catalogo';
export type ParadaPrivada={id:number|null;nome:string;latitude:number;longitude:number;horario:string|null};
export type ColetaPrivada={turmaId:number;sentido:string;modo:'PORTA_A_PORTA'|'PARADAS_DEFINIDAS';versao:number;paradas:ParadaPrivada[];escolhidaId:number|null;sugestao:{parada:ParadaPrivada;distanciaMetros:number;metodo:string}|null;viagemId:number|null};
function prefixo(id:string,sentido:string){if(!['IDA','VOLTA'].includes(sentido))throw new Error('Sentido inválido.');return `/turmas/${recursoId(id)}/coleta/${sentido}`;}
export async function consultarColetaPrivada(id:string,sentido:string,enderecoId:string,signal?:AbortSignal){
    const r=await apiRequest<ColetaPrivada>(`${prefixo(id,sentido)}${enderecoId?`?enderecoId=${recursoId(enderecoId)}`:''}`,{signal});
    if(!r||r.turmaId!==Number(id)||r.sentido!==sentido||!Array.isArray(r.paradas)||!Number.isInteger(r.versao))throw new Error('Configuração privada inválida.');return r;
}
export async function salvarColetaPrivada(id:string,sentido:string,versao:number,modo:ColetaPrivada['modo'],paradas:ParadaPrivada[]){
    const r=await apiRequest<ColetaPrivada>(prefixo(id,sentido),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({versao,modo,paradas:modo==='PORTA_A_PORTA'?[]:paradas.map(p=>({...p,pontoConfirmado:true}))})});
    if(!r||r.turmaId!==Number(id)||r.modo!==modo)throw new Error('A configuração não foi confirmada.');return r;
}
export async function escolherParadaPrivada(id:string,sentido:string,versao:number,paradaId:number){
    return apiRequest(`${prefixo(id,sentido)}/minha-parada`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({versao,paradaId:recursoId(paradaId)})});
}
