import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../styles/theme';

export function FormFeedback({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <View style={styles.container} accessibilityLiveRegion="assertive">
            <Text accessibilityRole="alert" style={styles.text}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: theme.colors.surface, borderLeftWidth: 3, borderLeftColor: theme.colors.danger,
        padding: theme.spacing.md, marginVertical: theme.spacing.sm },
    text: { color: theme.colors.text, fontSize: theme.typography.size.regular },
});
