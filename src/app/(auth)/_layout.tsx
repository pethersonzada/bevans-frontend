import { useThemeRevision } from '../../hooks/useThemeRevision';
import { Stack } from 'expo-router';

export default function PublicAuthLayout() {
    useThemeRevision();
    return <Stack screenOptions={{ headerShown: false }} />;
}
