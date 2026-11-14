import { apiRequest } from '../config/api';
import { recursoId } from './catalogo';
export type TipoOperacao='VIAGEM'|'EXCURSAO';
export type EstadoOperacional='AGUARDANDO'|'EMBARCADO'|'DESEMBARCADO'|'NAO_EMBARCOU';
export type RegistroOperacional={id:number;nome:string;estado:EstadoOperacional;versao:number;autor:string;atualizadoEm:string;ordem:number};
export type Operacao={referenciaId:number;tipo:TipoOperacao;sentido:string;contadores:{esperados:number;aguardando:number;naVan:number;naoEmbarcaram:number;desembarcados:number};registros:RegistroOperacional[]};
export function prefixoOperacao(tipo:string,id:string|number) {
    if(tipo!=='VIAGEM'&&tipo!=='EXCURSAO')throw new Error('Modalidade inválida.');return `/operacoes/${tipo}/${recursoId(id)}`;
}
export async function consultarOperacao(tipo:string,id:string,motorista:boolean,signal?:AbortSignal):Promise<Operacao|RegistroOperacional> {
    const r=await apiRequest<Operacao|RegistroOperacional>(`${prefixoOperacao(tipo,id)}${motorista?'':'/minha'}`,{signal});
    if(!r || (motorista? !('registros'in r)||!Array.isArray(r.registros)||!r.contadores:!('versao'in r)||!Number.isInteger(r.versao)))throw new Error('Estado operacional inválido.');return r;
}
export async function alterarEstadoOperacional(tipo:string,id:string,registro:RegistroOperacional,motorista:boolean,estado:EstadoOperacional,motivo?:string) {
    const r=await apiRequest<RegistroOperacional>(`${prefixoOperacao(tipo,id)}${motorista?`/passageiros/${recursoId(registro.id)}`:'/minha'}/estado`,{
        method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado,versao:registro.versao,correcao:Boolean(motivo),...(motivo?{motivo}:{})})});
    if(!r || r.id!==registro.id || r.estado!==estado)throw new Error('A confirmação não foi recebida. Atualize o estado antes de tentar novamente.');return r;
}
