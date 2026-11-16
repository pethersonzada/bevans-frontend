import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text,Switch,View } from 'react-native';
import { RemoteLoading, Screen, Section, Field, Notice, ActionButton, ui } from '../components/ui/Primitives';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRemoteResource } from '../hooks/useRemoteResource';
import { consultarContatoComercial,salvarContatoComercial,type ContatoComercial } from '../services/contatoMotorista';
import { useAuth } from '../contexts/AuthContext';
import { AsyncState } from '../components/AsyncState';
import { errorMessage } from '../config/api';
export default function ContatoComercialScreen() {
    const { user } = useAuth();
    return <TelaContato key={user.id} motorista={user.tipo === 'MOTORISTA'} />;
}
export function TelaContato({ motorista }: { motorista: boolean }) {
    const router = useRouter(), [salvo, setSalvo] = useState(false);
    const { data, error, reload } = useRemoteResource(motorista ? 'contato-comercial' : false, consultarContatoComercial);
    return <Screen title="Contato comercial" subtitle="Um canal de atendimento para seus passageiros." onBack={() => router.back()}>
        {salvo && <Notice>Contato comercial salvo.</Notice>}
        {!motorista ? <AsyncState message="Disponível para motoristas." /> : error ? <AsyncState message={error} onRetry={reload} /> : !data ? <RemoteLoading/> : <Formulario key={data.versao} data={data} onSaved={() => { setSalvo(true); reload(); }} onEditing={() => setSalvo(false)} />}
    </Screen>;
}
export function Formulario({data,onSaved,onEditing}:{data:ContatoComercial;onSaved:()=>void;onEditing:()=>void}){const [telefone,setTelefone]=useState(data.telefone||''),[habilitado,setHabilitado]=useState(data.habilitado),[aceite,setAceite]=useState(false),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
    const pending=useRef(false),mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    const salvar=async()=>{
        if(pending.current||(habilitado&&!aceite))return;
        pending.current=true;setBusy(true);setFeedback('');onEditing();
        try{await salvarContatoComercial({telefone,habilitado,aceiteDivulgacao:aceite,versao:data.versao});if(mounted.current)onSaved();}
        catch(e){if(mounted.current)setFeedback(errorMessage(e));}
        finally{pending.current=false;if(mounted.current)setBusy(false);}
    };
    return <><Notice>Seu telefone pessoal não é utilizado automaticamente. Apenas passageiros autorizados podem consultar o número comercial quando você permitir.</Notice>
        <Section title="Número de atendimento"><Field label="Telefone comercial" hint="Inclua o DDI 55 e o DDD." accessibilityLabel="Telefone comercial com DDI 55" value={telefone} editable={!busy} onChangeText={v=>{onEditing();setTelefone(v);}} keyboardType="phone-pad" autoComplete="tel"/>
            <View style={{flexDirection:'row',alignItems:'center',gap:16}}><Text style={[ui.label,{flex:1}]}>Disponibilizar contato</Text><Switch disabled={busy} value={habilitado} onValueChange={v=>{onEditing();setHabilitado(v);}} accessibilityLabel="Habilitar contato comercial"/></View>
        </Section>
        <Section title="Sua autorização"><Text style={ui.body}>Autorizo divulgar este número comercial aos passageiros autorizados.</Text><Switch disabled={busy} value={aceite} onValueChange={setAceite} accessibilityLabel="Aceite de divulgação comercial"/>
            <ActionButton variant="primary" title="Salvar contato" busy={busy} disabled={habilitado&&!aceite} onPress={()=>void salvar()}/>
            {!!feedback&&<Text accessibilityLiveRegion="polite" style={ui.body}>{feedback}</Text>}
        </Section></>;}
