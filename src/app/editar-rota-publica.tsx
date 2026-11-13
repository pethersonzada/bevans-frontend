import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { AsyncState } from '../components/AsyncState';
import EnderecoMapaPicker from '../components/EnderecoMapaPicker';
import MapaPreviaPublica from '../components/MapaPreviaPublica';
import type { EnderecoEncontrado } from '../services/enderecoSearch';
import { buscarRotaPublica, salvarRotaPublica, salvarParadasPublicas, publicarRota, planejarRotaPublica } from '../services/rotasPublicas';
import type { RotaPublica, RotaPublicaDados, ParadaPublica, PontoPublico, DiaRota } from '../types/rotaPublica';
import { errorMessage } from '../config/api';
import { globalStyles as s } from '../styles/globalStyles';

const dias: [DiaRota,string][]=[['MONDAY','Seg'],['TUESDAY','Ter'],['WEDNESDAY','Qua'],['THURSDAY','Qui'],['FRIDAY','Sex'],['SATURDAY','Sáb'],['SUNDAY','Dom']];
type Escolha={tipo:'ORIGEM'|'DESTINO'|'PARADA';indice?:number};
const nova=(turmaId:number):RotaPublicaDados=>({turmaId,nome:'',cidade:'',categoria:'OUTROS',modo:'FIXA',origemNome:'',origemLatitude:NaN,origemLongitude:NaN,
    destinoNome:'',destinoLatitude:NaN,destinoLongitude:NaN,dias:['MONDAY'],horarioIda:'07:00',horarioVolta:null,descricao:null,regiao:null,campus:null});

export default function EditarRotaPublica() {
    const params=useLocalSearchParams<{id?:string;turmaId?:string}>();const router=useRouter();const {user,isLoading}=useAuth();const insets=useSafeAreaInsets();
    const [dados,setDados]=useState<RotaPublicaDados>(nova(Number(params.turmaId)));
    const [paradas,setParadas]=useState<ParadaPublica[]>([]),[salva,setSalva]=useState<RotaPublica|null>(null);
    const [escolha,setEscolha]=useState<Escolha|null>(null),[candidato,setCandidato]=useState<EnderecoEncontrado|null>(null);
    const [previa,setPrevia]=useState<PontoPublico[]>([]),[dirty,setDirty]=useState(false);
    const [loading,setLoading]=useState(!!params.id),[busy,setBusy]=useState(false),[erro,setErro]=useState(''),[sucesso,setSucesso]=useState(''),[tentativa,setTentativa]=useState(0);
    const idRef=useRef<number|null>(params.id?Number(params.id):null),operacao=useRef(false),montada=useRef(true);
    const contexto=user.id+':'+(params.id??'')+':'+(params.turmaId??'');
    const contextoAtual=useRef(contexto);contextoAtual.current=contexto;
    useEffect(()=>{montada.current=true;return()=>{montada.current=false;};},[]);
    useFocusEffect(useCallback(()=>{
        const alvo=params.id??(idRef.current==null?null:String(idRef.current));
        if(!alvo || isLoading || !user.id || user.tipo!=='MOTORISTA')return;
        let ativo=true;setLoading(true);setErro('');
        buscarRotaPublica(alvo).then(r=>{if(ativo){setDados(r);setParadas(r.paradas);setSalva(r);idRef.current=r.id;setDirty(false);}})
            .catch(e=>{if(ativo)setErro(errorMessage(e));}).finally(()=>{if(ativo)setLoading(false);});
        return()=>{ativo=false;};
    },[params.id,isLoading,user.id,user.tipo,tentativa]));
    function alterar(patch:Partial<RotaPublicaDados>){setDados(d=>({...d,...patch}));setDirty(true);setSucesso('');setPrevia([]);}
    function alterarParadas(p:ParadaPublica[]){setParadas(p);setDirty(true);setSucesso('');setPrevia([]);}
    function mapa(tipo:Escolha['tipo'],indice?:number){setCandidato(null);setEscolha({tipo,indice});}
    async function executar(fn:(vigente:()=>boolean)=>Promise<void>){
        if(operacao.current || isLoading || !user.id || user.tipo!=='MOTORISTA')return;
        const contextoPedido=contexto;const vigente=()=>montada.current&&contextoAtual.current===contextoPedido;
        operacao.current=true;setBusy(true);setErro('');setSucesso('');
        try{await fn(vigente);}catch(e){if(vigente())setErro(errorMessage(e));}finally{operacao.current=false;if(vigente())setBusy(false);}
    }
    async function salvar(){await executar(async(vigente)=>{
        if(!dados.nome.trim()||!dados.cidade.trim()||!dados.dias.length)throw new Error('Informe nome, cidade e dias de operação.');
        for(const h of [dados.horarioIda,dados.horarioVolta])if(h && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(h))throw new Error('Use horários no formato HH:mm.');
        const r=await salvarRotaPublica(idRef.current,dados);if(!vigente())return;idRef.current=r.id;
        // Se a segunda escrita falhar, retry atualiza a rota criada, sem duplicar.
        const completa=await salvarParadasPublicas(r.id,paradas);
        if(!vigente())return;setSalva(completa);setDados(completa);setParadas(completa.paradas);setDirty(false);setSucesso('Rota e paradas salvas.');
    });}
    function confirmarPonto(){
        if(!candidato||!escolha)return;
        if(escolha.tipo==='ORIGEM')alterar({origemNome:candidato.nome,origemLatitude:candidato.latitude,origemLongitude:candidato.longitude});
        else if(escolha.tipo==='DESTINO')alterar({destinoNome:candidato.nome,destinoLatitude:candidato.latitude,destinoLongitude:candidato.longitude});
        else {const p:ParadaPublica={id:escolha.indice==null?null:paradas[escolha.indice].id,nome:escolha.indice==null?candidato.nome:paradas[escolha.indice].nome,latitude:candidato.latitude,longitude:candidato.longitude,horario:escolha.indice==null?null:paradas[escolha.indice].horario};
            alterarParadas(escolha.indice==null?[...paradas,p]:paradas.map((v,i)=>i===escolha.indice?p:v));}
        setEscolha(null);setCandidato(null);
    }
    function mover(i:number,delta:number){const destino=i+delta;if(destino<0||destino>=paradas.length)return;const p=[...paradas];[p[i],p[destino]]=[p[destino],p[i]];alterarParadas(p);}
    const button=(label:string,onPress:()=>void,disabled=false)=><TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label} disabled={disabled||busy}
        style={[s.buttonPrimary,{opacity:disabled||busy?0.45:1}]} onPress={onPress}><Text style={s.buttonText}>{label}</Text></TouchableOpacity>;
    if(isLoading||!user.id||user.tipo!=='MOTORISTA')return <AsyncState loading={isLoading} message="Entre como motorista para editar rotas."/>;
    if(loading)return <AsyncState loading title="Carregando rota salva..."/>;
    if(params.id && !salva && erro)return <AsyncState message={erro} onRetry={()=>setTentativa(t=>t+1)}/>;
    if(escolha){
        const p=escolha.tipo==='ORIGEM'?{latitude:dados.origemLatitude,longitude:dados.origemLongitude}:escolha.tipo==='DESTINO'?{latitude:dados.destinoLatitude,longitude:dados.destinoLongitude}:escolha.indice==null?null:paradas[escolha.indice];
        return <View style={[s.container,{paddingTop:insets.top,paddingBottom:insets.bottom}]}>
            {button('Voltar sem alterar o ponto',()=>setEscolha(null))}
            <EnderecoMapaPicker tipo={escolha.tipo==='ORIGEM'?'origem':escolha.tipo==='DESTINO'?'destino':'endereco'} localizacaoInicial={p} onChange={setCandidato}/>
            {button('Confirmar ponto',confirmarPonto,!candidato)}
        </View>;
    }
    const pontos:PontoPublico[]=[{paradaId:null,nome:dados.origemNome,latitude:dados.origemLatitude,longitude:dados.origemLongitude},...paradas.map(p=>({...p,paradaId:p.id})),{paradaId:null,nome:dados.destinoNome,latitude:dados.destinoLatitude,longitude:dados.destinoLongitude}];
    return <ScrollView style={[s.container,{paddingTop:insets.top}]} contentContainerStyle={{paddingBottom:insets.bottom+40}} keyboardShouldPersistTaps="handled">
        {button('Voltar às Rotas Públicas',()=>router.back())}<Text style={s.title}>Editar rota urbana</Text>
        {!!erro&&<AsyncState message={erro}/>} {!!sucesso&&<Text accessibilityLiveRegion="polite">{sucesso}</Text>}
        {busy&&<AsyncState loading title="Aguardando confirmação do servidor..."/>}
        <Text>Nome</Text><TextInput accessibilityLabel="Nome da rota" style={s.input} value={dados.nome} editable={!busy} onChangeText={nome=>alterar({nome})}/>
        <Text>Cidade de operação</Text><TextInput accessibilityLabel="Cidade de operação" style={s.input} value={dados.cidade} editable={!busy} onChangeText={cidade=>alterar({cidade})}/>
        <Text>Modalidade: {dados.modo}</Text><View style={{flexDirection:'row',gap:12}}>{(['FIXA','FLEXIVEL'] as const).map(modo=><TouchableOpacity key={modo} accessibilityRole="button" style={{minHeight:48,padding:12}} disabled={busy} onPress={()=>alterar({modo})}><Text>{dados.modo===modo?'✓ ':''}{modo}</Text></TouchableOpacity>)}</View>
        <Text>Categoria</Text>{(['ESCOLAR','UNIVERSITARIA','OUTROS'] as const).map(categoria=>button((dados.categoria===categoria?'✓ ':'')+categoria,()=>alterar({categoria})))}
        <Text>Dias de operação</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{dias.map(([d,label])=><TouchableOpacity key={d} accessibilityRole="button" accessibilityLabel={label} style={{minHeight:48,padding:12}} disabled={busy}
            onPress={()=>alterar({dias:dados.dias.includes(d)?dados.dias.filter(v=>v!==d):[...dados.dias,d]})}><Text>{dados.dias.includes(d)?'✓ ':''}{label}</Text></TouchableOpacity>)}</View>
        <Text>Horário ida</Text><TextInput accessibilityLabel="Horário de ida" style={s.input} value={dados.horarioIda??''} placeholder="HH:mm" editable={!busy} onChangeText={h=>alterar({horarioIda:h||null})}/>
        <Text>Horário volta</Text><TextInput accessibilityLabel="Horário de volta" style={s.input} value={dados.horarioVolta??''} placeholder="HH:mm" editable={!busy} onChangeText={h=>alterar({horarioVolta:h||null})}/>
        <Text>Origem pública: {dados.origemNome||'Selecione no mapa'}</Text>{button('Definir origem',()=>mapa('ORIGEM'))}
        <Text>Destino: {dados.destinoNome||'Selecione no mapa'}</Text>{button('Definir destino',()=>mapa('DESTINO'))}
        <Text style={s.title}>Paradas na ordem do percurso</Text>
        {paradas.map((p,i)=><View key={p.id??`nova-${i}`} style={s.card}>
            <Text>{i+1}.</Text><TextInput accessibilityLabel={`Nome da parada ${i+1}`} style={s.input} editable={!busy} value={p.nome} onChangeText={nome=>alterarParadas(paradas.map((v,j)=>j===i?{...v,nome}:v))}/>
            <TextInput accessibilityLabel={`Horário da parada ${i+1}`} style={s.input} editable={!busy} value={p.horario??''} placeholder="HH:mm (opcional)" onChangeText={horario=>alterarParadas(paradas.map((v,j)=>j===i?{...v,horario:horario||null}:v))}/>
            {button(`Reposicionar parada ${i+1}`,()=>mapa('PARADA',i))}
            {button(`Subir parada ${i+1}`,()=>mover(i,-1),i===0)}{button(`Descer parada ${i+1}`,()=>mover(i,1),i===paradas.length-1)}
            {button(`Remover parada ${i+1}`,()=>alterarParadas(paradas.filter((_,j)=>i!==j)))}
        </View>)}
        {button('Adicionar parada no mapa',()=>mapa('PARADA'),paradas.length>=50)}
        <Text>Prévia da ordem dos pontos; as ligações não representam instruções de navegação.</Text>
        {pontos.every(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude))&&<MapaPreviaPublica pontos={previa.length?previa:pontos}/>}
        {button('Salvar rota e paradas',()=>void salvar())}
        {salva&&<>
            <Text>{salva.vagas.ocupados} aprovados / {salva.vagas.capacidade??'capacidade não configurada'} assentos · {salva.vagas.disponiveis??'—'} vagas</Text>
            {button('Editar assentos da turma',()=>router.push({pathname:'/editar-turma',params:{id:String(dados.turmaId)}}),dirty)}
            <Text>{salva.publicada?'Publicada':'Não publicada'}</Text>
            {button(salva.publicada?'Retirar publicação':'Publicar rota',()=>void executar(async(vigente)=>{const r=await publicarRota(salva.id,!salva.publicada);if(vigente()){setSalva(r);setSucesso(r.publicada?'Rota publicada.':'Publicação retirada.');}}),dirty)}
            {button(dados.modo==='FLEXIVEL'?'Otimizar prévia de ida':'Ver prévia de ida',()=>void executar(async(vigente)=>{const p=await planejarRotaPublica(salva.id,'IDA',dados.modo==='FLEXIVEL');if(vigente())setPrevia(p);}),dirty)}
            {button('Ver prévia de volta',()=>void executar(async(vigente)=>{const p=await planejarRotaPublica(salva.id,'VOLTA',dados.modo==='FLEXIVEL');if(vigente())setPrevia(p);}),dirty)}
        </>}
    </ScrollView>;
}
