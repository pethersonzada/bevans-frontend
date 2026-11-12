import { Stack } from 'expo-router';
import { AppAlertProvider } from '../contexts/AppAlertContext';
import { StatusBar, View, Button } from 'react-native';
import { AsyncState } from '../components/AsyncState';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootLayoutNav() {
    const { user, isLoading, sessionError, retrySession, signOut } = useAuth();
    if (isLoading) return <AsyncState loading />;
    if (sessionError) return (
        <View style={{ flex: 1, justifyContent: 'center' }}>
            <AsyncState message={sessionError} onRetry={retrySession} />
            <Button title="Voltar ao login" onPress={() => { void signOut().catch(console.error); }} />
        </View>
    );
    const signedIn = Boolean(user.id);
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Protected guard={!signedIn}>
                <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="gerenciar-enderecos" />
                <Stack.Screen name="cadastro-endereco" />
                <Stack.Screen name="editar-endereco" />
                <Stack.Screen name="entrar-turma" />
                <Stack.Screen name="home-passageiro" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && user.tipo === 'MOTORISTA'}>
                <Stack.Screen name="home-motorista" />
                <Stack.Screen name="cadastro-turma" />
                <Stack.Screen name="editar-turma" />
                <Stack.Screen name="selecionar-rota-mapa" />
                <Stack.Screen name="mapa" />
            </Stack.Protected>
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <AppAlertProvider><AuthProvider>
                <RootLayoutNav />
            </AuthProvider></AppAlertProvider>
        </SafeAreaProvider>
    );
}
