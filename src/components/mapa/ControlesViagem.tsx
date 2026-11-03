import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../styles/theme';

type ControlesViagemProps = {
    distanciaRestante: number | null;
    etaMinutos: number | null;
    viagemAtiva: boolean;
    onIniciarViagem: () => void;
    onEncerrarViagem: () => void;
};

export function ControlesViagem({
    distanciaRestante,
    etaMinutos,
    viagemAtiva,
    onIniciarViagem,
    onEncerrarViagem,
}: ControlesViagemProps) {
    const insets = useSafeAreaInsets();

    return (
        <>
            {distanciaRestante !== null && (
                <View style={[styles.cardMetricas, { bottom: insets.bottom + 92 }]}>
                    <View>
                        <Text style={styles.rotuloMetrica}>DISTÂNCIA RESTANTE</Text>
                        <Text style={styles.valorMetrica}>{(distanciaRestante / 1000).toFixed(1)} km</Text>
                    </View>
                    <View style={styles.metricaDireita}>
                        <Text style={styles.rotuloMetrica}>CHEGADA ESTIMADA</Text>
                        <Text style={styles.valorEta}>{etaMinutos} min</Text>
                    </View>
                </View>
            )}

            <View style={[styles.containerAcao, { bottom: insets.bottom + 16 }]}>
                {!viagemAtiva ? (
                    <TouchableOpacity style={styles.botaoIniciar} onPress={onIniciarViagem} activeOpacity={0.8}>
                        <Ionicons name="play" size={20} color="#0F172A" style={styles.iconeBotao} />
                        <Text style={styles.textoBotaoIniciar}>INICIAR ROTA DE TRANSPORTE</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.botaoEncerrar} onPress={onEncerrarViagem} activeOpacity={0.8}>
                        <Ionicons name="stop" size={20} color="#FFFFFF" style={styles.iconeBotao} />
                        <Text style={styles.textoBotaoEncerrar}>ENCERRAR VIAGEM</Text>
                    </TouchableOpacity>
                )}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    cardMetricas: {
        position: 'absolute',
        left: theme.spacing.md,
        right: theme.spacing.md,
        zIndex: 20,
        backgroundColor: '#1E293B',
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: '#334155',
        padding: theme.spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    rotuloMetrica: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    valorMetrica: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 2,
    },
    metricaDireita: {
        alignItems: 'flex-end',
    },
    valorEta: {
        color: '#00D2FF',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 2,
    },
    containerAcao: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 20,
        paddingHorizontal: theme.spacing.md,
    },
    botaoIniciar: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#00D2FF',
        borderRadius: theme.borderRadius.md,
        height: 54,
        shadowColor: '#00D2FF',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    botaoEncerrar: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        borderRadius: theme.borderRadius.md,
        height: 64,
        shadowColor: '#EF4444',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    iconeBotao: {
        marginRight: theme.spacing.xs,
    },
    textoBotaoIniciar: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 15,
        letterSpacing: 0.5,
    },
    textoBotaoEncerrar: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 0.5,
    },
});