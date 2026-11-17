import type { DadosExcursao, Excursao, ExecucaoExcursao, ParadaExcursao } from './excursoes';
import { coordenadasMapaValidas } from './mapaExcursao';

export function normalizarHorarioParada(horario:string|null) {
    if(!horario)return null;
    if(!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(horario))throw new Error('Use HH:mm nos horários dos pontos.');
    return horario.length===5?horario+':00':horario;
}
export function normalizarParadasExcursao(paradas:ParadaExcursao[]) {
    return paradas.map(p=>({id:p.id,nome:p.nome.trim(),latitude:p.latitude,longitude:p.longitude,horario:normalizarHorarioParada(p.horario),instrucoes:p.instrucoes?.trim()||null}));
}
export function validarDadosExcursao(d:DadosExcursao) {
    if(!d.titulo.trim()||d.titulo.trim().length>120)throw new Error('Informe um nome de viagem com até 120 caracteres.');
    if(!d.destinoNome.trim()||d.destinoNome.trim().length>255||!coordenadasMapaValidas(d.destinoLatitude,d.destinoLongitude))throw new Error('Confirme um destino válido no mapa.');
    if(d.origemNome!=null||d.origemLatitude!=null||d.origemLongitude!=null){
        if(!d.origemNome?.trim()||d.origemNome.trim().length>255||!coordenadasMapaValidas(d.origemLatitude,d.origemLongitude))throw new Error('Confirme o ponto de saída no mapa.');
    }
}
export function validarColetaExcursao(modo:Excursao['modoColeta'],paradas:ParadaExcursao[]) {
    if(!['PORTA_A_PORTA','PARADA_UNICA','MULTIPLAS_PARADAS'].includes(modo)||paradas.length>50||
        (modo==='PORTA_A_PORTA'&&paradas.length!==0)||(modo==='PARADA_UNICA'&&paradas.length!==1)||(modo==='MULTIPLAS_PARADAS'&&paradas.length<2))throw new Error('Revise a quantidade de pontos para o modo de embarque escolhido.');
    const ids=new Set<number>();
    for(const p of paradas){
        if(!p.nome.trim()||p.nome.trim().length>120||!coordenadasMapaValidas(p.latitude,p.longitude)||p.pontoConfirmado===false)throw new Error('Confirme cada ponto de embarque no mapa e informe um nome com até 120 caracteres.');
        if(p.id!=null){if(!Number.isSafeInteger(p.id)||p.id<=0||ids.has(p.id))throw new Error('Há uma parada inválida ou repetida.');ids.add(p.id);}
        if((p.instrucoes?.length??0)>500)throw new Error('Use até 500 caracteres nas instruções da parada.');
        normalizarHorarioParada(p.horario);
    }
}
export function mesmaColetaExcursao(esperadas:ParadaExcursao[],salvas:ParadaExcursao[]) {
    if(esperadas.length!==salvas.length)return false;
    const normalized=normalizarParadasExcursao(salvas);
    return normalizarParadasExcursao(esperadas).every((p,i)=>{
        const s=normalized[i];return (p.id==null||p.id===s.id)&&p.nome===s.nome&&p.latitude===s.latitude&&p.longitude===s.longitude&&p.horario===s.horario&&p.instrucoes===s.instrucoes;
    });
}
export function mesmaExcursaoSalva(a:Excursao,b:Excursao) {
    const data=(e:Excursao)=>JSON.stringify({id:e.id,titulo:e.titulo.trim(),origemNome:e.origemNome?.trim()||null,origemLatitude:e.origemLatitude,origemLongitude:e.origemLongitude,destinoNome:e.destinoNome.trim(),destinoLatitude:e.destinoLatitude,destinoLongitude:e.destinoLongitude,partida:Date.parse(e.partidaEm),retorno:e.retornoEm?Date.parse(e.retornoEm):null,capacidade:e.capacidade,modo:e.modoColeta,estado:e.estado});
    return a.versao===b.versao&&data(a)===data(b)&&mesmaColetaExcursao(a.paradas,b.paradas);
}
export function impedimentoInicioExcursao(e:Excursao,sentido:'IDA'|'VOLTA',execucoes:ExecucaoExcursao[]|null|undefined):{mensagem:string;etapa?:'publicacao'|'Destino'|'Datas'}|null {
    if(!execucoes)return {mensagem:'Atualize as execuções antes de iniciar.'};
    if(e.estado==='CANCELADA')return {mensagem:'Esta excursão foi cancelada.'};
    if(e.estado==='CONCLUIDA')return {mensagem:'Esta excursão foi concluída. Consulte as execuções anteriores.'};
    if(execucoes.some(x=>x.sentido===sentido))return {mensagem:'Este trecho já possui execução. Consulte o roteiro e o controle de embarque.'};
    if(execucoes.some(x=>x.estado==='EM_ANDAMENTO'))return {mensagem:'Finalize a execução em andamento antes de iniciar outro trecho.'};
    if(e.estado!=='PUBLICADA')return {mensagem:'Revise e publique a excursão antes de iniciar.',etapa:'publicacao'};
    if(sentido==='VOLTA'){
        if(!execucoes.some(x=>x.sentido==='IDA'&&x.estado==='FINALIZADA'))return {mensagem:'Finalize a ida antes de iniciar a volta.'};
        if(!e.retornoEm)return {mensagem:'Defina o dia e o horário do retorno.',etapa:'Datas'};
        if(!coordenadasMapaValidas(e.origemLatitude,e.origemLongitude))return {mensagem:'Defina o ponto de saída para receber o grupo na volta.',etapa:'Destino'};
    }
    return null;
}
