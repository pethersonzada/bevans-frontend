import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
import { renovarPushAndroid } from '../services/push';
import { criarAberturaPush } from '../services/aberturaPush';
import { avisarNotificacoesChanged } from '../services/notificacoes';

export function AberturaPush() {
    const { user } = useAuth(); const router = useRouter();
    const previous = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        const changedAccount = previous.current !== undefined && previous.current !== user.id;
        previous.current = user.id;
        if (!user.id || Platform.OS === 'web') return;
        let active = true;
        const open = criarAberturaPush(() => active, id => router.push({ pathname: '/notificacoes', params: { notificacaoId: id } }));
        const onResponse = (response: Notifications.NotificationResponse | null) => {
            if (!active || !response) return;
            open(response.notification.request.content.data);
            void Notifications.clearLastNotificationResponseAsync().catch(() => {});
        };
        const renew = () => {
            if (active && AppState.currentState === 'active') void renovarPushAndroid(user.id!, () => active).catch(() => {});
        };
        const responseSubscription = Notifications.addNotificationResponseReceivedListener(onResponse);
        const receivedSubscription = Notifications.addNotificationReceivedListener(() => { if (active) avisarNotificacoesChanged(); });
        const tokenSubscription = Notifications.addPushTokenListener(renew);
        const stateSubscription = AppState.addEventListener('change', state => { if (state === 'active') renew(); });
        if (changedAccount) void Notifications.clearLastNotificationResponseAsync().catch(() => {});
        else void Notifications.getLastNotificationResponseAsync().then(onResponse).catch(() => {});
        renew();
        return () => { active = false; responseSubscription.remove(); receivedSubscription.remove(); tokenSubscription.remove(); stateSubscription.remove(); };
    }, [user.id, router]);
    return null;
}
