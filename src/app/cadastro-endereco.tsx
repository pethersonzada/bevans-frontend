import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '../config/api';
import { globalStyles } from '../styles/globalStyles';
import { theme } from '../styles/theme';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
MapboxGL.setAccessToken(MAPBOX_TOKEN);

export default function CadastroEndereco() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef<MapboxGL.Camera>(null);

    const [loading, setLoading] = useState(true);
    const [initialLocation, setInitialLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [enderecoCompleto, setEnderecoCompleto] = useState('Buscando seu endereço...');
    const currentCoords = useRef<{ latitude: number; longitude: number } | null>(null);

    const [modalVisivel, setModalVisivel] = useState(false);
    const [nomeLocal, setNomeLocal] = useState('');
    const [salvando, setSalvando] = useState(false);

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        (async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Aviso', 'Permissão de GPS negada.');
                    const fallback = { latitude: -8.2336, longitude: -35.7958 };
                    setInitialLocation(fallback);
                    currentCoords.current = fallback;
                    setLoading(false);
                    return;
                }

                let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
                const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };

                setInitialLocation(coords);
                currentCoords.current = coords;

                const [resultado] = await Location.reverseGeocodeAsync(coords);
                if (resultado) {
                    setEnderecoCompleto(`${resultado.street || 'Rua não identificada'}, ${resultado.streetNumber || 'S/N'}`);
                } else {
                    setEnderecoCompleto('Arraste o mapa para ajustar');
                }
            } catch (error) {
                Alert.alert('Erro de GPS', 'Não foi possível encontrar sua localização exata.');
                const fallback = { latitude: -8.2336, longitude: -35.7958 };
                setInitialLocation(fallback);
                currentCoords.current = fallback;
            } finally {
                setLoading(false);
            }
        })();

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const buscarEnderecoPorCoordenadas = async (lat: number, lng: number) => {
        currentCoords.current = { latitude: lat, longitude: lng };
        try {
            const [resultado] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (resultado) {
                const rua = resultado.street || resultado.name || 'Rua não identificada';
                const numero = resultado.streetNumber || 'S/N';
                setEnderecoCompleto(`${rua}, ${numero}`);
            } else {
                setEnderecoCompleto('Endereço selecionado no mapa');
            }
        } catch {
            setEnderecoCompleto('Endereço selecionado no mapa');
        }
    };

    const handleRegionDidChange = (feature: any) => {
        const coordinates = feature?.geometry?.coordinates;
        if (coordinates && coordinates.length === 2) {
            const lng = coordinates[0];
            const lat = coordinates[1];

            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            timeoutRef.current = setTimeout(() => {
                buscarEnderecoPorCoordenadas(lat, lng);
            }, 400);
        }
    };

    const abrirModalConfirmacao = () => {
        if (!currentCoords.current) return Alert.alert('Atenção', 'Aguarde o mapa carregar.');
        setNomeLocal('');
        setModalVisivel(true);
    };

    const salvarEndereco = async () => {
        if (!nomeLocal.trim()) {
            Alert.alert('Atenção', 'Você precisa dar um nome para este endereço.');
            return;
        }

        if (!currentCoords.current) {
            Alert.alert('Erro', 'As coordenadas do mapa não foram identificadas.');
            return;
        }

        setSalvando(true);
        try {
            const userId = await AsyncStorage.getItem('userId');

            if (!userId) {
                Alert.alert('Erro', 'Usuário não identificado. Faça login novamente.');
                setSalvando(false);
                return;
            }

            const payload = {
                apelido: nomeLocal.trim(),
                rua: enderecoCompleto,
                numero: 'S/N',
                bairro: 'Centro',
                latitude: currentCoords.current.latitude,
                longitude: currentCoords.current.longitude
            };

            const response = await apiFetch(`/enderecos/usuario/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                await AsyncStorage.setItem('userEndereco', enderecoCompleto);
                setModalVisivel(false);
                Alert.alert('Sucesso', 'Endereço cadastrado!');
                router.replace('/(tabs)/home');
            } else {
                const errorText = await response.text();
                Alert.alert('Erro', `Falha ao salvar no servidor (Status: ${response.status}). ${errorText}`);
            }
        } catch (e) {
            Alert.alert('Erro', 'Falha de conexão com o servidor.');
        } finally {
            setSalvando(false);
        }
    };

    if (loading || !initialLocation) {
        return (
            <View style={[globalStyles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <View style={globalStyles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <View style={[styles.headerOverlay, { paddingTop: insets.top + theme.spacing.sm }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerText}>Onde você embarca?</Text>
            </View>

            <View style={styles.mapContainer}>
                <MapboxGL.MapView
                    style={{ flex: 1 }}
                    styleURL={MapboxGL.StyleURL.Dark}
                    logoEnabled={false}
                    attributionEnabled={false}
                    compassEnabled={false}
                    onRegionIsChanging={handleRegionDidChange}
                >
                    <MapboxGL.Camera
                        ref={cameraRef}
                        zoomLevel={16}
                        centerCoordinate={[initialLocation.longitude, initialLocation.latitude]}
                    />
                </MapboxGL.MapView>

                <View style={styles.pinMarker}>
                    <Ionicons name="location" size={38} color={theme.colors.primary} />
                </View>
            </View>

            <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
                <Text style={styles.enderecoLabel}>Endereço selecionado:</Text>
                <Text style={styles.enderecoText}>{enderecoCompleto}</Text>
                
                <TouchableOpacity style={styles.button} onPress={abrirModalConfirmacao} activeOpacity={0.8}>
                    <Text style={styles.buttonText}>Confirmar Localização</Text>
                </TouchableOpacity>
            </View>

            <Modal animationType="fade" transparent visible={modalVisivel} onRequestClose={() => { if (!salvando) setModalVisivel(false); }}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconCircle}>
                                <Ionicons name="bookmark" size={22} color={theme.colors.primary} />
                            </View>
                            <Text style={styles.modalTitulo}>Salvar Endereço</Text>
                        </View>

                        <Text style={styles.modalTexto}>
                            Como você deseja chamar este local? (ex: Casa, Faculdade, Trabalho)
                        </Text>

                        <TextInput
                            style={styles.inputNome}
                            placeholder="Nome do local"
                            placeholderTextColor={theme.colors.textLight}
                            value={nomeLocal}
                            onChangeText={setNomeLocal}
                            autoCapitalize="words"
                            autoCorrect={false}
                            editable={!salvando}
                            maxLength={30}
                        />

                        <View style={styles.modalBotoes}>
                            <TouchableOpacity
                                style={[styles.botaoModal, styles.botaoCancelar]}
                                onPress={() => setModalVisivel(false)}
                                disabled={salvando}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.botaoModal, styles.botaoConfirmar, (!nomeLocal.trim() || salvando) && styles.botaoDisabled]}
                                onPress={salvarEndereco}
                                disabled={salvando || !nomeLocal.trim()}
                                activeOpacity={0.8}
                            >
                                {salvando ? (
                                    <ActivityIndicator color={theme.colors.surface} />
                                ) : (
                                    <Text style={styles.textoBotaoConfirmar}>Salvar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerOverlay: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.sm,
    },
    headerText: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    pinMarker: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -19,
        marginTop: -38,
        pointerEvents: 'none',
        zIndex: 10,
    },
    footer: {
        backgroundColor: theme.colors.surface,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        gap: theme.spacing.xs,
    },
    enderecoLabel: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        fontWeight: '600',
    },
    enderecoText: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
    },
    button: {
        height: 50,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
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
    modalContent: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    modalIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: `${theme.colors.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitulo: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    modalTexto: {
        fontSize: theme.typography.size.regular,
        color: theme.colors.textLight,
    },
    inputNome: {
        height: 48,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: theme.spacing.md,
        fontSize: theme.typography.size.regular,
        color: theme.colors.text,
    },
    modalBotoes: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        marginTop: theme.spacing.xs,
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
        fontWeight: theme.typography.weight.bold,
        fontSize: theme.typography.size.regular,
    },
    botaoConfirmar: {
        backgroundColor: theme.colors.primary,
    },
    botaoDisabled: {
        opacity: 0.5,
    },
    textoBotaoConfirmar: {
        color: theme.colors.surface,
        fontWeight: theme.typography.weight.bold,
        fontSize: theme.typography.size.regular,
    },
});