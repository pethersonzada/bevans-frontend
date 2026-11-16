import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { Field, Notice, RemoteLoading } from '../ui/Primitives';
import { AsyncState } from '../AsyncState';
import EnderecoMapaPicker from '../EnderecoMapaPicker';
import { PedidosRota } from '../PedidosRota';
import { ActionButton, AtalhoViagem, BlocoViagem, CabecalhoViagem, DadoViagem, EscolhaEmbarque, PaginaViagem, ProgressoViagem, trip } from '../excursoes/ViagemUI';
import { nomeLocalExibicao, nomeLocalGenerico, resolverEnderecoExcursao } from '../../services/enderecoReversoExcursao';
import { listarTurmasMotorista } from '../../services/turmas';
import { buscarRotaPublica, listarMinhasRotas, planejarRotaPublica, publicarRota } from '../../services/rotasPublicas';
import { iniciarViagem } from '../../services/viagens';
import { estadoEdicaoRota, salvarPlanejamentoRota } from '../../services/edicaoRotaPublica';
import { dadosParaApi, diasRota, etapasRota, mesmaVersaoVisivel, mesmosDados, mesmasParadas, novoRascunhoRota, paradaLocal, paradasParaApi, pontosItinerario, rascunhoDaRota, reordenarParada, validarEtapaRota, type EtapaRota, type RascunhoRota } from '../../services/itinerarioRotaPublica';
import type { EnderecoEncontrado } from '../../services/enderecoSearch';
import type { PontoPublico, RotaPublica } from '../../types/rotaPublica';
import type { Turma } from '../../types/turma';
import { errorMessage } from '../../config/api';
import { theme } from '../../styles/theme';
import { MapaItinerario } from './MapaItinerario';
import { HoraRota } from './HoraRota';

type Escolha={tipo:'origem'|'destino'|'parada';chave?:string};
const categorias={ESCOLAR:'Escolar',UNIVERSITARIA:'Universitária',OUTROS:'Outros'} as const;
export function PlanejarRotaPublica({initial,turmaId,motoristaId,onExit}:{initial?:RotaPublica;turmaId?:number;motoristaId:string;onExit:()=>void}) {
    const router=useRouter(),network=useNetInfo();
    const [d,setD]=useState(()=>initial?rascunhoDaRota(initial):novoRascunhoRota(turmaId||null));
    const [etapa,setEtapa]=useState<EtapaRota>('Informações'),[vista,setVista]=useState<'planejar'|'gestao'>('planejar');
    const [mapa,setMapa]=useState<Escolha|null>(null),[candidato,setCandidato]=useState<EnderecoEncontrado|null>(null),[selecionado,setSelecionado]=useState<string|null>(null);
    const [erro,setErro]=useState(''),[mensagem,setMensagem]=useState(''),[busy,setBusy]=useState(false),[sair,setSair]=useState(false),[recarregar,setRecarregar]=useState(false);
    const [bases,setBases]=useState<Turma[]>([]),[baseErro,setBaseErro]=useState(''),[baseLoading,setBaseLoading]=useState(false),[retry,setRetry]=useState(0);
    const [previa,setPrevia]=useState<PontoPublico[]|null>(null),[confirmarPublicacao,setConfirmarPublicacao]=useState(false),[,render]=useState(0);
    const estado=useRef(estadoEdicaoRota(initial||null)),pending=useRef(false),mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    const salva=estado.current.salva;
    const dirty=salva?(()=>{try{return !mesmosDados(dadosParaApi(d),salva)||!mesmasParadas(paradasParaApi(d),salva.paradas);}catch{return true;}})():JSON.stringify(d)!==JSON.stringify(novoRascunhoRota(turmaId||null));
    const offline=network.isConnected===false||network.isInternetReachable===false;
    const aguardandoConfirmacao=!!estado.current.incerta||estado.current.parcial||estado.current.conferir;
    const leave=()=>{if(pending.current)return;if(dirty||aguardandoConfirmacao){setSair(true);return;}onExit();};
    useEffect(()=>{
        if(etapa!=='Revisão'||salva)return;
        let active=true;setBaseLoading(true);setBaseErro('');
        void Promise.all([listarTurmasMotorista(motoristaId),listarMinhasRotas()]).then(([turmas,rotas])=>{if(active)setBases(turmas.filter(t=>!rotas.some(r=>r.turmaId===t.id)));}).catch(e=>{if(active)setBaseErro(errorMessage(e));}).finally(()=>{if(active)setBaseLoading(false);});
        return()=>{active=false;};
    },[etapa,!!salva,motoristaId,retry]);
    function update(patch:Partial<RascunhoRota>) {if(pending.current)return;setD(v=>({...v,...patch}));setErro('');setMensagem('');setPrevia(null);setConfirmarPublicacao(false);}
    const back=()=>{
        if(pending.current)return;
        if(mapa){setMapa(null);setCandidato(null);return;}
        if(sair){setSair(false);return;}
        if(vista==='gestao'){setVista('planejar');return;}
        const index=etapasRota.indexOf(etapa);
        if(index>0){setEtapa(etapasRota[index-1]);setErro('');return;}
        leave();
    };
    useFocusEffect(useCallback(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{back();return true;});return()=>sub.remove();},[mapa,etapa,vista,dirty,sair,aguardandoConfirmacao]));
    async function execute(action:()=>Promise<void>) {
        if(pending.current)return;pending.current=true;setBusy(true);setErro('');setMensagem('');
        try{await action();}catch(e){if(mounted.current)setErro((e as {status?:number}).status===409?'A rota mudou ou há embarques/viagem que impedem esta alteração. Seu rascunho foi preservado. Confira a versão salva.':errorMessage(e));}
        finally{pending.current=false;if(mounted.current){setBusy(false);render(v=>v+1);}}
    }
    async function persist() {
        await execute(async()=>{
            const saved=await salvarPlanejamentoRota(estado.current,d,()=>mounted.current,()=>{if(mounted.current)render(v=>v+1);});
            if(!mounted.current)return;setD(rascunhoDaRota(saved));setMensagem('Rota e itinerário salvos. Publicar é uma ação separada.');setVista('gestao');setPrevia(null);
        });
    }
    const openMap=(tipo:Escolha['tipo'],chave?:string)=>{setVista('planejar');setEtapa(tipo==='parada'?'Paradas':'Endereços');setMapa({tipo,chave});setCandidato(null);};
    const usePoint=()=>{
        if(!mapa||!candidato||nomeLocalGenerico(candidato.nome))return;
        if(mapa.tipo==='origem')update({origemNome:candidato.nome,origemLatitude:candidato.latitude,origemLongitude:candidato.longitude});
        else if(mapa.tipo==='destino')update({destinoNome:candidato.nome,destinoLatitude:candidato.latitude,destinoLongitude:candidato.longitude});
        else if(mapa.chave)update({paradas:d.paradas.map(p=>p.chaveLocal===mapa.chave?{...p,nome:candidato.nome,latitude:candidato.latitude,longitude:candidato.longitude}:p)});
        else if(d.paradas.length<50)update({paradas:[...d.paradas,paradaLocal({id:null,nome:candidato.nome,latitude:candidato.latitude,longitude:candidato.longitude,horario:null})]});
        setMapa(null);setCandidato(null);
    };
    const points=pontosItinerario(d).map(p=>({...p,nome:nomeLocalExibicao(p.nome)}));
    const itinerary=<><MapaItinerario pontos={points} selecionado={selecionado} onSelect={key=>{setSelecionado(key);}}/><Text style={trip.caption}>Origem (O), paradas numeradas e destino (D). As linhas mostram a sequência, não navegação viária.</Text></>;
    const summary=<View style={trip.travelCard}><DadoViagem icon="business-outline" text={d.cidade||'Cidade pendente'}/><DadoViagem icon="school-outline" text={categorias[d.categoria]}/><DadoViagem icon="map-outline" text={d.modo==='FIXA'?'Trajeto fixo':'Trajeto flexível'}/><DadoViagem icon="calendar-outline" text={diasRota.filter(([v])=>d.dias.includes(v)).map(([,label])=>label).join(' · ')||'Dias pendentes'}/><DadoViagem icon="time-outline" text={`Ida: ${d.horarioIda||'não definida'} · Volta: ${d.horarioVolta||'não definida'}`}/></View>;
    const ordered=<View style={{gap:12}}>{points.map(p=><Pressable key={p.chave} accessibilityRole="button" accessibilityLabel={`Revisar ${p.papel==='parada'?`parada ${p.ordem}`:p.papel}`} onPress={()=>{setSelecionado(p.chave);if(p.papel==='parada'){setEtapa('Paradas');setVista('planejar');}else openMap(p.papel);}} style={[trip.shortcut,selecionado===p.chave&&{borderColor:theme.colors.primary,borderWidth:2}]}><View style={trip.dateBadge}><Text style={trip.label}>{p.papel==='origem'?'O':p.papel==='destino'?'D':p.ordem}</Text></View><Text style={[trip.label,{flex:1}]}>{p.nome}</Text><Ionicons name="chevron-forward" size={20} color={theme.colors.primary}/></Pressable>)}</View>;
    if(mapa){
        const current=mapa.tipo==='parada'?d.paradas.find(p=>p.chaveLocal===mapa.chave):mapa.tipo==='origem'?{nome:d.origemNome,latitude:d.origemLatitude,longitude:d.origemLongitude}:{nome:d.destinoNome,latitude:d.destinoLatitude,longitude:d.destinoLongitude};
        return <PaginaViagem title={mapa.tipo==='origem'?'Origem da rota':mapa.tipo==='destino'?'Destino da rota':'Ponto de parada'} onBack={back} footer={<><ActionButton title="Usar este ponto" variant="primary" disabled={!candidato||busy} onPress={usePoint}/><ActionButton title="Voltar ao planejamento" onPress={back}/></>}>
            <CabecalhoViagem title="Encontre o lugar" subtitle="Pesquise ou marque no mapa. Revise o endereço antes de confirmar."/>
            <View style={{minHeight:520,borderRadius:22,overflow:'hidden'}}><EnderecoMapaPicker localizacaoInicial={current} tipo={mapa.tipo==='parada'?'endereco':mapa.tipo} resolverEndereco={resolverEnderecoExcursao} onChange={setCandidato}/></View>
            {candidato&&<DadoViagem icon="location" text={candidato.nome}/>}
        </PaginaViagem>;
    }
    if(sair)return <PaginaViagem title="Seu planejamento" onBack={()=>setSair(false)}><CabecalhoViagem title="Há alterações não salvas" subtitle="O rascunho fica nesta tela enquanto você continua planejando."/><ActionButton title="Continuar planejando" variant="primary" onPress={()=>setSair(false)}/><ActionButton title="Sair e descartar rascunho" variant="danger" onPress={onExit}/></PaginaViagem>;
    const feedback=<>{offline&&<Notice>Sem conexão. Continue planejando; salvar e publicar exigem conexão.</Notice>}{!!erro&&<Notice>{erro}</Notice>}{!!mensagem&&<Notice>{mensagem}</Notice>}{busy&&<RemoteLoading title="Aguardando confirmação do servidor…"/>}{estado.current.parcial&&<Notice>Parte da rota foi salva. Seu rascunho foi preservado e a próxima tentativa usa a mesma rota.</Notice>}{estado.current.incerta&&<Notice>A resposta anterior não foi confirmada. A próxima tentativa fará uma consulta antes de qualquer nova gravação.</Notice>}{estado.current.conferir&&<Notice>A confirmação final do servidor está pendente. Salve novamente para conferir o resultado antes de publicar.</Notice>}</>;
    if(vista==='gestao'&&salva)return <PaginaViagem title="Sua rota pública" onBack={back}>
        <CabecalhoViagem title={salva.nome} subtitle={salva.publicada?'Rota publicada':'Salva · ainda não publicada'}/>{feedback}{dirty&&<Notice>Há alterações no seu planejamento. Salve antes de publicar, consultar prévias ou iniciar uma viagem.</Notice>}{summary}{itinerary}{ordered}
        <ActionButton title="Editar planejamento" icon="create-outline" onPress={()=>{setVista('planejar');setEtapa('Informações');}}/>
        <BlocoViagem title="Publicação"><Text style={trip.muted}>Salvar não publica. Se a rota já está publicada, salvar atualiza os dados desse serviço.</Text>
            {confirmarPublicacao&&<Notice>{salva.publicada?'Retirar esta rota do catálogo?':'Disponibilizar esta rota no catálogo para passageiros?'}</Notice>}
            <ActionButton title={confirmarPublicacao?(salva.publicada?'Confirmar retirada':'Confirmar publicação'):salva.publicada?'Retirar publicação':'Publicar rota'} disabled={busy||dirty||offline||!!estado.current.incerta||estado.current.parcial||estado.current.conferir} onPress={()=>{
                if(!confirmarPublicacao){setConfirmarPublicacao(true);return;}
                void execute(async()=>{const actual=await buscarRotaPublica(salva.id);if(!mesmaVersaoVisivel(actual,salva))throw Object.assign(new Error('A versão salva mudou.'),{status:409});const r=await publicarRota(salva.id,!salva.publicada);if(mounted.current){estado.current.salva=r;setD(rascunhoDaRota(r));setConfirmarPublicacao(false);setMensagem(r.publicada?'Rota publicada.':'Publicação retirada.');}});
            }}/>{confirmarPublicacao&&<ActionButton title="Cancelar publicação" disabled={busy} onPress={()=>setConfirmarPublicacao(false)}/>}
        </BlocoViagem>
        <BlocoViagem title="Trajeto salvo">{(['IDA','VOLTA'] as const).map(sentido=><ActionButton key={sentido} title={`${d.modo==='FLEXIVEL'?'Otimizar prévia':'Ver prévia'} de ${sentido==='IDA'?'ida':'volta'}`} disabled={busy||dirty||offline||aguardandoConfirmacao} onPress={()=>void execute(async()=>{const p=await planejarRotaPublica(salva.id,sentido,d.modo==='FLEXIVEL');if(mounted.current)setPrevia(p);})}/>)}
            {previa&&<><Text style={trip.caption}>Prévia do servidor. Não altera as paradas salvas.</Text><MapaItinerario pontos={previa.map((p,i)=>({...p,chave:`previa-${i}`,papel:i===0?'origem':i===previa.length-1?'destino':'parada',ordem:i}))} selecionado={null} onSelect={()=>{}}/></>}
        </BlocoViagem>
        <BlocoViagem title="Operação e passageiros"><PedidosRota rotaId={salva.id}/>{(['IDA','VOLTA'] as const).map(sentido=><ActionButton key={sentido} title={`Iniciar viagem ${sentido}`} disabled={busy||dirty||offline||aguardandoConfirmacao} onPress={()=>void execute(async()=>{await iniciarViagem(salva.turmaId,sentido);if(mounted.current)router.push({pathname:'/mapa',params:{turmaId:String(salva.turmaId),sentido:sentido.toLowerCase()}});})}/>)}</BlocoViagem>
        <ActionButton title="Configurar capacidade" disabled={busy||dirty||aguardandoConfirmacao} onPress={()=>router.push({pathname:'/editar-turma',params:{id:String(salva.turmaId)}})}/><ActionButton title="Voltar às rotas" disabled={busy} onPress={leave}/>
    </PaginaViagem>;
    const index=etapasRota.indexOf(etapa);
    const advance=()=>{try{validarEtapaRota(d,etapa);setEtapa(etapasRota[index+1]);setErro('');}catch(e){setErro(errorMessage(e));}};
    const pendencias=etapasRota.filter(s=>s!=='Revisão').flatMap(s=>{try{validarEtapaRota(d,s);return [];}catch(e){return [errorMessage(e)];}});
    return <PaginaViagem title={salva?'Editar rota pública':'Nova rota pública'} onBack={back} footer={<>
        {etapa==='Revisão'?<ActionButton title={salva?'Salvar alterações':'Salvar rota pública'} variant="primary" busy={busy} disabled={offline||baseLoading} onPress={()=>void persist()}/>:<ActionButton title="Continuar" icon="arrow-forward" variant="primary" disabled={busy} onPress={advance}/>}
        <ActionButton title={index?'Etapa anterior':'Voltar'} disabled={busy} onPress={back}/>
    </>}>
        <ProgressoViagem steps={etapasRota} current={index}/>{feedback}
        {dirty&&<Text accessibilityLiveRegion="polite" style={trip.caption}>Alterações ainda não salvas</Text>}
        {etapa==='Informações'&&<>
            <CabecalhoViagem eyebrow="Seu serviço de transporte" title="Qual rota vamos criar?" subtitle="Dê uma identidade à rota e escolha como ela funciona."/>
            <View style={trip.travelCard}><Field label="Nome da rota" accessibilityLabel="Nome da rota" value={d.nome} maxLength={120} onChangeText={nome=>update({nome})}/><Field label="Cidade de operação" accessibilityLabel="Cidade de operação" value={d.cidade} maxLength={120} onChangeText={cidade=>update({cidade})}/></View>
            <BlocoViagem title="Para quem é essa rota?">{(Object.keys(categorias) as (keyof typeof categorias)[]).map(categoria=><EscolhaEmbarque key={categoria} selected={d.categoria===categoria} icon={categoria==='ESCOLAR'?'school-outline':categoria==='UNIVERSITARIA'?'library-outline':'people-outline'} title={categorias[categoria]} description={categoria==='OUTROS'?'Transporte para diferentes necessidades.':categoria==='ESCOLAR'?'Transporte de estudantes.':'Deslocamentos para a universidade.'} onPress={()=>update({categoria})}/>)}</BlocoViagem>
            <BlocoViagem title="Como será o trajeto?"><EscolhaEmbarque selected={d.modo==='FIXA'} icon="map-outline" title="Trajeto fixo" description="Embarques nas paradas cadastradas." onPress={()=>update({modo:'FIXA'})}/><EscolhaEmbarque selected={d.modo==='FLEXIVEL'} icon="navigate-outline" title="Trajeto flexível" description="Pontos solicitados por passageiros, sujeitos à sua autorização." onPress={()=>update({modo:'FLEXIVEL'})}/></BlocoViagem>
            <BlocoViagem title="Mais sobre a rota (opcional)"><Field label="Descrição" value={d.descricao||''} multiline onChangeText={descricao=>update({descricao:descricao||null})}/><Field label="Região atendida" value={d.regiao||''} maxLength={255} onChangeText={regiao=>update({regiao:regiao||null})}/><Field label="Campus" value={d.campus||''} maxLength={255} onChangeText={campus=>update({campus:campus||null})}/></BlocoViagem>
        </>}
        {etapa==='Endereços'&&<><CabecalhoViagem title="De onde até onde?" subtitle="Escolha locais públicos e confira o endereço de cada pin."/>
            <AtalhoViagem title={nomeLocalGenerico(d.origemNome)?'Escolher origem':d.origemNome} detail="Origem · toque para revisar no mapa" icon="navigate-outline" onPress={()=>openMap('origem')}/><AtalhoViagem title={nomeLocalGenerico(d.destinoNome)?'Escolher destino':d.destinoNome} detail="Destino · toque para revisar no mapa" icon="flag-outline" onPress={()=>openMap('destino')}/>{itinerary}
        </>}
        {etapa==='Paradas'&&<><CabecalhoViagem title="Desenhe o itinerário" subtitle="Adicione os encontros e organize a sequência. Tudo fica no rascunho até salvar a rota."/>{itinerary}
            <AtalhoViagem title={nomeLocalExibicao(d.origemNome)} detail="Origem · revisar no mapa" icon="navigate-outline" onPress={()=>openMap('origem')}/>
            {d.paradas.map((p,i)=><View key={p.chaveLocal} style={[trip.travelCard,selecionado===p.chaveLocal&&{borderColor:theme.colors.primary,borderWidth:2}]}>
                <View style={trip.cardTop}><View style={trip.dateBadge}><Text style={trip.day}>{i+1}</Text></View><View style={{flex:1,gap:6}}><Text style={trip.label}>{nomeLocalExibicao(p.nome)}</Text><Text style={trip.caption}>{p.horario||'Horário opcional'}</Text></View></View>
                <ActionButton title={`Ajustar parada ${i+1}`} icon="create-outline" onPress={()=>setSelecionado(selecionado===p.chaveLocal?null:p.chaveLocal)}/>
                {selecionado===p.chaveLocal&&<><Field label="Nome da parada" accessibilityLabel={`Nome da parada ${i+1}`} value={nomeLocalGenerico(p.nome)?'':p.nome} maxLength={120} onChangeText={nome=>update({paradas:d.paradas.map(v=>v.chaveLocal===p.chaveLocal?{...v,nome}:v)})}/><HoraRota label={`Horário da parada ${i+1}`} value={p.horario} onChange={horario=>update({paradas:d.paradas.map(v=>v.chaveLocal===p.chaveLocal?{...v,horario}:v)})}/><ActionButton title={`Reposicionar parada ${i+1}`} icon="map-outline" onPress={()=>openMap('parada',p.chaveLocal)}/><ActionButton title={`Remover parada ${i+1}`} variant="danger" onPress={()=>{update({paradas:d.paradas.filter(v=>v.chaveLocal!==p.chaveLocal)});setSelecionado(null);}}/></>}
                <View style={{flexDirection:'row',gap:12}}><ActionButton title={`Subir parada ${i+1}`} disabled={i===0} onPress={()=>update({paradas:reordenarParada(d,p.chaveLocal,-1).paradas})}/><ActionButton title={`Descer parada ${i+1}`} disabled={i===d.paradas.length-1} onPress={()=>update({paradas:reordenarParada(d,p.chaveLocal,1).paradas})}/></View>
            </View>)}
            <ActionButton title="Adicionar parada no mapa" icon="add" disabled={d.paradas.length>=50} onPress={()=>openMap('parada')}/><Text style={trip.caption}>{d.paradas.length} de 50 paradas · nenhuma gravação individual</Text><AtalhoViagem title={nomeLocalExibicao(d.destinoNome)} detail="Destino · revisar no mapa" icon="flag-outline" onPress={()=>openMap('destino')}/>
        </>}
        {etapa==='Horários'&&<><CabecalhoViagem title="Quando a rota funciona?" subtitle="Escolha os dias e pelo menos um horário de ida ou volta."/>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{diasRota.map(([value,label])=><Pressable key={value} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked:d.dias.includes(value)}} onPress={()=>update({dias:d.dias.includes(value)?d.dias.filter(v=>v!==value):[...d.dias,value]})} style={[trip.dateBadge,{minHeight:56,borderWidth:2,borderColor:d.dias.includes(value)?theme.colors.primary:theme.colors.border}]}><Text style={trip.label}>{d.dias.includes(value)?'✓ ':''}{label}</Text></Pressable>)}</View>
            <HoraRota label="Horário de ida" value={d.horarioIda} onChange={horarioIda=>update({horarioIda})}/><HoraRota label="Horário de volta" value={d.horarioVolta} onChange={horarioVolta=>update({horarioVolta})}/>{summary}
        </>}
        {etapa==='Revisão'&&<><CabecalhoViagem title="Sua rota está tomando forma" subtitle="Revise o percurso e a operação antes de salvar."/><View style={trip.hero}><Text style={trip.heroEyebrow}>ROTA PÚBLICA</Text><Text style={trip.heroTitle}>{d.nome}</Text><Text style={trip.heroSubtitle}>{d.cidade}</Text></View>{summary}{itinerary}{ordered}
            {pendencias.map((p,i)=><Notice key={i}>{p}</Notice>)}
            <BlocoViagem title="Vagas e execução"><Text style={trip.muted}>Escolha a turma responsável pelas vagas, vínculos e execução desta rota. Cada turma pode ter uma rota pública; nada será criado automaticamente.</Text>
                {salva?<DadoViagem icon="people-outline" text={`Turma associada #${salva.turmaId} · ${salva.vagas.ocupados} aprovados / ${salva.vagas.capacidade??'capacidade não configurada'}`}/>:baseLoading?<RemoteLoading/>:baseErro?<AsyncState message={baseErro} onRetry={()=>setRetry(v=>v+1)}/>:<>{bases.map(t=><EscolhaEmbarque key={t.id} selected={d.turmaId===t.id} icon="people-outline" title={t.nome||'Turma'} description={`Turno ${t.turno}`} onPress={()=>update({turmaId:t.id})}/>)}{!bases.length&&<Notice>Nenhuma turma disponível sem rota pública. Cadastre ou revise suas turmas antes de salvar. Seu planejamento permanece nesta tela.</Notice>}</>}
                {!d.turmaId&&<Notice>Escolha a associação operacional para concluir o salvamento.</Notice>}
            </BlocoViagem>
            <Text style={trip.muted}>Salvar não publica uma nova rota. Uma rota já publicada mantém a publicação ao salvar alterações.</Text>
            {salva&&<ActionButton title="Abrir gestão da versão salva" disabled={busy} onPress={()=>setVista('gestao')}/>}
        </>}
        {salva&&<ActionButton title="Conferir versão do servidor" disabled={busy} onPress={()=>setRecarregar(true)}/>}
        {recarregar&&<View style={trip.travelCard}><Notice>Carregar a versão do servidor descarta este rascunho. Em caso de falha, suas alterações continuam aqui.</Notice><ActionButton title="Manter meu rascunho" disabled={busy} onPress={()=>setRecarregar(false)}/><ActionButton title="Descartar e carregar versão salva" variant="danger" disabled={busy} onPress={()=>void execute(async()=>{const actual=await buscarRotaPublica(salva!.id);if(mounted.current){estado.current=estadoEdicaoRota(actual);setD(rascunhoDaRota(actual));setRecarregar(false);setPrevia(null);setMensagem('Versão salva carregada.');}})}/></View>}
    </PaginaViagem>;
}
