const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Executa as funções reais do mapa, isolando somente a interface nativa.
const arquivo = process.argv[2] && process.argv[2].endsWith('.txt')
    ? process.argv[2] : path.join(__dirname, '..', 'src', 'app', 'mapa.tsx');
const source = fs.readFileSync(arquivo, 'utf8');
const ast = ts.createSourceFile('mapa.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length, 0, 'O mapa deve ter sintaxe válida');
const nomes = new Set(['distanciaMetros', 'projetarNoSegmento', 'medirRota', 'metrosProjetados', 'quadroNaRota', 'coordenadasRestantesDoTrecho', 'interpolarHeading']);
const funcoes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && nomes.has(n.name?.text));
assert.equal(funcoes.length, nomes.size);
const codigo = funcoes.map(n => n.getText(ast)).join('\n') + '\nexports.api = {' + [...nomes].join(',') + '};';
const contexto = { exports: {} };
vm.runInNewContext(ts.transpileModule(codigo, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText, contexto);
const { medirRota, quadroNaRota, coordenadasRestantesDoTrecho, metrosProjetados, projetarNoSegmento, interpolarHeading } = contexto.exports.api;
const quase = (x, y, delta = 1e-9) => assert.ok(Math.abs(x-y) <= delta, `${x} != ${y}`);
const pontoIgual = (c, p) => { quase(c[0], p.longitude); quase(c[1], p.latitude); };
const coords = [[-35.1,-8.2],[-35.09,-8.2],[-35.09,-8.19],[-35.08,-8.19]];

test('o primeiro ponto azul acompanha exatamente o centro da van num segmento longo', () => {
    const m = medirRota(coords);
    for (let i=0; i<100; i++) {
        const q = quadroNaRota(m, m.acumuladas[1]*i/100, 0);
        const l = coordenadasRestantesDoTrecho(coords, q.progresso, 2);
        pontoIgual(l[0], q.posicao);
        quase(q.posicao.latitude, coords[0][1]);
        assert.ok(q.progresso.t >= 0 && q.progresso.t <= 1);
    }
});
test('a van percorre a esquina sem cortar a curva e o azul não contém vértices anteriores', () => {
    const m = medirRota(coords);
    const q = quadroNaRota(m, m.acumuladas[1] + (m.acumuladas[2]-m.acumuladas[1])/2, 0);
    const l = coordenadasRestantesDoTrecho(coords, q.progresso, 2);
    assert.equal(q.progresso.indice, 1);
    pontoIgual(l[0], q.posicao);
    quase(q.posicao.longitude, coords[1][0]);
    assert.equal(l.length, 2);
    assert.equal(l[1], coords[2]);
});
test('a linha azul termina na parada, sem consumir as próximas', () => {
    const m = medirRota(coords), q = quadroNaRota(m, m.acumuladas[2], 0);
    assert.equal(coordenadasRestantesDoTrecho(coords,q.progresso,2).length,0);
    const proxima = coordenadasRestantesDoTrecho(coords,q.progresso,3);
    pontoIgual(proxima[0],q.posicao);
    assert.equal(proxima[1],coords[3]);
});
test('coordenadas duplicadas e chegada final não produzem NaN nem linha residual', () => {
    const c=[coords[0],coords[0],coords[1],coords[1]],m=medirRota(c);
    for(const d of [0,1,m.acumuladas[3]]) {
        const q=quadroNaRota(m,d,0);
        assert.ok(Number.isFinite(q.posicao.latitude) && Number.isFinite(q.posicao.longitude));
        assert.ok(Number.isFinite(q.heading));
    }
    const q=quadroNaRota(m,m.acumuladas[3],0);
    assert.equal(coordenadasRestantesDoTrecho(c,q.progresso,3).length,0);
});
test('o progresso da geometria antiga não corta uma rota nova',()=>{
    const m=medirRota(coords),q=quadroNaRota(m,m.acumuladas[1],0), nova=coords.slice();
    const l=coordenadasRestantesDoTrecho(nova,q.progresso,3);
    assert.equal(l[0],nova[0]);
    assert.equal(l.length,4);
});
test('GPS projetado usa a fração real do segmento e heading cruza norte pelo caminho curto',()=>{
    const m=medirRota(coords),a={longitude:coords[0][0],latitude:coords[0][1]}, b={longitude:coords[1][0],latitude:coords[1][1]};
    const p=projetarNoSegmento({longitude:(a.longitude+b.longitude)/2,latitude:a.latitude},a,b);
    quase(metrosProjetados(m,{...p,indice:0}),m.acumuladas[1]/2,1e-6);
    quase(interpolarHeading(350,10,.5),0);
});
