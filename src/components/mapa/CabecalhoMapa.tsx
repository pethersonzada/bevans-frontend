import { Ionicons } from '@expo/vector-icons';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../styles/theme';

const { width: LARGURA_TELA } = Dimensions.get('window');
const ESCALA = Math.min(LARGURA_TELA / 390, 1.25);

type CabecalhoMapaProps = {
    onBack: () => void;
    online: boolean;
    direcaoAtual: string;
    horarioAtual: string;
};

export function CabecalhoMapa({ onBack, online, direcaoAtual, horarioAtual }: CabecalhoMapaProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { top: insets.top + 8 }]}>
            <TouchableOpacity style={styles.botaoVoltar} onPress={onBack} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={22} color="#00D2FF" />
            </TouchableOpacity>
            
            <View style={styles.painelInfo}>
                <View style={styles.statusContainer}>
                    <View style={[styles.indicadorStatus, { backgroundColor: online ? '#10B981' : '#EF4444' }]} />
                    <Text style={styles.textoRota}>ROTA {direcaoAtual.toUpperCase()}</Text>
                </View>
                <Text style={styles.textoHorario}>{horarioAtual}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
    },
    botaoVoltar: {
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: '#334155',
        width: 42 * ESCALA,
        height: 42 * ESCALA,
        borderRadius: 21 * ESCALA,
        justifyContent: 'center',
        alignItems: 'center',
    },
    painelInfo: {
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: '#334155',
        marginLeft: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs + 2,
        borderRadius: theme.borderRadius.md,
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'space-between',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    indicadorStatus: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    textoRota: {
        color: '#FFFFFF',
        letterSpacing: 0.5,
        fontWeight: '700',
        fontSize: 12 * ESCALA,
    },
    textoHorario: {
        color: '#00D2FF',
        fontSize: 13 * ESCALA,
        fontWeight: '900',
        marginLeft: theme.spacing.sm,
    },
});