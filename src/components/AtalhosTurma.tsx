import { useThemeRevision } from '../hooks/useThemeRevision';

import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { apiRequest } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { consultarColetaPrivada } from '../services/coletaPrivada';
import { ContatoProtegido } from './ContatoProtegido';
import { MenuRow, ui } from './ui/Primitives';

export function AtalhosTurma({ turmaId }: { turmaId: number }) {
    useThemeRevision();
    const { user } = useAuth();
    const router = useRouter();

    const { data, error } = useRemoteResource(
        'status-operacao:' + turmaId,
        signal =>
            apiRequest<{ status: string; viagemId: number }>(
                '/rota/status-atual?turmaId=' + turmaId,
                { signal }
            ),
        15000
    );

    const { data: coleta } = useRemoteResource(
        user.tipo === 'PASSAGEIRO'
            ? `atalhos-coleta:${turmaId}`
            : false,
        async signal => {
            const [ida, volta] = await Promise.all([
                consultarColetaPrivada(
                    String(turmaId), 'IDA', '', signal
                ),
                consultarColetaPrivada(
                    String(turmaId), 'VOLTA', '', signal
                ),
            ]);

            return { ida, volta };
        }
    );

    const ativa =
        data?.status === 'ATIVA' &&
        Number.isSafeInteger(data.viagemId) &&
        data.viagemId > 0;

    const usaParadasIda =
        coleta?.ida.modo === 'PARADAS_DEFINIDAS';

    const usaParadasVolta =
        coleta?.volta.modo === 'PARADAS_DEFINIDAS';

    const mostrarEscolhaParada =
        usaParadasIda || usaParadasVolta;

    return (
        <View style={ui.section}>
            <Text style={ui.sectionTitle}>Sua turma</Text>

            <Text style={ui.caption}>
                {error
                    ? 'Não foi possível confirmar a viagem. Tente atualizar a tela.'
                    : !data
                    ? 'Consultando a viagem…'
                    : data.status === 'ATIVA'
                    ? 'Viagem em andamento'
                    : 'Consulte o trajeto e as informações da turma.'}
            </Text>

            {user.tipo === 'PASSAGEIRO' && (
                <>
                    {mostrarEscolhaParada && (
                        <MenuRow
                            title="Meu embarque"
                            description={
                                usaParadasIda && usaParadasVolta
                                    ? 'Escolha suas paradas de ida e volta.'
                                    : usaParadasIda
                                    ? 'Escolha sua parada de ida.'
                                    : 'Escolha sua parada de volta.'
                            }
                            icon="location-outline"
                            onPress={() =>
                                router.push({
                                    pathname: '/coleta-privada',
                                    params: {
                                        turmaId: String(turmaId),
                                    },
                                })
                            }
                        />
                    )}

                    <ContatoProtegido
                        tipo="turmas"
                        id={turmaId}
                    />
                </>
            )}

            {ativa && (
                <MenuRow
                    title="Acompanhar viagem"
                    description="Embarques e situação atual."
                    icon="navigate-outline"
                    onPress={() =>
                        router.push({
                            pathname: '/controle-viagem',
                            params: {
                                tipo: 'VIAGEM',
                                id: String(data!.viagemId),
                            },
                        })
                    }
                />
            )}
        </View>
    );
}
