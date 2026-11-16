import type { DadosExcursao, Excursao, ParadaExcursao } from '../../services/excursoes';
import { validarDatasExcursao } from '../../services/excursaoFormulario';
import type { PontoViagem } from './ViagemUI';
export type RascunhoViagem = {titulo:string;destino:PontoViagem|null;origem:PontoViagem|null;partida:string;retorno:string;capacidade:string;modo:Excursao['modoColeta'];paradas:ParadaExcursao[]};
export const momentos=['Destino','Datas','Embarque','Pontos','Revisão'] as const;
export type Momento = typeof momentos[number];
export function rascunhoInicial(e?:Excursao):RascunhoViagem {
    return {titulo:e?.titulo||'',destino:e?{nome:e.destinoNome,latitude:e.destinoLatitude,longitude:e.destinoLongitude}:null,
        origem:e?.origemNome&&e.origemLatitude!=null&&e.origemLongitude!=null?{nome:e.origemNome,latitude:e.origemLatitude,longitude:e.origemLongitude}:null,
        partida:e?.partidaEm||'',retorno:e?.retornoEm||'',capacidade:e?String(e.capacidade):'',modo:e?.modoColeta||'PORTA_A_PORTA',paradas:e?.paradas||[]};
}
export function dadosRascunho(d:RascunhoViagem,versao?:number):DadosExcursao {
    return {titulo:d.titulo.trim(),destinoNome:d.destino?.nome||'',destinoLatitude:d.destino?.latitude??NaN,destinoLongitude:d.destino?.longitude??NaN,
        origemNome:d.origem?.nome??null,origemLatitude:d.origem?.latitude??null,origemLongitude:d.origem?.longitude??null,partidaEm:d.partida,retornoEm:d.retorno||null,capacidade:Number(d.capacidade),versao};
}
export function validarMomento(d:RascunhoViagem,m:Momento) {
    if(m==='Destino'||m==='Revisão'){
        if(!d.destino||!d.titulo.trim())throw new Error('Escolha o destino e dê um nome à viagem.');
    }
    if(m==='Datas'||m==='Revisão'){
        if(!/^[1-9]\d*$/.test(d.capacidade.trim()))throw new Error('Informe a quantidade de lugares da van.');
        validarDatasExcursao(d.partida,d.retorno||null,Number(d.capacidade));
    }
    if(m==='Pontos'||m==='Revisão'){
        if(d.modo==='PARADA_UNICA'&&d.paradas.length!==1)throw new Error('Escolha um único ponto de encontro.');
        if(d.modo==='MULTIPLAS_PARADAS'&&(d.paradas.length<2||d.paradas.length>50))throw new Error('Organize de 2 a 50 pontos de encontro.');
        if(d.modo!=='PORTA_A_PORTA'&&d.paradas.some(p=>!p.nome.trim()||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||(p.latitude===0&&p.longitude===0)))throw new Error('Confirme os pontos de embarque no mapa.');
        if(d.modo!=='PORTA_A_PORTA'&&d.paradas.some(p=>p.horario&&!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(p.horario)))throw new Error('Use HH:mm nos horários dos pontos.');
    }
}
export function coletaRascunho(d:RascunhoViagem) {return d.modo==='PORTA_A_PORTA'?[]:d.paradas;}
export function dadosMudaram(d:RascunhoViagem,e:Excursao) {
    const normalize=(value:DadosExcursao)=>({...value,partidaEm:Date.parse(value.partidaEm),retornoEm:value.retornoEm?Date.parse(value.retornoEm):null});
    const left=normalize(dadosRascunho(d)),right=normalize(dadosRascunho(rascunhoInicial(e)));return JSON.stringify(left)!==JSON.stringify(right);
}
export function coletaMudou(d:RascunhoViagem,e:Excursao) {return d.modo!==e.modoColeta||JSON.stringify(coletaRascunho(d))!==JSON.stringify(e.paradas);}
