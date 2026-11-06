// Read source for legacy unit tests that import ../dist. No production/module behavior is mocked.
const Module = require('node:module'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const backend = path.join(root, 'backend');
const ts = require(path.join(backend, 'node_modules/typescript'));
const resolve = Module._resolveFilename;
const dist = path.join(backend, 'dist') + path.sep;
Module._resolveFilename = function(request, parent, ...rest) {
  if (parent && request.startsWith('.')) {
    const target = path.resolve(path.dirname(parent.filename), request);
    if (target.startsWith(dist)) {
      const source = path.join(backend, 'src', target.slice(dist.length).replace(/\.js$/, '') + '.ts');
      if (fs.existsSync(source)) return source;
    }
  }
  return resolve.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true },
}).outputText, file);
