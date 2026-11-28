import { apiRequest } from '../config/api';
import { recursoId } from './catalogo';
export type TipoOperacao='VIAGEM'|'EXCURSAO';
export type EstadoOperacional='AGUARDANDO'|'EMBARCADO'|'DESEMBARCADO'|'NAO_EMBARCOU';
export const rotulosEstado: Record<EstadoOperacional,string> = {AGUARDANDO:'Aguardando',EMBARCADO:'Embarcado',NAO_EMBARCOU:'Não embarcou',DESEMBARCADO:'Desembarcado'};
export function mensagemErroOperacao(error:unknown,contexto:'consulta'|'confirmacao'='confirmacao'):string {
    const e=error as {status?:number;kind?:string;message?:string};
    if(e?.status===401||e?.kind==='session')return 'Sua sessão expirou. Entre novamente antes de confirmar.';
    if(e?.status===403)return 'Você não tem permissão para operar esta viagem.';
    if(e?.status===409)return `${e.message||'O estado mudou ou a viagem foi encerrada.'} Consulte a atualização oficial antes de repetir a ação.`;
    if(e?.kind==='timeout')return contexto==='consulta'?'A consulta da operação demorou. Atualize para conferir o estado atual.':'A confirmação demorou e pode ter sido registrada. Confira o estado atualizado antes de tentar novamente.';
    if(e?.kind==='network')return contexto==='consulta'?'Sem conexão com o servidor. Atualize ao reconectar para consultar o estado atual.':'Sem conexão com o servidor. Nenhuma confirmação local foi assumida. Atualize ao reconectar.';
    return e?.message||'Não foi possível consultar a operação.';
}
export type RegistroOperacional={id:number;nome:string;estado:EstadoOperacional;versao:number;autor:string;atualizadoEm:string;ordem:number};
export type Operacao={referenciaId:number;tipo:TipoOperacao;sentido:string;modalidade?:'PRIVADA'|'PUBLICA'|null;contadores:{esperados:number;aguardando:number;naVan:number;naoEmbarcaram:number;desembarcados:number};registros:RegistroOperacional[]};
export function prefixoOperacao(tipo:string,id:string|number) {
    if(tipo!=='VIAGEM'&&tipo!=='EXCURSAO')throw new Error('Modalidade inválida.');return `/operacoes/${tipo}/${recursoId(id)}`;
}
export async function consultarOperacao(tipo:string,id:string,motorista:boolean,signal?:AbortSignal):Promise<Operacao|RegistroOperacional> {
    if(!motorista&&tipo==='EXCURSAO')throw new Error('O participante de excursão consulta sua operação pela página da inscrição, com a credencial individual.');
    const r=await apiRequest<Operacao|RegistroOperacional>(`${prefixoOperacao(tipo,id)}${motorista?'':'/minha'}`,{signal});
    if(!r || (motorista? !('registros'in r)||!Array.isArray(r.registros)||!r.contadores||r.referenciaId!==Number(id)||r.tipo!==tipo:!('versao'in r)||!Number.isInteger(r.versao)))throw new Error('Estado operacional inválido.');return r;
}
export async function alterarEstadoOperacional(tipo:string,id:string,registro:RegistroOperacional,motorista:boolean,estado:EstadoOperacional,motivo?:string) {
    if(!motorista&&tipo==='EXCURSAO')throw new Error('Use a página da sua inscrição para confirmar o embarque nesta excursão.');
    const r=await apiRequest<RegistroOperacional>(`${prefixoOperacao(tipo,id)}${motorista?`/passageiros/${recursoId(registro.id)}`:'/minha'}/estado`,{
        method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado,versao:registro.versao,correcao:Boolean(motivo),...(motivo?{motivo}:{})})});
    if(!r || r.id!==registro.id || r.estado!==estado)throw new Error('A confirmação não foi recebida. Atualize o estado antes de tentar novamente.');return r;
}
