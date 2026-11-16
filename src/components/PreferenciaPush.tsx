import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { ativarPushAndroid, desativarPush } from '../services/push';
import { errorMessage } from '../config/api';
import { theme } from '../styles/theme';

export function PreferenciaPush() {
    const { user } = useAuth();
    return user.id ? <PushControls key={user.id} owner={user.id} /> : null;
}
function PushControls({ owner }: { owner: string }) {
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
        {[['Permitir notificações Android', true], ['Revogar notificações deste aparelho', false]].map(([label, activate]) => <Pressable key={String(label)} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void run(Boolean(activate))} style={{ minHeight: 48, padding: 12, borderRadius: 8, backgroundColor: theme.colors.primary, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>{busy ? 'Aguarde…' : label}</Text>
        </Pressable>)}
        <Text accessibilityLiveRegion="polite">{message}</Text>
    </View>;
}
