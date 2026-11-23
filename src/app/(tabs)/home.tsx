import { useThemeRevision } from '../../hooks/useThemeRevision';
import { ActivityIndicator, View } from 'react-native';
import { theme } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';
import HomeMotorista from '../home-motorista';
import HomePassageiro from '../home-passageiro';


export default function HomeTab() {
    useThemeRevision();
    const { user, isLoading } = useAuth();

    if (isLoading || !user?.id) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return <View key={user.id} style={{flex:1}}>{user.tipo === 'MOTORISTA' ? <HomeMotorista /> : <HomePassageiro />}</View>;
}
