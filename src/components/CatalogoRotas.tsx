import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TextInput, Button, View, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useFocusedPolling } from '../hooks/useFocusedPolling';
import { consultarCatalogo, alterarFavorito, type FiltrosCatalogo, type Pagina, type ResumoRota } from '../services/catalogo';
import { errorMessage } from '../config/api';
import { AsyncState } from './AsyncState';
import { globalStyles as s } from '../styles/globalStyles';

const initial: FiltrosCatalogo = { cidade: '', destino: '', categoria: '', somenteFavoritas: false };
export function CatalogoRotas() {
    const { user } = useAuth(); const router = useRouter();
    const [draft, setDraft] = useState(initial), [filters, setFilters] = useState(initial);
    const [page, setPage] = useState(0), [retry, setRetry] = useState(0);
    const [result, setResult] = useState<{key:string; data:Pagina<ResumoRota>} | null>(null);
    const [error, setError] = useState(''), [busy, setBusy] = useState<number | null>(null); const pending = useRef(false);
    const key = JSON.stringify([user.id, filters, page, retry]);
    useFocusedPolling(async signal => {
        setError('');
        try { const data = await consultarCatalogo(filters, page, signal); if (!signal.aborted) setResult({key,data}); }
        catch (e) { if (!signal.aborted) { setResult(null); setError(errorMessage(e)); } }
    }, 60000, user.id ? key : false);
    const data = result?.key === key ? result.data : null;
    const favorite = async (r: ResumoRota) => {
        if (pending.current) return; pending.current = true; setBusy(r.id);
        try { await alterarFavorito(r.id, !r.favorita); setRetry(v=>v+1); }
        catch(e) { setError(errorMessage(e)); } finally { pending.current=false; setBusy(null); }
    };
    return <SafeAreaView edges={['top','left','right']} style={{flex:1}}><ScrollView contentContainerStyle={{padding:16,gap:12}} keyboardShouldPersistTaps="handled">
        <Text style={s.title} accessibilityRole="header">Rotas públicas</Text>
        <TextInput accessibilityLabel="Cidade de operação" placeholder="Cidade de operação" style={s.input} maxLength={160} value={draft.cidade} onChangeText={cidade=>setDraft({...draft,cidade})}/>
        <TextInput accessibilityLabel="Destino" placeholder="Destino" style={s.input} maxLength={160} value={draft.destino} onChangeText={destino=>setDraft({...draft,destino})}/>
        <View style={{gap:8}}>{['','ESCOLAR','UNIVERSITARIA','OUTROS'].map(categoria=><Button key={categoria} title={`${draft.categoria===categoria?'✓ ':''}${categoria||'Todas as categorias'}`} onPress={()=>setDraft({...draft,categoria})}/>)}</View>
        <Text>Somente favoritas</Text><Switch accessibilityLabel="Somente favoritas" value={draft.somenteFavoritas} onValueChange={somenteFavoritas=>setDraft({...draft,somenteFavoritas})}/>
        <Button title="Pesquisar" onPress={()=>{setPage(0);setFilters({...draft});setRetry(v=>v+1);}}/>
        {error ? <AsyncState message={error} onRetry={()=>setRetry(v=>v+1)}/> : !data ? <AsyncState loading/> : <>
            {!data.itens.length && <AsyncState status="empty" title="Nenhuma rota encontrada"/>}
            {data.itens.map(r=><View key={r.id} style={s.card}>
                <Text accessibilityRole="header">{r.nome} · {r.cidade}</Text><Text>{r.destino} · {r.modo}</Text>
                <Text>{r.motoristaNome} · Ida {r.horarioIda||'não informada'} · Volta {r.horarioVolta||'não informada'}</Text>
                <Text>{r.vagas.disponiveis ?? '—'} vagas disponíveis</Text>
                <Button title="Ver rota e solicitar vaga" onPress={()=>router.push({pathname:'/detalhe-rota',params:{id:String(r.id)}})}/>
                <Button title={busy===r.id?'Salvando…':r.favorita?'Remover dos favoritos':'Favoritar'} disabled={busy!==null} onPress={()=>void favorite(r)}/>
            </View>)}
            <Text>Página {page+1} de {Math.max(1,data.totalPaginas)}</Text>
            <Button title="Anterior" disabled={page===0} onPress={()=>setPage(v=>v-1)}/>
            <Button title="Próxima" disabled={page+1>=data.totalPaginas} onPress={()=>setPage(v=>v+1)}/>
        </>}
    </ScrollView></SafeAreaView>;
}
