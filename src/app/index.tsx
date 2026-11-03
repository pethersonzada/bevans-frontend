import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { globalStyles } from '../styles/globalStyles';
import { theme } from '../styles/theme';
import { useAuth } from './context/AuthContext';

export default function Index() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={[globalStyles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    if (user?.id) {
        return <Redirect href="/(tabs)/home" />;
    }

    return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});