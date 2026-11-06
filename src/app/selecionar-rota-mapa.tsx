import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '../config/api';
import { globalStyles } from '../styles/globalStyles';
import { theme } from '../styles/theme';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
MapboxGL.setAccessToken(MAPBOX_TOKEN);

export default function SelecionarRotaMapa() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef<MapboxGL.Camera>(null);
    const { turmaId, tipo } = useLocalSearchParams<{ turmaId: string; tipo: 'ORIGEM' | 'DESTINO' }>();

    const [loading, setLoading] = useState(true);
    const [initialLocation, setInitialLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [enderecoAtual, setEnderecoAtual] = useState('Buscando endereço...');
    const currentCoords = useRef<{ latitude: number; longitude: number } | null>(null);
    const [salvando, setSalvando] = useState(false);

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        (async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
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
                    setEnderecoAtual(`${resultado.street || 'Rua não identificada'}, ${resultado.streetNumber || 'S/N'}`);
                } else {
                    setEnderecoAtual('Arraste o mapa para ajustar');
                }
            } catch (error) {
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
                setEnderecoAtual(`${rua}, ${numero}`);
            } else {
                setEnderecoAtual('Localização selecionada no mapa');
            }
        } catch {
            setEnderecoAtual('Localização selecionada no mapa');
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

    const confirmarSelecao = async () => {
        if (!currentCoords.current) return Alert.alert('Atenção', 'Aguarde o mapa carregar.');

        setSalvando(true);
        try {
            const bodyData = tipo === 'ORIGEM' ? {
                origemNome: enderecoAtual,
                origemLatitude: currentCoords.current.latitude,
                origemLongitude: currentCoords.current.longitude
            } : {
                destinoNome: enderecoAtual,
                destinoLatitude: currentCoords.current.latitude,
                destinoLongitude: currentCoords.current.longitude
            };

            const response = await apiFetch(`/turmas/${turmaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                Alert.alert('Sucesso', `${tipo === 'ORIGEM' ? 'Origem' : 'Destino'} atualizado com sucesso!`);
                router.back();
            } else {
                const errorText = await response.text();

                let mensagem = errorText;

                try {
                    const dados = JSON.parse(errorText);
                    mensagem = dados.erro || dados.message || errorText;
                } catch {
                    
                }

                console.error('Erro ao atualizar turma:', {
                    status: response.status,
                    mensagem,
                    resposta: errorText,
                });

                Alert.alert('Erro ao salvar endereço', mensagem);
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

            <View style={[styles.headerOverlay, { paddingTop: insets.top + theme.spacing.xs }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerText}>
                    {tipo === 'ORIGEM' ? 'Selecione o local de Saída' : 'Selecione o Ponto Final'}
                </Text>
            </View>

            <View style={styles.mapContainer}>
                <MapboxGL.MapView
                    style={styles.flexOne}
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

                <View style={styles.centerPin}>
                    <Ionicons
                        name={tipo === 'ORIGEM' ? 'navigate' : 'flag'}
                        size={36}
                        color={tipo === 'ORIGEM' ? theme.colors.primary : theme.colors.danger}
                    />
                </View>
            </View>

            <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
                <Text style={styles.enderecoLabel}>
                    {tipo === 'ORIGEM' ? 'Saída Selecionada:' : 'Destino Selecionado:'}
                </Text>
                <Text style={styles.enderecoText}>{enderecoAtual}</Text>

                <TouchableOpacity
                    style={[styles.button, salvando && styles.buttonDisabled]}
                    onPress={confirmarSelecao}
                    disabled={salvando}
                    activeOpacity={0.85}
                >
                    {salvando ? (
                        <ActivityIndicator color={theme.colors.surface} />
                    ) : (
                        <Text style={styles.buttonText}>
                            Confirmar {tipo === 'ORIGEM' ? 'Saída' : 'Destino'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    flexOne: {
        flex: 1,
    },
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    backButton: {
        marginRight: theme.spacing.sm,
        padding: 4,
    },
    headerText: {
        fontSize: theme.typography.size.large,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
    },
    mapContainer: {
        flex: 1,
    },
    centerPin: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -18,
        marginTop: -36,
        pointerEvents: 'none',
        zIndex: 10,
    },
    footer: {
        backgroundColor: theme.colors.surface,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    enderecoLabel: {
        fontSize: theme.typography.size.small,
        color: theme.colors.textLight,
        fontWeight: '700',
        marginBottom: 2,
    },
    enderecoText: {
        fontSize: theme.typography.size.regular,
        fontWeight: theme.typography.weight.bold,
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
    },
    button: {
        height: 54,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: theme.colors.surface,
        fontWeight: theme.typography.weight.bold,
        fontSize: 16,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});