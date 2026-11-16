const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const exportsRoteiro = {};
vm.runInNewContext(
    ts.transpileModule(
        fs.readFileSync('src/services/roteiroNavegacao.ts', 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS } }
    ).outputText,
    { exports: exportsRoteiro, Error, Set, Number, Math }
);
const { montarParadasDefinidas } = exportsRoteiro;

const paradas = [
    { id: 11, nome: 'Praça', latitude: -8.1, longitude: -34.9 },
    { id: 22, nome: 'Escola', latitude: -8.2, longitude: -35.0 },
];

test('IDA visita as paradas cadastradas mesmo sem reservas', () => {
    const antes = JSON.stringify(paradas);
    const ordem = montarParadasPublicas([], paradas, 'IDA');
    assert.deepEqual(Array.from(ordem, p => p.id), [-11, -22]);
    assert.equal(JSON.stringify(paradas), antes);
});

test('VOLTA percorre as paradas em ordem inversa sem mutar a origem', () => {
    const ordem = montarParadasPublicas([], paradas, 'VOLTA');
    assert.deepEqual(Array.from(ordem, p => p.id), [-22, -11]);
    assert.equal(paradas[0].id, 11);
});

test('passageiro embarcando na parada não cria waypoint duplicado', () => {
    const passageiros = [
        { id: 100, nome: 'Passageiro 1', latitude: -8.100001, longitude: -34.9 },
        { id: 200, nome: 'Passageiro 2', latitude: -8.15, longitude: -34.95 },
    ];
    const ordem = montarParadasPublicas(passageiros, paradas, 'IDA');
    assert.deepEqual(Array.from(ordem, p => p.id), [-11, -22, 200]);
});

test('paradas sem identidade não podem entrar na navegação', () => {
    assert.throws(
        () => montarParadasPublicas([], [{ ...paradas[0], id: 0 }], 'IDA'),
        /identificador válido/
    );
    assert.throws(
        () => montarParadasPublicas([], [paradas[0], paradas[0]], 'IDA'),
        /identificador válido/
    );
});
