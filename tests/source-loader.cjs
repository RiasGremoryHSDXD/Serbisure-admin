const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function loader(overrides = {}) {
  const cache = new Map(Object.entries(overrides).map(([name, value]) => [path.resolve(root, name), value]));
  function load(name) {
    const file = path.resolve(root, name);
    if (cache.has(file)) return cache.get(file);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    const module = { exports: {} }; cache.set(file, module.exports);
    const localRequire = name => {
      // Icons are irrelevant to data rendering; avoid the package's CJS/ESM shim in Node.
      if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(file), name);
      const target = [base, base + '.ts', base + '.tsx'].find(file => fs.existsSync(file));
      return load(target);
    };
    new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
    cache.set(file, module.exports); return module.exports;
  }
  return load;
}
module.exports = loader;
