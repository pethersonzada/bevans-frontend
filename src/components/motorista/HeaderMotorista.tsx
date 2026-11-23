import { useThemeRevision } from '../../hooks/useThemeRevision';
﻿import { HeaderHome } from '../HeaderHome';

export function HeaderMotorista({ nomeMotorista }: { nomeMotorista: string }) {
    useThemeRevision();
    return <HeaderHome nome={nomeMotorista} />;
}
