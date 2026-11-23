import { themedStyles } from '../../styles/themedStyles';
import { useThemeRevision } from '../../hooks/useThemeRevision';
import type { ComponentProps, ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { theme } from '../../styles/theme';

type Icon = ComponentProps<typeof Ionicons>['name'];
export function ActionButton({ title, onPress, disabled = false, busy = false, variant = 'secondary', icon, accessibilityLabel }: {
    title: string; onPress: () => void; disabled?: boolean; busy?: boolean; variant?: 'primary' | 'secondary' | 'danger'; icon?: Icon; accessibilityLabel?: string;
}) {
    useThemeRevision();
    const blocked = disabled || busy, filled = variant === 'primary';
    const color = filled ? theme.colors.surface : variant === 'danger' ? theme.colors.danger : theme.colors.primary;
    return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} accessibilityState={{ disabled: blocked, busy }} disabled={blocked} onPress={onPress}
        style={({ pressed }) => [ui.button, filled && ui.primary, variant === 'danger' && ui.danger, { opacity: blocked ? 0.45 : pressed ? 0.75 : 1 }]}>
        {busy ? <ActivityIndicator color={color} /> : icon ? <Ionicons name={icon} size={20} color={color} /> : null}
        <Text style={[ui.buttonText, { color }]}>{title}</Text>
    </Pressable>;
}
export function Screen({ children, title, subtitle, onBack, action, tabs = false }: { children: ReactNode; title: string; subtitle?: string; onBack?: () => void; action?: ReactNode; tabs?: boolean }) {
    useThemeRevision();
    return <SafeAreaView edges={tabs ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']} style={ui.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
            <View style={ui.header}>
                {onBack && <IconButton icon="arrow-back" label="Voltar" onPress={onBack} />}
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}><Text accessibilityRole="header" style={ui.title}>{title}</Text>{subtitle && <Text style={ui.body}>{subtitle}</Text>}</View>
                {action}
            </View>
            {children}
        </ScrollView>
    </SafeAreaView>;
}
export function IconButton({ icon, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
    useThemeRevision();
    return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={ui.iconButton}><Ionicons name={icon} size={24} color={theme.colors.primary} /></Pressable>;
}
export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    useThemeRevision();
    return <View style={ui.section}><Text accessibilityRole="header" style={ui.sectionTitle}>{title}</Text>{description && <Text style={ui.body}>{description}</Text>}{children}</View>;
}
export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
    useThemeRevision();
    return <View style={{ gap: 6 }}><Text style={ui.label}>{label}</Text><TextInput {...props} accessibilityLabel={props.accessibilityLabel || label} placeholderTextColor={theme.colors.textLight} style={[ui.input, props.style]} />{hint && <Text style={ui.caption}>{hint}</Text>}</View>;
}
export function Choice({ label, description, selected, disabled, onPress }: { label: string; description?: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
    useThemeRevision();
    return <Pressable accessibilityRole="radio" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[ui.choice, selected && ui.selected, disabled && { opacity: 0.5 }]}>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={theme.colors.primary} />
        <View style={{ flex: 1, gap: 4 }}><Text style={ui.label}>{label}</Text>{description && <Text style={ui.caption}>{description}</Text>}</View>
    </Pressable>;
}
export function Steps({ steps, current, onChange }: { steps: readonly string[]; current: string; onChange: (value: string) => void }) {
    useThemeRevision();
    return <View style={ui.steps}>{steps.map((step, index) => <Pressable key={step} accessibilityRole="tab" accessibilityState={{ selected: current === step }} onPress={() => onChange(step)} style={[ui.step, current === step && ui.selected]}>
        <Text style={[ui.caption, current === step && { color: theme.colors.primary, fontWeight: '700' }]}>{index + 1}. {step}</Text>
    </Pressable>)}</View>;
}
export function MenuRow({ title, description, icon, onPress }: { title: string; description?: string; icon: Icon; onPress: () => void }) {
    useThemeRevision();
    return <Pressable accessibilityRole="button" onPress={onPress} style={ui.menuRow}><Ionicons name={icon} size={22} color={theme.colors.primary} /><View style={{ flex: 1, gap: 4 }}><Text style={ui.label}>{title}</Text>{description && <Text style={ui.caption}>{description}</Text>}</View><Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} /></Pressable>;
}
export function Notice({ children }: { children: ReactNode }) {
    useThemeRevision(); return <View style={ui.notice}><Text accessibilityLiveRegion="polite" style={ui.body}>{children}</Text></View>; }
// Use only for remote reads; local actions and writes keep their own progress.
export function RemoteLoading({ title = 'Carregando informações' }: { title?: string }) {
    useThemeRevision();
    const network = useNetInfo();
    if (network.isConnected === false || network.isInternetReachable === false) return <Notice>Sem conexão. Reconecte para carregar estas informações.</Notice>;
    return <View style={{ padding: 24, gap: 12, alignItems: 'center' }}><ActivityIndicator color={theme.colors.primary} accessibilityLabel={title} /><Text style={ui.body}>{title}</Text></View>;
}
export function Pagination({ page, pages, onChange, disabled = false }: { page: number; pages: number; onChange: (value: number) => void; disabled?: boolean }) {
    useThemeRevision();
    if (pages <= 1) return null;
    return <View style={{ gap: 8 }}><Text style={ui.caption}>Página {page + 1} de {pages}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flexGrow: 1 }}><ActionButton title="Anterior" disabled={disabled || page <= 0} onPress={() => onChange(page - 1)} /></View>
        <View style={{ flexGrow: 1 }}><ActionButton title="Próxima" disabled={disabled || page + 1 >= pages} onPress={() => onChange(page + 1)} /></View>
    </View></View>;
}
export const ui = themedStyles(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: 20, gap: 20, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 32 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { fontSize: 26, fontWeight: '700', color: theme.colors.primary },
    sectionTitle: { fontSize: 19, fontWeight: '700', color: theme.colors.primary },
    body: { fontSize: 15, lineHeight: 23, color: theme.colors.text },
    caption: { fontSize: 13, lineHeight: 20, color: theme.colors.textLight },
    label: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
    section: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 20, gap: 16, borderWidth: 1, borderColor: theme.colors.border },
    input: { minHeight: 52, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 14, color: theme.colors.text, fontSize: 16, backgroundColor: theme.colors.surface },
    button: { minHeight: 50, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
    primary: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    danger: { borderColor: theme.colors.danger },
    buttonText: { fontSize: 15, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
    iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: theme.colors.surface },
    choice: { minHeight: 52, padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
    selected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.subtle },
    steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    step: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
    menuRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    notice: { backgroundColor: theme.colors.subtle, borderRadius: 8, padding: 16, borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
}));
