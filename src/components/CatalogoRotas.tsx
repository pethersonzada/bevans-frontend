import { useThemeRevision } from '../hooks/useThemeRevision';
import { RemoteLoading, Screen, Section, ActionButton as Button, Field, Choice, Pagination, Notice, ui } from './ui/Primitives';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View, Switch } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useFocusedPolling } from '../hooks/useFocusedPolling';
import { consultarCatalogo, alterarFavorito, type FiltrosCatalogo, type Pagina, type ResumoRota } from '../services/catalogo';
import { errorMessage } from '../config/api';
import { AsyncState } from './AsyncState';
import { filtrosIniciais as initial, lerFiltrosCatalogo, normalizarFiltrosCatalogo, salvarFiltrosCatalogo } from '../services/preferenciasCatalogo';

export function CatalogoRotas() {
    useThemeRevision();
    const { user } = useAuth(); const router = useRouter();
    const [draft, setDraft] = useState(initial), [filters, setFilters] = useState(initial);
    const [page, setPage] = useState(0), [retry, setRetry] = useState(0);
    const [result, setResult] = useState<{key:string; data:Pagina<ResumoRota>} | null>(null);
    const [error, setError] = useState(''), [busy, setBusy] = useState<number | null>(null); const pending = useRef(false);
    const [restored, setRestored] = useState<string | null>(null), [storageError, setStorageError] = useState('');
    const account = user.id;
    const mounted = useRef(true), owner = useRef(account); owner.current = account;
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    const current = () => mounted.current && owner.current === account;
    useEffect(() => {
        let active = true;
        setStorageError('');
        if (!account) return;
        void lerFiltrosCatalogo(account).then(saved => {
            if (active && current()) { setDraft(saved); setFilters(saved); setPage(0); setRestored(account); }
        }).catch(() => {
            if (active && current()) {
                setDraft({ ...initial }); setFilters({ ...initial }); setPage(0); setRestored(account);
                setStorageError('Não foi possível recuperar sua última pesquisa. Você pode pesquisar novamente.');
            }
        });
        return () => { active = false; };
    }, [account]);
    const ready = !!account && restored === account;
    const apply = (next: FiltrosCatalogo) => {
        if (!ready || !account || !current()) return;
        const value = normalizarFiltrosCatalogo(next);
        setDraft(value); setFilters(value); setPage(0); setRetry(v => v + 1); setStorageError('');
        void salvarFiltrosCatalogo(account, value).catch(() => {
            if (current()) setStorageError('Sua pesquisa foi aplicada, mas não foi salva neste aparelho. Pesquise novamente para tentar salvar.');
        });
    };
    const key = JSON.stringify([user.id, filters, page, retry]);
    useFocusedPolling(async signal => {
        setError('');
        try { const data = await consultarCatalogo(filters, page, signal); if (!signal.aborted) setResult({key,data}); }
        catch (e) { if (!signal.aborted) { setResult(null); setError(errorMessage(e)); } }
    }, 60000, ready ? key : false);
    const data = result?.key === key ? result.data : null;
    const favorite = async (r: ResumoRota) => {
        if (pending.current || !user.id || !current()) return; pending.current = true; setBusy(r.id);
        try { await alterarFavorito(r.id, !r.favorita); if(current())setRetry(v=>v+1); }
        catch(e) { if(current())setError(errorMessage(e)); } finally { pending.current=false; if(current())setBusy(null); }
    };
    return <Screen tabs title="Rotas públicas" subtitle="Encontre um serviço para o seu trajeto.">
        {!!storageError && <Notice>{storageError}</Notice>}
        {!ready ? <RemoteLoading title="Recuperando sua pesquisa" /> : <><Section title="Encontre sua rota">
        <Field label="Cidade" accessibilityLabel="Cidade de operação" placeholder="Cidade de operação" maxLength={160} value={draft.cidade} onChangeText={cidade=>setDraft({...draft,cidade})}/>
        <Field label="Destino" placeholder="Para onde você vai?" maxLength={160} value={draft.destino} onChangeText={destino=>setDraft({...draft,destino})}/>
        <View style={{gap:8}}>{['','ESCOLAR','UNIVERSITARIA','OUTROS'].map(categoria=><Choice key={categoria} selected={draft.categoria===categoria} label={categoria==='ESCOLAR'?'Escolar':categoria==='UNIVERSITARIA'?'Universitária':categoria==='OUTROS'?'Outros':'Todas as categorias'} onPress={()=>setDraft({...draft,categoria})}/>)}</View>
        <Text style={ui.body}>Somente favoritas</Text><Switch accessibilityLabel="Somente favoritas" value={draft.somenteFavoritas} onValueChange={somenteFavoritas=>setDraft({...draft,somenteFavoritas})}/>
        <Button variant="primary" icon="search-outline" title="Pesquisar" onPress={()=>apply(draft)}/>
        <Button title="Limpar filtros" onPress={()=>apply(initial)}/></Section>
        {error ? <AsyncState message={error} onRetry={()=>setRetry(v=>v+1)}/> : !data ? <RemoteLoading/> : <>
            {!data.itens.length && <AsyncState status="empty" title="Nenhuma rota encontrada"/>}
            {data.itens.map(r=><Section key={r.id} title={r.nome} description={r.cidade}>
                <Text style={ui.body}>{r.destino} · {r.modo==='FIXA'?'Trajeto fixo':'Trajeto flexível'}</Text>
                <Text style={ui.body}>{r.motoristaNome} · Ida {r.horarioIda||'não informada'} · Volta {r.horarioVolta||'não informada'}</Text>
                <Text style={ui.body}>{r.vagas.disponiveis ?? '—'} vagas disponíveis</Text>
                <Button title="Ver rota e solicitar vaga" accessibilityLabel={`Ver rota ${r.nome} e solicitar vaga`} onPress={()=>router.push({pathname:'/detalhe-rota',params:{id:String(r.id)}})}/>
                <Button title={busy===r.id?'Salvando…':r.favorita?'Remover dos favoritos':'Favoritar'} accessibilityLabel={`${r.favorita?'Remover dos favoritos':'Favoritar'} ${r.nome}`} disabled={busy!==null} onPress={()=>void favorite(r)}/>
            </Section>)}

            <Pagination page={page} pages={data.totalPaginas} onChange={setPage}/>
        </>}
        </>}
    </Screen>;
}
