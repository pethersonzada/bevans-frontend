const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
// Use the installed SDK's own generator, as Expo CLI does when Metro starts.
const expo = createRequire(require.resolve('expo/package.json'));
const cli = createRequire(expo.resolve('@expo/cli/package.json'));
process.env.EXPO_ROUTER_APP_ROOT = path.join(root, 'src', 'app');
const destination = path.join(root, '.expo', 'types');
fs.mkdirSync(destination, { recursive: true });
cli('@expo/router-server/build/typed-routes').regenerateDeclarations(destination);
