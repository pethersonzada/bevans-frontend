import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';

export default function TabLayout() {
    const insets = useSafeAreaInsets();
    
    return (
        <Tabs screenOptions={{ 
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
                    title: 'Início', 
                    tabBarIcon: ({color, size}) => <Ionicons name="home" size={size} color={color} /> 
                }} 
            />
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