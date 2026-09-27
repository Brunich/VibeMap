import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import { analyze, flowFrom, isCode, keepFile, langOf, stripCommonRoot, MAX_FILES, ROLE_ORDER, type Alert, type Project, type ProjectFile, type Role } from './analyze';
import MindMap, { type Branch } from './MindMap';
import FileView from './FileView';
import { LANG, ROLE, plural } from './roles';
import { rpgSample, vibemapSample } from './samples';

type Tab = 'mapa' | 'recorrido' | 'archivos' | 'alertas';
type Loaded = { project: Project; sources: Map<string, string>; skipped: number };

// ---------- lectura de carpetas ----------
async function readFile(file: File, path: string): Promise<ProjectFile | null> {
  if (!keepFile(path, file.size)) return null;
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.subarray(0, 4000).includes(0)) return null;
  return { path, content: new TextDecoder('utf-8').decode(buf) };
}

async function readEntry(entry: FileSystemEntry, out: Promise<ProjectFile | null>[], counter: { seen: number }): Promise<void> {
  const path = entry.fullPath.replace(/^\//, '');
  if (!keepFile(entry.isDirectory ? path + '/x.ts' : path, 0) && entry.isDirectory) return;
  if (entry.isFile) {
    counter.seen++;
    if (out.length >= MAX_FILES) return;
    out.push(new Promise(res => (entry as FileSystemFileEntry).file(f => readFile(f, path).then(res, () => res(null)), () => res(null))));
    return;
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  let batch: FileSystemEntry[];
  do {
    batch = await new Promise<FileSystemEntry[]>(res => reader.readEntries(res, () => res([])));
    for (const e of batch) await readEntry(e, out, counter);
  } while (batch.length);
}

function load(files: ProjectFile[], fallbackName: string, seen = files.length): Loaded {
  const { name, files: clean } = stripCommonRoot(files);
  const project = analyze(clean, name === 'proyecto' ? fallbackName : name);
  return { project, sources: new Map(clean.map(f => [f.path.replace(/\\/g, '/'), f.content])), skipped: Math.max(0, seen - files.length) };
}

// ---------- vistas ----------
function Overview({ project, onOpen }: { project: Project; onOpen: (p: string) => void }) {
  const branches: Branch[] = useMemo(() => {
    const byRole = new Map<Role, typeof project.files>();
    for (const f of project.files) {
      if (f.role === 'config' && !isCode(f)) continue;
      byRole.set(f.role, [...(byRole.get(f.role) ?? []), f]);
    }
    return ROLE_ORDER.filter(r => byRole.has(r)).map(r => {
      const list = [...byRole.get(r)!].sort((a, b) => (b.importedBy.length * 3 + b.defs.length) - (a.importedBy.length * 3 + a.defs.length) || b.lines - a.lines);
      const leaves = list.slice(0, 3).map(f => ({
        text: `${f.name}${f.importedBy.length ? ` · usado por ${f.importedBy.length}` : f.defs.length ? ` · ${plural(f.defs.length, 'función', 'funciones')}` : ''}`,
        onClick: () => onOpen(f.path),
      }));
      if (list.length > 3) leaves.push({ text: `+${list.length - 3} más`, onClick: () => onOpen(list[3].path) });
      return { id: r, label: ROLE[r].label, sub: plural(list.length, 'archivo', 'archivos'), color: ROLE[r].color, leaves, onClick: () => onOpen(list[0].path) };
    });
  }, [project, onOpen]);
  const t = project.totals;
  return <MindMap width={1180} title={project.name} meta={`${plural(t.files, 'archivo', 'archivos')} · ${plural(t.lines, 'línea', 'líneas')}`} branches={branches} runKey={project.name + t.files}
    label={`Mapa de ${project.name}: ${branches.map(b => `${b.label}, ${b.sub}`).join('; ')}`} />;
}

function Flow({ project, onOpen }: { project: Project; onOpen: (p: string) => void }) {
  const [entry, setEntry] = useState(project.entries[0] ?? '');
  const steps = useMemo(() => entry === project.entries[0] ? project.flow : flowFrom(entry, project.byPath, new Map(project.files.map(f => [f.path, new Map(Object.entries(f.uses))]))), [entry, project]);
  if (!steps.length) return <p className="empty">No encontré por dónde arranca: ningún archivo importa a otro.</p>;
  return <div className="flow">
    {project.entries.length > 1 && <label className="flow-entry">Empieza en
      <select value={entry} onChange={e => setEntry(e.target.value)}>{project.entries.map(p => <option key={p} value={p}>{p}</option>)}</select>
    </label>}
    <ol>{steps.map(s => {
      const f = project.byPath.get(s.path)!;
      const from = s.from ? project.byPath.get(s.from)! : null;
      const main = [...f.defs].filter(d => d.kind !== 'método').sort((a, b) => b.calledFrom.length - a.calledFrom.length).slice(0, 3);
      return <li key={s.path} style={{ ['--c' as string]: ROLE[f.role].color, ['--d' as string]: `${s.n * 0.06}s` }}>
        <span className="flow-n">{s.n}</span>
        <button className="flow-card" onClick={() => onOpen(s.path)}>
          <span className="flow-top"><strong>{f.name}</strong><small>{ROLE[f.role].label}</small></span>
          <span className="flow-why">{from
            ? <>{from.name} lo carga{s.names.length ? <> para usar <code>{s.names.join(', ')}</code></> : null}.</>
            : <>Aquí arranca el proyecto.</>}</span>
          {main.length > 0 && <span className="flow-defs">{main.map(d => <code key={d.name}>{d.name}</code>)}</span>}
        </button>
      </li>;
    })}</ol>
    {steps.length < project.files.filter(isCode).length && <p className="flow-note">El recorrido sigue los imports desde la entrada; los archivos que nadie carga desde aquí están en Archivos.</p>}
  </div>;
}

function Files({ project, sources, selected, onOpen }: { project: Project; sources: Map<string, string>; selected: string; onOpen: (p: string) => void }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const m = new Map<string, typeof project.files>();
    const query = q.trim().toLowerCase();
    for (const f of project.files) if (!query || f.path.toLowerCase().includes(query) || f.defs.some(d => d.name.toLowerCase().includes(query))) m.set(f.dir, [...(m.get(f.dir) ?? []), f]);
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [project, q]);
  return <div className="files">
    <nav className="files-list" aria-label="Archivos del proyecto">
      <input type="search" placeholder="Buscar archivo o función" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar archivo o función" />
      <div className="files-scroll">{groups.map(([dir, list]) => <div key={dir} className="files-group">
        <p>{dir || 'raíz'}</p>
        <ul>{list.sort((a, b) => a.name.localeCompare(b.name)).map(f => <li key={f.path}>
          <button className={f.path === selected ? 'on' : ''} onClick={() => onOpen(f.path)} aria-current={f.path === selected ? 'true' : undefined}>
            <i style={{ background: ROLE[f.role].color }} /><span>{f.name}</span><small>{f.lines}</small>
          </button>
        </li>)}</ul>
      </div>)}{!groups.length && <p className="empty">Nada coincide con «{q}».</p>}</div>
    </nav>
    {selected && <FileView project={project} path={selected} source={sources.get(selected) ?? ''} onOpen={onOpen} />}
  </div>;
}

const ALERT_INFO: Record<Alert['kind'], { title: string; tip: string }> = {
  ciclo: { title: 'Imports en círculo', tip: 'Dos o más archivos dependen entre sí; un cambio en uno puede romper al otro al cargar.' },
  huérfano: { title: 'Archivos que nadie usa', tip: 'Viven junto al código que sí corre, pero ningún archivo los carga. Puede ser código muerto.' },
  grande: { title: 'Archivos muy grandes', tip: 'Más de 400 líneas: cuesta leerlos y es fácil romper algo al editarlos.' },
  'sin-usar': { title: 'Funciones exportadas sin uso', tip: 'Se ofrecen a otros archivos, pero nadie las llama.' },
};

function Alerts({ project, onOpen }: { project: Project; onOpen: (p: string) => void }) {
  if (!project.alerts.length) return <p className="empty ok">Sin alertas: no hay imports en círculo, archivos sueltos ni funciones olvidadas.</p>;
  const kinds = (Object.keys(ALERT_INFO) as Alert['kind'][]).filter(k => project.alerts.some(a => a.kind === k));
  return <div className="alerts">{kinds.map(k => <section key={k} className={`alert-group a-${k}`}>
    <h3>{ALERT_INFO[k].title}<span>{project.alerts.filter(a => a.kind === k).length}</span></h3>
    <p>{ALERT_INFO[k].tip}</p>
    <ul>{project.alerts.filter(a => a.kind === k).map(a => <li key={a.text}><button onClick={() => onOpen(a.paths[0])}>{a.text}</button></li>)}</ul>
  </section>)}</div>;
}

// ---------- app ----------
export default function App() {
  const [data, setData] = useState<Loaded | null>(null);
  const [tab, setTab] = useState<Tab>('mapa');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLDivElement>(null);

  const show = useCallback((d: Loaded) => {
    setData(d); setTab('mapa'); setError('');
    setSelected(d.project.entries[0] ?? d.project.files.find(isCode)?.path ?? d.project.files[0]?.path ?? '');
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);
  const open = useCallback((p: string) => { setSelected(p); setTab('archivos'); requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }, []);

  async function finish(files: ProjectFile[], seen: number) {
    if (!files.some(f => isCode({ lang: langOf(f.path) }))) { setError('No encontré código que pueda leer. VibeMap entiende TypeScript, JavaScript, Python y GDScript.'); return; }
    show(load(files, 'proyecto', seen));
  }
  async function fromInput(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true); setError('');
    try {
      const all = [...list];
      const read = await Promise.all(all.slice(0, MAX_FILES * 4).map(f => readFile(f, (f.webkitRelativePath || f.name)).catch(() => null)));
      await finish(read.filter((f): f is ProjectFile => !!f).slice(0, MAX_FILES), all.length);
    } finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function onDrop(e: DragEvent) {
    e.preventDefault(); setDrag(false);
    const items = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry()).filter((x): x is FileSystemEntry => !!x);
    if (!items.length) return;
    setBusy(true); setError('');
    try {
      const out: Promise<ProjectFile | null>[] = [];
      const counter = { seen: 0 };
      for (const it of items) await readEntry(it, out, counter);
      await finish((await Promise.all(out)).filter((f): f is ProjectFile => !!f), counter.seen);
    } finally { setBusy(false); }
  }

  const p = data?.project;
  return <div className="app">
    <header className="top">
      <div className="wrap top-inner">
        <a className="brand" href="/" onClick={e => { e.preventDefault(); setData(null); }}><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" /><circle cx="4.5" cy="6" r="2" /><circle cx="19.5" cy="6" r="2" /><circle cx="4.5" cy="18" r="2" /><circle cx="19.5" cy="18" r="2" /><path d="M9.3 10.4 6.2 7.3M14.7 10.4l3.1-3.1M9.3 13.6l-3.1 3.1M14.7 13.6l3.1 3.1" /></svg></span>VibeMap</a>
        <p className="top-note">Tu código no sale de tu navegador</p>
        <a className="top-link" href="https://github.com/Brunich/VibeMap">Código</a>
      </div>
    </header>

    {!data && <main className="wrap hero">
      <div className="hero-copy">
        <p className="kicker">Mapa mental de código</p>
        <h1>Entiende un proyecto <em>antes</em> de leerlo.</h1>
        <p className="lead">Suelta la carpeta de un proyecto y VibeMap te dice dónde arranca, qué archivo usa a cuál, qué funciones define cada uno y qué está sobrando.</p>
        <ul className="langs">{['TypeScript', 'JavaScript', 'React', 'Python', 'GDScript · Godot'].map(l => <li key={l}>{l}</li>)}</ul>
      </div>
      <div className={`drop${drag ? ' is-drag' : ''}${busy ? ' is-busy' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
        <svg className="drop-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M6 14a4 4 0 0 1 4-4h9l4 5h15a4 4 0 0 1 4 4v17a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" /><path d="M24 33V21m-5 5 5-5 5 5" /></svg>
        <p className="drop-title">{busy ? 'Leyendo el proyecto…' : 'Arrastra aquí la carpeta de tu proyecto'}</p>
        <p className="drop-sub">Se ignoran node_modules, builds e imágenes. Hasta {MAX_FILES.toLocaleString('es-MX')} archivos.</p>
        <button className="btn" onClick={() => input.current?.click()} disabled={busy}>Elegir carpeta</button>
        <input ref={input} type="file" hidden multiple {...{ webkitdirectory: '', directory: '' }} onChange={e => fromInput(e.target.files)} />
        {error && <p className="drop-error" role="alert">{error}</p>}
        <div className="samples"><span>O prueba con</span>
          <button onClick={() => show(load(vibemapSample, 'VibeMap'))}>El código de VibeMap</button>
          <button onClick={() => show(load(rpgSample, 'Mini RPG · Godot'))}>Un RPG en Godot</button>
        </div>
      </div>
      <ol className="how">
        <li><b>1</b><strong>Lee</strong><span>Recorre cada archivo y encuentra imports, funciones y clases.</span></li>
        <li><b>2</b><strong>Conecta</strong><span>Une quién usa a quién y quién llama a cada función.</span></li>
        <li><b>3</b><strong>Explica</strong><span>Te da el mapa, el recorrido desde la entrada y lo que conviene revisar.</span></li>
      </ol>
    </main>}

    {data && p && <main className="wrap result" ref={top}>
      <section className="summary">
        <div>
          <p className="kicker">Proyecto</p>
          <h1>{p.name}</h1>
          <ul className="langs small">{p.totals.langs.filter(([l]) => l !== 'other').map(([l, n]) => <li key={l}>{LANG[l]} <b>{n}</b></li>)}</ul>
        </div>
        <dl className="stats">
          <div><dt>{p.totals.files.toLocaleString('es-MX')}</dt><dd>archivos</dd></div>
          <div><dt>{p.totals.lines.toLocaleString('es-MX')}</dt><dd>líneas</dd></div>
          <div><dt>{p.totals.defs.toLocaleString('es-MX')}</dt><dd>funciones y clases</dd></div>
          <div><dt>{p.totals.links.toLocaleString('es-MX')}</dt><dd>conexiones</dd></div>
        </dl>
        <button className="btn-ghost" onClick={() => setData(null)}>Otro proyecto</button>
      </section>
      {data.skipped > 0 && <p className="note">Leí {plural(p.totals.files, 'archivo', 'archivos')}; omití {plural(data.skipped, 'otro', 'otros')} (imágenes, builds o dependencias).</p>}

      <div className="tabs" role="tablist" aria-label="Vistas">
        {([['mapa', 'Mapa'], ['recorrido', 'Recorrido'], ['archivos', 'Archivos'], ['alertas', 'Alertas']] as [Tab, string][]).map(([k, label]) =>
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}{k === 'alertas' && p.alerts.length > 0 && <span className="count">{p.alerts.length}</span>}</button>)}
      </div>

      <div className="panel" role="tabpanel">
        {tab === 'mapa' && <>
          <p className="panel-lead">Cada rama es un tipo de archivo. Toca un archivo para ver su mapa.</p>
          <Overview project={p} onOpen={open} />
          <ul className="legend">{ROLE_ORDER.filter(r => p.files.some(f => f.role === r)).map(r => <li key={r}><i style={{ background: ROLE[r].color }} />{ROLE[r].label} <span>· {ROLE[r].hint}</span></li>)}</ul>
        </>}
        {tab === 'recorrido' && <>
          <p className="panel-lead">Lo que se carga, en orden, desde {p.entries[0] ? <code>{p.byPath.get(p.entries[0])!.name}</code> : 'la entrada'}.</p>
          <Flow project={p} onOpen={open} />
        </>}
        {tab === 'archivos' && <Files project={p} sources={data.sources} selected={selected} onOpen={open} />}
        {tab === 'alertas' && <Alerts project={p} onOpen={open} />}
      </div>
    </main>}

    <footer className="wrap foot">
      <p>Hecho en un hackathon por un equipo de 3 y mejorado por <a href="https://bruno-portfolio-azure.vercel.app">Bruno Salas</a>.</p>
    </footer>
  </div>;
}
