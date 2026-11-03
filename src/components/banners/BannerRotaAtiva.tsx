import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../styles/theme';

type Props = {
    onPress: () => void;
};

export function BannerRotaAtiva({ onPress }: Props) {
    return (
        <TouchableOpacity 
            style={styles.container} 
            onPress={onPress}
            activeOpacity={0.85}
        >
            <View style={styles.iconWrapper}>
                <Ionicons name="map" size={24} color={theme.colors.surface} />
            </View>

            <View style={styles.textContainer}>
                <Text style={styles.title}>ROTA EM ANDAMENTO</Text>
                <Text style={styles.subtitle}>Toque para retornar ao acompanhamento do mapa</Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color={theme.colors.surface} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.md,
    },
    textContainer: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.surface,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: theme.typography.size.small,
        color: 'rgba(255, 255, 255, 0.85)',
    },
});