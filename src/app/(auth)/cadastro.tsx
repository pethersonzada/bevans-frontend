import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { TextInputMask } from 'react-native-masked-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '../../config/api';
import { auth } from '../../config/firebase';
import { globalStyles } from '../../styles/globalStyles';
import { theme } from '../../styles/theme';

export default function Signup() {
    const { tipo } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [confirmaSenha, setConfirmaSenha] = useState('');
    const [telefone, setTelefone] = useState('');
    const [codigoAcesso, setCodigoAcesso] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSenha, setShowSenha] = useState(false);
    const [showConfirmaSenha, setShowConfirmaSenha] = useState(false);
    const [focado, setFocado] = useState<string | null>(null);

    const tipoUsuario = (tipo as string) || 'PASSAGEIRO';
    const isFocado = (campo: string) => focado === campo;

    async function handleCadastro() {
        if (!nome || !email || !senha || !confirmaSenha || !telefone) {
            Alert.alert("Atenção", "Preencha todos os campos.");
            return;
        }

        if (tipoUsuario === 'MOTORISTA' && codigoAcesso !== 'ROTA2026') {
            Alert.alert("Acesso Restrito", "Código de motorista inválido.");
            return;
        }

        if (senha !== confirmaSenha) {
            Alert.alert("Erro", "As senhas não coincidem.");
            return;
        }

        setLoading(true);
        try {
            const emailFormatado = email.trim().toLowerCase();

            const userCredential = await createUserWithEmailAndPassword(auth, emailFormatado, senha);
            const firebaseUid = userCredential.user.uid;

            await sendEmailVerification(userCredential.user);

            const response = await apiFetch(`/usuarios/cadastrar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                body: JSON.stringify({ 
                    nome, 
                    email: emailFormatado, 
                    firebaseUid, 
                    telefone: telefone.replace(/\D/g, ''), 
                    tipo: tipoUsuario, 
                    enderecoCompleto: 'Endereço Pendente', 
                    latitude: 0.0, 
                    longitude: 0.0 
                })
            });

            if (response.ok) {
                Alert.alert(
                    "Conta Criada!", 
                    "Enviamos um e-mail de confirmação para a sua caixa de entrada. Por favor, verifique o seu e-mail antes de fazer o login."
                );
                router.replace('/(auth)/login');
            } else {
                let mensagemErro = "Não foi possível salvar o usuário no servidor.";
                try {
                    const errorData = await response.json();
                    if (errorData.message) mensagemErro = errorData.message;
                } catch (e) {}
                Alert.alert("Atenção", mensagemErro);
            }
        } catch (error: any) {
            let mensagemErro = "Não foi possível conectar ao servidor.";
            if (error.code === 'auth/email-already-in-use') {
                mensagemErro = "Este e-mail já está em uso no Firebase.";
            } else if (error.code === 'auth/invalid-email') {
                mensagemErro = "E-mail inválido.";
            } else if (error.code === 'auth/weak-password') {
                mensagemErro = "A senha deve ter pelo menos 6 caracteres.";
            }
            Alert.alert("Erro no Cadastro", mensagemErro);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flexOne}>
                <ScrollView 
                    contentContainerStyle={[
                        styles.content, 
                        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }
                    ]} 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={26} color={theme.colors.text} />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <Text style={styles.titulo}>
                            Cadastro {tipoUsuario.charAt(0) + tipoUsuario.slice(1).toLowerCase()}
                        </Text>
                        <Text style={styles.subtitulo}>Preencha seus dados para começar</Text>
                    </View>
                    
                    {tipoUsuario === 'MOTORISTA' && (
                        <View style={[
                            styles.inputContainer, 
                            styles.inputContainerMotorista,
                            isFocado('codigo') && styles.inputFocused
                        ]}>
                            <Ionicons name="key-outline" size={22} color={theme.colors.primary} style={styles.inputIcon} />
                            <TextInput 
                                style={styles.inputComIcone} 
                                placeholder="Código de Autorização" 
                                placeholderTextColor={theme.colors.textLight}
                                onChangeText={setCodigoAcesso}
                                onFocus={() => setFocado('codigo')}
                                onBlur={() => setFocado(null)}
                                secureTextEntry
                                selectionColor={theme.colors.primary}
                                underlineColorAndroid="transparent"
                                value={codigoAcesso}
                            />
                        </View>
                    )}

                    <View style={[styles.inputContainer, isFocado('nome') && styles.inputFocused]}>
                        <Ionicons name="person-outline" size={22} color={isFocado('nome') ? theme.colors.primary : theme.colors.textLight} style={styles.inputIcon} />
                        <TextInput 
                            style={styles.inputComIcone} 
                            placeholder="Nome Completo" 
                            placeholderTextColor={theme.colors.textLight} 
                            onChangeText={setNome} 
                            onFocus={() => setFocado('nome')}
                            onBlur={() => setFocado(null)}
                            value={nome}
                            autoComplete="name"
                            textContentType="name"
                            autoCapitalize="words"
                            selectionColor={theme.colors.primary}
                            underlineColorAndroid="transparent"
                        />
                    </View>

                    <View style={[styles.inputContainer, isFocado('email') && styles.inputFocused]}>
                        <Ionicons name="mail-outline" size={22} color={isFocado('email') ? theme.colors.primary : theme.colors.textLight} style={styles.inputIcon} />
                        <TextInput 
                            style={styles.inputComIcone} 
                            placeholder="E-mail" 
                            placeholderTextColor={theme.colors.textLight} 
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email} 
                            onChangeText={setEmail}
                            onFocus={() => setFocado('email')}
                            onBlur={() => setFocado(null)}
                            autoComplete="email"
                            textContentType="emailAddress"
                            selectionColor={theme.colors.primary}
                        />
                    </View>

                    <View style={[styles.inputContainer, isFocado('telefone') && styles.inputFocused]}>
                        <Ionicons name="call-outline" size={22} color={isFocado('telefone') ? theme.colors.primary : theme.colors.textLight} style={styles.inputIcon} />
                        <TextInputMask 
                            type={'cel-phone'} 
                            options={{ withDDD: true, dddMask: '(99) ' }} 
                            style={styles.inputComIcone} 
                            placeholderTextColor={theme.colors.textLight} 
                            placeholder="Telefone" 
                            keyboardType="numeric" 
                            value={telefone} 
                            onChangeText={setTelefone}
                            onFocus={() => setFocado('telefone')}
                            onBlur={() => setFocado(null)}
                            autoComplete="tel"
                            textContentType="telephoneNumber"
                            selectionColor={theme.colors.primary}
                        />
                    </View>

                    <View style={[styles.inputContainer, isFocado('senha') && styles.inputFocused]}>
                        <Ionicons name="lock-closed-outline" size={22} color={isFocado('senha') ? theme.colors.primary : theme.colors.textLight} style={styles.inputIcon} />
                        <TextInput 
                            style={styles.inputComIcone} 
                            placeholder="Senha" 
                            placeholderTextColor={theme.colors.textLight} 
                            secureTextEntry={!showSenha} 
                            onChangeText={setSenha} 
                            onFocus={() => setFocado('senha')}
                            onBlur={() => setFocado(null)}
                            value={senha}
                            autoComplete="new-password"
                            textContentType="newPassword"
                            selectionColor={theme.colors.primary}
                        />
                        <TouchableOpacity 
                            onPress={() => setShowSenha(!showSenha)} 
                            style={styles.eyeIcon} 
                            activeOpacity={0.7}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons name={showSenha ? "eye-off-outline" : "eye-outline"} size={22} color={isFocado('senha') ? theme.colors.primary : theme.colors.textLight} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.inputContainer, isFocado('confirmaSenha') && styles.inputFocused]}>
                        <Ionicons name="lock-closed-outline" size={22} color={isFocado('confirmaSenha') ? theme.colors.primary : theme.colors.textLight} style={styles.inputIcon} />
                        <TextInput 
                            style={styles.inputComIcone} 
                            placeholder="Confirmar Senha" 
                            placeholderTextColor={theme.colors.textLight} 
                            secureTextEntry={!showConfirmaSenha} 
                            onChangeText={setConfirmaSenha} 
                            onFocus={() => setFocado('confirmaSenha')}
                            onBlur={() => setFocado(null)}
                            value={confirmaSenha}
                            autoComplete="new-password"
                            textContentType="newPassword"
                            selectionColor={theme.colors.primary}
                        />
                        <TouchableOpacity 
                            onPress={() => setShowConfirmaSenha(!showConfirmaSenha)} 
                            style={styles.eyeIcon} 
                            activeOpacity={0.7}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons name={showConfirmaSenha ? "eye-off-outline" : "eye-outline"} size={22} color={isFocado('confirmaSenha') ? theme.colors.primary : theme.colors.textLight} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={22} color={theme.colors.primary} />
                        <Text style={styles.infoText}>
                            O endereço será configurado posteriormente no seu perfil.
                        </Text>
                    </View>
                    
                    <TouchableOpacity 
                        style={[styles.buttonSubmit, loading && styles.buttonDisabled]} 
                        onPress={handleCadastro} 
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.colors.surface} />
                        ) : (
                            <Text style={styles.buttonText}>CRIAR CONTA</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    flexOne: {
        flex: 1,
    },
    content: {
        paddingHorizontal: theme.spacing.lg + 4,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.xs,
        marginLeft: -12,
    },
    header: {
        marginBottom: theme.spacing.xl,
    },
    titulo: {
        fontSize: 32,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitulo: {
        fontSize: theme.typography.size.regular,
        color: theme.colors.textLight,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.lg,
        paddingHorizontal: theme.spacing.md,
        height: 56,
        marginBottom: theme.spacing.md,
    },
    inputFocused: {
        borderColor: theme.colors.primary,
        borderWidth: 1.5,
    },
    inputContainerMotorista: {
        borderColor: theme.colors.primary,
        backgroundColor: `${theme.colors.primary}05`,
    },
    inputIcon: {
        marginRight: theme.spacing.sm,
    },
    inputComIcone: {
        flex: 1,
        fontSize: 16,
        color: theme.colors.text,
        height: '100%',
    },
    eyeIcon: {
        padding: 8,
        marginRight: -4,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${theme.colors.primary}12`,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: `${theme.colors.primary}25`,
        gap: theme.spacing.md,
        marginTop: 8,
        marginBottom: theme.spacing.xl,
    },
    infoText: {
        flex: 1,
        fontSize: theme.typography.size.small,
        color: theme.colors.text,
        lineHeight: 20,
    },
    buttonSubmit: {
        height: 56,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: theme.colors.surface,
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});