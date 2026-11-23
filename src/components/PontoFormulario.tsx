import { useThemeRevision } from '../hooks/useThemeRevision';
import { useState } from 'react';
import { Text, View } from 'react-native';
import EnderecoMapaPicker from './EnderecoMapaPicker';
import { ActionButton, ui } from './ui/Primitives';
type Ponto = { nome: string; latitude: number; longitude: number };
export function PontoFormulario({ label, value, onChange, optional = false }: { label: string; value: Ponto | null; onChange: (value: Ponto | null) => void; optional?: boolean }) {
    useThemeRevision();
    const [editing, setEditing] = useState(false);
    if (optional && !value && !editing) return <ActionButton title={'Adicionar: ' + label + ' (opcional)'} icon="add" onPress={() => setEditing(true)} />;
    return <View style={{ gap: 8 }}>
        <Text style={ui.label}>{label}</Text>
        <Text style={ui.body}>{value?.nome || (optional ? 'Não configurado' : 'Selecione e confirme o ponto no mapa')}</Text>
        <ActionButton title={(value ? 'Alterar: ' : 'Definir: ') + label} icon="location-outline" onPress={() => setEditing(true)} />
        {editing && <>
            <EnderecoMapaPicker localizacaoInicial={value} onChange={point => { if (point) { onChange(point); setEditing(false); } }} />
            <ActionButton title="Fechar seleção do ponto" onPress={() => setEditing(false)} />
        </>}
        {optional && value && <ActionButton title={'Remover: ' + label} onPress={() => { onChange(null); setEditing(false); }} />}
    </View>;
}
