import { useThemeRevision } from '../../hooks/useThemeRevision';
import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { openBrowserAsync } from 'expo-web-browser';
import { auth } from '../../config/firebase';
import { validarConvitePassageiro } from '../../services/convitePassageiro';
import { validarPaginaConvite } from '../../services/paginaConvite';
import { FormFeedback } from '../FormFeedback';
import { ActionButton, Field, Notice, Section } from '../ui/Primitives';
import { trip } from './ViagemUI';

export function AcessoPassageiro() {
    useThemeRevision();
    const [link,setLink]=useState(''),[erro,setErro]=useState(''),[busy,setBusy]=useState(false),[retorno,setRetorno]=useState(false);
    const lock=useRef(false),mounted=useRef(true),owner=useRef(auth.currentUser),network=useNetInfo();
    const offline=network.isConnected===false||network.isInternetReachable===false;
    const base=process.env.EXPO_PUBLIC_CONVITE_WEB_URL;
    let configurado=true;
    try {validarPaginaConvite(base);} catch {configurado=false;}
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    async function abrir() {
        if(lock.current||offline||!configurado)return;
        setErro('');setRetorno(false);
        let seguro:string;
        try {seguro=validarConvitePassageiro(link,base);} catch(e) {setErro(e instanceof Error?e.message:'Confira o convite.');return;}
        if(!owner.current||auth.currentUser!==owner.current){setErro('Sua sessão mudou. Entre novamente.');return;}
        lock.current=true;setBusy(true);
        try {
            await openBrowserAsync(seguro);
            if(mounted.current&&auth.currentUser===owner.current){setLink('');setRetorno(true);}
        } catch {
            // Native failures can include the sensitive URL. Do not render or log them.
            if(mounted.current&&auth.currentUser===owner.current)setErro('Não foi possível abrir o convite. Tente novamente.');
        } finally {lock.current=false;if(mounted.current)setBusy(false);}
    }
    return <>
        <Section title="Recebeu um convite?" description="Abra a página oficial para consultar destino, datas e disponibilidade e realizar sua inscrição conforme as regras do organizador.">
            <Field label="Link do convite" value={link} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="Cole o link enviado pelo organizador" onChangeText={value=>{setLink(value);setErro('');setRetorno(false);}}/>
            <FormFeedback message={erro}/>
            {!configurado&&<Notice>A página oficial de convites ainda não foi configurada neste aplicativo. Solicite ao organizador o link para abrir pelo navegador.</Notice>}
            {offline&&<Notice>Reconecte à internet para abrir o convite e consultar a disponibilidade atual.</Notice>}
            <ActionButton title="Abrir convite" icon="open-outline" variant="primary" busy={busy} disabled={!link.trim()||offline||!configurado} onPress={()=>void abrir()}/>
            {retorno&&<Notice>Você voltou da página de inscrição. Consulte o resultado nela; abrir o convite não confirma uma reserva.</Notice>}
        </Section>
        <Section title="Minhas excursões"><Text style={trip.body}>O vínculo entre inscrições por convite e sua conta do aplicativo ainda não está disponível. Por enquanto, consulte sua inscrição pelo acesso individual fornecido na página oficial.</Text></Section>
    </>;
}
