import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import HomeMotorista from '../home-motorista';
import HomePassageiro from '../home-passageiro';

export default function HomeTab() {
    const { user, isLoading } = useAuth();

    if (isLoading || !user?.id) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color="#0E1524" />
            </View>
        );
    }

    return user.tipo === 'MOTORISTA' ? <HomeMotorista /> : <HomePassageiro />;
}