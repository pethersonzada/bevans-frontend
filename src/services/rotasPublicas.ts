import { apiRequest } from '../config/api';
import type { CategoriaRota, DiaRota, ModoRota, ParadaPublica, PontoPublico, RotaPublica, RotaPublicaDados } from '../types/rotaPublica';

function id(value: number | string): number {
    if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error('Identificador de rota inválido.');
    return Number(value);
}
export function pontoValido(latitude: unknown, longitude: unknown): boolean {
    return typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && !(latitude === 0 && longitude === 0);
}
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Resposta de rota inválida.');
    return value as Record<string, unknown>;
}
function parada(value: unknown): ParadaPublica {
    const p=object(value);
    if (typeof p.nome !== 'string' || !p.nome.trim() || !pontoValido(p.latitude,p.longitude)) throw new Error('Parada inválida.');
    return { id:p.id == null ? null : id(p.id as number), nome:p.nome,latitude:p.latitude as number,longitude:p.longitude as number,
        horario:typeof p.horario === 'string' ? p.horario : null };
}
export function parseRotaPublica(value: unknown): RotaPublica {
    const r=object(value);
    if (!['FIXA','FLEXIVEL'].includes(String(r.modo)) || !['ESCOLAR','UNIVERSITARIA','OUTROS'].includes(String(r.categoria))
        || typeof r.nome !== 'string' || typeof r.cidade !== 'string' || !pontoValido(r.origemLatitude,r.origemLongitude)
        || !pontoValido(r.destinoLatitude,r.destinoLongitude) || !Array.isArray(r.paradas) || !Array.isArray(r.dias)
        || typeof r.publicada !== 'boolean' || typeof r.ativa !== 'boolean') throw new Error('Resposta de rota inválida.');
    const v=object(r.vagas);
    if(!Number.isSafeInteger(v.ocupados) || (v.ocupados as number)<0 || typeof v.configurada!=='boolean'
        || (v.configurada ? !Number.isInteger(v.capacidade) || (v.capacidade as number)<=0 || v.disponiveis!==Math.max(0,(v.capacidade as number)-(v.ocupados as number))
            : v.capacidade!==null || v.disponiveis!==null))throw new Error('Resposta de vagas inválida.');
    const diasValidos=['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
    if(!r.dias.length || r.dias.some(d=>!diasValidos.includes(String(d))) || typeof r.origemNome!=='string' || typeof r.destinoNome!=='string')throw new Error('Resposta de rota inválida.');
    const pontos=r.paradas.map(parada);if(pontos.some(p=>p.id==null))throw new Error('Parada salva sem identificador.');
    const optional=(key:string)=>typeof r[key]==='string'?r[key] as string:null;
    return { id:id(r.id as number),turmaId:id(r.turmaId as number),nome:r.nome,cidade:r.cidade,categoria:r.categoria as CategoriaRota,modo:r.modo as ModoRota,
        origemNome:r.origemNome,origemLatitude:r.origemLatitude as number,origemLongitude:r.origemLongitude as number,
        destinoNome:r.destinoNome,destinoLatitude:r.destinoLatitude as number,destinoLongitude:r.destinoLongitude as number,
        dias:r.dias as DiaRota[],horarioIda:optional('horarioIda'),horarioVolta:optional('horarioVolta'),descricao:optional('descricao'),regiao:optional('regiao'),campus:optional('campus'),
        publicada:r.publicada,ativa:r.ativa,paradas:pontos,vagas:{capacidade:v.capacidade as number|null,ocupados:v.ocupados as number,disponiveis:v.disponiveis as number|null,configurada:v.configurada} };
}
export async function listarMinhasRotas(): Promise<RotaPublica[]> {
    const r=await apiRequest<unknown>('/rotas-publicas/minhas');
    if (!Array.isArray(r)) throw new Error('Não foi possível ler suas rotas.');
    return r.map(parseRotaPublica);
}
export async function buscarRotaPublica(rotaId: number | string): Promise<RotaPublica> {
    const esperado=id(rotaId);const r=parseRotaPublica(await apiRequest<unknown>(`/rotas-publicas/${esperado}`));
    if(r.id!==esperado) throw new Error('O servidor retornou outra rota.');return r;
}
export async function salvarRotaPublica(rotaId: number | null, dados: RotaPublicaDados): Promise<RotaPublica> {
    id(dados.turmaId);
    if (!pontoValido(dados.origemLatitude,dados.origemLongitude) || !pontoValido(dados.destinoLatitude,dados.destinoLongitude)) throw new Error('Confirme origem e destino no mapa.');
    const r=parseRotaPublica(await apiRequest<unknown>(rotaId == null ? '/rotas-publicas' : `/rotas-publicas/${id(rotaId)}`,
        {method:rotaId == null?'POST':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)}));
    if(r.turmaId!==dados.turmaId || (rotaId!=null && r.id!==rotaId) || r.modo!==dados.modo || r.categoria!==dados.categoria
        || r.nome!==dados.nome.trim() || r.cidade!==dados.cidade.trim()
        || Math.abs(r.origemLatitude-dados.origemLatitude)>1e-7 || Math.abs(r.origemLongitude-dados.origemLongitude)>1e-7
        || Math.abs(r.destinoLatitude-dados.destinoLatitude)>1e-7 || Math.abs(r.destinoLongitude-dados.destinoLongitude)>1e-7)
        throw new Error('O servidor não confirmou os dados e os pontos desta rota.');return r;
}
export async function salvarParadasPublicas(rotaId:number, pontos:ParadaPublica[]):Promise<RotaPublica> {
    pontos.forEach(p=>parada(p));
    const r=parseRotaPublica(await apiRequest<unknown>(`/rotas-publicas/${id(rotaId)}/paradas`,{
        method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(pontos)}));
    if(r.id!==rotaId || r.paradas.length!==pontos.length || pontos.some((p,i)=>{
        const salvo=r.paradas[i];return (p.id!=null && p.id!==salvo.id) || p.nome.trim()!==salvo.nome
            || Math.abs(p.latitude-salvo.latitude)>1e-7 || Math.abs(p.longitude-salvo.longitude)>1e-7;
    }))throw new Error('O servidor não confirmou a ordem e as coordenadas das paradas. Recarregue a rota.');return r;
}
export async function publicarRota(rotaId:number, publicada:boolean):Promise<RotaPublica> {
    const r=parseRotaPublica(await apiRequest<unknown>(`/rotas-publicas/${id(rotaId)}/publicacao`,{
        method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({valor:publicada})}));
    if(r.id!==rotaId || r.publicada!==publicada)throw new Error('A publicação não foi confirmada.');return r;
}
export async function planejarRotaPublica(rotaId:number,sentido:'IDA'|'VOLTA',otimizar:boolean):Promise<PontoPublico[]> {
    const r=await apiRequest<unknown>(`/rotas-publicas/${id(rotaId)}/planejamento?sentido=${sentido}&otimizar=${otimizar}`,{method:'POST'});
    if(!Array.isArray(r))throw new Error('Prévia indisponível.');return r.map(value=>{
        const p=object(value);const v=parada({...p,id:p.paradaId});return {paradaId:v.id,nome:v.nome,latitude:v.latitude,longitude:v.longitude};
    });
}
