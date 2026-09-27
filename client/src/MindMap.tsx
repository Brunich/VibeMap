import { useState } from 'react';

// Mapa mental: un nodo al centro, ramas a los lados y hojas con datos concretos.
// Lo usan el resumen del proyecto y el mapa de cada archivo.
export type Leaf = { text: string; warn?: boolean; onClick?: () => void };
export type Branch = { id: string; label: string; sub: string; color: string; leaves: Leaf[]; onClick?: () => void };
type Props = { width?: number; reach?: number; title: string; meta: string; branches: Branch[]; label: string; runKey: string; emptyLeft?: string; emptyRight?: string; sides?: 'auto' | 'split'; splitAt?: number };

const cut = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;
const textWidth = (s: string, size: number) => s.length * size * 0.56 + 26;
const LEAF_H = 24, GAP = 22;

export default function MindMap({ width: W = 1100, reach = 215, title, meta, branches, label, runKey, emptyLeft, emptyRight, sides = 'auto', splitAt }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const CX = W / 2;
  const size = (b: Branch) => Math.max(1, b.leaves.length) * LEAF_H + GAP;
  let left: Branch[], right: Branch[];
  if (sides === 'split') { left = branches.slice(0, splitAt); right = branches.slice(splitAt); }
  else {
    left = []; right = [];
    let l = 0, r = 0;
    for (const b of branches) { if (l <= r) { left.push(b); l += size(b); } else { right.push(b); r += size(b); } }
  }
  const sideH = (list: Branch[]) => list.reduce((s, b) => s + size(b), 0);
  const H = Math.max(360, Math.max(sideH(left), sideH(right)) + 70);
  const CY = H / 2;
  const rootLabel = cut(title, 30);
  const rootW = Math.max(W < 1000 ? 190 : 220, textWidth(rootLabel, 16));
  let order = 0;

  const place = (list: Branch[], isLeft: boolean) => {
    const total = sideH(list);
    let y0 = CY - total / 2;
    return list.map(b => {
      const y = y0 + size(b) / 2; y0 += size(b);
      const name = cut(b.label, 20);
      const w = Math.max(128, textWidth(name, 14) + 14, b.sub.length * 10.5 * 0.66 + 44);
      const x = isLeft ? CX - reach : CX + reach;
      const nx = isLeft ? x - w : x;
      const dim = hover !== null && hover !== b.id;
      const d0 = (order += 1) * 0.08;
      const click = b.onClick;
      return <g key={b.id} className={`mm-branch${dim ? ' mm-dim' : ''}${hover === b.id ? ' mm-hot' : ''}${click ? ' mm-click' : ''}`}
        onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(b.id)} onBlur={() => setHover(null)}
        tabIndex={0} role={click ? 'button' : undefined} aria-label={`${b.label}, ${b.sub}`}
        onClick={click} onKeyDown={e => { if (click && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); click(); } }}
        style={{ ['--d' as string]: `${d0}s` }}>
        <path className="mm-edge" pathLength={1} d={`M${CX + (isLeft ? -rootW / 2 : rootW / 2)} ${CY} C ${isLeft ? CX - 170 : CX + 170} ${CY}, ${isLeft ? x + 90 : x - 90} ${y}, ${x} ${y}`} stroke={b.color} />
        {b.leaves.map((leaf, j) => {
          const ly = y + (j - (b.leaves.length - 1) / 2) * LEAF_H;
          const lx = isLeft ? nx - 34 : nx + w + 34;
          const text = cut(leaf.text, 30);
          return <g key={leaf.text + j} className={`mm-leaf${leaf.onClick ? ' mm-leaf-click' : ''}`} style={{ ['--d' as string]: `${d0 + 0.25 + j * 0.06}s` }}
            onClick={leaf.onClick ? e => { e.stopPropagation(); leaf.onClick!(); } : undefined}>
            <path className="mm-edge mm-edge-thin" pathLength={1} d={`M${isLeft ? nx : nx + w} ${y} C ${isLeft ? nx - 16 : nx + w + 16} ${y}, ${isLeft ? lx + 12 : lx - 12} ${ly}, ${lx} ${ly}`} stroke={b.color} />
            <text x={isLeft ? lx - 6 : lx + 6} y={ly} textAnchor={isLeft ? 'end' : 'start'} className={leaf.warn ? 'mm-warn' : ''}>{text}{text !== leaf.text && <title>{leaf.text}</title>}</text>
          </g>;
        })}
        <g className="mm-node">
          <rect x={nx} y={y - 20} width={w} height={40} rx={11} stroke={b.color} />
          <circle cx={isLeft ? nx + w - 14 : nx + 14} cy={y} r={4} fill={b.color} />
          <text x={isLeft ? nx + w - 26 : nx + 26} y={y - 2} textAnchor={isLeft ? 'end' : 'start'} className="mm-name">{name}</text>
          <text x={isLeft ? nx + w - 26 : nx + 26} y={y + 12} textAnchor={isLeft ? 'end' : 'start'} className="mm-kind" fill={b.color}>{b.sub}</text>
        </g>
      </g>;
    });
  };

  return <div className="mm" key={runKey}>
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={label}>
      <defs><radialGradient id="mm-glow"><stop offset="0" stopColor="#6b5fb0" stopOpacity=".45" /><stop offset="1" stopColor="#15171e" stopOpacity="0" /></radialGradient></defs>
      <circle cx={CX} cy={CY} r="210" fill="url(#mm-glow)" />
      {place(left, true)}
      {place(right, false)}
      {!left.length && emptyLeft && <text x={CX - reach} y={CY} textAnchor="end" className="mm-empty">{emptyLeft}</text>}
      {!right.length && emptyRight && <text x={CX + reach} y={CY} textAnchor="start" className="mm-empty">{emptyRight}</text>}
      <g className="mm-root">
        <rect x={CX - rootW / 2} y={CY - 36} width={rootW} height={72} rx={18} />
        <text x={CX} y={CY - 6} textAnchor="middle" className="mm-root-name">{rootLabel}</text>
        <text x={CX} y={CY + 18} textAnchor="middle" className="mm-root-meta">{meta}</text>
      </g>
    </svg>
    <div className="mm-tree">
      <p className="mm-tree-root"><strong>{rootLabel}</strong>{meta}</p>
      <ul>{branches.map((b, i) => <li key={b.id} style={{ ['--c' as string]: b.color, ['--d' as string]: `${i * 0.06}s` }}>
        {b.onClick ? <button className="mm-tree-name" onClick={b.onClick}>{b.label}<small>{b.sub}</small></button> : <span className="mm-tree-name">{b.label}<small>{b.sub}</small></span>}
        <span className="mm-tree-facts">{b.leaves.map((l, j) => l.onClick ? <button key={j} onClick={l.onClick}>{l.text}</button> : <span key={j} className={l.warn ? 'mm-warn' : ''}>{l.text}</span>)}</span>
      </li>)}</ul>
    </div>
  </div>;
}
