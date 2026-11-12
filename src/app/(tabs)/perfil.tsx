import { useAppAlert } from '../../contexts/AppAlertContext';
import { AppModal as Modal } from '../../components/AppModal';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
    sendPasswordResetEmail,
} from 'firebase/auth';
import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    
    KeyboardAvoidingView,
    Linking,
    
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

import { errorMessage } from '../../config/api';
import { alterarEmailConta, excluirContaServidor, accountErrorMessage } from '../../services/conta';
import { FormFeedback } from '../../components/FormFeedback';
import { LogoutConfirmation } from '../../components/LogoutConfirmation';
import { auth } from '../../config/firebase';
import { globalStyles } from '../../styles/globalStyles';
import { theme } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';

const WHATSAPP_URL = 'https://wa.me/5581991976404';
const PALAVRA_CONFIRMACAO = 'EXCLUIR';

export default function Perfil() {
    const Alert = useAppAlert();
    const { user, signOut } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Modais
    const [modalDeletarVisivel, setModalDeletarVisivel] = useState(false);
    const [modalEmailVisivel, setModalEmailVisivel] = useState(false);
    const [modalSenhaVisivel, setModalSenhaVisivel] = useState(false);
    const [confirmarSaida, setConfirmarSaida] = useState(false);
    const cancelarSaida = useCallback(() => setConfirmarSaida(false), []);
    useFocusEffect(useCallback(() => cancelarSaida, [cancelarSaida]));

    // Estados dos Formularios
    const [textoDigitado, setTextoDigitado] = useState('');
    const [senhaAtual, setSenhaAtual] = useState('');
    const [novoEmail, setNovoEmail] = useState('');
    const [mostrarSenha, setMostrarSenha] = useState(false);

    // Estados de Carregamento
    const [excluindo, setExcluindo] = useState(false);
    const [erroExclusao, setErroExclusao] = useState('');
    const [carregandoEmail, setCarregandoEmail] = useState(false);
    const [carregandoSenha, setCarregandoSenha] = useState(false);
    const [erroEmail, setErroEmail] = useState<string | null>(null);
    const contaPendente = useRef(false);

    const nome = user?.nome?.trim() || 'Usuário';
    const inicial = nome.charAt(0).toUpperCase();
    const emailUsuario = auth.currentUser?.email || '';
    const confirmacaoOk = textoDigitado.trim().toUpperCase() === PALAVRA_CONFIRMACAO;
    const ehPassageiro = ['PASSAGEIRO', 'ALUNO'].includes(user?.tipo?.toUpperCase() || '');

    const abrirWhatsApp = async () => {
        try {
            const suportado = await Linking.canOpenURL(WHATSAPP_URL);
            if (suportado) {
                await Linking.openURL(WHATSAPP_URL);
            } else {
                Alert.alert('Erro', 'O WhatsApp não está instalado ou o link é inválido.');
            }
        } catch {
            Alert.alert('Erro', 'Não foi possível iniciar o atendimento.');
        }
    };

    const limparModais = () => {
        setErroEmail(null);

        setModalDeletarVisivel(false);
        setTextoDigitado('');
        setErroExclusao('');

        setModalEmailVisivel(false);
        setSenhaAtual('');
        setNovoEmail('');
        setMostrarSenha(false);

        setModalSenhaVisivel(false);
    };

    const fecharModais = () => {
        if (contaPendente.current || carregandoSenha) return;
        limparModais();
    };

    const sair = () => {
        if (!contaPendente.current) setConfirmarSaida(true);
    };

    const handleAlterarEmail = async () => {
        const emailFormatado = novoEmail.trim().toLowerCase();

        if (!senhaAtual.trim() || !emailFormatado) {
            Alert.alert('Atenção', 'Preencha sua senha atual e o novo e-mail.');
            return;
        }

        if (contaPendente.current) return;
        contaPendente.current = true;
        setErroEmail(null);
        setCarregandoEmail(true);
        try {
            if (!user.id) throw new Error('Entre novamente para alterar sua conta.');
            await alterarEmailConta(user.id, emailFormatado, senhaAtual);
            Alert.alert('Sucesso', 'Seu e-mail foi atualizado com sucesso.');
            limparModais();
        } catch (error) {
            setErroEmail(accountErrorMessage(error));
        } finally {
            contaPendente.current = false;
            setCarregandoEmail(false);
        }
    };

    const handleRecuperarSenha = async () => {
        if (contaPendente.current) return;
        contaPendente.current = true;
        setCarregandoSenha(true);
        try {
            const userFirebase = auth.currentUser;
            if (!userFirebase || !userFirebase.email) {
                throw new Error('Nenhum usuário autenticado no momento.');
            }

            await sendPasswordResetEmail(auth, userFirebase.email);

            Alert.alert(
                'Link Enviado',
                `Enviamos um link seguro de redefinição para ${userFirebase.email}. Verifique sua caixa de entrada e spam.`
            );
            limparModais();
        } catch (error: any) {
            console.error(error);
            Alert.alert('Erro', 'Ocorreu um erro ao enviar o link de recuperação de senha.');
        } finally {
            contaPendente.current = false;
            setCarregandoSenha(false);
        }
    };

    const excluirConta = async () => {
        if (!confirmacaoOk || contaPendente.current) return;
        contaPendente.current = true;

        setExcluindo(true);
        setErroExclusao('');
        try {
            const userFirebase = auth.currentUser;
            if (!userFirebase || !user?.id) {
                throw new Error('Usuário não identificado.');
            }

            await excluirContaServidor(user.id);
            await signOut();
            limparModais();
            router.replace('/login');
        } catch (error: any) {
            console.error(error);
            if (error?.code === 'auth/requires-recent-login') {
                setErroExclusao('Por motivos de segurança, faça login novamente antes de excluir sua conta.');
            } else {
                setErroExclusao(errorMessage(error));
            }
        } finally {
            contaPendente.current = false;
            setExcluindo(false);
        }
    };

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <ScrollView
                accessibilityElementsHidden={confirmarSaida}
                importantForAccessibility={confirmarSaida ? 'no-hide-descendants' : 'auto'}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl },
                ]}
            >
                {/* Header com Avatar */}
                <View style={styles.profileHeader}>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>{inicial}</Text>
                    </View>
                    <Text style={styles.nome} numberOfLines={1}>
                        {nome}
                    </Text>
                    {emailUsuario ? <Text style={styles.subtituloEmail}>{emailUsuario}</Text> : null}

                    {user?.tipo ? (
                        <View style={styles.badge}>
                            <Ionicons name="shield-checkmark" size={13} color={theme.colors.primary} />
                            <Text style={styles.badgeText}>{user.tipo}</Text>
                        </View>
                    ) : null}
                </View>

                {/* Seção Endereços */}
                {ehPassageiro && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>ENDEREÇOS</Text>
                        <View style={globalStyles.card}>
                            <Pressable
                                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                                onPress={() => router.push('/gerenciar-enderecos' as any)}
                            >
                                <View style={styles.menuIconWrapper}>
                                    <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
                                </View>
                                <Text style={styles.menuText}>Gerenciar Endereços</Text>
                                <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
                            </Pressable>
                        </View>
                    </View>
                )}

                {/* Seção Segurança */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SEGURANÇA</Text>
                    <View style={globalStyles.card}>
                        <Pressable
                            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                            onPress={() => setModalEmailVisivel(true)}
                        >
                            <View style={styles.menuIconWrapper}>
                                <Ionicons name="mail-outline" size={20} color={theme.colors.primary} />
                            </View>
                            <Text style={styles.menuText}>Alterar E-mail</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
                        </Pressable>

                        <View style={styles.divider} />

                        <Pressable
                            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                            onPress={() => setModalSenhaVisivel(true)}
                        >
                            <View style={styles.menuIconWrapper}>
                                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.primary} />
                            </View>
                            <Text style={styles.menuText}>Alterar Senha</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
                        </Pressable>
                    </View>
                </View>

                {/* Seção Suporte */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SUPORTE</Text>
                    <View style={globalStyles.card}>
                        <Pressable
                            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                            onPress={abrirWhatsApp}
                        >
                            <View style={styles.menuIconWrapper}>
                                <Ionicons name="headset-outline" size={20} color={theme.colors.primary} />
                            </View>
                            <Text style={styles.menuText}>Central de Ajuda</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
                        </Pressable>
                    </View>
                </View>

                {/* Botões de Ação */}
                <View style={styles.actionContainer}>
                    <Pressable
                        style={({ pressed }) => [styles.botaoSair, pressed && { opacity: 0.8 }]}
                        onPress={sair}
                    >
                        <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
                        <Text style={styles.textoBotaoSair}>Encerrar Sessão</Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [styles.botaoDeletar, pressed && { opacity: 0.85 }]}
                        onPress={() => setModalDeletarVisivel(true)}
                    >
                        <Ionicons name="trash-outline" size={20} color={theme.colors.surface} />
                        <Text style={styles.textoBotaoDeletar}>Excluir Minha Conta</Text>
                    </Pressable>
                </View>
            </ScrollView>

            {confirmarSaida && <LogoutConfirmation onConfirm={signOut} onCancel={cancelarSaida} />}

            {/* Modal Alterar Email */}
            <Modal animationType="fade" transparent visible={modalEmailVisivel} onRequestClose={fecharModais}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={[globalStyles.card, styles.modalContent]}>
                        <Text style={globalStyles.title}>Alterar E-mail</Text>
                        <FormFeedback message={erroEmail} />
                        <Text style={styles.modalTexto}>
                            Informe sua senha atual e o novo e-mail para realizar a atualização de segurança.
                        </Text>

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={[globalStyles.input, styles.inputComIcone]}
                                placeholder="Senha atual"
                                placeholderTextColor={theme.colors.textLight}
                                secureTextEntry={!mostrarSenha}
                                value={senhaAtual}
                                onChangeText={setSenhaAtual}
                                editable={!carregandoEmail}
                                autoCapitalize="none"
                            />
                            <Pressable
                                style={styles.iconeOlho}
                                onPress={() => setMostrarSenha((prev) => !prev)}
                            >
                                <Ionicons
                                    name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color={theme.colors.textLight}
                                />
                            </Pressable>
                        </View>

                        <TextInput
                            style={globalStyles.input}
                            placeholder="Novo e-mail"
                            placeholderTextColor={theme.colors.textLight}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={novoEmail}
                            onChangeText={setNovoEmail}
                            editable={!carregandoEmail}
                        />

                        <View style={styles.modalBotoes}>
                            <Pressable style={[styles.botaoModal, styles.botaoCancelar]} onPress={fecharModais} disabled={carregandoEmail}>
                                <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
                            </Pressable>
                            <Pressable style={[styles.botaoModal, styles.botaoConfirmarPadrao]} onPress={handleAlterarEmail} disabled={carregandoEmail}>
                                {carregandoEmail ? (
                                    <ActivityIndicator color={theme.colors.surface} />
                                ) : (
                                    <Text style={styles.textoBotaoConfirmarPadrao}>Atualizar</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal Redefinir Senha */}
            <Modal animationType="fade" transparent visible={modalSenhaVisivel} onRequestClose={fecharModais}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={[globalStyles.card, styles.modalContent]}>
                        <Text style={globalStyles.title}>Redefinir Senha</Text>
                        <Text style={styles.modalTexto}>
                            Deseja receber um link de redefinição de senha no seu e-mail cadastrado?
                        </Text>

                        <View style={styles.modalBotoes}>
                            <Pressable style={[styles.botaoModal, styles.botaoCancelar]} onPress={fecharModais} disabled={carregandoSenha}>
                                <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
                            </Pressable>
                            <Pressable style={[styles.botaoModal, styles.botaoConfirmarPadrao]} onPress={handleRecuperarSenha} disabled={carregandoSenha}>
                                {carregandoSenha ? (
                                    <ActivityIndicator color={theme.colors.surface} />
                                ) : (
                                    <Text style={styles.textoBotaoConfirmarPadrao}>Enviar Link</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal Excluir Conta */}
            <Modal animationType="fade" transparent visible={modalDeletarVisivel} onRequestClose={fecharModais}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={[globalStyles.card, styles.modalContent]}>
                        <View style={styles.modalIcon}>
                            <Ionicons name="alert-circle" size={44} color={theme.colors.danger} />
                        </View>
                        <Text style={globalStyles.title}>Aviso de Exclusão</Text>
                        <Text style={styles.modalTexto}>
                            Esta ação removerá permanentemente seus dados. Digite{' '}
                            <Text style={{ fontWeight: theme.typography.weight.bold, color: theme.colors.text }}>
                                {PALAVRA_CONFIRMACAO}
                            </Text>{' '}
                            para confirmar.
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
                        {erroExclusao ? <Text style={styles.textoErro}>{erroExclusao}</Text> : null}

                        <View style={styles.modalBotoes}>
                            <Pressable style={[styles.botaoModal, styles.botaoCancelar]} onPress={fecharModais} disabled={excluindo}>
                                <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.botaoModal,
                                    styles.botaoConfirmarExclusao,
                                    (!confirmacaoOk || excluindo) && { opacity: 0.4 },
                                ]}
                                onPress={excluirConta}
                                disabled={!confirmacaoOk || excluindo}
                            >
                                {excluindo ? (
                                    <ActivityIndicator color={theme.colors.surface} />
                                ) : (
                                    <Text style={styles.textoBotaoConfirmarExclusao}>Excluir</Text>
                                )}
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
        paddingHorizontal: theme.spacing.md,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    avatarContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: theme.colors.primary,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
    },
    avatarText: {
        fontSize: 38,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.primary,
    },
    nome: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginTop: theme.spacing.sm,
    },
    subtituloEmail: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        marginTop: 2,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${theme.colors.primary}15`,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.pill,
        marginTop: theme.spacing.xs,
    },
    badgeText: {
        marginLeft: 4,
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
        marginBottom: theme.spacing.xs,
        marginLeft: theme.spacing.xs,
        letterSpacing: 0.5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm + 2,
        borderRadius: theme.borderRadius.md,
    },
    menuItemPressed: {
        opacity: 0.7,
    },
    menuIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: `${theme.colors.primary}12`,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.md,
    },
    menuText: {
        flex: 1,
        fontSize: theme.typography.size.regular,
        color: theme.colors.text,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical: 2,
        marginLeft: 52,
    },
    actionContainer: {
        marginTop: theme.spacing.md,
        gap: theme.spacing.sm,
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
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'center',
        padding: theme.spacing.lg,
    },
    modalContent: {
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.lg,
    },
    modalTexto: {
        fontSize: theme.typography.size.regular,
        color: theme.colors.textLight,
        textAlign: 'center',
        marginBottom: theme.spacing.md,
        lineHeight: 20,
    },
    inputContainer: {
        position: 'relative',
        justifyContent: 'center',
    },
    inputComIcone: {
        paddingRight: 44,
    },
    iconeOlho: {
        position: 'absolute',
        right: 12,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textoErro: {
        color: theme.colors.danger,
        fontSize: theme.typography.size.small,
        textAlign: 'center',
        marginTop: theme.spacing.xs,
    },
    modalIcon: {
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
    },
    modalBotoes: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: theme.spacing.md,
        gap: theme.spacing.sm,
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
