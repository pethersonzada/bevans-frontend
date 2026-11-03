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

    return (
        <View style={styles.container}>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                    style={[styles.input, focado === 'email' && styles.inputFocused]}
                    placeholder="seu@email.com"
                    placeholderTextColor={theme.colors.textLight}
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
                <Text style={styles.label}>Senha</Text>
                <TextInput
                    style={[styles.input, focado === 'senha' && styles.inputFocused]}
                    placeholder="••••••••"
                    placeholderTextColor={theme.colors.textLight}
                    secureTextEntry
                    selectionColor={theme.colors.primary}
                    value={senha}
                    onChangeText={setSenha}
                    onFocus={() => setFocado('senha')}
                    onBlur={() => setFocado(null)}
                    editable={!loading && !carregandoSenha}
                />
            </View>

            <TouchableOpacity
                style={styles.forgotPasswordContainer}
                onPress={onEsqueciSenha}
                disabled={carregandoSenha || loading}
                activeOpacity={0.6}
            >
                <Text style={styles.forgotPasswordText}>
                    {carregandoSenha ? "Enviando..." : "Esqueceu a senha?"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, (loading || carregandoSenha) && styles.buttonDisabled]}
                onPress={onLogin}
                disabled={loading || carregandoSenha}
                activeOpacity={0.85}
            >
                {loading ? <ActivityIndicator color={theme.colors.surface} /> : <Text style={styles.buttonText}>Entrar</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: theme.spacing.md,
    },
    label: {
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
    },
    input: {
        height: 48,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: theme.spacing.md,
        fontSize: theme.typography.size.regular,
        color: theme.colors.text,
    },
    inputFocused: {
        borderColor: theme.colors.primary,
        borderWidth: 1.5,
    },
    forgotPasswordContainer: {
        alignSelf: 'flex-end',
        marginBottom: theme.spacing.lg,
        marginTop: -theme.spacing.xs,
    },
    forgotPasswordText: {
        fontSize: theme.typography.size.small,
        color: theme.colors.primary,
        fontWeight: theme.typography.weight.bold,
    },
    button: {
        height: 50,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: theme.colors.surface,
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
    },
});