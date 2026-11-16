import { pontoValido } from './rotasPublicas';
import { nomeLocalGenerico } from './enderecoReversoExcursao';
import type { RotaPublica, RotaPublicaDados, ParadaPublica } from '../types/rotaPublica';
export type ParadaRascunho=ParadaPublica&{chaveLocal:string};
export type RascunhoRota=Omit<RotaPublicaDados,'turmaId'>&{turmaId:number|null;paradas:ParadaRascunho[]};
export type PontoItinerario={chave:string;papel:'origem'|'destino'|'parada';nome:string;latitude:number;longitude:number;ordem:number};
let nextKey=0;
export function paradaLocal(p:ParadaPublica):ParadaRascunho {return {...p,chaveLocal:p.id!=null?`parada-${p.id}`:`nova-${++nextKey}`};}
export function novoRascunhoRota(turmaId:number|null=null):RascunhoRota {
    return {turmaId,nome:'',cidade:'',categoria:'OUTROS',modo:'FIXA',origemNome:'',origemLatitude:NaN,origemLongitude:NaN,destinoNome:'',destinoLatitude:NaN,destinoLongitude:NaN,dias:[],horarioIda:null,horarioVolta:null,descricao:null,regiao:null,campus:null,paradas:[]};
}
export function rascunhoDaRota(r:RotaPublica):RascunhoRota {return {...r,paradas:r.paradas.map(paradaLocal)};}
export function pontosItinerario(r:Pick<RascunhoRota,'origemNome'|'origemLatitude'|'origemLongitude'|'destinoNome'|'destinoLatitude'|'destinoLongitude'|'paradas'>):PontoItinerario[] {
    const points:PontoItinerario[]=[];
    if(pontoValido(r.origemLatitude,r.origemLongitude))points.push({chave:'origem',papel:'origem',nome:r.origemNome,latitude:r.origemLatitude,longitude:r.origemLongitude,ordem:0});
    r.paradas.forEach((p,i)=>{if(pontoValido(p.latitude,p.longitude))points.push({chave:p.chaveLocal,papel:'parada',nome:p.nome,latitude:p.latitude,longitude:p.longitude,ordem:i+1});});
    if(pontoValido(r.destinoLatitude,r.destinoLongitude))points.push({chave:'destino',papel:'destino',nome:r.destinoNome,latitude:r.destinoLatitude,longitude:r.destinoLongitude,ordem:r.paradas.length+1});
    return points;
}
export function reordenarParada(d:RascunhoRota,chave:string,delta:number):RascunhoRota {
    const i=d.paradas.findIndex(p=>p.chaveLocal===chave),to=i+delta;
    if(i<0||to<0||to>=d.paradas.length)return d;
    const paradas=[...d.paradas];[paradas[i],paradas[to]]=[paradas[to],paradas[i]];return {...d,paradas};
}
export function paradasParaApi(d:RascunhoRota):ParadaPublica[] {return d.paradas.map(({id,nome,latitude,longitude,horario})=>({id,nome:nome.trim(),latitude,longitude,horario:horario||null}));}
export function dadosParaApi(d:RascunhoRota):RotaPublicaDados {
    if(!Number.isSafeInteger(d.turmaId)||!d.turmaId||d.turmaId<1)throw new Error('A API exige uma associação operacional com uma turma sua para salvar. O planejamento pode ser montado sem ela.');
    return {turmaId:d.turmaId,nome:d.nome.trim(),cidade:d.cidade.trim(),categoria:d.categoria,modo:d.modo,origemNome:d.origemNome.trim(),origemLatitude:d.origemLatitude,origemLongitude:d.origemLongitude,destinoNome:d.destinoNome.trim(),destinoLatitude:d.destinoLatitude,destinoLongitude:d.destinoLongitude,dias:d.dias,horarioIda:d.horarioIda||null,horarioVolta:d.horarioVolta||null,descricao:d.descricao||null,regiao:d.regiao||null,campus:d.campus||null};
}
const hora=(value:string|null)=>value&&/^\d{2}:\d{2}$/.test(value)?value+':00':value||null;
export function mesmosDados(a:RotaPublicaDados,b:RotaPublicaDados) {
    const coords=['origemLatitude','origemLongitude','destinoLatitude','destinoLongitude'] as const;
    if(coords.some(key=>!Number.isFinite(a[key])||!Number.isFinite(b[key])||Math.abs(a[key]-b[key])>1e-7))return false;
    const plain=(r:RotaPublicaDados)=>[r.turmaId,r.nome.trim(),r.cidade.trim(),r.categoria,r.modo,r.origemNome.trim(),r.destinoNome.trim(),[...r.dias].sort(),hora(r.horarioIda),hora(r.horarioVolta),r.descricao||null,r.regiao||null,r.campus||null];
    return JSON.stringify(plain(a))===JSON.stringify(plain(b));
}
export function mesmasParadas(a:ParadaPublica[],b:ParadaPublica[],compararIds=true) {
    return a.length===b.length&&a.every((p,i)=>{const q=b[i];return (!compararIds||p.id==null||p.id===q.id)&&p.nome.trim()===q.nome.trim()&&Math.abs(p.latitude-q.latitude)<=1e-7&&Math.abs(p.longitude-q.longitude)<=1e-7&&hora(p.horario)===hora(q.horario);});
}
export function mesmaVersaoVisivel(a:RotaPublica,b:RotaPublica) {return a.id===b.id&&a.publicada===b.publicada&&a.ativa===b.ativa&&mesmosDados(a,b)&&mesmasParadas(a.paradas,b.paradas);}
export const etapasRota=['Informações','Endereços','Paradas','Horários','Revisão'] as const;
export type EtapaRota=typeof etapasRota[number];
export const diasRota=[['MONDAY','Segunda'],['TUESDAY','Terça'],['WEDNESDAY','Quarta'],['THURSDAY','Quinta'],['FRIDAY','Sexta'],['SATURDAY','Sábado'],['SUNDAY','Domingo']] as const;
export function validarEtapaRota(d:RascunhoRota,etapa:EtapaRota) {
    if(etapa==='Informações'||etapa==='Revisão') {
        if(!d.nome.trim()||d.nome.trim().length>120||!d.cidade.trim()||d.cidade.trim().length>120)throw new Error('Informe nome e cidade, com até 120 caracteres.');
        if(!['FIXA','FLEXIVEL'].includes(d.modo)||!['ESCOLAR','UNIVERSITARIA','OUTROS'].includes(d.categoria))throw new Error('Escolha modalidade e categoria.');
    }
    if(etapa==='Endereços'||etapa==='Revisão') {
        if(!pontoValido(d.origemLatitude,d.origemLongitude)||!pontoValido(d.destinoLatitude,d.destinoLongitude)||nomeLocalGenerico(d.origemNome)||nomeLocalGenerico(d.destinoNome)||d.origemNome.trim().length>255||d.destinoNome.trim().length>255)throw new Error('Confirme origem e destino no mapa, com uma descrição de até 255 caracteres.');
    }
    if(etapa==='Paradas'||etapa==='Revisão') {
        if(d.paradas.length>50||d.paradas.some(p=>nomeLocalGenerico(p.nome)||p.nome.trim().length>120||!pontoValido(p.latitude,p.longitude)))throw new Error('Revise os endereços das paradas (até 50 pontos; nomes de até 120 caracteres).');
    }
    if(etapa==='Horários'||etapa==='Revisão') {
        if(!d.dias.length||d.dias.some(day=>!diasRota.some(([value])=>value===day)))throw new Error('Escolha os dias de operação.');
        if(!d.horarioIda&&!d.horarioVolta)throw new Error('Informe ao menos um horário de operação.');
    }
    if((etapa==='Paradas'||etapa==='Horários'||etapa==='Revisão')&&[d.horarioIda,d.horarioVolta,...d.paradas.map(p=>p.horario)].some(h=>h&&!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(h)))throw new Error('Use HH:mm nos horários.');
}
export function validarRascunhoRota(d:RascunhoRota) {
    validarEtapaRota(d,'Revisão');
    const dados=dadosParaApi(d);
    const ids=d.paradas.filter(p=>p.id!=null).map(p=>p.id);if(new Set(ids).size!==ids.length)throw new Error('Há uma parada duplicada no planejamento.');
    return dados;
}
