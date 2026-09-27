import { useEffect, useMemo, useRef, useState } from 'react';
import { describe, type Project } from './analyze';
import MindMap, { type Branch } from './MindMap';
import { LANG, ROLE, plural } from './roles';

// El mapa de un archivo: quién lo usa (izquierda), qué usa (derecha), sus funciones y su código.
const AI = import.meta.env.VITE_AI === 'on';
type AiResult = { explicacion: string; flujo_ejecucion: string[]; resumen_archivo: string };
const MAX_CODE_LINES = 1500;

export default function FileView({ project, path, source, onOpen }: { project: Project; path: string; source: string; onOpen: (p: string) => void }) {
  const f = project.byPath.get(path)!;
  const [line, setLine] = useState<number | null>(null);
  const [ai, setAi] = useState<{ state: 'idle' | 'loading' | 'error'; data?: AiResult; error?: string }>({ state: 'idle' });
  const code = useRef<HTMLDivElement>(null);
  useEffect(() => { setLine(null); setAi({ state: 'idle' }); code.current?.scrollTo({ top: 0 }); }, [path]);
  useEffect(() => {
    if (line === null || !code.current) return;
    const row = code.current.querySelector<HTMLElement>(`[data-line="${line}"]`);
    if (row) code.current.scrollTo({ top: row.offsetTop - 60, behavior: 'smooth' });
  }, [line]);

  const branches = useMemo(() => {
    const left: Branch[] = f.importedBy.slice(0, 7).map(p => {
      const o = project.byPath.get(p)!;
      const names = o.uses[path] ?? [];
      return { id: 'in:' + p, label: o.name, sub: `lo usa · ${ROLE[o.role].label.toLowerCase()}`, color: ROLE[o.role].color, leaves: names.length ? names.slice(0, 4).map(n => ({ text: n })) : [{ text: 'lo carga completo' }], onClick: () => onOpen(p) };
    });
    if (f.importedBy.length > 7) left.push({ id: 'in:more', label: `+${f.importedBy.length - 7} archivos`, sub: 'también lo usan', color: '#8c93a6', leaves: [] });
    const right: Branch[] = f.imports.slice(0, 7).map(p => {
      const o = project.byPath.get(p)!;
      const names = f.uses[p] ?? [];
      return { id: 'out:' + p, label: o.name, sub: `usa · ${ROLE[o.role].label.toLowerCase()}`, color: ROLE[o.role].color, leaves: names.length ? names.slice(0, 4).map(n => ({ text: n })) : [{ text: 'lo carga completo' }], onClick: () => onOpen(p) };
    });
    if (f.imports.length > 7) right.push({ id: 'out:more', label: `+${f.imports.length - 7} archivos`, sub: 'también usa', color: '#8c93a6', leaves: [] });
    if (f.external.length) right.push({ id: 'pkg', label: 'Paquetes', sub: plural(f.external.length, 'externo', 'externos'), color: '#8c93a6', leaves: f.external.slice(0, 5).map(t => ({ text: t })) });
    return { list: [...left, ...right], split: left.length };
  }, [f, path, project, onOpen]);

  const lines = useMemo(() => source.replace(/\r\n?/g, '\n').split('\n'), [source]);
  const defLines = useMemo(() => new Map(f.defs.map(d => [d.line, d])), [f]);

  async function explain() {
    setAi({ state: 'loading' });
    try {
      const res = await fetch('/api/file-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, content: source.slice(0, 40_000), projectContext: `${project.name}: ${project.files.length} archivos. Lo usan: ${f.importedBy.join(', ') || 'nadie'}. Usa: ${f.imports.join(', ') || 'nada del proyecto'}.` }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No respondió la IA');
      setAi({ state: 'idle', data });
    } catch (e) { setAi({ state: 'error', error: e instanceof Error ? e.message : 'No respondió la IA' }); }
  }

  return <article className="fv">
    <header className="fv-head">
      <div>
        <p className="fv-path">{f.dir || 'raíz'} /</p>
        <h2>{f.name}</h2>
        <p className="fv-desc">{describe(f, project)}</p>
      </div>
      <ul className="fv-facts">
        <li style={{ ['--c' as string]: ROLE[f.role].color }}><i />{ROLE[f.role].label}</li>
        <li>{LANG[f.lang]}</li>
        <li>{plural(f.lines, 'línea', 'líneas')}</li>
        {AI && <li><button className="btn-ghost" onClick={explain} disabled={ai.state === 'loading'}>{ai.state === 'loading' ? 'Explicando…' : 'Explicar con IA'}</button></li>}
      </ul>
    </header>
    {ai.data && <section className="fv-ai"><p>{ai.data.explicacion}</p><ol>{ai.data.flujo_ejecucion.map(s => <li key={s}>{s.replace(/^\d+\.\s*/, '')}</li>)}</ol><p className="fv-ai-sum">{ai.data.resumen_archivo}</p></section>}
    {ai.state === 'error' && <p className="fv-ai-error" role="alert">{ai.error}</p>}

    <MindMap width={900} reach={165} title={f.name} meta={`${plural(f.defs.length, 'función', 'funciones')} · ${plural(f.lines, 'línea', 'líneas')}`} branches={branches.list} sides="split" splitAt={branches.split} runKey={path}
      label={`Mapa de ${f.name}: lo usan ${f.importedBy.length} archivos y usa ${f.imports.length}`} emptyLeft={project.entries.includes(path) ? 'aquí arranca' : 'nadie lo usa'} emptyRight="no usa otros archivos" />

    <div className="fv-body">
      <section className="fv-defs" aria-label="Funciones">
        <h3>{f.defs.length ? 'Qué define' : 'No define funciones'}</h3>
        <ul>{f.defs.map(d => <li key={d.name + d.line}>
          <button className={line === d.line ? 'on' : ''} onClick={() => setLine(d.line)}>
            <span className="fv-def-name">{d.name}<small>{d.kind} · línea {d.line}</small></span>
            {d.calledFrom.length > 0 && <span className="fv-def-rel"><b>La llaman</b> {d.calledFrom.slice(0, 4).join(', ')}{d.calledFrom.length > 4 ? ` y ${d.calledFrom.length - 4} más` : ''}</span>}
            {d.calls.length > 0 && <span className="fv-def-rel"><b>Llama a</b> {d.calls.slice(0, 4).join(', ')}{d.calls.length > 4 ? ` y ${d.calls.length - 4} más` : ''}</span>}
          </button>
        </li>)}</ul>
      </section>
      <section className="fv-code" aria-label={`Código de ${f.name}`}>
        <div className="fv-code-bar"><span>{f.path}</span>{lines.length > MAX_CODE_LINES && <span>primeras {MAX_CODE_LINES.toLocaleString('es-MX')} líneas</span>}</div>
        <div className="fv-code-scroll" ref={code} tabIndex={0}>
          <pre>{lines.slice(0, MAX_CODE_LINES).map((l, i) => {
            const n = i + 1, d = defLines.get(n);
            return <div key={n} data-line={n} className={`${d ? 'is-def' : ''}${line === n ? ' is-on' : ''}`}><span className="ln">{n}</span><code>{l || ' '}</code></div>;
          })}</pre>
        </div>
      </section>
    </div>
  </article>;
}
