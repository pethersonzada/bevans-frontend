
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { theme } from '../styles/theme';

export type TipoMarcador =
  | 'origem'
  | 'destino'
  | 'passageiro'
  | 'endereco'
  | 'van';

const ICONES: Record<
  TipoMarcador,
  React.ComponentProps<typeof Ionicons>['name']
> = {
  origem: 'home',
  destino: 'flag',
  passageiro: 'person',
  endereco: 'location',
  van: 'bus',
};

type Props = {
  tipo: TipoMarcador;
  tamanho?: number;
};

export default function MapMarker({
  tipo,
  tamanho = 42,
}: Props) {
  return (
    <View
      collapsable={false}
      style={[
        styles.marcador,
        {
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          backgroundColor: theme.colors.marker[tipo],
        },
      ]}
    >
      <Ionicons
        name={ICONES[tipo]}
        size={Math.round(tamanho * 0.5)}
        color={theme.colors.map.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  marcador: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.map.text,
    elevation: 5,
    shadowColor: theme.colors.map.background,
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
});
