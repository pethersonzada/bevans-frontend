import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import { useIsFocused } from 'expo-router/react-navigation';
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../styles/theme';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '');
type Coordinates = { latitude: number; longitude: number };
type Props = { centroMapa: Coordinates; minhaLocalizacao: Coordinates | null; posicaoVan: Coordinates | null };

export const MapaRadarPassageiro = memo(function MapaRadarPassageiro({ centroMapa, minhaLocalizacao, posicaoVan }: Props) {
    const focused = useIsFocused();
    const cameraRef = useRef<MapboxGL.Camera>(null);
    useEffect(() => {
        if (focused && posicaoVan) cameraRef.current?.setCamera({
            centerCoordinate: [posicaoVan.longitude, posicaoVan.latitude],
            zoomLevel: 16, animationDuration: 1000,
        });
    }, [focused, posicaoVan]);
    if (!focused) return null;
    return (
                                <MapboxGL.MapView
                                    style={styles.flexOne}
                                    styleURL={MapboxGL.StyleURL.Dark}
                                    logoEnabled={false}
                                    attributionEnabled={false}
                                    compassEnabled={false}
                                >
                                    <MapboxGL.Camera
                                        ref={cameraRef}
                                        zoomLevel={16}
                                        centerCoordinate={[centroMapa.longitude, centroMapa.latitude]}
                                    />
                                    {minhaLocalizacao && (
                                        <MapboxGL.PointAnnotation id="passageiro-local" coordinate={[minhaLocalizacao.longitude, minhaLocalizacao.latitude]}>
                                            <View style={styles.passageiroMarker}>
                                                <Ionicons name="person" size={14} color="#FFFFFF" />
                                            </View>
                                        </MapboxGL.PointAnnotation>
                                    )}
                                    {posicaoVan && (
                                        <MapboxGL.PointAnnotation id="van-passageiro" coordinate={[posicaoVan.longitude, posicaoVan.latitude]}>
                                            <View style={styles.vanMarker}>
                                                <Text style={styles.vanMarkerIcon}>🚐</Text>
                                            </View>
                                        </MapboxGL.PointAnnotation>
                                    )}
                                </MapboxGL.MapView>
    );
});
const styles = StyleSheet.create({
    flexOne: { flex: 1 },
    vanMarker: {
        backgroundColor: '#1E1E1E',
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 3,
        borderColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        elevation: 5,
    },
    vanMarkerIcon: {
        fontSize: 20,
    },
    passageiroMarker: {
        backgroundColor: theme.colors.primary,
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
