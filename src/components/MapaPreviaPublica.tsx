import MapboxGL from '@rnmapbox/maps';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { PontoPublico } from '../types/rotaPublica';
import { coordenadasMapaValidas } from '../services/mapaExcursao';
import { theme } from '../styles/theme';
import MapMarker from './MapMarker';

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || '';
// Initialize here too: opening this preview must not depend on another screen.
if (token) MapboxGL.setAccessToken(token);

type PontoMapa=PontoPublico&{tipo?:string};
export default function MapaPreviaPublica({ pontos,onEditarPonto }: { pontos:PontoMapa[];onEditarPonto?:(ponto:PontoMapa,index:number)=>void }) {
    const camera=useRef<MapboxGL.Camera>(null);
    const [estado,setEstado]=useState<'carregando'|'pronto'|'erro'>('carregando');
    const [tentativa,setTentativa]=useState(0);
    const carregou=useRef(false);
    const [selecao,setSelecao]=useState<string|null>(null);
    const validos=pontos.filter(p=>coordenadasMapaValidas(p?.latitude,p?.longitude));
    const west=Math.min(...validos.map(p=>p.longitude)),east=Math.max(...validos.map(p=>p.longitude));
    const south=Math.min(...validos.map(p=>p.latitude)),north=Math.max(...validos.map(p=>p.latitude));
    const chave=(p:PontoMapa,i:number)=>`${i}:${p.paradaId}:${p.tipo}:${p.latitude}:${p.longitude}:${p.nome}`;
    const selecionado=validos.find((p,i)=>chave(p,i)===selecao);
    const enquadrar=()=>{
        if(![west,east,south,north].every(Number.isFinite))return;
        if(west===east&&south===north)camera.current?.setCamera({centerCoordinate:[west,south],zoomLevel:14,animationDuration:0});
        else camera.current?.fitBounds([east,north],[west,south],48,0);
    };
    useEffect(()=>{
        if(carregou.current)enquadrar();
    },[west,east,south,north]);
    useEffect(()=>{
        if(!token||estado!=='carregando')return;
        const timer=setTimeout(()=>setEstado('erro'),20000);
        return()=>clearTimeout(timer);
    },[estado,tentativa]);
    return <View style={{gap:8}}>
        <View accessibilityLabel="Mapa da ordem das paradas" style={{height:260,backgroundColor:theme.colors.map.background}}>
            {token?<MapboxGL.MapView key={tentativa} testID="mapa-previa-nativo" style={{flex:1}} styleURL={MapboxGL.StyleURL.Dark}
                onDidFinishLoadingMap={()=>{carregou.current=true;setEstado('pronto');enquadrar();}}
                onDidFinishRenderingMapFully={()=>setEstado('pronto')}
                onMapLoadingError={()=>setEstado('erro')}>
                <MapboxGL.Camera ref={camera} defaultSettings={validos[0]?{centerCoordinate:[validos[0].longitude,validos[0].latitude],zoomLevel:12}:{zoomLevel:1}}/>
                {validos.map((p,i)=><MapboxGL.PointAnnotation key={`${p.paradaId??'extremo'}-${i}`} id={`preview-${i}`} coordinate={[p.longitude,p.latitude]} title={`${i+1}. ${p.nome}`} onSelected={()=>{setSelecao(chave(p,i));camera.current?.setCamera({centerCoordinate:[p.longitude,p.latitude],zoomLevel:16,animationDuration:250});}}>
                    <MapMarker tipo={p.tipo==='ORIGEM'?'origem':p.tipo==='DESTINO'?'destino':p.tipo?'endereco':i===0&&validos.length>1?'origem':i===validos.length-1?'destino':'endereco'} numero={p.tipo==='COLETA'||p.tipo==='DESEMBARQUE'?i+1:undefined} tamanho={p.tipo==='COLETA'||p.tipo==='DESEMBARQUE'?34:42}/>
                </MapboxGL.PointAnnotation>)}
            </MapboxGL.MapView>:<Text accessibilityRole="alert" style={{color:theme.colors.map.text,padding:16}}>Mapa indisponível: o token do Mapbox não foi configurado neste aplicativo.</Text>}
            {token&&estado==='carregando'&&<View pointerEvents="none" style={{position:'absolute',top:8,left:8,padding:8,backgroundColor:theme.colors.map.surface,flexDirection:'row',gap:8}}><ActivityIndicator color={theme.colors.primary}/><Text style={{color:theme.colors.map.text}}>Carregando mapa…</Text></View>}
        </View>
        {selecionado&&<View style={{gap:8}}><Text accessibilityLiveRegion="polite">{selecionado.nome}</Text>{onEditarPonto&&<Pressable accessibilityRole="button" accessibilityLabel="Editar ponto selecionado" onPress={()=>onEditarPonto(selecionado,pontos.indexOf(selecionado))} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:theme.colors.primary}}>Editar este ponto</Text></Pressable>}</View>}
        {validos.length>1&&<Pressable accessibilityRole="button" accessibilityLabel="Enquadrar todos os pontos" onPress={()=>{setSelecao(null);enquadrar();}} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:theme.colors.primary}}>Ver todos os pontos</Text></Pressable>}
        {token&&estado==='erro'&&<View style={{gap:8}}>
            <Text accessibilityRole="alert">Não foi possível renderizar o mapa. Verifique a conexão e tente novamente. O planejamento e os pontos foram preservados.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Recarregar mapa" onPress={()=>{carregou.current=false;setEstado('carregando');setTentativa(v=>v+1);}} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:theme.colors.primary}}>Recarregar mapa</Text></Pressable>
        </View>}
        {validos.length!==pontos.length&&<Text accessibilityRole="alert">Há pontos com coordenadas inválidas. Corrija os locais antes de gerar o roteiro.</Text>}
        {!validos.length&&<Text>Nenhum ponto com coordenadas válidas para exibir. Adicione ou revise os locais da viagem.</Text>}
    </View>;
}
