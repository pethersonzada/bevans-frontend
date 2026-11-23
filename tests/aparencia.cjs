const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/excursoes.cjs');
const tick=()=>new Promise(setImmediate);
test('preferência inválida usa sistema e resolução acompanha o modo do dispositivo',()=>{
 const h=harness('src/services/aparencia.ts');for(const value of [null,undefined,'',{},'sepia','SYSTEM'])assert.equal(h.mod.lerPreferenciaAparencia(value),'system');
 assert.equal(h.mod.lerPreferenciaAparencia('dark'),'dark');assert.equal(h.mod.resolverAparencia('system','dark'),'dark');assert.equal(h.mod.resolverAparencia('system','light'),'light');assert.equal(h.mod.resolverAparencia('system',null),'light');assert.equal(h.mod.resolverAparencia('light','dark'),'light');
});
test('paleta notifica assinantes e cada estilo é calculado uma vez por tema sem remontagem',()=>{
 const h=harness('src/styles/theme.ts'),{theme,applyTheme,subscribeTheme}=h.mod,{themedStyles}=h.load('src/styles/themedStyles.ts');let calls=0,notifications=0;
 const styles=themedStyles(()=>{calls++;return {body:{color:theme.colors.text,backgroundColor:theme.colors.surface}};});const off=subscribeTheme(()=>notifications++);
 const light=styles.body;assert.equal(styles.body,light);assert.equal(calls,1);applyTheme('dark');const dark=styles.body;assert.notEqual(light.color,dark.color);assert.notEqual(light.backgroundColor,dark.backgroundColor);assert.equal(calls,2);assert.equal(notifications,1);applyTheme('dark');assert.equal(notifications,1);applyTheme('light');assert.equal(styles.body,light);assert.equal(calls,2);assert.deepEqual(Object.keys(styles),['body']);off();applyTheme('dark');assert.equal(notifications,2);
});
test('provider restaura escolha, acompanha sistema e mantém a árvore de filhos',async()=>{
 const memory=new Map([['@bevans:aparencia:v1','dark']]);let system='light';const h=harness('src/contexts/ThemeContext.tsx',{extras:{'react-native':{useColorScheme:()=>system},'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async k=>memory.get(k),setItem:async(k,v)=>memory.set(k,v)}}}});
 const child={type:'draft',value:'dados em edição'},tree=()=>h.render('ThemeProvider',{children:child});tree();await tick();let t=tree();assert.equal(t.props.value.preference,'dark');assert.equal(t.props.children,child);
 await t.props.value.setPreference('system');t=tree();assert.equal(h.load('src/styles/theme.ts').getThemeMode(),'light');system='dark';t=tree();assert.equal(h.load('src/styles/theme.ts').getThemeMode(),'dark');assert.equal(t.props.children,child);assert.equal(memory.get('@bevans:aparencia:v1'),'system');h.unmount();
});
test('falha no armazenamento mantém escolha anterior e apresenta erro recuperável',async()=>{
 const h=harness('src/contexts/ThemeContext.tsx',{extras:{'react-native':{useColorScheme:()=>null},'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async()=>{throw Error('Disco');},setItem:async()=>{throw Error('Disco');}}}}});
 const tree=()=>h.render('ThemeProvider',{children:'form'});tree();await tick();let t=tree();assert.equal(t.props.value.preference,'system');assert.match(t.props.value.error,/tema do sistema/);await assert.rejects(t.props.value.setPreference('dark'),/não foi salva/);t=tree();assert.equal(t.props.value.preference,'system');assert.match(t.props.value.error,/salvar/);h.unmount();
});

test('cores de texto, seleção e ações têm contraste mínimo nos dois temas',()=>{
 const h=harness('src/styles/theme.ts');const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
 const ratio=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+0.05)/(values[1]+0.05);};
 for(const mode of ['light','dark']){h.mod.applyTheme(mode);const c=h.mod.theme.colors;for(const [fg,bg] of [[c.text,c.surface],[c.textLight,c.surface],[c.textLight,c.background],[c.textLight,c.subtle],[c.primary,c.surface],[c.surface,c.primary],[c.danger,c.surface],[c.success,c.surface]])assert.ok(ratio(fg,bg)>=4.5,`${mode}: ${fg} em ${bg}`);}
});