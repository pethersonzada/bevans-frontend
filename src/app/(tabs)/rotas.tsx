import { useAuth } from '../../contexts/AuthContext';
import RotasPublicasMotorista from '../rotas-publicas';
import { CatalogoRotas } from '../../components/CatalogoRotas';

export default function RotasTab() {
    const { user } = useAuth();
    return user.tipo === 'MOTORISTA' ? <RotasPublicasMotorista key={user.id} /> : <CatalogoRotas key={user.id} />;
}
