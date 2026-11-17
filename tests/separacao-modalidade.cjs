const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
    const calls = [];
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync('src/services/viagens.ts', 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(source, { exports, require: () => ({
        apiFetch: async (url, options) => { calls.push({ url, options }); return { ok: true }; },
        apiRequest: async () => ({ status: 'INATIVA' }),
    }) });
    return { api: exports, calls };
}
test('partida privada identifica modalidade explicitamente', async () => {
    const {api,calls} = load();
    await api.iniciarViagem(1, 'IDA');
    assert.equal(calls[0].url, '/rota/iniciar');
    assert.deepEqual(JSON.parse(calls[0].options.body), {turmaId:1,sentido:'IDA',modalidade:'PRIVADA'});
});
test('partida pública usa endpoint da própria publicação', async () => {
    const {api,calls} = load();
    await api.iniciarViagemPublica(9, 'VOLTA');
    assert.equal(calls[0].url, '/rotas-publicas/9/iniciar');
    assert.deepEqual(JSON.parse(calls[0].options.body), {sentido:'VOLTA'});
});
