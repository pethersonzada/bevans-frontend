import { useRouter } from 'expo-router';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { useCallback, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormLogin } from '../../components/FormLogin';
import { ApiError, errorMessage } from '../../config/api';
import { fetchSessionUser } from '../../services/session';
import { auth } from '../../config/firebase';
import { globalStyles } from '../../styles/globalStyles';
import { theme } from '../../styles/theme';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { signIn } = useAuth();

    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const [carregandoSenha, setCarregandoSenha] = useState(false);

    const handleLogin = useCallback(async () => {
        if (!email || !senha) {
            Alert.alert("Atenção", "Preencha o e-mail e a senha.");
            return;
        }

        setLoading(true);
        try {
            const emailFormatado = email.trim().toLowerCase();

            const userCredential = await signInWithEmailAndPassword(auth, emailFormatado, senha);
            const firebaseUid = userCredential.user.uid;

            await signIn(await fetchSessionUser(firebaseUid));
            router.replace('/(tabs)/home');
        } catch (error: any) {
            let mensagemErro = error instanceof ApiError
                ? errorMessage(error)
                : "Não foi possível entrar. Tente novamente.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                mensagemErro = "E-mail ou senha incorretos.";
            } else if (error.code === 'auth/invalid-email') {
                mensagemErro = "Formato de e-mail inválido.";
            }
            Alert.alert("Acesso Negado", mensagemErro);
        } finally {
            setLoading(false);
        }
    }, [email, senha, signIn, router]);

    const handleEsqueciSenha = useCallback(async () => {
        if (!email.trim()) {
            Alert.alert("Atenção", "Informe seu e-mail no campo acima para recuperar a senha.");
            return;
        }

        setCarregandoSenha(true);
        try {
            const emailFormatado = email.trim().toLowerCase();
            await sendPasswordResetEmail(auth, emailFormatado);
            Alert.alert(
                "E-mail Enviado",
                `Enviamos as instruções de redefinição para ${emailFormatado}.`
            );
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                Alert.alert("Erro", "Não há conta cadastrada com este e-mail.");
            } else {
                Alert.alert("Erro", "Não foi possível enviar o e-mail de recuperação.");
            }
        } finally {
            setCarregandoSenha(false);
        }
    }, [email]);

    return (
        <KeyboardAvoidingView 
            style={globalStyles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            
            <ScrollView 
                contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]} 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
            >
                <View style={styles.headerArea}>
                    <View style={styles.logoContainer}>
                        <Image source={require('../../../assets/images/logo-app-sem-fundo-sem-titulo.png')} style={styles.logoImage}/>
                    </View>

                    <Text style={styles.title}>Bem-vindo de volta!</Text>
                    <Text style={styles.subtitle}>Entre com seus dados para continuar.</Text>
                </View>

                <View style={styles.formCard}>
                    <FormLogin 
                        email={email} 
                        setEmail={setEmail} 
                        senha={senha} 
                        setSenha={setSenha} 
                        loading={loading} 
                        onLogin={handleLogin} 
                        onEsqueciSenha={handleEsqueciSenha}
                        carregandoSenha={carregandoSenha}
                    />
                </View>

                <View style={styles.registerContainer}>
                    <Text style={styles.text}>Ainda não tem conta?</Text>
                    <View style={styles.row}>
                        <Text style={styles.text}>Cadastre-se como</Text>
                        <TouchableOpacity 
                            onPress={() => router.push({ pathname: '/(auth)/cadastro', params: { tipo: 'PASSAGEIRO' } })}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text style={styles.linkText}>Passageiro</Text>
                        </TouchableOpacity>
                        <Text style={styles.text}>ou</Text>
                        <TouchableOpacity 
                            onPress={() => router.push({ pathname: '/(auth)/cadastro', params: { tipo: 'MOTORISTA' } })}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text style={styles.linkText}>Motorista</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.lg,
    },
    headerArea: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    logoImage: {
        width: 140,
        height: 140,
        resizeMode: 'contain',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: theme.spacing.xs,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: theme.typography.size.regular,
        color: theme.colors.textLight,
        textAlign: 'center',
    },
    formCard: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.xl,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 3,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    registerContainer: {
        alignItems: 'center',
        marginTop: theme.spacing.xl + theme.spacing.md,
        gap: theme.spacing.xs,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    text: {
        fontSize: theme.typography.size.regular,
        color: theme.colors.textLight,
    },
    linkText: {
        fontSize: theme.typography.size.regular,
        fontWeight: '700',
        color: theme.colors.primary,
    },
});
