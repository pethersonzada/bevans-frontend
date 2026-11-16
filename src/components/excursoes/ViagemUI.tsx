import type { ComponentProps, ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';
import { ActionButton } from '../ui/Primitives';
import MapaPreviaPublica from '../MapaPreviaPublica';
import type { Excursao } from '../../services/excursoes';
import { useNomesExcursao } from './useNomesExcursao';
import { nomeLocalExibicao } from '../../services/enderecoReversoExcursao';
type Icon = ComponentProps<typeof Ionicons>['name'];
export const estadosViagem: Record<string,string> = { RASCUNHO:'Em planejamento', PUBLICADA:'Publicada', CANCELADA:'Cancelada', CONCLUIDA:'Concluída' };
export function dataViagem(iso:string, options:Intl.DateTimeFormatOptions = { day:'numeric', month:'short' }) {
    return Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleDateString('pt-BR',options) : 'A combinar';
}
export function horaViagem(iso:string) { return Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : 'Escolher horário'; }
export function PaginaViagem({ title, children, onBack, action, footer, tabs=false }: { title:string;children:ReactNode;onBack?:()=>void;action?:ReactNode;footer?:ReactNode;tabs?:boolean }) {
    return <SafeAreaView edges={tabs?['top','left','right']:['top','bottom','left','right']} style={trip.page}>
        <View style={trip.bar}>{onBack&&<Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={trip.iconButton}><Ionicons name="arrow-back" size={24} color={theme.colors.primary}/></Pressable>}<Text style={trip.barTitle}>{title}</Text>{action}</View>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={trip.content}>{children}</ScrollView>
        {footer&&<View style={trip.footer}>{footer}</View>}
    </SafeAreaView>;
}
export function CabecalhoViagem({ eyebrow, title, subtitle }: { eyebrow?:string;title:string;subtitle?:string }) {
    return <View style={{gap:10}}>{eyebrow&&<Text style={trip.eyebrow}>{eyebrow}</Text>}<Text accessibilityRole="header" style={trip.heading}>{title}</Text>{subtitle&&<Text style={trip.muted}>{subtitle}</Text>}</View>;
}
export function CartaoViagem({e:original,onPress,emAndamento=false}:{e:Excursao;onPress:()=>void;emAndamento?:boolean}) {
    const {exibicao:e,consultando,consultados}=useNomesExcursao(original,false);
    return <Pressable accessibilityRole="button" accessibilityLabel={`${e.destinoNome}. ${e.titulo}. ${estadosViagem[e.estado]||e.estado}. Ver viagem`} onPress={onPress} style={({pressed})=>[trip.travelCard,pressed&&{opacity:0.85}]}>
        <View style={trip.cardTop}><View style={trip.dateBadge}><Text style={trip.day}>{dataViagem(e.partidaEm,{day:'2-digit'})}</Text><Text style={trip.month}>{dataViagem(e.partidaEm,{month:'short'})}</Text><Text style={trip.caption}>{dataViagem(e.partidaEm,{year:'numeric'})}</Text></View><View style={{flex:1,gap:6}}><Text style={trip.status}>{emAndamento?'Em viagem':estadosViagem[e.estado]||e.estado}</Text><Text accessibilityRole="header" style={trip.cardDestination}>{e.destinoNome}</Text><Text style={trip.muted}>{e.titulo}</Text></View></View>
        <View style={trip.cardFacts}><DadoViagem icon="time-outline" text={horaViagem(e.partidaEm)}/><DadoViagem icon="people-outline" text={`${e.capacidade} lugares no total`}/></View>
        {e.origemNome&&<DadoViagem icon="navigate-outline" text={`Saída de ${e.origemNome}`}/>}
        {consultando&&<Text style={trip.caption}>Consultando endereço do local…</Text>}
        {consultados>0&&<Text style={trip.caption}>Endereço consultado pelas coordenadas</Text>}
        <View style={trip.cardLink}><Text style={trip.link}>{e.estado==='RASCUNHO'?'Continuar planejamento':'Ver viagem'}</Text><Ionicons name="arrow-forward" size={20} color={theme.colors.primary}/></View>
    </Pressable>;
}
export function DadoViagem({icon,text}:{icon:Icon;text:string}) { return <View style={{flexDirection:'row',alignItems:'center',gap:8,flexShrink:1}}><Ionicons name={icon} size={18} color={theme.colors.textLight}/><Text style={[trip.body,{flexShrink:1}]}>{text}</Text></View>; }
export function DestinoHero({destino,titulo,estado}:{destino:string;titulo:string;estado?:string}) {
    return <View style={trip.hero}><View style={trip.heroTop}><View style={trip.heroIcon}><Ionicons name="compass-outline" size={34} color="#fff"/></View>{estado&&<Text style={trip.heroStatus}>{estadosViagem[estado]||estado}</Text>}</View><Text style={trip.heroEyebrow}>NOSSO DESTINO</Text><Text accessibilityRole="header" style={trip.heroTitle}>{nomeLocalExibicao(destino)}</Text><Text style={trip.heroSubtitle}>{titulo}</Text></View>;
}
export function BlocoViagem({title,action,children}:{title:string;action?:ReactNode;children:ReactNode}) { return <View style={{gap:14}}><View style={trip.sectionHeader}><Text accessibilityRole="header" style={trip.sectionTitle}>{title}</Text>{action}</View>{children}</View>; }
export function AtalhoViagem({title,detail,icon,onPress}:{title:string;detail?:string;icon:Icon;onPress:()=>void}) {
    return <Pressable accessibilityRole="button" onPress={onPress} style={trip.shortcut}><View style={trip.shortcutIcon}><Ionicons name={icon} size={24} color={theme.colors.primary}/></View><View style={{flex:1,gap:4}}><Text style={trip.label}>{title}</Text>{detail&&<Text style={trip.muted}>{detail}</Text>}</View><Ionicons name="chevron-forward" size={20} color={theme.colors.textLight}/></Pressable>;
}
export type PontoViagem = {nome:string;latitude:number;longitude:number};
export function ItinerarioViagem({origem,destino,paradas=[],mapa=false,lista=true}:{origem:PontoViagem|null;destino:PontoViagem|null;paradas?:PontoViagem[];mapa?:boolean;lista?:boolean}) {
    const pontos=[...(origem?[{...origem,tipo:'Saída'}]:[]),...paradas.map((p,i)=>({...p,tipo:`Embarque ${i+1}`})),...(destino?[{...destino,tipo:'Destino'}]:[])].map(p=>({...p,nome:nomeLocalExibicao(p.nome)}));
    return <View style={trip.itinerary}>
        {mapa&&pontos.length>0&&<><View style={trip.map}><MapaPreviaPublica pontos={pontos.map((p,i)=>({...p,paradaId:i+1}))}/></View><Text style={trip.caption}>Mapa dos pontos. Linhas indicam sequência, não navegação viária.</Text></>}
        {lista?pontos.map((p,i)=><View key={i} style={trip.timelineRow}><View style={trip.timelineRail}><View style={[trip.dot,i===pontos.length-1&&{backgroundColor:theme.colors.primary}]}/>{i<pontos.length-1&&<View style={trip.rail}/>}</View><View style={{flex:1,paddingBottom:i<pontos.length-1?16:0,gap:4}}><Text style={trip.caption}>{p.tipo}</Text><Text style={trip.label}>{p.nome}</Text></View></View>):<>{origem&&<DadoViagem icon="navigate-outline" text={`Saída: ${nomeLocalExibicao(origem.nome)}`}/>}
        {destino&&<DadoViagem icon="flag-outline" text={`Destino: ${nomeLocalExibicao(destino.nome)}`}/>}</>}
        {!origem&&<Text style={trip.caption}>Saída definida pelos pontos de embarque.</Text>}
    </View>;
}
export function EscolhaEmbarque({selected,icon,title,description,onPress}:{selected:boolean;icon:Icon;title:string;description:string;onPress:()=>void}) {
    return <Pressable accessibilityRole="radio" accessibilityState={{selected}} onPress={onPress} style={[trip.boardingCard,selected&&trip.boardingSelected]}><View style={trip.boardingIcon}><Ionicons name={icon} size={30} color={theme.colors.primary}/></View><View style={{flex:1,gap:6}}><Text style={trip.label}>{title}</Text><Text style={trip.muted}>{description}</Text></View><Ionicons name={selected?'checkmark-circle':'ellipse-outline'} size={24} color={selected?theme.colors.primary:theme.colors.border}/></Pressable>;
}
export function ProgressoViagem({steps,current}:{steps:readonly string[];current:number}) { return <View style={{gap:12}}><View style={{flexDirection:'row',gap:6}}>{steps.map((s,i)=><View key={s} style={[trip.progress,{backgroundColor:i<=current?theme.colors.primary:theme.colors.border}]}/>)}</View><Text accessibilityLabel={`Etapa ${current+1} de ${steps.length}: ${steps[current]}`} style={trip.eyebrow}>{current+1} / {steps.length} · {steps[current]}</Text></View>; }
export function EditarLink({onPress}:{onPress:()=>void}) { return <Pressable accessibilityRole="button" accessibilityLabel="Editar esta seção" onPress={onPress} style={trip.editLink}><Text style={trip.link}>Editar</Text><Ionicons name="create-outline" size={18} color={theme.colors.primary}/></Pressable>; }
export { ActionButton };
export const trip=StyleSheet.create({
    page:{flex:1,backgroundColor:theme.colors.background},bar:{paddingHorizontal:20,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:12,width:'100%',maxWidth:760,alignSelf:'center'},barTitle:{flex:1,fontSize:16,fontWeight:'600',color:theme.colors.primary},iconButton:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:16,backgroundColor:theme.colors.surface},
    content:{padding:20,paddingBottom:32,gap:26,width:'100%',maxWidth:760,alignSelf:'center'},footer:{padding:16,gap:8,borderTopWidth:1,borderTopColor:theme.colors.border,backgroundColor:theme.colors.surface,width:'100%',maxWidth:760,alignSelf:'center'},heading:{fontSize:30,lineHeight:36,fontWeight:'700',color:theme.colors.primary},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.2,color:theme.colors.textLight,textTransform:'uppercase'},body:{fontSize:15,lineHeight:22,color:theme.colors.text},muted:{fontSize:14,lineHeight:21,color:theme.colors.textLight},caption:{fontSize:12,lineHeight:18,color:theme.colors.textLight},label:{fontSize:16,lineHeight:23,fontWeight:'600',color:theme.colors.primary},sectionTitle:{fontSize:20,fontWeight:'700',color:theme.colors.primary},link:{fontSize:14,fontWeight:'700',color:theme.colors.primary},
    hero:{padding:24,borderRadius:24,backgroundColor:theme.colors.primary,gap:12},heroTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},heroIcon:{height:64,width:64,borderRadius:22,backgroundColor:'#FFFFFF16',alignItems:'center',justifyContent:'center'},heroStatus:{fontSize:12,color:'#fff',backgroundColor:'#FFFFFF1F',padding:10,borderRadius:20,flexShrink:1},heroEyebrow:{fontSize:11,color:'#C5D1DF',letterSpacing:2,marginTop:12},heroTitle:{fontSize:30,lineHeight:36,color:'#fff',fontWeight:'700'},heroSubtitle:{fontSize:15,lineHeight:22,color:'#D7E1EC'},
    travelCard:{padding:20,borderRadius:22,backgroundColor:theme.colors.surface,gap:18,borderWidth:1,borderColor:theme.colors.border},cardTop:{flexDirection:'row',gap:16,alignItems:'flex-start'},dateBadge:{minWidth:58,padding:10,borderRadius:16,backgroundColor:'#EDF1F5',alignItems:'center'},day:{fontSize:26,fontWeight:'700',color:theme.colors.primary},month:{fontSize:12,fontWeight:'600',textTransform:'uppercase',color:theme.colors.primary},status:{fontSize:11,fontWeight:'700',color:theme.colors.textLight,textTransform:'uppercase',letterSpacing:0.7},cardDestination:{fontSize:21,lineHeight:27,fontWeight:'700',color:theme.colors.primary},cardFacts:{flexDirection:'row',flexWrap:'wrap',gap:16},cardLink:{paddingTop:14,borderTopWidth:1,borderTopColor:theme.colors.border,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
    sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},shortcut:{padding:18,borderWidth:1,borderColor:theme.colors.border,backgroundColor:theme.colors.surface,borderRadius:18,flexDirection:'row',gap:14,alignItems:'center',minHeight:80},shortcutIcon:{height:46,width:46,borderRadius:15,backgroundColor:'#EDF1F5',justifyContent:'center',alignItems:'center'},
    itinerary:{gap:12},map:{borderRadius:20,overflow:'hidden',height:260},timelineRow:{flexDirection:'row',gap:16},timelineRail:{width:18,alignItems:'center',paddingTop:5},dot:{width:12,height:12,borderRadius:6,borderWidth:2,borderColor:theme.colors.primary,backgroundColor:theme.colors.surface},rail:{width:2,flex:1,backgroundColor:theme.colors.border,marginTop:4},boardingCard:{padding:18,gap:14,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:theme.colors.border,backgroundColor:theme.colors.surface,borderRadius:20,minHeight:110},boardingSelected:{borderWidth:2,borderColor:theme.colors.primary,backgroundColor:'#EDF1F5'},boardingIcon:{width:44,alignItems:'center'},progress:{height:4,borderRadius:4,flex:1},editLink:{flexDirection:'row',alignItems:'center',gap:6,minHeight:48,paddingHorizontal:8},
});
