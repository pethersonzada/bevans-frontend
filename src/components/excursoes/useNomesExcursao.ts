import { useEffect, useState } from 'react';
import type { Excursao } from '../../services/excursoes';
import { nomeLocalGenerico, nomeLocalExibicao, resolverNomesExcursao } from '../../services/enderecoReversoExcursao';
export function useNomesExcursao(e:Excursao,incluirParadas=true) {
    const key=JSON.stringify([e.id,e.destinoNome,e.destinoLatitude,e.destinoLongitude,e.origemNome,e.origemLatitude,e.origemLongitude,incluirParadas?e.paradas:[]]);
    const needed=nomeLocalGenerico(e.destinoNome)||(e.origemLatitude!=null&&e.origemLongitude!=null&&nomeLocalGenerico(e.origemNome))||(incluirParadas&&e.paradas.some(p=>nomeLocalGenerico(p.nome)));
    const [resolved,setResolved]=useState<{key:string;excursao:Excursao;resolvidos:number;falhas:number}|null>(null);
    useEffect(()=>{
        if(!needed)return;
        const controller=new AbortController();
        void resolverNomesExcursao(e,controller.signal,incluirParadas).then(r=>{if(!controller.signal.aborted)setResolved({key,...r});}).catch(()=>{if(!controller.signal.aborted)setResolved({key,excursao:e,resolvidos:0,falhas:1});});
        return()=>controller.abort();
    },[key,needed,incluirParadas]);
    const value=resolved?.key===key?resolved:null;
    const source=value?.excursao||e;
    // A display-only projection: persistence and edit drafts keep the server DTO.
    const exibicao={...source,destinoNome:nomeLocalExibicao(source.destinoNome),origemNome:source.origemNome==null?null:nomeLocalExibicao(source.origemNome),paradas:source.paradas.map(p=>({...p,nome:nomeLocalExibicao(p.nome)}))};
    return {exibicao,consultando:needed&&!value,consultados:value?.resolvidos||0,falhas:value?.falhas||0,legado:needed};
}
