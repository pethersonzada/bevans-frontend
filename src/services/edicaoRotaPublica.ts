import { buscarRotaPublica, listarMinhasRotas, salvarParadasPublicas, salvarRotaPublica } from './rotasPublicas';
import { mesmasParadas, mesmosDados, mesmaVersaoVisivel, paradasParaApi, validarRascunhoRota, type RascunhoRota } from './itinerarioRotaPublica';
import type { RotaPublica } from '../types/rotaPublica';
export type EstadoEdicaoRota={salva:RotaPublica|null;incerta:'criacao'|'dados'|'paradas'|null;conferir:boolean;parcial:boolean};
const unknown=(e:unknown)=>{const status=(e as {status?:number}).status;return !status||status>=500;};
const conflict=()=>Object.assign(new Error('A versão salva mudou em outra sessão. Seu rascunho foi preservado; confira o servidor antes de substituir alterações.'),{status:409});
export function estadoEdicaoRota(salva:RotaPublica|null=null):EstadoEdicaoRota {return {salva,incerta:null,conferir:false,parcial:false};}
export async function salvarPlanejamentoRota(state:EstadoEdicaoRota,d:RascunhoRota,isCurrent:()=>boolean,onProgress:()=>void=()=>{}):Promise<RotaPublica> {
    const dados=validarRascunhoRota(d),paradas=paradasParaApi(d);
    const check=()=>{if(!isCurrent())throw new Error('A sessão mudou. O salvamento foi interrompido.');};
    const adopt=(r:RotaPublica)=>{check();state.salva=r;onProgress();};
    check();
    if(state.incerta==='criacao'){
        const found=(await listarMinhasRotas()).find(r=>r.turmaId===dados.turmaId);check();
        if(!found||!mesmosDados(found,dados))throw new Error('A criação anterior não foi confirmada. Confira suas rotas antes de iniciar outra criação.');
        adopt(found);state.incerta=null;state.parcial=true;
    }
    if(state.incerta==='dados'||state.incerta==='paradas'){
        const actual=await buscarRotaPublica(state.salva!.id);check();
        const confirmed=state.incerta==='dados'?mesmosDados(actual,dados):mesmosDados(actual,dados)&&mesmasParadas(paradas,actual.paradas);
        if(!confirmed)throw new Error('O resultado anterior é desconhecido. Confira a versão do servidor antes de permitir uma nova tentativa.');
        adopt(actual);state.incerta=null;
    }
    if(state.salva){
        const current=await buscarRotaPublica(state.salva.id);check();
        if(!mesmaVersaoVisivel(current,state.salva))throw conflict();
    }
    if(!state.salva||!mesmosDados(state.salva,dados)){
        const creating=!state.salva;
        try {adopt(await salvarRotaPublica(state.salva?.id??null,dados));state.parcial=true;}
        catch(e){if(unknown(e)){state.incerta=creating?'criacao':'dados';onProgress();}throw e;}
    }
    check();
    const expected=paradasParaApi(d);
    if(!mesmasParadas(expected,state.salva!.paradas)){
        // The two existing endpoints are not transactional together. Detect a
        // visible concurrent edit between the data write and the stop write.
        const beforeStops=await buscarRotaPublica(state.salva!.id);check();
        if(!mesmaVersaoVisivel(beforeStops,state.salva!))throw conflict();
        try {adopt(await salvarParadasPublicas(state.salva!.id,expected));state.parcial=true;}
        catch(e){
            if(!unknown(e))throw e;
            state.incerta='paradas';onProgress();
            // A lost response can be proven by a read; never replay null IDs blindly.
            try {const actual=await buscarRotaPublica(state.salva!.id);check();if(mesmosDados(actual,dados)&&mesmasParadas(expected,actual.paradas)){adopt(actual);state.incerta=null;}else throw e;}
            catch {throw new Error('Não foi possível confirmar as paradas. O rascunho foi preservado; confira o resultado no servidor antes de repetir.');}
        }
    }
    state.conferir=true;onProgress();
    const verified=await buscarRotaPublica(state.salva!.id);check();
    if(!mesmosDados(verified,dados)||!mesmasParadas(expected,verified.paradas))throw conflict();
    adopt(verified);state.incerta=null;state.parcial=false;state.conferir=false;onProgress();return verified;
}
