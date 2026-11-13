import MapboxGL from '@rnmapbox/maps';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { PontoPublico } from '../types/rotaPublica';
import MapMarker from './MapMarker';

export default function MapaPreviaPublica({ pontos }: { pontos: PontoPublico[] }) {
    const camera=useRef<MapboxGL.Camera>(null);
    const west=Math.min(...pontos.map(p=>p.longitude)),east=Math.max(...pontos.map(p=>p.longitude));
    const south=Math.min(...pontos.map(p=>p.latitude)),north=Math.max(...pontos.map(p=>p.latitude));
    useEffect(()=>{
        if(![west,east,south,north].every(Number.isFinite) || (west===east && south===north))return;
        camera.current?.fitBounds([east,north],[west,south],40,300);
    },[west,east,south,north]);
    if(!pontos.length)return null;
    const coordinates=pontos.map(p=>[p.longitude,p.latitude]);
    return <View accessibilityLabel="Mapa da ordem das paradas" style={{height:260}}>
        <MapboxGL.MapView style={{flex:1}} styleURL={MapboxGL.StyleURL.Dark}>
            <MapboxGL.Camera ref={camera} centerCoordinate={coordinates[0]} zoomLevel={12}/>
            {pontos.length>1 && <MapboxGL.ShapeSource id="preview-points" shape={{type:'Feature',properties:{},geometry:{type:'LineString',coordinates}}}>
                <MapboxGL.LineLayer id="preview-line" style={{lineColor:'#40BFA8',lineWidth:4}}/>
            </MapboxGL.ShapeSource>}
            {pontos.map((p,i)=><MapboxGL.PointAnnotation key={String(p.paradaId??`end-${i}`)} id={`preview-${i}`} coordinate={[p.longitude,p.latitude]} title={`${i+1}. ${p.nome}`}>
                <MapMarker tipo={i===0?'origem':i===pontos.length-1?'destino':'endereco'}/>
            </MapboxGL.PointAnnotation>)}
        </MapboxGL.MapView>
    </View>;
}
