import { useAuth } from '../context/AuthContext';
import HomeMotorista from '../home-motorista';
import HomePassageiro from '../home-passageiro';

export default function HomeTab() {
    const { user } = useAuth();

    return user?.tipo === 'MOTORISTA' ? <HomeMotorista /> : <HomePassageiro />;
}