import { useThemeRevision } from '../hooks/useThemeRevision';
import { ActionButton, ui } from './ui/Primitives';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { ativarPushAndroid, desativarPush } from '../services/push';
import { errorMessage } from '../config/api';
import { theme } from '../styles/theme';

export function PreferenciaPush() {
    useThemeRevision();
    const { user } = useAuth();
    return user.id ? <PushControls key={user.id} owner={user.id} /> : null;
}
function PushControls({ owner }: { owner: string }) {
    useThemeRevision();
    const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    const mounted = useRef(true), pending = useRef(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const run = async (activate: boolean) => {
        if (pending.current) return;
        pending.current = true; setBusy(true); setMessage('');
        try {
            if (activate) await ativarPushAndroid(owner, () => mounted.current);
            else await desativarPush(owner);
            if (mounted.current) setMessage(activate ? 'Dispositivo registrado. O recebimento depende do serviço de notificações; não é uma confirmação de entrega.' : 'Dispositivo revogado e token Android invalidado.');
        } catch (e) { if (mounted.current) setMessage(errorMessage(e)); }
        finally { pending.current = false; if (mounted.current) setBusy(false); }
    };
    return <View style={{ gap: 8 }}>
        <Text>A central funciona mesmo sem permitir notificações no aparelho.</Text>
        <ActionButton variant="primary" title="Permitir notificações Android" busy={busy} onPress={()=>void run(true)}/>
        <ActionButton variant="danger" title="Revogar notificações deste aparelho" disabled={busy} onPress={()=>void run(false)}/>
        <Text accessibilityLiveRegion="polite">{message}</Text>
    </View>;
}
