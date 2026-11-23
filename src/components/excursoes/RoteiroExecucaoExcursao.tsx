import { useThemeRevision } from '../../hooks/useThemeRevision';
import { Text, View } from 'react-native';
import type { ExecucaoExcursao } from '../../services/excursoes';
import MapaPreviaPublica from '../MapaPreviaPublica';
import { trip } from './ViagemUI';

export function RoteiroExecucaoExcursao({execucao}:{execucao:ExecucaoExcursao}) {
    useThemeRevision();
    return <View style={{gap:12}}>
        <Text accessibilityRole="header" style={trip.sectionTitle}>Roteiro da execução · {execucao.sentido==='IDA'?'Ida':'Volta'}</Text>
        <Text style={trip.caption}>Pontos registrados pelo servidor ao iniciar este trecho. Alterações no cadastro não substituem este roteiro.</Text>
        <MapaPreviaPublica pontos={execucao.pontos}/>
        {execucao.pontos.map((p,i)=><View key={`${p.paradaId??p.tipo}-${i}`} style={{gap:4}}>
            <Text style={trip.label}>{i+1}. {p.tipo==='ORIGEM'?'Saída':p.tipo==='DESTINO'?'Destino':p.tipo==='DESEMBARQUE'?'Desembarque':'Embarque'} · {p.nome}</Text>
            {!!p.participantes?.length&&<Text style={trip.caption}>{p.participantes.length} {p.participantes.length===1?'participante autorizado':'participantes autorizados'}</Text>}
        </View>)}
    </View>;
}
