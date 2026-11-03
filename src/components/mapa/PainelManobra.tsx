import { Ionicons } from '@expo/vector-icons';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../styles/theme';

const { width: LARGURA_TELA } = Dimensions.get('window');
const ESCALA = Math.min(LARGURA_TELA / 390, 1.25);

type Manobra = { instrucao: string; tipo: string };

type PainelManobraProps = {
    manobraAtual: Manobra | null;
    velocidadeAtual: number;
};

function iconePorManobra(tipo: string): keyof typeof Ionicons.glyphMap {
    if (tipo.includes('left')) return 'arrow-back';
    if (tipo.includes('right')) return 'arrow-forward';
    if (tipo.includes('roundabout')) return 'sync';
    if (tipo.includes('arrive')) return 'flag';
    return 'arrow-up';
}

export function PainelManobra({ manobraAtual, velocidadeAtual }: PainelManobraProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { top: insets.top + 66 }]}>
            <View style={styles.iconeContainer}>
                <Ionicons name={manobraAtual ? iconePorManobra(manobraAtual.tipo) : 'navigate-outline'} size={22} color="#0F172A" />
            </View>
            <View style={styles.textoContainer}>
                <Text style={styles.rotuloManobra}>Próxima manobra</Text>
                <Text style={styles.instrucaoManobra} numberOfLines={2}>
                    {manobraAtual?.instrucao || 'Calculando rota...'}
                </Text>
            </View>
            <View style={styles.velocidadeContainer}>
                <Text style={styles.valorVelocidade}>{velocidadeAtual}</Text>
                <Text style={styles.unidadeVelocidade}>KM/H</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: theme.spacing.md,
        right: theme.spacing.md,
        zIndex: 10,
        backgroundColor: '#1E293B',
        padding: theme.spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#334155',
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 10,
    },
    iconeContainer: {
        backgroundColor: '#00D2FF',
        padding: 12,
        borderRadius: theme.borderRadius.sm + 2,
        marginRight: theme.spacing.md,
    },
    textoContainer: {
        flex: 1,
    },
    rotuloManobra: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    instrucaoManobra: {
        color: '#FFFFFF',
        fontSize: 14 * ESCALA,
        fontWeight: '700',
        marginTop: 2,
        lineHeight: 19,
    },
    velocidadeContainer: {
        alignItems: 'flex-end',
        marginLeft: theme.spacing.sm,
    },
    valorVelocidade: {
        color: '#00D2FF',
        fontSize: 18 * ESCALA,
        fontWeight: '900',
    },
    unidadeVelocidade: {
        color: '#64748B',
        fontSize: 9,
        fontWeight: '700',
    },
});