import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../styles/theme';

type Props = {
    email: string;
    setEmail: (v: string) => void;
    senha: string;
    setSenha: (v: string) => void;
    loading: boolean;
    onLogin: () => void;
    onEsqueciSenha: () => void;
    carregandoSenha: boolean;
};

export function FormLogin({ email, setEmail, senha, setSenha, loading, onLogin, onEsqueciSenha, carregandoSenha }: Props) {
    const [focado, setFocado] = useState<'email' | 'senha' | null>(null);
    const [mostrarSenha, setMostrarSenha] = useState(false);

    const isFocado = (campo: 'email' | 'senha') => focado === campo;

    return (
        <View style={styles.container}>
            <View style={styles.inputGroup}>
                <Text style={[styles.label, isFocado('email') && styles.labelFocused]}>E-mail</Text>
                <TextInput
                    style={[styles.input, isFocado('email') && styles.inputFocused]}
                    placeholder="seu@email.com"
                    placeholderTextColor={theme.colors.textLight + '80'}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    selectionColor={theme.colors.primary}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocado('email')}
                    onBlur={() => setFocado(null)}
                    editable={!loading && !carregandoSenha}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, isFocado('senha') && styles.labelFocused]}>Senha</Text>
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={[styles.input, styles.passwordInput, isFocado('senha') && styles.inputFocused]}
                        placeholder="••••••••"
                        placeholderTextColor={theme.colors.textLight + '80'}
                        secureTextEntry={!mostrarSenha}
                        selectionColor={theme.colors.primary}
                        value={senha}
                        onChangeText={setSenha}
                        onFocus={() => setFocado('senha')}
                        onBlur={() => setFocado(null)}
                        editable={!loading && !carregandoSenha}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setMostrarSenha((prev) => !prev)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons 
                            name={mostrarSenha ? "eye-off-outline" : "eye-outline"} 
                            size={22} 
                            color={isFocado('senha') ? theme.colors.primary : theme.colors.textLight} 
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                style={styles.forgotPasswordContainer}
                onPress={onEsqueciSenha}
                disabled={carregandoSenha || loading}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Text style={styles.forgotPasswordText}>
                    {carregandoSenha ? "Enviando..." : "Esqueceu a senha?"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, (loading || carregandoSenha) && styles.buttonDisabled]}
                accessibilityRole="button"
                accessibilityLabel={loading ? "Entrando" : "Entrar"}
                accessibilityState={{ busy: loading, disabled: loading || carregandoSenha }}
                onPress={onLogin}
                disabled={loading || carregandoSenha}
                activeOpacity={0.85}
            >
                {loading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator color={theme.colors.surface} size="small" /><Text style={styles.buttonText}>Entrando...</Text></View>
                ) : (
                    <Text style={styles.buttonText}>Entrar</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: theme.spacing.lg,
    },
    label: {
        fontSize: theme.typography.size.small,
        fontWeight: '700',
        color: theme.colors.textLight,
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    labelFocused: {
        color: theme.colors.primary,
    },
    input: {
        height: 52,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: theme.spacing.md,
        fontSize: theme.typography.size.regular,
        color: theme.colors.text,
    },
    passwordContainer: {
        position: 'relative',
        justifyContent: 'center',
    },
    passwordInput: {
        paddingRight: 50, // Espaço extra para o ícone não encavalar no texto
    },
    eyeIcon: {
        position: 'absolute',
        right: 14,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputFocused: {
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.surface,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 1,
    },
    forgotPasswordContainer: {
        alignSelf: 'flex-end',
        marginBottom: theme.spacing.xl,
        marginTop: -theme.spacing.sm,
    },
    forgotPasswordText: {
        fontSize: theme.typography.size.small,
        color: theme.colors.primary,
        fontWeight: '700',
    },
    button: {
        height: 54,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        color: theme.colors.surface,
        fontSize: theme.typography.size.regular,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});