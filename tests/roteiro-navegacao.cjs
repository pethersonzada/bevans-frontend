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
const { validarPontoRoteiro, assinaturaRoteiro } = exportsRoteiro;

test('roteiro deve conter exatamente os passageiros da operação ativa', () => {
    const { conferirSnapshotRoteiro } = exportsRoteiro;
    const pontos = [{ id: 8 }, { id: 9 }];
    const operacao = { referenciaId: 42, tipo: 'VIAGEM', sentido: 'IDA', contadores: { esperados: 2 }, registros: [{ alunoId: 8 }, { alunoId: 9 }] };
    assert.doesNotThrow(() => conferirSnapshotRoteiro(pontos, operacao, 42, 'IDA'));
    for (const [lista, op, viagem, sentido] of [
        [[], operacao, 42, 'IDA'],
        [[{ id: 8 }, { id: 7 }], operacao, 42, 'IDA'],
        [pontos, operacao, 43, 'IDA'],
        [pontos, operacao, 42, 'VOLTA'],
        [pontos, { ...operacao, registros: [{ alunoId: 8 }, { alunoId: 8 }] }, 42, 'IDA'],
    ]) assert.throws(() => conferirSnapshotRoteiro(lista, op, viagem, sentido), /não correspondem/);
    assert.doesNotThrow(() => conferirSnapshotRoteiro([], { ...operacao, registros: [], contadores: { esperados: 0 } }, 42, 'IDA'));
});

test('ponto obrigatório inválido bloqueia o roteiro em vez de desaparecer', () => {
    for (const ponto of [
        { id: 0, latitude: -8, longitude: -35 },
        { id: 1, latitude: 91, longitude: -35 },
        { id: 1, latitude: -8, longitude: NaN },
        { id: 1, latitude: 0, longitude: 0 },
    ]) assert.throws(() => validarPontoRoteiro(ponto), /ponto obrigatório/);
    assert.equal(validarPontoRoteiro({ id: 1, latitude: 0, longitude: -35 }).latitude, 0);
});

test('cache distingue endereço, destino, ordem e pontos pendentes com os mesmos IDs', () => {
    const destino = { latitude: -8.3, longitude: -35.3 };
    const pontos = [{ id: 1, latitude: -8, longitude: -35 }, { id: 2, latitude: -8.1, longitude: -35.1 }];
    const chave = assinaturaRoteiro(pontos, destino);
    assert.notEqual(chave, assinaturaRoteiro([{ ...pontos[0], latitude: -8.2 }, pontos[1]], destino));
    assert.notEqual(chave, assinaturaRoteiro(pontos, { ...destino, longitude: -35.4 }));
    assert.notEqual(chave, assinaturaRoteiro([...pontos].reverse(), destino));
    assert.notEqual(chave, assinaturaRoteiro(pontos.slice(1), destino));
    assert.equal(chave, assinaturaRoteiro(pontos, destino));
});

test('parada obrigatória com coordenada inválida bloqueia a navegação pública', () => {
    assert.throws(() => montarParadasDefinidas([], [{ id: 1, latitude: -91, longitude: -35 }], 'IDA'), /ponto obrigatório/);
});

const paradas = [
    { id: 11, nome: 'Praça', latitude: -8.1, longitude: -34.9 },
    { id: 22, nome: 'Escola', latitude: -8.2, longitude: -35.0 },
];

test('IDA visita as paradas cadastradas mesmo sem reservas', () => {
    const antes = JSON.stringify(paradas);
    const ordem = montarParadasDefinidas([], paradas, 'IDA');
    assert.deepEqual(Array.from(ordem, p => p.id), [-11, -22]);
    assert.equal(JSON.stringify(paradas), antes);
});

test('VOLTA percorre as paradas em ordem inversa sem mutar a origem', () => {
    const ordem = montarParadasDefinidas([], paradas, 'VOLTA');
    assert.deepEqual(Array.from(ordem, p => p.id), [-22, -11]);
    assert.equal(paradas[0].id, 11);
});

test('passageiro embarcando na parada não cria waypoint duplicado', () => {
    const passageiros = [
        { id: 100, nome: 'Passageiro 1', latitude: -8.100001, longitude: -34.9 },
        { id: 200, nome: 'Passageiro 2', latitude: -8.15, longitude: -34.95 },
    ];
    const ordem = montarParadasDefinidas(passageiros, paradas, 'IDA');
    assert.deepEqual(Array.from(ordem, p => p.id), [-11, -22, 200]);
});

test('paradas sem identidade não podem entrar na navegação', () => {
    assert.throws(
        () => montarParadasDefinidas([], [{ ...paradas[0], id: 0 }], 'IDA'),
        /identificador válido/
    );
    assert.throws(
        () => montarParadasDefinidas([], [paradas[0], paradas[0]], 'IDA'),
        /identificador válido/
    );
});
