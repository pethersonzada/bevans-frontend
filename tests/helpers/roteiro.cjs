const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, require: name => {if(name.endsWith('/useThemeRevision'))return {useThemeRevision:()=> 'light'};if(name.endsWith('/themedStyles'))return {themedStyles:factory=>factory()};if(name.endsWith('/PreferenciaAparencia'))return {PreferenciaAparencia:'Appearance'};if(name.endsWith('/ThemeContext'))return {ThemeProvider:'ThemeProvider'};
        if (!(name in mocks)) throw Error(`Import inesperado: ${name}`);
        return mocks[name];
    }, Error, Response, Headers, AbortController, setTimeout, clearTimeout, ...globals });
    return exports;
}
const passageiro = (id, latitude = -8.1, longitude = -35.1) => ({ id, nome: `Pessoa ${id}`, latitude, longitude });
const ponto = (tipo, nome, latitude, longitude, paradaId = null, passageiros = []) => ({ tipo, nome, latitude, longitude, paradaId, passageiros });
function fixture(modalidade, sentido) {
    const origem = ponto('ORIGEM', `${sentido} origem`, sentido === 'IDA' ? -8 : -8.5, -35);
    const destino = ponto('DESTINO', `${sentido} destino`, sentido === 'IDA' ? -8.5 : -8, -35.5);
    if (modalidade === 'PORTA_A_PORTA') return [origem,
        ponto('INDIVIDUAL', 'Endereço do sentido', sentido === 'IDA' ? -8.2 : -8.3, -35.2, null, [passageiro(11)]), destino];
    const vazia = ponto('PARADA', 'Sem reservas', -8.1, -35.1, 11);
    const compartilhada = ponto('PARADA', 'Embarque compartilhado', -8.2, -35.2, 22, [passageiro(11), passageiro(33)]);
    const excepcional = ponto('EXCEPCIONAL', 'Exceção aprovada', -8.4, -35.4, null, [passageiro(44)]);
    // Listas representam respostas já ordenadas pelo backend, nunca ordenadas pelo cliente.
    if (modalidade === 'PRIVADA_PARADAS') return sentido === 'IDA' ? [origem, vazia, compartilhada, destino] : [origem, compartilhada, vazia, destino];
    if (modalidade === 'FIXA') return sentido === 'IDA' ? [origem, vazia, compartilhada, excepcional, destino] : [origem, compartilhada, vazia, excepcional, destino];
    return sentido === 'IDA' ? [origem, excepcional, vazia, compartilhada, destino] : [origem, vazia, excepcional, compartilhada, destino];
}
function painel(pontos, viagemId = 42, sentido = 'IDA') {
    const registros = pontos.flatMap((p, ordem) => p.passageiros.map(a => ({ id: 900 + a.id, alunoId: a.id, nome: a.nome, paradaId: p.paradaId, ordem, estado: 'AGUARDANDO', versao: 0 })));
    return { referenciaId: viagemId, tipo: 'VIAGEM', sentido, registros, contadores: { esperados: registros.length } };
}
module.exports = { load, passageiro, ponto, fixture, painel };
