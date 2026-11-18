const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,require:n=>mocks[n]});return exports;}
const jsx=(type,props)=>({type,props});
test('cabeçalho compartilhado reserva o sino e permite nome longo com Safe Area lateral',()=>{
 const theme=load('src/styles/theme.ts',{}).theme;
 const m=load('src/components/HeaderHome.tsx',{'react':{useState:f=>[f(),()=>{}]},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Text:'Text',StyleSheet:{create:x=>x}},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:24,left:12,right:18})},'../hooks/useFocusedPolling':{useFocusedPolling(){}},'./AtalhoNotificacoes':{AtalhoNotificacoes:'Bell'},'../styles/theme':{theme}});
 const nome='Nome de passageiro muito longo para validar a quebra de linha';const tree=m.HeaderHome({nome});
 assert.equal(tree.props.style[1].paddingLeft,12+theme.spacing.lg);assert.equal(tree.props.style[1].paddingRight,18+theme.spacing.lg);
 const group=tree.props.children[0];assert.equal(group.props.style.flex,1);assert.equal(group.props.style.minWidth,0);
 const text=group.props.children[1];assert.equal(text.props.numberOfLines,undefined);assert.equal(text.props.children[1],nome);assert.equal(text.props.allowFontScaling,undefined);assert.equal(tree.props.children[1].type,'Bell');
});
test('motorista delega a identidade e o nome completo ao mesmo cabeçalho',()=>{
 const m=load('src/components/motorista/HeaderMotorista.tsx',{'react/jsx-runtime':{jsx},'../HeaderHome':{HeaderHome:'SharedHeader'}});const tree=m.HeaderMotorista({nomeMotorista:'Nome Completo'});assert.equal(tree.type,'SharedHeader');assert.equal(tree.props.nome,'Nome Completo');
});
