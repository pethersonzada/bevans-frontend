import { dataLocal, lerDataLocal } from './dataOperacao';
import { pontoValido } from './rotasPublicas';
import type { RotaPublica } from '../types/rotaPublica';

export function validarPedidoPublico(rota: RotaPublica, data: string, sentido: 'IDA'|'VOLTA', paradaId: number|null, ponto: {nome:string;latitude:number;longitude:number}|null, agora=new Date()) {
    const dia=lerDataLocal(data);
    if(!rota.publicada||!rota.ativa)throw new Error('Esta rota não está disponível para novos pedidos.');
    if(data<dataLocal(agora))throw new Error('Escolha hoje ou uma data futura.');
    const dias=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    if(!rota.dias.includes(dias[dia.getDay()] as RotaPublica['dias'][number]))throw new Error('A rota não opera no dia selecionado.');
    const horario=sentido==='IDA'?rota.horarioIda:rota.horarioVolta;
    if(!horario)throw new Error('Este sentido não possui horário disponível.');
    const [hora,minuto]=horario.split(':').map(Number);dia.setHours(hora,minuto,0,0);
    if(dia.getTime()<=agora.getTime())throw new Error('O horário deste embarque já passou. Escolha outra data ou sentido.');
    if(paradaId!==null){if(!rota.paradas.some(p=>p.id===paradaId))throw new Error('Escolha uma parada disponível nesta rota.');return;}
    if(rota.modo!=='FLEXIVEL'&&!rota.permitePontoExcepcional)throw new Error('Escolha uma parada cadastrada nesta rota fixa.');
    if(!ponto||!ponto.nome.trim()||ponto.nome.trim().length>120||!pontoValido(ponto.latitude,ponto.longitude))throw new Error('Escolha e confirme um ponto válido no mapa.');
}
