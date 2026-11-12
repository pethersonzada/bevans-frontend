const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const forbidden = ['app', 'components', 'contexts', 'hooks'].map(dir => path.join(root, 'src', dir));
const failures = [];
function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) { inspect(file); continue; }
        if (!/\.tsx?$/.test(file)) continue;
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        const isDomainLayer = ['services', 'types'].some(dir => file.startsWith(path.join(root, 'src', dir) + path.sep));
        for (const statement of source.statements) {
            if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
            const specifier = statement.moduleSpecifier;
            if (!specifier || !ts.isStringLiteral(specifier)) continue;
            const module = specifier.text;
            if (module === 'react-native' && ts.isImportDeclaration(statement)) {
                const bindings = statement.importClause?.namedBindings;
                if (bindings && ts.isNamedImports(bindings) && bindings.elements.some(item => (item.propertyName || item.name).text === 'Alert')) {
                    failures.push(`${path.relative(root, file)} imports native Alert; use useAppAlert instead`);
                }
            }
            if (module.startsWith('@react-navigation/')) {
                failures.push(`${path.relative(root, file)} imports ${module}; use the Expo Router SDK 56+ entry point`);
            }
            const target = module.startsWith('.') ? path.resolve(path.dirname(file), module)
                : module.startsWith('@/') ? path.join(root, module.slice(2)) : null;
            if (isDomainLayer && target && forbidden.some(dir => target === dir || target.startsWith(dir + path.sep))) {
                failures.push(`${path.relative(root, file)} imports UI or routing module ${module}`);
            }
        }
    }
}
inspect(path.join(root, 'src'));
if (failures.length) {
    process.stderr.write(failures.join('\n') + '\n');
    process.exitCode = 1;
} else {
    process.stdout.write('Architecture checks passed: domain boundaries and Expo Router navigation imports.\n');
}
