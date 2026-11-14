import { apiRequest } from '../config/api';
import { recursoId } from './catalogo';
export type ContatoComercial={telefone:string|null;habilitado:boolean;versao:number};
export async function consultarContatoComercial(signal?:AbortSignal){
    const r=await apiRequest<ContatoComercial>('/motorista/contato',{signal});if(!r||typeof r.habilitado!=='boolean'||!Number.isInteger(r.versao))throw new Error('Contato comercial inválido.');return r;
}
export async function salvarContatoComercial(dados:ContatoComercial&{aceiteDivulgacao:boolean}){
    return apiRequest<ContatoComercial>('/motorista/contato',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
}
export async function contatoAutorizado(tipo:'turmas'|'rotas-publicas',id:number){
    const r=await apiRequest<{waMe:string;telefoneComercial:string}>(`/${tipo}/${recursoId(id)}/contato-motorista`);
    if(!r||!/^55\d{10,11}$/.test(r.telefoneComercial)||r.waMe!==`https://wa.me/${r.telefoneComercial}`)throw new Error('Contato comercial indisponível.');return r.waMe;
}
