import { themedStyles } from '../../styles/themedStyles';
import { useThemeRevision } from '../../hooks/useThemeRevision';
import MapboxGL from '@rnmapbox/maps';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PontoItinerario } from '../../services/itinerarioRotaPublica';
import { theme } from '../../styles/theme';
type Props={pontos:PontoItinerario[];selecionado:string|null;onSelect:(key:string)=>void;onMove?:(key:string,latitude:number,longitude:number)=>void};
export function MapaItinerario({pontos,selecionado,onSelect,onMove}:Props) {
    useThemeRevision();
    const camera=useRef<MapboxGL.Camera>(null),annotations=useRef<Record<string,MapboxGL.PointAnnotation|null>>({});
    const [ready,setReady]=useState(false);
    const selected=pontos.find(p=>p.chave===selecionado);
    const west=Math.min(...pontos.map(p=>p.longitude)),east=Math.max(...pontos.map(p=>p.longitude)),south=Math.min(...pontos.map(p=>p.latitude)),north=Math.max(...pontos.map(p=>p.latitude));
    useEffect(()=>{
        if(!ready||!pontos.length)return;
        if(selected){camera.current?.setCamera({centerCoordinate:[selected.longitude,selected.latitude],zoomLevel:15,animationDuration:300});return;}
        if(west===east&&south===north)camera.current?.setCamera({centerCoordinate:[west,south],zoomLevel:14,animationDuration:300});
        else camera.current?.fitBounds([east,north],[west,south],52,300);
    },[ready,west,east,south,north,selected?.chave,selected?.latitude,selected?.longitude]);
    const labels=pontos.map(p=>`${p.chave}:${p.nome}:${p.ordem}`).join('|');
    useEffect(()=>{const frame=requestAnimationFrame(()=>Object.values(annotations.current).forEach(a=>a?.refresh()));return()=>cancelAnimationFrame(frame);},[labels,selecionado]);
    if(!pontos.length)return <View style={[styles.map,styles.empty]}><Text style={styles.emptyText}>Defina origem e destino para visualizar o itinerário. Nenhum ponto é escolhido automaticamente.</Text></View>;
    return <View style={styles.map} accessibilityLabel="Mapa dos pontos reais do itinerário">
        <MapboxGL.MapView style={{flex:1}} styleURL={MapboxGL.StyleURL.Dark} onDidFinishLoadingMap={()=>setReady(true)} attributionEnabled>
            <MapboxGL.Camera ref={camera} defaultSettings={{centerCoordinate:[pontos[0].longitude,pontos[0].latitude],zoomLevel:12}}/>
            {pontos.length>1&&<MapboxGL.ShapeSource id="public-route-sequence" shape={{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:pontos.map(p=>[p.longitude,p.latitude])}}}><MapboxGL.LineLayer id="public-route-sequence-line" style={{lineColor:'#A4BACB',lineWidth:3,lineDasharray:[2,2]}}/></MapboxGL.ShapeSource>}
            {pontos.map(p=>{
                const color=p.papel==='origem'?theme.colors.marker.origem:p.papel==='destino'?theme.colors.marker.destino:theme.colors.marker.endereco;
                return <MapboxGL.PointAnnotation key={p.chave} id={p.chave} ref={node=>{annotations.current[p.chave]=node;}} coordinate={[p.longitude,p.latitude]} title={`${p.papel==='origem'?'Origem':p.papel==='destino'?'Destino':`Parada ${p.ordem}`}: ${p.nome}`} draggable={!!onMove} onSelected={()=>onSelect(p.chave)} onDragEnd={event=>{if(event.geometry.type==='Point'){const [longitude,latitude]=event.geometry.coordinates;onMove?.(p.chave,latitude,longitude);}}}>
                    <View collapsable={false} onLayout={()=>annotations.current[p.chave]?.refresh()} style={[styles.marker,{backgroundColor:color,borderWidth:selecionado===p.chave?5:3,borderColor:selecionado===p.chave?'#FFE399':'#fff'}]}><Text style={styles.markerText}>{p.papel==='origem'?'O':p.papel==='destino'?'D':String(p.ordem)}</Text></View>
                </MapboxGL.PointAnnotation>;
            })}
        </MapboxGL.MapView>
    </View>;
}
const styles=themedStyles(() => StyleSheet.create({map:{height:330,borderRadius:18,overflow:'hidden',backgroundColor:theme.colors.map.background},empty:{padding:24,alignItems:'center',justifyContent:'center'},emptyText:{color:theme.colors.map.text,fontSize:15,lineHeight:23,textAlign:'center'},marker:{height:44,width:44,borderRadius:22,alignItems:'center',justifyContent:'center'},markerText:{fontSize:17,fontWeight:'700',color:'#fff'}}));
