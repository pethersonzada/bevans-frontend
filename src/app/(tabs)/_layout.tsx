import { useThemeRevision } from '../../hooks/useThemeRevision';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';

export default function TabLayout() {
    useThemeRevision();
    const insets = useSafeAreaInsets();

    return (
        <Tabs backBehavior="history" screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.textLight,
            tabBarStyle: {
                backgroundColor: theme.colors.surface,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
                height: 60 + (insets.bottom > 0 ? insets.bottom : 10),
                paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
                paddingTop: 8,
            }
        }}>
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Rota Privada',
                    tabBarIcon: ({color, size}) => <MaterialCommunityIcons name="van-passenger" size={size} color={color} />
                }}
            />
            <Tabs.Screen name="rotas" options={{ title: 'Rota Pública', tabBarAccessibilityLabel: 'Rotas públicas',
                tabBarIcon: ({ color, size }) => <Ionicons name="bus" size={size} color={color} /> }} />
            <Tabs.Screen name="excursoes" options={{ title: 'Excursões',
                tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} /> }} />
            <Tabs.Screen
                name="perfil"
                options={{
                    title: 'Perfil',
                    tabBarIcon: ({color, size}) => <Ionicons name="person" size={size} color={color} />
                }}
            />
        </Tabs>
    );
}
