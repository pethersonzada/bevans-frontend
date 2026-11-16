import * as Location from 'expo-location';
import { withDeadline } from './asyncOperation';
import type { EnderecoEncontrado } from './enderecoSearch';
import type { Excursao } from './excursoes';
type EnderecoNativo=Partial<Location.LocationGeocodedAddress>;
const text=(value:unknown)=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
export function nomeLocalGenerico(value:unknown) {
    const nome=text(value).toLocaleLowerCase('pt-BR');
    return !nome||nome==='ponto marcado no mapa';
}
export function nomeLocalExibicao(value:unknown) {return nomeLocalGenerico(value)?'Endereço não identificado':text(value);}
export function formatarEnderecoReverso(raw:EnderecoNativo):string {
    const rua=text(raw.street),numero=text(raw.streetNumber),bairro=text(raw.district);
    const cidade=text(raw.city)||text(raw.subregion),estado=text(raw.region);
    const logradouro=rua?[rua,numero].filter(Boolean).join(', '):'';
    const localidade=[cidade,estado].filter(Boolean).join(' - ');
    const parts=[logradouro,bairro.toLocaleLowerCase('pt-BR')===cidade.toLocaleLowerCase('pt-BR')?'':bairro,localidade].filter(Boolean);
    const unique=parts.filter((p,i)=>parts.findIndex(v=>v.toLocaleLowerCase('pt-BR')===p.toLocaleLowerCase('pt-BR'))===i);
    const composed=unique.join(', ');
    // Do not manufacture a street/number from a placemark or a postal code.
    const fallback=text(raw.formattedAddress)||text(raw.name);
    return composed||(!nomeLocalGenerico(fallback)&&!/^\d[\d\s.,-]*$/.test(fallback)?fallback:'');
}
export async function resolverEnderecoExcursao(ponto:{latitude:number;longitude:number},signal?:AbortSignal):Promise<EnderecoEncontrado> {
    const {latitude,longitude}=ponto;
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new Error('Coordenadas inválidas para consultar o endereço.');
    return withDeadline(async active=>{
        // Reuse the installed native geocoder. It does not require another API key
        // or a new endpoint, and never requests another permission automatically.
        const results=await Location.reverseGeocodeAsync({latitude,longitude});
        if(active.aborted)throw new Error('Consulta de endereço interrompida.');
        const raw=results.find(r=>!!formatarEnderecoReverso(r));
        const nome=raw?formatarEnderecoReverso(raw):'';
        if(!raw||nomeLocalGenerico(nome))throw new Error('Endereço não encontrado. Informe uma descrição do local selecionado.');
        return {id:`reverso:${latitude}:${longitude}`,nome,latitude,longitude,rua:text(raw.street),numero:text(raw.streetNumber),bairro:text(raw.district),tipo:'endereco',precisao:'manual'};
    },{signal,timeoutMs:10000,timeoutMessage:'A consulta do endereço demorou. Você pode informar a descrição manualmente.'});
}
export async function resolverNomesExcursao(e:Excursao,signal?:AbortSignal,incluirParadas=true) {
    const copy={...e,paradas:e.paradas.map(p=>({...p}))};
    const pending:{key:string;latitude:number;longitude:number;assign:(nome:string)=>void}[]=[];
    if(nomeLocalGenerico(e.destinoNome))pending.push({key:'destino',latitude:e.destinoLatitude,longitude:e.destinoLongitude,assign:n=>{copy.destinoNome=n;}});
    if(e.origemLatitude!=null&&e.origemLongitude!=null&&nomeLocalGenerico(e.origemNome))pending.push({key:'origem',latitude:e.origemLatitude,longitude:e.origemLongitude,assign:n=>{copy.origemNome=n;}});
    if(incluirParadas)e.paradas.forEach((p,i)=>{if(nomeLocalGenerico(p.nome))pending.push({key:`parada-${i}`,latitude:p.latitude,longitude:p.longitude,assign:n=>{copy.paradas[i].nome=n;}});});
    const requests=new Map<string,Promise<EnderecoEncontrado>>();let resolvidos=0,falhas=0;
    for(let i=0;i<pending.length;i+=3){
        if(signal?.aborted)break;
        await Promise.all(pending.slice(i,i+3).map(async p=>{
            const key=`${p.latitude}:${p.longitude}`;
            if(!requests.has(key))requests.set(key,resolverEnderecoExcursao(p,signal));
            try{const address=await requests.get(key)!;if(!signal?.aborted){p.assign(address.nome);resolvidos++;}}catch{falhas++;}
        }));
    }
    return {excursao:copy,resolvidos,falhas};
}
