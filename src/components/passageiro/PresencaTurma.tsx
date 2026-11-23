import { useThemeRevision } from '../../hooks/useThemeRevision';
import type { ComponentProps } from 'react';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { consultarColetaPrivada } from '../../services/coletaPrivada';
import { SeletorPresenca } from './SeletorPresenca';
export function PresencaTurma({turmaId,...props}:ComponentProps<typeof SeletorPresenca>&{turmaId:number|null}){
    useThemeRevision();
    const {data}=useRemoteResource(turmaId?`coleta-presenca:${turmaId}`:false,async signal=>{
        const [ida,volta]=await Promise.all([consultarColetaPrivada(String(turmaId),'IDA','',signal),consultarColetaPrivada(String(turmaId),'VOLTA','',signal)]);return {ida,volta};
    });
    return <SeletorPresenca {...props} usaParadasIda={data?.ida.modo==='PARADAS_DEFINIDAS'} usaParadasVolta={data?.volta.modo==='PARADAS_DEFINIDAS'}/>;
}
