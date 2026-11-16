import { RemoteLoading, Screen, Section, Steps, Field, Choice, Notice, ActionButton, ui } from '../components/ui/Primitives';
import { listarTurmasMotorista } from '../services/turmas';
import { listarMinhasRotas } from '../services/rotasPublicas';
import type { Turma } from '../types/turma';
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
import { PedidosRota } from '../components/PedidosRota';
import { iniciarViagem } from '../services/viagens';
import { globalStyles as s } from '../styles/globalStyles';

const dias: [DiaRota,string][]=[['MONDAY','Seg'],['TUESDAY','Ter'],['WEDNESDAY','Qua'],['THURSDAY','Qui'],['FRIDAY','Sex'],['SATURDAY','Sáb'],['SUNDAY','Dom']];
type Escolha={tipo:'ORIGEM'|'DESTINO'|'PARADA';indice?:number};
const nova=(turmaId:number):RotaPublicaDados=>({turmaId,nome:'',cidade:'',categoria:'OUTROS',modo:'FIXA',origemNome:'',origemLatitude:NaN,origemLongitude:NaN,
    destinoNome:'',destinoLatitude:NaN,destinoLongitude:NaN,dias:['MONDAY'],horarioIda:'07:00',horarioVolta:null,descricao:null,regiao:null,campus:null});

export default function EditarRotaPublica() {
    const params=useLocalSearchParams<{id?:string;turmaId?:string}>();const router=useRouter();const {user,isLoading}=useAuth();const insets=useSafeAreaInsets();
    const [etapa,setEtapa]=useState('Dados');
    const [bases,setBases]=useState<Turma[]>([]),[baseErro,setBaseErro]=useState(''),[baseLoading,setBaseLoading]=useState(false),[baseRetry,setBaseRetry]=useState(0);
    useEffect(()=>{
        if(etapa!=='Capacidade'||params.id||!user.id||user.tipo!=='MOTORISTA')return;
        let active=true;setBaseLoading(true);setBaseErro('');
        Promise.all([listarTurmasMotorista(user.id),listarMinhasRotas()]).then(([turmas,rotas])=>{if(active)setBases(turmas.filter(t=>!rotas.some(r=>r.turmaId===t.id)));}).catch(e=>{if(active)setBaseErro(errorMessage(e));}).finally(()=>{if(active)setBaseLoading(false);});
        return()=>{active=false;};
    },[etapa,params.id,user.id,user.tipo,baseRetry]);
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
        if(!Number.isSafeInteger(dados.turmaId)||dados.turmaId<=0)throw new Error('Selecione a associação operacional na etapa Capacidade.');
        if(!dados.nome.trim()||!dados.cidade.trim()||!dados.dias.length)throw new Error('Informe nome, cidade e dias de operação.');
        for(const h of [dados.horarioIda,dados.horarioVolta])if(h && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(h))throw new Error('Use horários no formato HH:mm.');
        const r=await salvarRotaPublica(idRef.current,dados);if(!vigente())return;idRef.current=r.id;
        // Se a segunda escrita falhar, retry atualiza a rota criada, sem duplicar.
        const completa=await salvarParadasPublicas(r.id,paradas);
        if(!vigente())return;setSalva(completa);setDados(completa);setParadas(completa.paradas);setDirty(false);setSucesso('Rota e paradas salvas.');setEtapa('Publicação');
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
    const button=(label:string,onPress:()=>void,disabled=false)=><ActionButton key={label} title={label} onPress={onPress} disabled={disabled||busy} />;
    if(isLoading||!user.id||user.tipo!=='MOTORISTA')return <AsyncState loading={isLoading} message="Entre como motorista para editar rotas."/>;
    if(loading)return <RemoteLoading title="Carregando rota salva..."/>;
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
    return <Screen title={salva?'Gerenciar rota':'Criar rota pública'} subtitle="Um serviço de transporte com identidade própria." onBack={()=>router.back()}>
        <Steps steps={salva?['Dados','Trajeto','Horários','Capacidade','Publicação','Operação']:['Dados','Trajeto','Horários','Capacidade']} current={etapa} onChange={setEtapa}/>
        {!!erro&&<AsyncState message={erro}/>}
        {!!sucesso&&<Notice>{sucesso}</Notice>}
        {dirty&&<Text style={ui.caption}>Alterações ainda não salvas. A publicação usa os dados confirmados no servidor.</Text>}
        {busy&&<AsyncState loading title="Aguardando confirmação do servidor..."/>}
        <View style={{display:etapa==='Dados'?'flex':'none',gap:16}}><Section title="Identidade do serviço" description="Defina como os passageiros encontrarão sua rota.">
        <Text style={ui.body}>Nome</Text><TextInput accessibilityLabel="Nome da rota" style={ui.input} value={dados.nome} editable={!busy} onChangeText={nome=>alterar({nome})}/>
        <Text style={ui.body}>Cidade de operação</Text><TextInput accessibilityLabel="Cidade de operação" style={ui.input} value={dados.cidade} editable={!busy} onChangeText={cidade=>alterar({cidade})}/>
        </Section><Section title="Tipo de serviço">
        <Text style={ui.label}>Modo de operação</Text>{(['FIXA','FLEXIVEL'] as const).map(modo=><Choice key={modo} label={modo==='FIXA'?'Trajeto fixo':'Trajeto flexível'} description={modo==='FIXA'?'Embarques nas paradas cadastradas.':'Pontos solicitados pelos passageiros, sujeitos à autorização.'} selected={dados.modo===modo} disabled={busy} onPress={()=>alterar({modo})}/>)}
        <Text style={ui.label}>Categoria</Text>{(['ESCOLAR','UNIVERSITARIA','OUTROS'] as const).map(categoria=><Choice key={categoria} label={categoria==='ESCOLAR'?'Escolar':categoria==='UNIVERSITARIA'?'Universitária':'Outros'} selected={dados.categoria===categoria} disabled={busy} onPress={()=>alterar({categoria})}/>)}
        </Section><ActionButton title="Continuar para trajeto" variant="primary" onPress={()=>setEtapa('Trajeto')}/></View>
        <View style={{display:etapa==='Horários'?'flex':'none',gap:16}}><Section title="Dias e horários"><Text style={ui.body}>Dias de operação</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{dias.map(([d,label])=><TouchableOpacity key={d} accessibilityRole="checkbox" accessibilityState={{checked:dados.dias.includes(d),disabled:busy}} accessibilityLabel={label} style={{minHeight:48,padding:12}} disabled={busy}
            onPress={()=>alterar({dias:dados.dias.includes(d)?dados.dias.filter(v=>v!==d):[...dados.dias,d]})}><Text style={ui.body}>{dados.dias.includes(d)?'✓ ':''}{label}</Text></TouchableOpacity>)}</View>
        <Text style={ui.body}>Horário ida</Text><TextInput accessibilityLabel="Horário de ida" style={ui.input} value={dados.horarioIda??''} placeholder="HH:mm" editable={!busy} onChangeText={h=>alterar({horarioIda:h||null})}/>
        <Text style={ui.body}>Horário volta</Text><TextInput accessibilityLabel="Horário de volta" style={ui.input} value={dados.horarioVolta??''} placeholder="HH:mm" editable={!busy} onChangeText={h=>alterar({horarioVolta:h||null})}/>
        </Section><ActionButton title="Continuar para capacidade" variant="primary" onPress={()=>setEtapa('Capacidade')}/></View>
        <View style={{display:etapa==='Trajeto'?'flex':'none',gap:16}}><Section title="Origem e destino" description="Use pontos públicos. Nenhum endereço privado será copiado da turma."><Text style={ui.body}>Origem pública: {dados.origemNome||'Selecione no mapa'}</Text>{button('Definir origem',()=>mapa('ORIGEM'))}
        <Text style={ui.body}>Destino: {dados.destinoNome||'Selecione no mapa'}</Text>{button('Definir destino',()=>mapa('DESTINO'))}
        </Section><Section title="Paradas" description="Organize os pontos na ordem do percurso.">
        {paradas.map((p,i)=><View key={p.id??`nova-${i}`} style={ui.section}>
            <Text style={ui.body}>{i+1}.</Text><TextInput accessibilityLabel={`Nome da parada ${i+1}`} style={ui.input} editable={!busy} value={p.nome} onChangeText={nome=>alterarParadas(paradas.map((v,j)=>j===i?{...v,nome}:v))}/>
            <TextInput accessibilityLabel={`Horário da parada ${i+1}`} style={ui.input} editable={!busy} value={p.horario??''} placeholder="HH:mm (opcional)" onChangeText={horario=>alterarParadas(paradas.map((v,j)=>j===i?{...v,horario:horario||null}:v))}/>
            {button(`Reposicionar parada ${i+1}`,()=>mapa('PARADA',i))}
            {button(`Subir parada ${i+1}`,()=>mover(i,-1),i===0)}{button(`Descer parada ${i+1}`,()=>mover(i,1),i===paradas.length-1)}
            {button(`Remover parada ${i+1}`,()=>alterarParadas(paradas.filter((_,j)=>i!==j)))}
        </View>)}
        {button('Adicionar parada no mapa',()=>mapa('PARADA'),paradas.length>=50)}
        <Text style={ui.body}>Prévia da ordem dos pontos; as ligações não representam instruções de navegação.</Text>
        {etapa==='Trajeto'&&pontos.every(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude))&&<MapaPreviaPublica pontos={previa.length?previa:pontos}/>}
        </Section><ActionButton title="Continuar para horários" variant="primary" onPress={()=>setEtapa('Horários')}/></View>
        <View style={{display:etapa==='Capacidade'?'flex':'none',gap:16}}><Section title="Associação operacional" description="A API atual exige uma turma sua para capacidade, vínculos e execução. A rota tem nome, trajeto e publicação próprios. Não criaremos uma turma automaticamente.">
            {salva?<><Text style={ui.body}>{salva.vagas.ocupados} aprovados / {salva.vagas.capacidade??'capacidade não configurada'} assentos</Text>{button('Configurar capacidade',()=>router.push({pathname:'/editar-turma',params:{id:String(dados.turmaId)}}),dirty)}</>:baseLoading?<RemoteLoading/>:baseErro?<AsyncState message={baseErro} onRetry={()=>setBaseRetry(v=>v+1)}/>:<>
                {bases.map(t=><Choice key={t.id} label={t.nome||'Turma'} description={'Turno '+t.turno} selected={dados.turmaId===t.id} disabled={busy} onPress={()=>alterar({turmaId:t.id})}/>)}
                {!bases.length&&<Notice>Você precisa de uma turma operacional disponível, ainda sem rota pública associada. A criação independente depende de uma evolução da API. Gerencie suas turmas privadas na aba principal; seu rascunho permanece aqui enquanto esta tela estiver aberta.</Notice>}
            </>}
        </Section><ActionButton title="Salvar rota e paradas" variant="primary" busy={busy} onPress={()=>void salvar()}/></View>
        {salva&&<>
            <View style={{display:etapa==='Operação'?'flex':'none',gap:16}}><Section title="Operação e passageiros">{etapa==='Operação'&&<PedidosRota key={salva.id} rotaId={salva.id}/>}
            {(['IDA','VOLTA'] as const).map(sentido=>button(`Iniciar viagem ${sentido}`,()=>void executar(async(vigente)=>{await iniciarViagem(salva.turmaId,sentido);if(vigente())router.push({pathname:'/mapa',params:{turmaId:String(salva.turmaId),sentido:sentido.toLowerCase()}});}),dirty))}
            </Section></View><View style={{display:etapa==='Publicação'?'flex':'none',gap:16}}><Section title="Revisar e publicar" description="Salvar não publica sua rota. Revise o trajeto e a capacidade antes de disponibilizá-la.">
            <Text style={ui.body}>{salva.publicada?'Publicada':'Não publicada'}</Text>
            {button(salva.publicada?'Retirar publicação':'Publicar rota',()=>void executar(async(vigente)=>{const r=await publicarRota(salva.id,!salva.publicada);if(vigente()){setSalva(r);setSucesso(r.publicada?'Rota publicada.':'Publicação retirada.');}}),dirty)}
            {button(dados.modo==='FLEXIVEL'?'Otimizar prévia de ida':'Ver prévia de ida',()=>void executar(async(vigente)=>{const p=await planejarRotaPublica(salva.id,'IDA',dados.modo==='FLEXIVEL');if(vigente()){setPrevia(p);setEtapa('Trajeto');}}),dirty)}
            {button('Ver prévia de volta',()=>void executar(async(vigente)=>{const p=await planejarRotaPublica(salva.id,'VOLTA',dados.modo==='FLEXIVEL');if(vigente())setPrevia(p);}),dirty)}
            </Section></View>
        </>}
    </Screen>;
}
