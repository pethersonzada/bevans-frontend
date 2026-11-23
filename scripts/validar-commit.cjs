// Verifica somente arquivos versionados de um commit, sem alterar a árvore de trabalho.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const ref = process.argv[2] || 'HEAD';
if (ref !== 'HEAD' && !/^[a-f0-9]{7,40}$/i.test(ref)) throw Error('Informe HEAD ou o hash de um commit.');
function run(command, args, cwd = root, log) {
    const result = spawnSync(command, args, {
        cwd, env: { ...process.env, CI: 'true', EXPO_NO_DOTENV: '1', EXPO_OFFLINE: '1' },
        encoding: 'utf8', windowsHide: true, maxBuffer: 30 * 1024 * 1024,
    });
    if (log) fs.writeFileSync(log, (result.stdout || '') + (result.stderr || ''));
    if (result.error || result.status !== 0) throw Error(`Falha em ${command}; consulte ${log || 'a saída do Git'}.`);
    return result.stdout.trim();
}
const sha = run('git', ['rev-parse', '--verify', `${ref}^{commit}`]);
const destination = path.join(root, '.expo', 'validacao-commits', `${sha}-${Date.now()}`);
fs.mkdirSync(destination, { recursive: true });
const archive = path.join(destination, 'main.tar');
run('git', ['archive', '--format=tar', `--output=${archive}`, sha]);
run('tar', ['-xf', archive, '-C', destination]);
fs.symlinkSync(path.join(root, 'node_modules'), path.join(destination, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const npm = script => process.platform === 'win32'
    ? run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${script}`], destination, path.join(destination, `${script.replace(':', '-')}.log`))
    : run('npm', ['run', script], destination, path.join(destination, `${script.replace(':', '-')}.log`));
const result = { commit: sha, arquivos: 'git archive; sem alterações locais e sem .env', dependencias: 'node_modules instalado no workspace', check: false, bundleAndroid: false };
try {
    npm('check'); result.check = true;
    npm('bundle:android'); result.bundleAndroid = true;
} finally {
    fs.writeFileSync(path.join(destination, 'resultado.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ...result, evidencias: path.relative(root, destination) }, null, 2));
}
