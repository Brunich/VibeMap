import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, stripCommonRoot, keepFile } from '../src/analyze.ts';
import { rpgSample } from '../src/sample-rpg.ts';

test('Godot: la escena principal marca la entrada y class_name conecta archivos', () => {
  const p = analyze(rpgSample, 'Mini RPG');
  assert.equal(p.entries[0], 'scripts/main.gd');
  const main = p.byPath.get('scripts/main.gd')!;
  assert.ok(main.imports.includes('scripts/player.gd'));
  assert.ok(main.imports.includes('scripts/save_system.gd'), 'autoload SaveSystem');
  const player = p.byPath.get('scripts/player.gd')!;
  assert.ok(player.imports.includes('scripts/inventory.gd'));
  assert.ok(player.importedBy.includes('scripts/battle_manager.gd'));
  const gain = player.defs.find(d => d.name === 'gain_xp')!;
  assert.ok(gain.calledFrom.some(c => c.includes('_on_battle_ended')));
  assert.equal(p.byPath.get('scripts/save_system.gd')!.role, 'datos');
  assert.equal(p.flow[0].path, 'scripts/main.gd');
  assert.ok(p.flow.length >= 6);
});

test('TypeScript: imports con .js, alias y nombres importados', () => {
  const p = analyze([
    { path: 'src/main.tsx', content: "import { createRoot } from 'react-dom/client';\nimport App from './App';\ncreateRoot(document.body).render(<App/>);" },
    { path: 'src/App.tsx', content: "import { useState } from 'react';\nimport { load, type Row } from './api.js';\nexport default function App() {\n  const [r] = useState(load());\n  return <Table rows={r}/>;\n}\nfunction Table({ rows }: { rows: Row[] }) { return <div>{rows.length}</div>; }" },
    { path: 'src/api.ts', content: "export type Row = { id: number };\nexport const load = () => JSON.parse(localStorage.getItem('rows') ?? '[]');\nexport function unused() { return 1; }" },
    { path: 'src/old.ts', content: 'export const x = 1;' },
  ]);
  assert.deepEqual(p.entries, ['src/main.tsx']);
  const app = p.byPath.get('src/App.tsx')!;
  assert.deepEqual(app.imports, ['src/api.ts']);
  assert.deepEqual(app.external, ['react']);
  assert.equal(app.defs.find(d => d.name === 'Table')!.kind, 'componente');
  assert.ok(app.defs.find(d => d.name === 'App')!.calls.includes('Table'));
  assert.ok(p.byPath.get('src/api.ts')!.defs.find(d => d.name === 'load')!.calledFrom.includes('App.tsx · App'));
  assert.equal(p.byPath.get('src/api.ts')!.role, 'datos');
  assert.ok(p.alerts.some(a => a.kind === 'huérfano' && a.paths[0] === 'src/old.ts'));
  assert.ok(p.alerts.some(a => a.kind === 'sin-usar' && a.text.includes('unused')));
});

test('Python: imports relativos y ciclos', () => {
  const p = analyze([
    { path: 'app/main.py', content: 'from .game import run\n\nif __name__ == "__main__":\n    run()\n' },
    { path: 'app/game.py', content: 'from . import board\nimport random\n\ndef run():\n    board.draw()\n' },
    { path: 'app/board.py', content: 'from .game import run\n\ndef draw():\n    print("x")\n' },
  ]);
  assert.equal(p.entries[0], 'app/main.py');
  assert.deepEqual(p.byPath.get('app/game.py')!.external, ['random']);
  assert.ok(p.byPath.get('app/game.py')!.imports.includes('app/board.py'));
  assert.ok(p.alerts.some(a => a.kind === 'ciclo'));
});

test('filtros al subir una carpeta', () => {
  assert.equal(keepFile('node_modules/react/index.js', 10), false);
  assert.equal(keepFile('src/logo.png', 10), false);
  assert.equal(keepFile('src/a.ts', 10), true);
  const r = stripCommonRoot([{ path: 'mi-app/src/a.ts', content: '' }, { path: 'mi-app/b.ts', content: '' }]);
  assert.equal(r.name, 'mi-app');
  assert.equal(r.files[0].path, 'src/a.ts');
});
