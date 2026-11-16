import { apiRequest,apiFetch,readApiError } from '../config/api';
import { paginaValida,recursoId,type Pagina } from './catalogo';
export type Notificacao={id:number;tipo:string;contextoTipo:string;contextoId:number;titulo:string;mensagem:string;criadaEm:string;lidaEm:string|null};
export type PreferenciasNotificacao={pushOperacional:boolean;pushInformativo:boolean};
const listeners=new Set<()=>void>();
export function onNotificacoesChanged(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function avisarNotificacoesChanged(){listeners.forEach(listener=>listener());}
export async function listarNotificacoes(pagina:number,signal?:AbortSignal) {
    return paginaValida(await apiRequest<Pagina<Notificacao>>(`/notificacoes?pagina=${pagina}&tamanho=20`,{signal}));
}
export async function localizarNotificacao(id:string,signal?:AbortSignal){
    recursoId(id);let pagina=0;
    while(pagina<100){const r=await listarNotificacoes(pagina,signal);const aviso=r.itens.find(n=>String(n.id)===id);if(aviso)return aviso;if(pagina+1>=r.totalPaginas)break;pagina++;}
    throw new Error('O aviso não está disponível no histórico recente da sua conta.');
}
export async function contarNaoLidas(signal?:AbortSignal) {
    const r=await apiRequest<number>('/notificacoes/nao-lidas',{signal});if(!Number.isSafeInteger(r)||r!<0)throw new Error('Contagem de notificações inválida.');return r!;
}
export async function lerNotificacao(id:number) {const r=await apiFetch(`/notificacoes/${recursoId(id)}/leitura`,{method:'PUT'});if(!r.ok)throw await readApiError(r);avisarNotificacoesChanged();}
export async function preferenciasNotificacao(signal?:AbortSignal) {
    const r=await apiRequest<PreferenciasNotificacao>('/notificacoes/preferencias',{signal});
    if(!r||typeof r.pushOperacional!=='boolean'||typeof r.pushInformativo!=='boolean')throw new Error('Preferências inválidas.');return r;
}
export async function salvarPreferenciasNotificacao(dados:PreferenciasNotificacao) {
    const r=await apiFetch('/notificacoes/preferencias',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});if(!r.ok)throw await readApiError(r);
}
export async function registrarDispositivo(instalacaoId:string,token:string) {
    if(!/^[A-Za-z0-9_-]{16,128}$/.test(instalacaoId)||!token.trim())throw new Error('Dispositivo inválido.');
    const r=await apiFetch('/notificacoes/dispositivos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instalacaoId,token,consentePush:true})});if(!r.ok)throw await readApiError(r);
}
export async function revogarDispositivo(instalacaoId:string) {
    if(!/^[A-Za-z0-9_-]{16,128}$/.test(instalacaoId))throw new Error('Dispositivo inválido.');
    const r=await apiFetch(`/notificacoes/dispositivos/${instalacaoId}`,{method:'DELETE',timeoutMs:5000});if(!r.ok)throw await readApiError(r);
}
export function destinoNotificacao(n:Notificacao) {
    const id=String(recursoId(n.contextoId));
    if(n.contextoTipo==='VIAGEM')return {pathname:'/controle-viagem' as const,params:{tipo:'VIAGEM',id}};
    if(n.contextoTipo==='EXECUCAO_EXCURSAO')return {pathname:'/controle-viagem' as const,params:{tipo:'EXCURSAO',id}};
    if(n.contextoTipo==='ROTA_PUBLICA')return {pathname:'/detalhe-rota' as const,params:{id}};
    if(n.contextoTipo==='EXCURSAO')return {pathname:'/editar-excursao' as const,params:{id}};
    return {pathname:'/(tabs)/home' as const};
}
export async function destinoAutorizadoNotificacao(n:Notificacao,motorista:boolean){
    const id=recursoId(n.contextoId);
    let path:string|null=null;
    switch(n.contextoTipo){
        case 'VIAGEM':path=`/operacoes/VIAGEM/${id}${motorista?'':'/minha'}`;break;
        case 'EXECUCAO_EXCURSAO':
            if(!motorista)throw new Error('Consulte esta excursão pela página da sua inscrição.');
            path=`/operacoes/EXCURSAO/${id}`;break;
        case 'ROTA_PUBLICA':path=`/rotas-publicas/${id}`;break;
        case 'EXCURSAO':
            if(!motorista)throw new Error('Consulte esta excursão pela página da sua inscrição.');
            path=`/excursoes/${id}`;break;
    }
    if(path){const r=await apiRequest<unknown>(path);if(!r)throw new Error('Este recurso não está mais disponível.');}
    return destinoNotificacao(n);
}
export function mensagemErroNotificacao(error:unknown){
    const e=error as {status?:number;kind?:string;message?:string};
    if(e?.status===403||e?.status===404)return 'O recurso foi removido ou não está disponível para sua conta.';
    if(e?.kind==='network')return 'Sem conexão. A central será atualizada quando a conexão retornar.';
    return e?.message||'Não foi possível atualizar as notificações.';
}
