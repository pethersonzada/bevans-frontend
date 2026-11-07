import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';

function RootLayoutNav() {
    const { user, isLoading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const firstSegment = segments[0] || '';
        const inAuthGroup = firstSegment === '(tabs)';
        
        const publicasForaDasTabs = [
            'login',
            'cadastro',
            'gerenciar-enderecos', 
            'entrar-turma', 
            'cadastro-endereco', 
            'cadastro-turma',
            'editar-turma',
            'mapa',
            'selecionar-rota-mapa',
            'editar-endereco'
        ];

        const estaEmTelaLivre = publicasForaDasTabs.includes(firstSegment);

        // O setTimeout coloca o redirecionamento na fila do próximo tick da call stack,
        // dando tempo do <Stack /> e do Expo Router montarem sem dar erro de state update.
        const timer = setTimeout(() => {
            if (!user.id && inAuthGroup) {
                router.replace('/login');
            } else if (user.id && !inAuthGroup && !estaEmTelaLivre) {
                router.replace('/(tabs)/home');
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [user.id, isLoading, segments]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color="#0E1524" />
            </View>
        );
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <AuthProvider>
                <RootLayoutNav />
            </AuthProvider>
        </SafeAreaProvider>
    );
}