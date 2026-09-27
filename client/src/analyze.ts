// Lee el código de un proyecto y lo interpreta: qué archivo arranca, quién usa a quién,
// qué funciones define cada uno y por dónde fluye. Todo corre en el navegador.

export type ProjectFile = { path: string; content: string };
export type Lang = 'ts' | 'js' | 'py' | 'gd' | 'css' | 'html' | 'json' | 'md' | 'other';
export type Role = 'entrada' | 'interfaz' | 'logica' | 'datos' | 'estilos' | 'config' | 'pruebas';
export type DefKind = 'componente' | 'clase' | 'función' | 'método';
export type Def = { name: string; line: number; kind: DefKind; exported: boolean; calls: string[]; calledFrom: string[] };
export type FileInfo = {
  path: string; name: string; dir: string; lang: Lang; lines: number; role: Role;
  imports: string[]; external: string[]; importedBy: string[];
  /** por cada archivo importado, los nombres que toma de él */
  uses: Record<string, string[]>;
  defs: Def[]; entryScore: number;
};
export type Step = { n: number; path: string; from: string | null; names: string[] };
export type Alert = { kind: 'ciclo' | 'huérfano' | 'grande' | 'sin-usar'; paths: string[]; text: string };
export type Project = {
  name: string; files: FileInfo[]; byPath: Map<string, FileInfo>;
  entries: string[]; flow: Step[]; alerts: Alert[];
  totals: { files: number; lines: number; defs: number; links: number; langs: [Lang, number][] };
};

export const ROLE_ORDER: Role[] = ['entrada', 'interfaz', 'logica', 'datos', 'estilos', 'config', 'pruebas'];
const CODE: Lang[] = ['ts', 'js', 'py', 'gd'];
export const isCode = (f: { lang: Lang }) => CODE.includes(f.lang);

const IGNORED = /(^|\/)(node_modules|\.git|dist|build|out|coverage|\.next|\.vercel|\.godot|\.import|__pycache__|\.venv|venv|\.idea|\.vscode|android|ios|Pods|vendor|third_party|addons)(\/|$)/;
const TEXT_EXT = /\.(tsx?|jsx?|mjs|cjs|py|gd|css|scss|html?|json|md|tscn|cfg|toml|ya?ml|godot)$/i;
export const MAX_FILE_CHARS = 300_000;
export const MAX_FILES = 1500;

export function keepFile(path: string, size: number): boolean {
  return !IGNORED.test(path) && TEXT_EXT.test(path) && size <= MAX_FILE_CHARS && !/(package-lock|yarn\.lock|pnpm-lock)/.test(path) && !/\.min\.(js|css)$/.test(path) && !/-[A-Za-z0-9_]{8}\.(js|css)$/.test(path);
}

export function langOf(path: string): Lang {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (['ts', 'tsx', 'mts', 'cts'].includes(ext)) return 'ts';
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'js';
  if (ext === 'py') return 'py';
  if (ext === 'gd') return 'gd';
  if (['css', 'scss'].includes(ext)) return 'css';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (['json', 'toml', 'yaml', 'yml', 'cfg', 'godot', 'tscn'].includes(ext)) return 'json';
  if (ext === 'md') return 'md';
  return 'other';
}

const norm = (p: string) => {
  const out: string[] = [];
  for (const part of p.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop(); else out.push(part);
  }
  return out.join('/');
};
const dirOf = (p: string) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
const baseOf = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** Quita la carpeta raíz común (la que sube el navegador al elegir una carpeta). */
export function stripCommonRoot(files: ProjectFile[]): { name: string; files: ProjectFile[] } {
  const firsts = new Set(files.map(f => f.path.split('/')[0]));
  if (firsts.size === 1 && files.every(f => f.path.includes('/'))) {
    const root = [...firsts][0];
    return { name: root, files: files.map(f => ({ ...f, path: f.path.slice(root.length + 1) })) };
  }
  return { name: 'proyecto', files };
}

// ---------- imports ----------
type RawImport = { spec: string; names: string[] };

function jsImports(src: string): RawImport[] {
  const out: RawImport[] = [];
  const re = /(?:^|[;\n])\s*(?:import|export)\s+(type\s+)?([^;]{0,600}?)\s*from\s*['"]([^'"]+)['"]|(?:^|[;\n])\s*import\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of src.matchAll(re)) {
    if (m[3]) {
      if (m[1]) continue; // import type: no hay flujo en tiempo de ejecución
      const clause = m[2];
      const names: string[] = [];
      const def = clause.match(/^([A-Za-z_$][\w$]*)/);
      if (def && def[1] !== 'type') names.push(def[1]);
      const braces = clause.match(/\{([\s\S]*)\}/);
      if (braces) for (const part of braces[1].split(',')) {
        const p = part.trim().replace(/^type\s+/, '');
        if (!p || part.trim().startsWith('type ')) continue;
        const [orig, alias] = p.split(/\s+as\s+/);
        names.push((alias || orig).trim());
      }
      const star = clause.match(/\*\s+as\s+(\w+)/);
      if (star) names.push(star[1]);
      out.push({ spec: m[3], names });
    } else {
      const spec = m[4] || m[5] || m[6];
      if (spec) out.push({ spec, names: [] });
    }
  }
  return out;
}

function pyImports(src: string): RawImport[] {
  const out: RawImport[] = [];
  for (const m of src.matchAll(/^\s*from\s+([.\w]+)\s+import\s+\(?([^)\n]+)\)?/gm)) {
    const names = m[2].split(',').map(s => s.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean);
    // `from . import board`: cada nombre es un módulo hermano
    if (/^\.+$/.test(m[1])) for (const n of names) out.push({ spec: m[1] + n, names: [n] });
    else out.push({ spec: m[1], names });
  }
  for (const m of src.matchAll(/^\s*import\s+([\w.]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w.]+(?:\s+as\s+\w+)?)*)/gm))
    for (const part of m[1].split(',')) {
      const [mod, alias] = part.trim().split(/\s+as\s+/);
      out.push({ spec: mod.trim(), names: [alias?.trim() || mod.trim().split('.')[0]] });
    }
  return out;
}

function gdImports(src: string): RawImport[] {
  const out: RawImport[] = [];
  for (const m of src.matchAll(/(?:preload|load)\(\s*["'](res:\/\/[^"']+)["']\s*\)|^extends\s+["'](res:\/\/[^"']+)["']/gm)) out.push({ spec: m[1] || m[2], names: [] });
  return out;
}

function webImports(src: string, lang: Lang): RawImport[] {
  const out: RawImport[] = [];
  if (lang === 'css') for (const m of src.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)) out.push({ spec: m[1], names: [] });
  if (lang === 'html') for (const m of src.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)=["']([^"']+)["']/g)) out.push({ spec: m[1], names: [] });
  return out;
}

const JS_EXT = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

function resolve(fromPath: string, lang: Lang, spec: string, paths: Set<string>, godotRoot: string): string | { external: string } | null {
  const clean = spec.split('?')[0];
  if (lang === 'gd' || clean.startsWith('res://')) {
    const p = norm((godotRoot ? godotRoot + '/' : '') + clean.slice(6));
    return paths.has(p) ? p : null;
  }
  if (lang === 'py') {
    const dots = clean.match(/^\.*/)![0].length;
    const mod = clean.slice(dots).replace(/\./g, '/');
    const candidates: string[] = [];
    if (dots) {
      let base = dirOf(fromPath);
      for (let i = 1; i < dots; i++) base = dirOf(base);
      candidates.push(norm(`${base}/${mod}`));
    } else {
      candidates.push(mod, norm(`${dirOf(fromPath)}/${mod}`));
    }
    for (const c of candidates) for (const ext of ['.py', '/__init__.py']) if (paths.has(c + ext)) return c + ext;
    if (!dots) {
      const tail = '/' + mod + '.py';
      const hit = [...paths].find(p => p.endsWith(tail));
      if (hit) return hit;
      return { external: clean.split('.')[0] };
    }
    return null;
  }
  if (clean.startsWith('.') || clean.startsWith('/')) {
    const base = clean.startsWith('/') ? norm(clean) : norm(`${dirOf(fromPath)}/${clean}`);
    const tries = [base, base.replace(/\.(m|c)?js$/, '.ts'), base.replace(/\.jsx$/, '.tsx'), base.replace(/\.js$/, '.tsx')];
    for (const t of tries) for (const ext of JS_EXT) if (paths.has(t + ext)) return t + ext;
    if (clean.startsWith('/')) for (const ext of JS_EXT) {
      const hit = [...paths].find(p => p.endsWith(clean.slice(1) + ext) && (ext || p.endsWith(clean.slice(1))));
      if (hit) return hit;
    }
    return null;
  }
  if (/^(@|~)\//.test(clean)) {
    const rest = clean.slice(2);
    for (const root of ['src/', 'client/src/', '']) for (const ext of JS_EXT) if (paths.has(root + rest + ext)) return root + rest + ext;
    return null;
  }
  if (lang === 'css' || lang === 'html') return null;
  const pkg = clean.startsWith('@') ? clean.split('/').slice(0, 2).join('/') : clean.split('/')[0];
  return { external: pkg.replace(/^node:/, '') };
}

// ---------- definiciones ----------
const JS_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'constructor', 'else', 'do', 'try', 'with']);

function jsDefs(src: string, lang: Lang, path: string): Omit<Def, 'calls' | 'calledFrom'>[] {
  const out: Omit<Def, 'calls' | 'calledFrom'>[] = [];
  const jsx = /\.(tsx|jsx)$/.test(path);
  const lines = src.split('\n');
  let inClass = 0, depth = 0;
  lines.forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '');
    const exported = /^\s*export\b/.test(line);
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/))) {
      out.push({ name: m[1], line: i + 1, kind: 'clase', exported }); inClass = depth + 1;
    } else if ((m = line.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/))
      || (m = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>|\(\s*\{)/))) {
      const name = m[1];
      const kind: DefKind = jsx && /^[A-Z]/.test(name) ? 'componente' : 'función';
      if (!(depth > 0 && !inClass && /^\s{2,}/.test(raw) && kind === 'función' && !exported)) out.push({ name, line: i + 1, kind, exported });
    } else if (inClass && depth === inClass && (m = line.match(/^\s+(?:public\s+|private\s+|protected\s+|static\s+|async\s+|override\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{/)) && !JS_KEYWORDS.has(m[1])) {
      out.push({ name: m[1], line: i + 1, kind: 'método', exported: false });
    }
    for (const ch of line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (inClass && depth < inClass) inClass = 0; }
    }
  });
  void lang;
  return out;
}

function pyDefs(src: string): Omit<Def, 'calls' | 'calledFrom'>[] {
  const out: Omit<Def, 'calls' | 'calledFrom'>[] = [];
  src.split('\n').forEach((line, i) => {
    const m = line.match(/^(\s*)(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)/);
    if (!m) return;
    const nested = m[1].length > 0;
    out.push({ name: m[3], line: i + 1, kind: m[2] === 'class' ? 'clase' : nested ? 'método' : 'función', exported: !m[3].startsWith('_') && !nested });
  });
  return out;
}

function gdDefs(src: string): Omit<Def, 'calls' | 'calledFrom'>[] {
  const out: Omit<Def, 'calls' | 'calledFrom'>[] = [];
  src.split('\n').forEach((line, i) => {
    let m = line.match(/^class_name\s+([A-Za-z_]\w*)/);
    if (m) { out.push({ name: m[1], line: i + 1, kind: 'clase', exported: true }); return; }
    m = line.match(/^(\s*)(?:static\s+)?func\s+([A-Za-z_]\w*)/);
    if (m) out.push({ name: m[2], line: i + 1, kind: m[1] ? 'método' : 'función', exported: !m[2].startsWith('_') });
    m = line.match(/^class\s+([A-Za-z_]\w*)/);
    if (m) out.push({ name: m[1], line: i + 1, kind: 'clase', exported: false });
  });
  return out;
}

const stripComments = (src: string, lang: Lang) => lang === 'py' || lang === 'gd'
  ? src.replace(/#.*$/gm, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Vacía cadenas y expresiones regulares: su texto no es código que se ejecute. */
const stripLiterals = (src: string) => src
  .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""')
  .replace(/(^|[=(,:[!&|?{};]\s*)\/(?![*/])(?:\\.|\[(?:\\.|[^\]\n])*\]|[^/\\\n])+\/[gimsuyd]*/gm, '$1/r/');

const esc = (s: string) => s.replace(/[$]/g, '\\$');
const callRe = (name: string, kind: DefKind) => kind === 'componente'
  ? new RegExp(`<${esc(name)}\\b|\\b${esc(name)}\\s*\\(`)
  : kind === 'clase' ? new RegExp(`\\b${esc(name)}\\b`) : new RegExp(`(?<![\\w$])${esc(name)}\\s*\\(`);

// ---------- rol ----------
function roleOf(f: FileInfo, src: string): Role {
  const p = f.path.toLowerCase();
  if (/(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.|(^|\/)test_[^/]*\.py$/.test(p)) return 'pruebas';
  if (f.lang === 'css') return 'estilos';
  if (f.lang === 'json' || f.lang === 'md' || /(^|\/)[^/]*\.config\.[mc]?[jt]s$|(^|\/)(eslint|vite|webpack|babel|jest|playwright)[^/]*$/.test(p)) return 'config';
  if (f.entryScore >= 3) return 'entrada';
  if (/(^|\/)(api|server|db|database|models?|store|stores|services?|repositor(y|ies)|data|lib\/api|supabase|queries)(\/|\.|$)|client\.(ts|js|py)$|(^|\/)(db|api|server|models?)\.[a-z]+$/.test(p)) return 'datos';
  // Un componente de React es interfaz aunque también pida datos.
  if (f.lang === 'html' || /\.(tsx|jsx)$/.test(p) || /(^|\/)(components?|pages|views|ui|screens|widgets)\//.test(p)) return 'interfaz';
  const code = f.lang === 'ts' || f.lang === 'js' ? stripLiterals(src) : src;
  if (/\bfetch\(|express\(|createClient\(|sqlite3|axios\.|requests\.(get|post)|localStorage\.|FileAccess\.|ResourceSaver|\bsqlalchemy\b|\bpandas\b/.test(code) || /\bopen\([^)]*['"][rwa]b?['"]/.test(src)) return 'datos';
  if (/^extends\s+(Control|CanvasLayer|Label|Button|Panel)/m.test(src) || /\b(tkinter|pygame\.display|render_template)\b/.test(code)) return 'interfaz';
  return 'logica';
}

function entryScoreOf(path: string, src: string, lang: Lang): number {
  const b = baseOf(path).toLowerCase();
  let s = 0;
  if (/^(main|index)\.(tsx?|jsx?|mjs)$/.test(b)) s += 3;
  if (/^(server|app)\.(ts|js|mjs|py)$/.test(b)) s += 2;
  if (b === 'main.py' || b === 'main.gd' || b === 'game.gd') s += 3;
  if (lang === 'py' && /if\s+__name__\s*==\s*['"]__main__['"]/.test(src)) s += 3;
  if (/createRoot\(|ReactDOM\.render\(|app\.listen\(|new\s+Vue\(|createApp\(/.test(src)) s += 3;
  if (lang === 'gd' && /func\s+_ready\s*\(/.test(src) && /change_scene|add_child\(|instantiate\(/.test(src)) s += 1;
  if (path.split('/').length > 3) s -= 1;
  return s;
}

// ---------- análisis ----------
export function analyze(input: ProjectFile[], projectName = 'proyecto'): Project {
  const files: ProjectFile[] = input.map(f => ({ path: norm(f.path), content: f.content.replace(/\r\n?/g, '\n') })).filter(f => f.path);
  const paths = new Set(files.map(f => f.path));
  const godotFile = files.find(f => baseOf(f.path) === 'project.godot');
  const godotRoot = godotFile ? dirOf(godotFile.path) : '';
  let mainScene = '';
  if (godotFile) mainScene = godotFile.content.match(/run\/main_scene\s*=\s*"res:\/\/([^"]+)"/)?.[1] ?? '';

  const infos: FileInfo[] = [];
  const rawImports = new Map<string, RawImport[]>();
  const clean = new Map<string, string>();
  for (const f of files) {
    const generated = f.content.length > 20_000 && f.content.length / (f.content.split('\n').length || 1) > 250;
    const lang = generated ? 'other' : langOf(f.path);
    const src = isCode({ lang }) ? stripComments(f.content, lang) : f.content;
    clean.set(f.path, src);
    const imp = lang === 'ts' || lang === 'js' ? jsImports(src) : lang === 'py' ? pyImports(src) : lang === 'gd' ? gdImports(src) : webImports(f.content, lang);
    rawImports.set(f.path, imp);
    const defs = (lang === 'ts' || lang === 'js' ? jsDefs(src, lang, f.path) : lang === 'py' ? pyDefs(src) : lang === 'gd' ? gdDefs(src) : []).map(d => ({ ...d, calls: [], calledFrom: [] }));
    infos.push({
      path: f.path, name: baseOf(f.path), dir: dirOf(f.path), lang, lines: f.content ? f.content.split('\n').length : 0, role: 'logica',
      imports: [], external: [], importedBy: [], uses: {}, defs, entryScore: entryScoreOf(f.path, src, lang),
    });
  }
  const byPath = new Map(infos.map(f => [f.path, f]));

  // Godot: la escena principal apunta a su script, y las clases con class_name son globales.
  if (mainScene) {
    const scene = files.find(f => f.path === norm((godotRoot ? godotRoot + '/' : '') + mainScene));
    const script = scene?.content.match(/path="res:\/\/([^"]+\.gd)"/)?.[1];
    const target = script && byPath.get(norm((godotRoot ? godotRoot + '/' : '') + script));
    if (target) target.entryScore += 4;
  }
  const gdGlobals = new Map<string, string>();
  for (const f of infos) if (f.lang === 'gd') for (const d of f.defs) if (d.kind === 'clase' && d.exported) gdGlobals.set(d.name, f.path);
  const autoload = godotFile?.content.split(/\[autoload\]/)[1]?.split(/\n\[/)[0] ?? '';
  for (const m of autoload.matchAll(/^(\w+)="\*?res:\/\/([^"]+)"/gm)) {
    const p = norm((godotRoot ? godotRoot + '/' : '') + m[2]);
    if (byPath.has(p)) { gdGlobals.set(m[1], p); byPath.get(p)!.defs.unshift({ name: m[1], line: 1, kind: 'clase', exported: true, calls: [], calledFrom: [] }); }
  }

  const importedNames = new Map<string, Map<string, string[]>>(); // archivo -> (destino -> nombres)
  for (const f of infos) {
    const names = new Map<string, string[]>();
    const add = (to: string, n: string[]) => { if (to === f.path) return; if (!f.imports.includes(to)) f.imports.push(to); names.set(to, [...(names.get(to) ?? []), ...n]); };
    for (const imp of rawImports.get(f.path)!) {
      const r = resolve(f.path, f.lang, imp.spec, paths, godotRoot);
      if (typeof r === 'string') add(r, imp.names);
      else if (r && !f.external.includes(r.external)) f.external.push(r.external);
    }
    if (f.lang === 'gd') {
      const src = clean.get(f.path)!;
      for (const [cls, where] of gdGlobals) if (where !== f.path && new RegExp(`\\b${cls}\\b`).test(src)) add(where, [cls]);
    }
    importedNames.set(f.path, names);
    for (const [to, n] of names) f.uses[to] = [...new Set(n)];
  }
  for (const f of infos) for (const to of f.imports) byPath.get(to)!.importedBy.push(f.path);

  // Llamadas: dentro del archivo, y hacia archivos que importa.
  for (const f of infos) {
    if (!isCode(f)) continue;
    const src = clean.get(f.path)!;
    const lines = src.split('\n');
    const bodies = f.defs.map((d, i) => {
      const next = f.defs.slice(i + 1).find(o => o.kind !== 'método' || d.kind === 'método' || d.kind === 'clase');
      return lines.slice(d.line, next ? next.line - 1 : lines.length).join('\n');
    });
    const inDef = new Array(lines.length).fill(false);
    f.defs.forEach((d, k) => { for (let i = d.line - 1; i < (f.defs[k + 1]?.line ?? lines.length + 1) - 1; i++) inDef[i] = true; });
    const topLevel = lines.filter((_, i) => !inDef[i]).join('\n');
    const targets: { def: Def; file: FileInfo }[] = [];
    for (const d of f.defs) targets.push({ def: d, file: f });
    for (const [to, names] of importedNames.get(f.path)!) {
      const t = byPath.get(to)!;
      const js = f.lang === 'ts' || f.lang === 'js';
      for (const d of t.defs) {
        if (d.name.startsWith('__') || d.name.length < 3) continue;
        if (js ? (d.kind === 'método' || (names.length > 0 && !names.includes(d.name) && !names.some(n => /^[a-z]/.test(n) && n.length > 0 && t.defs.every(x => x.name !== n)))) : false) continue;
        targets.push({ def: d, file: t });
      }
    }
    f.defs.forEach((d, i) => {
      for (const t of targets) {
        if (t.def === d || t.def.name.length < 2) continue;
        if (callRe(t.def.name, t.def.kind).test(bodies[i])) {
          const label = t.file === f ? t.def.name : `${t.file.name} · ${t.def.name}`;
          if (!d.calls.includes(label)) d.calls.push(label);
          const from = t.file === f ? d.name : `${f.name} · ${d.name}`;
          if (!t.def.calledFrom.includes(from)) t.def.calledFrom.push(from);
        }
      }
    });
    for (const t of targets) if (t.file !== f && callRe(t.def.name, t.def.kind).test(topLevel)) {
      const from = `${f.name}`;
      if (!t.def.calledFrom.includes(from)) t.def.calledFrom.push(from);
    }
  }

  // Entradas y roles
  const reach = (start: string) => { const seen = new Set([start]); const q = [start]; while (q.length) for (const n of byPath.get(q.shift()!)!.imports) if (!seen.has(n)) { seen.add(n); q.push(n); } return seen.size; };
  const code = infos.filter(isCode);
  let entries = code.filter(f => f.entryScore >= 3 && !/(^|\/)(tests?|__tests__)\//.test(f.path)).sort((a, b) => reach(b.path) - reach(a.path) || b.entryScore - a.entryScore).map(f => f.path);
  if (!entries.length) {
    const roots = code.filter(f => !f.importedBy.length && f.imports.length).sort((a, b) => reach(b.path) - reach(a.path));
    if (roots[0]) { roots[0].entryScore = 3; entries = [roots[0].path]; }
  }
  for (const f of infos) f.role = roleOf(f, clean.get(f.path)!);

  const flow = flowFrom(entries[0] ?? null, byPath, importedNames);
  const alerts = findAlerts(infos, entries, byPath);
  const langCount = new Map<Lang, number>();
  for (const f of infos) langCount.set(f.lang, (langCount.get(f.lang) ?? 0) + 1);
  return {
    name: projectName, files: infos, byPath, entries, flow, alerts,
    totals: {
      files: infos.length, lines: infos.reduce((s, f) => s + f.lines, 0), defs: infos.reduce((s, f) => s + f.defs.length, 0),
      links: infos.reduce((s, f) => s + f.imports.length, 0), langs: [...langCount].sort((a, b) => b[1] - a[1]),
    },
  };
}

export function flowFrom(entry: string | null, byPath: Map<string, FileInfo>, importedNames?: Map<string, Map<string, string[]>>, max = 14): Step[] {
  if (!entry) return [];
  const steps: Step[] = [{ n: 1, path: entry, from: null, names: [] }];
  const seen = new Set([entry]);
  const q = [entry];
  while (q.length && steps.length < max) {
    const cur = q.shift()!;
    const f = byPath.get(cur)!;
    const next = [...f.imports].filter(p => !seen.has(p)).sort((a, b) => Number(isCode(byPath.get(b)!)) - Number(isCode(byPath.get(a)!)) || byPath.get(b)!.importedBy.length - byPath.get(a)!.importedBy.length);
    for (const p of next) {
      if (steps.length >= max) break;
      seen.add(p); q.push(p);
      const names = importedNames?.get(cur)?.get(p) ?? [];
      steps.push({ n: steps.length + 1, path: p, from: cur, names: [...new Set(names)].slice(0, 4) });
    }
  }
  return steps;
}

function findAlerts(infos: FileInfo[], entries: string[], byPath: Map<string, FileInfo>): Alert[] {
  const alerts: Alert[] = [];
  const calledNames = new Set(infos.flatMap(f => f.defs.filter(d => d.calledFrom.length).map(d => d.name)));
  // ciclos
  const state = new Map<string, number>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const visit = (p: string) => {
    state.set(p, 1); stack.push(p);
    for (const n of byPath.get(p)!.imports) {
      if (cycles.length >= 3) break;
      if (state.get(n) === 1) cycles.push(stack.slice(stack.indexOf(n)));
      else if (!state.get(n)) visit(n);
    }
    stack.pop(); state.set(p, 2);
  };
  for (const f of infos) if (!state.get(f.path) && isCode(f)) visit(f.path);
  for (const c of cycles) alerts.push({ kind: 'ciclo', paths: c, text: `${c.map(p => baseOf(p)).join(' → ')} → ${baseOf(c[0])}: se importan en círculo.` });
  // Huérfano: vive junto a código que sí se usa, pero nadie lo alcanza desde una entrada.
  // Una carpeta de scripts sueltos (tools/, scripts/) no cuenta.
  const reached = new Set<string>(entries);
  const q = [...entries];
  while (q.length) for (const n of byPath.get(q.shift()!)!.imports) if (!reached.has(n)) { reached.add(n); q.push(n); }
  const liveDirs = new Set([...reached].map(dirOf));
  for (const f of infos) {
    if (!isCode(f) || f.role === 'pruebas' || f.role === 'config' || f.path.endsWith('.d.ts')) continue;
    if (!reached.has(f.path) && !f.importedBy.length && liveDirs.has(f.dir) && f.lang !== 'py') alerts.push({ kind: 'huérfano', paths: [f.path], text: `${f.name}: ningún archivo lo usa.` });
    if (f.lines > 400) alerts.push({ kind: 'grande', paths: [f.path], text: `${f.name}: ${f.lines.toLocaleString('es-MX')} líneas; conviene partirlo.` });
    // Un método que otro archivo redefine (herencia) cuenta como usado si alguna versión se llama.
    const unused = f.defs.filter(d => d.exported && d.kind !== 'método' && !d.calledFrom.length && f.importedBy.length && !entries.includes(f.path) && !calledNames.has(d.name));
    if (unused.length) alerts.push({ kind: 'sin-usar', paths: [f.path], text: `${f.name}: ${unused.slice(0, 3).map(d => d.name).join(', ')}${unused.length > 3 ? ` y ${unused.length - 3} más` : ''} no se llama${unused.length > 1 ? 'n' : ''} desde otro archivo.` });
  }
  return alerts;
}

/** Frase corta que explica el papel de un archivo con datos del propio código. */
export function describe(f: FileInfo, project: Project): string {
  const roleText: Record<Role, string> = {
    entrada: 'Es donde arranca el proyecto',
    interfaz: 'Dibuja parte de la interfaz',
    logica: 'Guarda lógica del proyecto',
    datos: 'Mueve datos: lee, guarda o pide a un servidor',
    estilos: 'Define estilos',
    config: 'Configura el proyecto',
    pruebas: 'Prueba el código',
  };
  const parts = [roleText[f.role]];
  const main = [...f.defs].sort((a, b) => b.calledFrom.length - a.calledFrom.length).filter(d => d.kind !== 'método').slice(0, 2).map(d => d.name);
  if (main.length) parts.push(`sobre todo con ${main.join(' y ')}`);
  let s = parts.join(', ') + '.';
  if (f.importedBy.length) s += ` Lo usan ${f.importedBy.length} archivo${f.importedBy.length > 1 ? 's' : ''}.`;
  if (project.entries[0] === f.path) s += ' Todo el recorrido empieza aquí.';
  return s;
}
