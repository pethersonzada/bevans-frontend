import { useThemeRevision } from '../hooks/useThemeRevision';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { dataLocal, lerDataLocal } from '../services/dataOperacao';
import { ActionButton, ui } from './ui/Primitives';

export function SeletorDataOperacao({ label, value, onChange, disabled = false }: {
    label: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
    useThemeRevision();
    const [aberto, setAberto] = useState(false);
    const data = value ? lerDataLocal(value) : new Date();
    return <View style={{ gap: 8 }}>
        <Text style={ui.label}>{label}</Text>
        <ActionButton title={value ? data.toLocaleDateString('pt-BR') : 'Escolher data'} accessibilityLabel={`Escolher ${label.toLowerCase()}`} disabled={disabled} icon="calendar-outline" onPress={() => setAberto(true)} />
        {aberto && <DateTimePicker mode="date" value={data} onChange={(event, selecionada) => {
            if (Platform.OS !== 'ios' || event.type !== 'set') setAberto(false);
            if (!disabled && event.type === 'set' && selecionada) onChange(dataLocal(selecionada));
        }} />}
        {aberto && Platform.OS === 'ios' && <ActionButton title="Concluir seleção" onPress={() => setAberto(false)} />}
    </View>;
}
