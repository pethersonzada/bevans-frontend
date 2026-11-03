import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updateEmail } from 'firebase/auth';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '@/src/config/api';
import { auth } from '../../config/firebase';
import { globalStyles } from '../../styles/globalStyles';
import { theme } from '../../styles/theme';
import { useAuth } from '../context/AuthContext';

const WHATSAPP_URL = 'https://wa.me/5581991976404';
const PALAVRA_CONFIRMACAO = 'EXCLUIR';

export default function Perfil() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [modalDeletarVisivel, setModalDeletarVisivel] = useState(false);
    const [textoDigitado, setTextoDigitado] = useState('');
    const [excluindo, setExcluindo] = useState(false);
    const [erroExclusao, setErroExclusao] = useState('');

    const [modalEmailVisivel, setModalEmailVisivel] = useState(false);
    const [senhaAtual, setSenhaAtual] = useState('');
    const [novoEmail, setNovoEmail] = useState('');
    const [carregandoEmail, setCarregandoEmail] = useState(false);

    const [modalSenhaVisivel, setModalSenhaVisivel] = useState(false);
    const [carregandoSenha, setCarregandoSenha] = useState(false);

    const nome = user?.nome?.trim() || 'Usuário';
    const inicial = nome.charAt(0).toUpperCase();
    const confirmacaoOk = textoDigitado.trim().toUpperCase() === PALAVRA_CONFIRMACAO;

    const ehPassageiro = user?.tipo?.toUpperCase() === 'PASSAGEIRO' || user?.tipo?.toUpperCase() === 'ALUNO';

    const abrirWhatsApp = () => {
        Linking.openURL(WHATSAPP_URL).catch(() =>
            Alert.alert('Erro', 'Não foi possível iniciar o atendimento.')
        );
    };

    const sair = () => {
        Alert.alert('Encerrar sessão', 'Deseja realmente sair do aplicativo?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Sair',
                style: 'destructive',
                onPress: async () => {
                    await signOut();
                    router.replace('/login');
                },
            },
        ]);
    };

    const fecharModais = () => {
        if (excluindo || carregandoEmail || carregandoSenha) return;
        
        setModalDeletarVisivel(false);
        setTextoDigitado('');
        setErroExclusao('');

        setModalEmailVisivel(false);
        setSenhaAtual('');
        setNovoEmail('');

        setModalSenhaVisivel(false);
    };

    const handleAlterarEmail = async () => {
        if (!senhaAtual.trim() || !novoEmail.trim()) {
            Alert.alert('Atenção', 'Preencha sua senha atual e o novo e-mail.');
            return;
        }

        setCarregandoEmail(true);
        try {
            const userFirebase = auth.currentUser;
            if (!userFirebase || !userFirebase.email) throw new Error("Usuário não autenticado");

            const credential = EmailAuthProvider.credential(userFirebase.email, senhaAtual);
            await reauthenticateWithCredential(userFirebase, credential);
            await updateEmail(userFirebase, novoEmail.trim());

            const resposta = await apiFetch(`/usuarios/${user.id}/email`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'true' 
                },
                body: JSON.stringify({ email: novoEmail.trim() })
            });

            if (!resposta.ok) {
                const erroData = await resposta.json();
                throw new Error(erroData.erro || "Falha ao sincronizar com o banco de dados");
            }
            
            Alert.alert('Sucesso', 'Seu e-mail foi atualizado com segurança.');
            fecharModais();
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                Alert.alert('Erro', 'A senha atual informada está incorreta.');
            } else if (error.code === 'auth/email-already-in-use') {
                Alert.alert('Erro', 'Este e-mail já está em uso por outra conta.');
            } else {
                Alert.alert('Erro', error.message || 'Não foi possível alterar o e-mail.');
            }
        } finally {
            setCarregandoEmail(false);
        }
    };

    const handleRecuperarSenha = async () => {
        setCarregandoSenha(true);
        try {
            const userFirebase = auth.currentUser;
            if (!userFirebase || !userFirebase.email) {
                throw new Error("Nenhum usuário logado no momento.");
            }

            await sendPasswordResetEmail(auth, userFirebase.email);
            
            Alert.alert(
                'Link Enviado', 
                `Enviamos um link seguro de redefinição para o e-mail da sua conta (${userFirebase.email}). Verifique sua caixa de entrada.`
            );
            fecharModais();
        } catch (error: any) {
            console.error(error);
            Alert.alert('Erro', 'Ocorreu um erro ao enviar o link de recuperação.');
        } finally {
            setCarregandoSenha(false);
        }
    };

    const excluirConta = async () => {
        if (!confirmacaoOk || excluindo) return;

        setExcluindo(true);
        setErroExclusao('');
        try {
            const resposta = await apiFetch(`/usuarios/${user.id}`, { 
                method: 'DELETE',
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });
            if (!resposta.ok) throw new Error(`HTTP Erro: ${resposta.status}`);

            await signOut();
            fecharModais();
            router.replace('/login');
        } catch (error) {
            console.error(error);
            setErroExclusao('Serviço indisponível no momento. Tente novamente mais tarde.');
        } finally {
            setExcluindo(false);
        }
    };

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + theme.spacing.md }]}
            >
                <View style={styles.profileHeader}>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>{inicial}</Text>
                    </View>
                    <Text style={styles.nome} numberOfLines={1}>{nome}</Text>
                    {user?.tipo ? (
                        <View style={styles.badge}>
                            <Ionicons name="shield-checkmark" size={12} color={theme.colors.primary} />
                            <Text style={styles.badgeText}>{user.tipo}</Text>
                        </View>
                    ) : null}
                </View>

                {ehPassageiro && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>ENDEREÇOS</Text>
                        <View style={globalStyles.card}>
                            <Pressable style={styles.menuItem} onPress={() => router.push('/gerenciar-enderecos' as any)}>
                                <View style={styles.menuIconWrapper}>
                                    <Ionicons name="location-outline" size={20} color={theme.colors.text} />
                                </View>
                                <Text style={styles.menuText}>Gerenciar Endereços</Text>
                                <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
                            </Pressable>
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SEGURANÇA</Text>
                    <View style={globalStyles.card}>
                        <Pressable style={styles.menuItem} onPress={() => setModalEmailVisivel(true)}>
                            <View style={styles.menuIconWrapper}>
                                <Ionicons name="mail-outline" size={20} color={theme.colors.text} />
                            </View>
                            <Text style={styles.menuText}>Alterar E-mail</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
                        </Pressable>

                        <View style={styles.divider} />

                        <Pressable style={styles.menuItem} onPress={() => setModalSenhaVisivel(true)}>
                            <View style={styles.menuIconWrapper}>
                                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.text} />
                            </View>
                            <Text style={styles.menuText}>Alterar Senha</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
                        </Pressable>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SUPORTE</Text>
                    <View style={globalStyles.card}>
                        <Pressable style={styles.menuItem} onPress={abrirWhatsApp}>
                            <View style={styles.menuIconWrapper}>
                                <Ionicons name="headset-outline" size={20} color={theme.colors.text} />
                            </View>
                            <Text style={styles.menuText}>Central de Ajuda</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
                        </Pressable>
                    </View>
                </View>

                <View style={styles.actionContainer}>
                    <Pressable style={styles.botaoSair} onPress={sair}>
                        <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
                        <Text style={styles.textoBotaoSair}>Encerrar Sessão</Text>
                    </Pressable>

                    <Pressable style={styles.botaoDeletar} onPress={() => setModalDeletarVisivel(true)}>
                        <Ionicons name="trash-outline" size={20} color={theme.colors.surface} />
                        <Text style={styles.textoBotaoDeletar}>Excluir Minha Conta</Text>
                    </Pressable>
                </View>
            </ScrollView>

            <Modal animationType="fade" transparent visible={modalEmailVisivel} onRequestClose={fecharModais}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={globalStyles.card}>
                        <Text style={globalStyles.title}>Alterar E-mail</Text>
                        <Text style={styles.modalTexto}>
                            Por segurança, informe sua senha atual e o novo endereço de e-mail.
                        </Text>

                        <TextInput
                            style={globalStyles.input}
                            placeholder="Senha atual"
                            placeholderTextColor={theme.colors.textLight}
                            secureTextEntry
                            value={senhaAtual}
                            onChangeText={setSenhaAtual}
                            editable={!carregandoEmail}
                        />

                        <TextInput
                            style={globalStyles.input}
                            placeholder="Novo e-mail"
                            placeholderTextColor={theme.colors.textLight}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={novoEmail}
                            onChangeText={setNovoEmail}
                            editable={!carregandoEmail}
                        />

                        <View style={styles.modalBotoes}>
                            <Pressable style={[styles.botaoModal, styles.botaoCancelar]} onPress={fecharModais} disabled={carregandoEmail}>
                                <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
                            </Pressable>
                            <Pressable style={[styles.botaoModal, styles.botaoConfirmarPadrao]} onPress={handleAlterarEmail} disabled={carregandoEmail}>
                                {carregandoEmail ? <ActivityIndicator color={theme.colors.surface} /> : <Text style={styles.textoBotaoConfirmarPadrao}>Atualizar</Text>}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal animationType="fade" transparent visible={modalSenhaVisivel} onRequestClose={fecharModais}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={globalStyles.card}>
                        <Text style={globalStyles.title}>Redefinir Senha</Text>
                        <Text style={styles.modalTexto}>
                            Deseja receber um link de redefinição de senha no e-mail associado à sua conta atual?
                        </Text>

                        <View style={styles.modalBotoes}>
                            <Pressable style={[styles.botaoModal, styles.botaoCancelar]} onPress={fecharModais} disabled={carregandoSenha}>
                                <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
                            </Pressable>
                            <Pressable style={[styles.botaoModal, styles.botaoConfirmarPadrao]} onPress={handleRecuperarSenha} disabled={carregandoSenha}>
                                {carregandoSenha ? <ActivityIndicator color={theme.colors.surface} /> : <Text style={styles.textoBotaoConfirmarPadrao}>Enviar Link</Text>}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal animationType="fade" transparent visible={modalDeletarVisivel} onRequestClose={fecharModais}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={globalStyles.card}>
                        <View style={styles.modalIcon}>
                            <Ionicons name="alert-circle" size={40} color={theme.colors.danger} />
                        </View>
                        <Text style={globalStyles.title}>Aviso de Exclusão</Text>
                        <Text style={styles.modalTexto}>
                            Esta operação não pode ser desfeita. Digite <Text style={{ fontWeight: theme.typography.weight.bold, color: theme.colors.text }}>{PALAVRA_CONFIRMACAO}</Text> para prosseguir.
                        </Text>

                        <TextInput
                            style={[globalStyles.input, { textAlign: 'center', textTransform: 'uppercase' }]}
                            placeholder={PALAVRA_CONFIRMACAO}
                            placeholderTextColor={theme.colors.textLight}
                            value={textoDigitado}
                            onChangeText={(t) => {
                                setTextoDigitado(t);
                                if (erroExclusao) setErroExclusao('');
                            }}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            editable={!excluindo}
                        />
                        {erroExclusao ? <Text style={globalStyles.errorText}>{erroExclusao}</Text> : null}
                        
                        <View style={styles.modalBotoes}>
                            <Pressable style={[styles.botaoModal, styles.botaoCancelar]} onPress={fecharModais} disabled={excluindo}>
                                <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
                            </Pressable>
                            <Pressable style={[styles.botaoModal, styles.botaoConfirmarExclusao, (!confirmacaoOk || excluindo) && { opacity: 0.4 }]} onPress={excluirConta} disabled={!confirmacaoOk || excluindo}>
                                {excluindo ? <ActivityIndicator color={theme.colors.surface} /> : <Text style={styles.textoBotaoConfirmarExclusao}>Excluir</Text>}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingBottom: theme.spacing.xxl,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: theme.colors.primary,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.primary,
    },
    nome: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginTop: theme.spacing.md,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${theme.colors.primary}15`,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.pill,
        marginTop: theme.spacing.xs,
    },
    badgeText: {
        marginLeft: theme.spacing.xs,
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.primary,
    },
    section: {
        marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
        fontSize: theme.typography.size.small,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.textLight,
        marginBottom: theme.spacing.sm,
        marginLeft: theme.spacing.xs,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
    },
    menuIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: `${theme.colors.primary}10`,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.md,
    },
    menuText: {
        flex: 1,
        fontSize: theme.typography.size.regular,
        color: theme.colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical: theme.spacing.sm,
        marginLeft: 52,
    },
    actionContainer: {
        marginTop: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    botaoSair: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${theme.colors.danger}10`,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
    },
    textoBotaoSair: {
        marginLeft: theme.spacing.sm,
        color: theme.colors.danger,
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
    },
    botaoDeletar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.danger,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
    },
    textoBotaoDeletar: {
        marginLeft: theme.spacing.sm,
        color: theme.colors.surface,
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: theme.spacing.lg,
    },
    modalTexto: {
        fontSize: theme.typography.size.regular,
        color: theme.colors.textLight,
        textAlign: 'center',
        marginBottom: theme.spacing.lg,
    },
    modalIcon: {
        alignItems: 'center',
        marginBottom: theme.spacing.md,
    },
    modalBotoes: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: theme.spacing.md,
        gap: theme.spacing.md,
    },
    botaoModal: {
        flex: 1,
        height: 48,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    botaoCancelar: {
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    textoBotaoCancelar: {
        color: theme.colors.text,
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
    },
    botaoConfirmarPadrao: {
        backgroundColor: theme.colors.primary,
    },
    textoBotaoConfirmarPadrao: {
        color: theme.colors.surface,
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
    },
    botaoConfirmarExclusao: {
        backgroundColor: theme.colors.danger,
    },
    textoBotaoConfirmarExclusao: {
        color: theme.colors.surface,
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
    },
});