import { RemoteLoading, Screen, Section, ActionButton as Button, Field, Choice, Pagination, ui } from './ui/Primitives';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TextInput, View, Switch } from 'react-native';
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
    return <Screen tabs title="Rotas públicas" subtitle="Encontre um serviço para o seu trajeto.">
        <Section title="Encontre sua rota">
        <Field label="Cidade" accessibilityLabel="Cidade de operação" placeholder="Cidade de operação" maxLength={160} value={draft.cidade} onChangeText={cidade=>setDraft({...draft,cidade})}/>
        <Field label="Destino" placeholder="Para onde você vai?" maxLength={160} value={draft.destino} onChangeText={destino=>setDraft({...draft,destino})}/>
        <View style={{gap:8}}>{['','ESCOLAR','UNIVERSITARIA','OUTROS'].map(categoria=><Choice key={categoria} selected={draft.categoria===categoria} label={categoria==='ESCOLAR'?'Escolar':categoria==='UNIVERSITARIA'?'Universitária':categoria==='OUTROS'?'Outros':'Todas as categorias'} onPress={()=>setDraft({...draft,categoria})}/>)}</View>
        <Text style={ui.body}>Somente favoritas</Text><Switch accessibilityLabel="Somente favoritas" value={draft.somenteFavoritas} onValueChange={somenteFavoritas=>setDraft({...draft,somenteFavoritas})}/>
        <Button variant="primary" icon="search-outline" title="Pesquisar" onPress={()=>{setPage(0);setFilters({...draft});setRetry(v=>v+1);}}/></Section>
        {error ? <AsyncState message={error} onRetry={()=>setRetry(v=>v+1)}/> : !data ? <RemoteLoading/> : <>
            {!data.itens.length && <AsyncState status="empty" title="Nenhuma rota encontrada"/>}
            {data.itens.map(r=><Section key={r.id} title={r.nome} description={r.cidade}>
                <Text style={ui.body}>{r.destino} · {r.modo==='FIXA'?'Trajeto fixo':'Trajeto flexível'}</Text>
                <Text style={ui.body}>{r.motoristaNome} · Ida {r.horarioIda||'não informada'} · Volta {r.horarioVolta||'não informada'}</Text>
                <Text style={ui.body}>{r.vagas.disponiveis ?? '—'} vagas disponíveis</Text>
                <Button title="Ver rota e solicitar vaga" onPress={()=>router.push({pathname:'/detalhe-rota',params:{id:String(r.id)}})}/>
                <Button title={busy===r.id?'Salvando…':r.favorita?'Remover dos favoritos':'Favoritar'} disabled={busy!==null} onPress={()=>void favorite(r)}/>
            </Section>)}

            <Pagination page={page} pages={data.totalPaginas} onChange={setPage}/>
        </>}
    </Screen>;
}
