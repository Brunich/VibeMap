# VibeMap — Editorial Gallery Design Guide

> **Apply this design to the VibeMap UI to match the gallery editorial aesthetic.**
> Aesthetic reference: art gallery / editorial magazine / curated catalog.
> Cream paper background, ivory framed cards, antique gold + burgundy accents,
> Playfair Display serif headings + Inter body + Outfit for friendly labels.

---

## 0. Prompt to give Claude Code

Paste this in your Claude Code session, in the project root, after you have your final code ready:

> **"Read `DESIGN_GUIDE.md` at the project root and apply its design system across the entire UI. Replace existing styling in `client/src/index.css` and `client/src/App.tsx` (and any new components) so the visual result matches the spec exactly: cream paper background, ivory cards, layered surfaces, Playfair Display + Inter + Outfit fonts, antique gold + burgundy accents, decorative corner + side ornaments, top accent bar. Keep ALL existing logic, state, hooks, types, and API calls intact — only restyle. Do not introduce neon, dark mode, glow effects, blueprint grid, or any other aesthetic. Do not add new features. Verify the build passes when done."**

---

## 1. Aesthetic Philosophy

- **Editorial gallery / museum catalog vibe** — like a printed art magazine or an exhibition page.
- **Three layered surfaces:** paper wall (background) → ivory canvas (cards) → soft inset (highlighted areas inside cards). Each is a slightly different tone of warm cream so the eye reads depth without harsh contrast.
- **Restrained color palette:** mostly warm neutrals (cream, ivory, beige, ink black) with two accents used sparingly: muted antique gold and warm burgundy. No bright/saturated colors.
- **Typography pairing:**
  - **Playfair Display** (serif) — big titles + italic body taglines + catalog numbers
  - **Inter** (sans) — most body text and small labels
  - **Outfit** (geometric rounded sans) — friendly section step labels (`I.`, `II.`)
- **Negative space + ornaments** — generous spacing, thin gold lines, small geometric decorations (squares, dots, ornament marks) in corners and side margins.

---

## 2. Anti-patterns (do NOT do this)

- ❌ Neon colors, glow effects, text-shadow with vibrant hues
- ❌ Dark mode / dark backgrounds
- ❌ Blueprint grids, scan lines, ASCII brackets
- ❌ Glassmorphism with heavy blur
- ❌ Pure white (#FFFFFF) backgrounds for cards (use warm ivory `#FAF5E5` instead)
- ❌ Bright indigo/blue accents, sky blue
- ❌ Large rounded corners (`rounded-[3rem]`) — keep it subtle (`rounded-md`)
- ❌ Heavy shadows / drop shadows
- ❌ Emojis as UI icons (use SVG only)
- ❌ Gradient backgrounds on cards or sections (gradients only on body bg, very subtle)

---

## 3. Color Palette (CSS custom properties)

```css
:root {
  /* Surfaces — warm cream → ivory → soft inset */
  --paper:        #EFE8D6;  /* body bg, gallery wall */
  --paper-2:      #E8E0CB;  /* deeper cream for depth (rare) */
  --canvas:       #FAF5E5;  /* card surface, warm ivory */
  --canvas-inset: #F4EEDA;  /* darker than card — insets, code blocks, table bg */
  --accent-soft:  #F4EFE0;  /* subtle highlight tint */

  /* Text */
  --ink:        #18181B;    /* gallery black, primary text */
  --ink-soft:   #3A3935;    /* secondary text */
  --muted:      #6B6357;    /* warm grey, supporting text */
  --muted-2:    #8B8275;    /* lighter warm grey */

  /* Borders / dividers */
  --line:       #D9CFB8;    /* warm beige border */
  --line-soft:  #E5DDC9;    /* lighter border */

  /* Accents */
  --gold:        #A88B4C;   /* muted antique gold — primary accent */
  --gold-soft:   #C9AE74;   /* lighter gold */
  --accent-deep: #5E3A3A;   /* warm burgundy — secondary accent */

  /* Status (muted) */
  --rose:      #B0584C;     /* error */
  --rose-soft: #F3DAD3;
}
```

### How to use the colors

| Layer / Element | Token | Hex |
|---|---|---|
| Page background | `--paper` | `#EFE8D6` |
| Cards / dropzone | `--canvas` | `#FAF5E5` |
| Inset within card (mermaid bg, code blocks, tables) | `--canvas-inset` | `#F4EEDA` |
| Card border | `--line` | `#D9CFB8` |
| Heading text | `--ink` | `#18181B` |
| Body text | `--ink-soft` | `#3A3935` |
| Supporting / hint text | `--muted` | `#6B6357` |
| Section labels, catalog numbers | `--gold` | `#A88B4C` |
| Step number badge text, single colored letter in title | `--accent-deep` | `#5E3A3A` |
| Code chips inside table | `--canvas` | `#FAF5E5` (raised over inset table bg) |

---

## 4. Typography

### Font import (single line, in `client/src/index.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap');
```

### Font tokens (in `@theme` block for Tailwind v4)

```css
@theme {
  --font-sans:    "Inter", system-ui, -apple-system, sans-serif;
  --font-serif:   "Playfair Display", "Iowan Old Style", Georgia, serif;
  --font-rounded: "Outfit", "Inter", system-ui, sans-serif;
}
```

### Usage rules

| Where | Font | Weight | Size |
|---|---|---|---|
| Big page title (`VibeMap`) | Playfair Display | 500 | `text-7xl md:text-8xl` |
| Italic tagline under title | Playfair italic | 400 | `text-xl md:text-2xl` |
| Small description below tagline | Inter | 400 | `text-base` |
| Section title in card | Playfair | 500 | `text-2xl` to `text-3xl` |
| Section sub-label (`// De qué va el proyecto`) | Inter smallcaps | 600 | `text-[10px]` |
| Step header (`I.` `II.`) | **Outfit** (rounded) | 600 | `text-base` (~`1.05rem`) |
| Catalog ordinal (file numbering) | Playfair italic | 400 | varies |
| Body text | Inter | 400 | `text-base` |
| Code / mono | default monospace stack | - | `text-xs` to `text-sm` |
| Tab labels | Inter smallcaps | 600 | `text-sm` |

---

## 5. Helper CSS classes (drop these into `index.css`)

```css
/* ---- Page-level styling ---- */

html, body {
  background: var(--paper);
  color: var(--ink);
  min-height: 100vh;
}

body {
  font-family: var(--font-sans);
  background-color: var(--paper);
  background-image:
    radial-gradient(ellipse 1200px 800px at 20% 10%, rgba(255, 255, 255, 0.5), transparent 60%),
    radial-gradient(ellipse 1000px 700px at 80% 90%, rgba(168, 139, 76, 0.06), transparent 60%);
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
}

/* Subtle paper grain noise — premium, not loud */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.5;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 0.08 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  mix-blend-mode: multiply;
}

/* Top accent bar — fixed, split black + burgundy + gold */
body::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg,
    var(--ink) 0%, var(--ink) 70%,
    var(--accent-deep) 70%, var(--accent-deep) 88%,
    var(--gold) 88%, var(--gold) 100%);
  pointer-events: none;
  z-index: 50;
}

#root { position: relative; z-index: 1; }

/* ---- Card / surface helpers ---- */

.gallery-card {
  background: var(--canvas);
  border: 1px solid var(--line);
  box-shadow:
    0 1px 0 rgba(24, 24, 27, 0.015),
    0 8px 24px -14px rgba(24, 24, 27, 0.06),
    0 2px 6px -3px rgba(168, 139, 76, 0.05);
}

.gallery-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.gallery-divider::before,
.gallery-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line);
}

/* ---- Typography helpers ---- */

.serif {
  font-family: var(--font-serif);
}

.smallcaps {
  font-feature-settings: "smcp", "c2sc";
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.catalog-num {
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--gold);
  font-variant-numeric: oldstyle-nums;
}

/* Friendlier step header (Paso I, Paso II) */
.step-label {
  font-family: var(--font-rounded);
  font-weight: 600;
  font-size: 1.05rem;
  letter-spacing: -0.005em;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.step-label-num {
  font-family: var(--font-rounded);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--accent-deep);
  background: var(--canvas-inset);
  border: 1px solid var(--line);
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Hover row */
.row-hover {
  transition: background-color 200ms ease, border-color 200ms ease;
}
.row-hover:hover {
  background-color: var(--accent-soft);
  border-color: var(--gold-soft);
}

/* ---- Decorative corner ornaments (frame the viewport) ---- */
.corner-ornament {
  position: fixed;
  width: 56px;
  height: 56px;
  pointer-events: none;
  z-index: 5;
  opacity: 0.85;
}
.corner-ornament::before,
.corner-ornament::after {
  content: '';
  position: absolute;
  background: var(--gold);
}
.corner-ornament .dot {
  position: absolute;
  width: 6px;
  height: 6px;
  background: var(--accent-deep);
  border-radius: 9999px;
}

.corner-tl { top: 28px; left: 28px; }
.corner-tl::before { top: 0; left: 0; width: 56px; height: 1px; }
.corner-tl::after  { top: 0; left: 0; width: 1px; height: 56px; }
.corner-tl .dot    { top: -3px; left: -3px; }

.corner-tr { top: 28px; right: 28px; }
.corner-tr::before { top: 0; right: 0; width: 56px; height: 1px; }
.corner-tr::after  { top: 0; right: 0; width: 1px; height: 56px; }
.corner-tr .dot    { top: -3px; right: -3px; }

.corner-bl { bottom: 28px; left: 28px; }
.corner-bl::before { bottom: 0; left: 0; width: 56px; height: 1px; }
.corner-bl::after  { bottom: 0; left: 0; width: 1px; height: 56px; }
.corner-bl .dot    { bottom: -3px; left: -3px; }

.corner-br { bottom: 28px; right: 28px; }
.corner-br::before { bottom: 0; right: 0; width: 56px; height: 1px; }
.corner-br::after  { bottom: 0; right: 0; width: 1px; height: 56px; }
.corner-br .dot    { bottom: -3px; right: -3px; }

/* ---- Side ornament (right edge, vertical) ---- */
.side-ornament {
  position: fixed;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  opacity: 0.7;
}
.side-ornament .mark-line   { width: 1px; height: 60px; background: var(--line); }
.side-ornament .mark-square { width: 8px; height: 8px; border: 1px solid var(--gold); transform: rotate(45deg); }
.side-ornament .mark-dot    { width: 5px; height: 5px; background: var(--accent-deep); border-radius: 9999px; }
.side-ornament .mark-text {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-family: var(--font-rounded);
  font-size: 9px;
  letter-spacing: 0.4em;
  color: var(--muted-2);
  text-transform: uppercase;
  font-weight: 500;
}

@media (max-width: 900px) {
  .corner-ornament, .side-ornament { display: none; }
}

/* ---- Scrollbar + selection ---- */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--paper); }
::-webkit-scrollbar-thumb { background: var(--line); border-radius: 5px; }
::-webkit-scrollbar-thumb:hover { background: var(--muted-2); }
::selection { background: var(--gold-soft); color: var(--ink); }
```

---

## 6. Mermaid theme config

In `App.tsx` (or wherever mermaid is initialized):

```ts
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'strict',
  themeVariables: {
    background: '#F4EEDA',
    primaryColor: '#FAF5E5',
    primaryTextColor: '#18181B',
    primaryBorderColor: '#A88B4C',
    secondaryColor: '#F4EFE0',
    tertiaryColor: '#EFE8D6',
    lineColor: '#3A3935',
    textColor: '#18181B',
    mainBkg: '#FAF5E5',
    nodeBorder: '#A88B4C',
    clusterBkg: '#F4EFE0',
    clusterBorder: '#D9CFB8',
    edgeLabelBackground: '#F4EEDA',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
})
```

---

## 7. Component patterns (JSX)

### 7.1 App root + decorative frame (top of `App` component return)

```tsx
return (
  <div className="max-w-5xl mx-auto px-6 py-20 font-sans antialiased text-[#18181B]">
    {/* Decorative frame corners */}
    <div className="corner-ornament corner-tl" aria-hidden="true"><span className="dot" /></div>
    <div className="corner-ornament corner-tr" aria-hidden="true"><span className="dot" /></div>
    <div className="corner-ornament corner-bl" aria-hidden="true"><span className="dot" /></div>
    <div className="corner-ornament corner-br" aria-hidden="true"><span className="dot" /></div>

    {/* Side ornament (right edge) */}
    <div className="side-ornament" aria-hidden="true">
      <span className="mark-square" />
      <span className="mark-line" />
      <span className="mark-text">Vibe · Map</span>
      <span className="mark-line" />
      <span className="mark-dot" />
    </div>

    {/* ... rest of the app ... */}
  </div>
)
```

### 7.2 Header

```tsx
<header className="text-center mb-20">
  <h1 className="serif text-7xl md:text-8xl font-medium tracking-tight mb-6 text-[#18181B] leading-none">
    Vibe<span className="text-[#5E3A3A]">M</span>ap
  </h1>
  <div className="flex items-center justify-center gap-3 mb-8" aria-hidden="true">
    <span className="h-px w-10 bg-[#18181B]" />
    <span className="text-[#A88B4C] text-base">❖</span>
    <span className="h-px w-10 bg-[#18181B]" />
  </div>
  <p className="serif italic text-xl md:text-2xl text-[#3A3935] max-w-2xl mx-auto leading-relaxed">
    ¿Codex o Claude te generó código y no entiendes qué hace?
  </p>
  <p className="text-base text-[#6B6357] max-w-xl mx-auto mt-3 leading-relaxed">
    Súbelo y te lo explico como mapa mental, en palabras simples.
  </p>
</header>
```

### 7.3 Tabs (underline-only, no pills)

```tsx
<div className="flex justify-center mb-16">
  <div className="inline-flex border-b border-[#D9CFB8] gap-12">
    <button
      type="button"
      onClick={() => setActiveTab('mapa')}
      className={`pb-3 text-sm smallcaps font-semibold transition-all border-b-2 -mb-px cursor-pointer ${
        activeTab === 'mapa'
          ? 'text-[#18181B] border-[#A88B4C]'
          : 'text-[#8B8275] border-transparent hover:text-[#3A3935]'
      }`}
    >
      Mapa de proyecto
    </button>
    <button
      type="button"
      onClick={() => setActiveTab('diagrama')}
      className={`pb-3 text-sm smallcaps font-semibold transition-all border-b-2 -mb-px cursor-pointer ${
        activeTab === 'diagrama'
          ? 'text-[#18181B] border-[#A88B4C]'
          : 'text-[#8B8275] border-transparent hover:text-[#3A3935]'
      }`}
    >
      Diagrama → Código
    </button>
  </div>
</div>
```

### 7.4 Dropzone (drop folder of code)

```tsx
<section
  {...getRootProps()}
  className={`gallery-card relative group border border-dashed rounded-md p-20 text-center transition-all duration-300 cursor-pointer ${
    isDragActive
      ? 'border-[#A88B4C] bg-[#F4EFE0] scale-[1.005]'
      : 'border-[#D9CFB8] hover:border-[#A88B4C] hover:bg-[#FAF5E5]'
  }`}
>
  <input {...getInputProps()} />
  <div className="space-y-6">
    <div className="w-20 h-20 bg-[#FAF5E5] border border-[#A88B4C]/40 text-[#A88B4C] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:border-[#A88B4C] transition-all duration-500">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
    <div className="space-y-3">
      <p className="serif text-3xl text-[#18181B] tracking-tight">Suelta tu carpeta de proyecto</p>
      <p className="text-[#6B6357] text-sm leading-relaxed max-w-md mx-auto">
        Funciona con código de cualquier IA: React, Python, Godot, Unity, C++, etc.
      </p>
    </div>
  </div>
</section>
```

### 7.5 Step header (Paso I / Paso II — friendly Outfit)

```tsx
<div>
  <div className="step-label mb-2">
    <span className="step-label-num">I</span>
    <span>Sube la foto del diagrama</span>
  </div>
  <p className="text-[#6B6357] text-sm leading-relaxed pl-11">
    Foto de un flowchart en papel, pizarra, o exportado de Lucidchart/Draw.io. JPG, PNG o WebP. Máx 8 MB.
  </p>
</div>
```

### 7.6 Generic card section (used everywhere)

```tsx
<section className="gallery-card rounded-md p-10 space-y-6">
  <div>
    <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
      // Sección
    </div>
    <p className="serif text-2xl text-[#18181B] leading-relaxed">{contenido}</p>
  </div>
</section>
```

### 7.7 Loading state

```tsx
<div className="gallery-card rounded-md p-10 space-y-6">
  <div className="flex items-center gap-4">
    <div className="flex space-x-2">
      <div className="w-2.5 h-2.5 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="w-2.5 h-2.5 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="w-2.5 h-2.5 bg-[#A88B4C] rounded-full animate-bounce" />
    </div>
    <div>
      <p className="serif text-xl text-[#18181B]">Componiendo el mapa de {fileCount} archivos…</p>
      <p className="text-[#6B6357] text-sm italic serif">Gemini está armando el mapa general.</p>
    </div>
  </div>
</div>
```

### 7.8 Error state

```tsx
<div className="bg-[#F3DAD3]/40 border border-[#B0584C]/30 p-8 rounded-md flex items-center justify-between gap-5">
  <div className="flex items-center gap-5">
    <div className="bg-[#B0584C]/15 border border-[#B0584C]/30 text-[#B0584C] p-3 rounded shrink-0">
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <div>
      <p className="serif text-xl text-[#B0584C]">Algo falló</p>
      <p className="text-[#B0584C]/80 text-sm">{error}</p>
    </div>
  </div>
  <button
    type="button"
    onClick={handleRetry}
    className="shrink-0 px-5 py-2.5 bg-[#B0584C] hover:bg-[#9a4d42] text-[#EFE8D6] text-[10px] smallcaps font-semibold rounded transition-colors cursor-pointer"
  >
    Reintentar
  </button>
</div>
```

### 7.9 Mapa General — section card with dark header

```tsx
<section className="gallery-card rounded-md overflow-hidden">
  <div className="bg-[#18181B] px-10 py-5 flex items-center justify-between border-b border-[#3A3935]">
    <span className="text-[#C9AE74] font-mono text-[10px] smallcaps font-semibold">
      — Sala I · Mapa General —
    </span>
    <div className="px-3 py-1 border border-[#C9AE74]/30 rounded">
      <span className="text-[#C9AE74] text-[10px] smallcaps font-semibold">
        {fileCount} archivos
      </span>
    </div>
  </div>
  <div className="p-10 space-y-10">
    <div>
      <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">// De qué va el proyecto</div>
      <p className="serif text-2xl text-[#18181B] leading-relaxed">{overview.resumen}</p>
    </div>
    {/* ... structure + diagram ... */}
  </div>
</section>
```

### 7.10 File list with catalog numbering

```tsx
<section>
  <div className="flex items-end justify-between mb-6 px-1">
    <div>
      <div className="text-[10px] smallcaps text-[#A88B4C] mb-1 font-semibold">— Sala II —</div>
      <h2 className="serif text-3xl text-[#18181B] tracking-tight">Archivos del proyecto</h2>
    </div>
    <p className="text-sm text-[#8B8275] serif italic">Click para ver el mapa de cada uno</p>
  </div>
  <div className="space-y-3">
    {overview.archivos.map((a, i) => (
      <div key={a.ruta} className="flex items-start gap-4">
        <span className="catalog-num text-sm pt-7 w-8 shrink-0 text-right">
          {String(i + 1).padStart(2, '0')}.
        </span>
        <div className="flex-1">
          <FileCard archivo={a} /* ... props ... */ />
        </div>
      </div>
    ))}
  </div>
</section>
```

### 7.11 FileCard

```tsx
<div className="gallery-card row-hover rounded-md overflow-hidden">
  <button
    type="button"
    onClick={onExpand}
    className="w-full text-left px-7 py-5 flex items-start justify-between gap-4 group cursor-pointer"
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3 mb-2">
        <span className={`text-[10px] smallcaps font-semibold px-2 py-0.5 rounded ring-1 ${importanciaStyles[archivo.importancia]}`}>
          {archivo.importancia}
        </span>
        <code className="text-xs font-mono text-[#8B8275] truncate">{archivo.ruta}</code>
      </div>
      <p className="text-base serif text-[#18181B] leading-snug">{archivo.rol}</p>
    </div>
    <div className="text-[#A88B4C]/40 group-hover:text-[#A88B4C] transition-colors mt-1">
      <svg className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </button>

  {expanded && (
    <div className="border-t border-[#E5DDC9] px-7 py-7 bg-[#F4EEDA]/60 space-y-6">
      {/* ... loading, error, FileMapView ... */}
    </div>
  )}
</div>
```

#### Importance badge styles

```ts
const importanciaStyles: Record<OverviewArchivo['importancia'], string> = {
  alta:  'bg-[#F4EFE0] text-[#A88B4C] ring-[#D9CFB8]',
  media: 'bg-[#F4EEDA] text-[#6B6357] ring-[#E5DDC9]',
  baja:  'bg-transparent text-[#8B8275] ring-[#E5DDC9]',
}
```

### 7.12 Recapitulación (Sala III) — quote with left border

```tsx
<section className="gallery-card rounded-md p-12 border-l-2 border-l-[#A88B4C]">
  <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
    — Sala III · Para llevarte —
  </div>
  <h2 className="serif text-3xl tracking-tight text-[#18181B] mb-8 italic">
    Si solo recuerdas {n === 1 ? 'una cosa' : `${n} cosas`}…
  </h2>
  <ul className="space-y-5">
    {recapitulacion.map((punto, i) => (
      <li key={i} className="flex items-start gap-5">
        <span className="catalog-num text-2xl shrink-0 leading-none mt-1 w-10 text-right">
          {String(i + 1).padStart(2, '0')}
        </span>
        <p className="serif text-lg text-[#18181B] leading-relaxed pt-0.5">{punto}</p>
      </li>
    ))}
  </ul>
</section>
```

### 7.13 Mermaid wrapper

```tsx
return (
  <div
    ref={ref}
    className="flex justify-center my-6 overflow-x-auto p-8 bg-[#F4EEDA] rounded-md border border-[#D9CFB8]"
  />
)
```

### 7.14 Code block (language tabs + code)

```tsx
<section className="rounded-md overflow-hidden border border-[#3A3935] bg-[#18181B] shadow-[0_12px_32px_-16px_rgba(24,24,27,0.3)]">
  <div className="px-6 py-4 flex items-center justify-between border-b border-[#3A3935] bg-[#18181B]">
    <span className="text-[#C9AE74] font-mono text-[10px] smallcaps font-semibold">
      Código · {result.lenguaje_detectado}
    </span>
    <button onClick={handleCopy}
      className="px-4 py-1.5 bg-transparent border border-[#C9AE74]/40 hover:border-[#C9AE74] hover:bg-[#C9AE74]/10 text-[#C9AE74] text-[10px] smallcaps font-semibold rounded transition-colors cursor-pointer">
      {copied ? '¡Copiado!' : 'Copiar'}
    </button>
  </div>
  <pre className="p-6 text-sm font-mono text-[#EFE8D6] overflow-x-auto whitespace-pre">
    {result.codigo || '// Sin código generado'}
  </pre>
</section>
```

### 7.15 Footer

```tsx
<footer className="mt-32 text-center pb-16 space-y-4">
  <div className="gallery-divider mb-10">
    <span className="text-[#A88B4C] font-serif text-sm">◆</span>
  </div>
  <p className="text-[#8B8275] text-sm serif italic">Una galería para el código generado por IA</p>
</footer>
```

---

## 8. Spacing system

- Page max-width: `max-w-5xl mx-auto`
- Page padding: `px-6 py-20`
- Section spacing: `space-y-12`
- Card padding: `p-10` (large) or `p-8` (medium) or `px-7 py-5` (compact)
- Card border radius: `rounded-md` (NOT large rounded)
- Header bottom margin: `mb-20`
- Footer top margin: `mt-32`

---

## 9. Animations / transitions

- All transitions: `200-300ms` ease (no faster than 150ms, no slower than 500ms)
- Hover: just `transition-colors` or `transition-all` — no scale-up, no glow, no transform
- Loading: 3 dots bouncing with 0.15s stagger (in `--gold` color)
- Mermaid render: default

---

## 10. Troubleshooting

### "My friend's project is on Tailwind v3, not v4"
The `@theme` block is v4-specific. For v3, replace it with:
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        rounded: ['Outfit', 'Inter', 'sans-serif'],
      },
    },
  },
}
```
All `bg-[#hex]` arbitrary values still work.

### "Some classes (like `.smallcaps`, `.gallery-card`) don't show up"
Make sure they're in `client/src/index.css` (or wherever the global stylesheet is) — they are plain CSS, not Tailwind utilities.

### "The corner ornaments overlap with my content on small screens"
The CSS already has `@media (max-width: 900px) { .corner-ornament, .side-ornament { display: none; } }`. Confirm that media query is in place.

### "Fonts don't load"
The `@import` URL must be at the very top of the CSS file, before `@plugin` and any selector. If using a CSP, allow `https://fonts.googleapis.com` and `https://fonts.gstatic.com`.

### "Mermaid still renders dark/with old theme"
Mermaid caches the theme on its first init. After updating the config, clear the cache by re-rendering or hard-refreshing the page.

### "Build fails because `@theme` isn't recognized"
That's a Tailwind v4 directive. Either upgrade Tailwind or use the v3 fallback above.

---

## 11. Final checklist for the friend

After applying:

- [ ] Cards (`gallery-card`) are clearly differentiated from body bg (paper → ivory)
- [ ] Insets within cards are slightly darker than the card surface (paper → ivory → inset)
- [ ] Top accent bar is visible (4px, dark with burgundy + gold split on right)
- [ ] 4 corner ornaments visible at desktop sizes
- [ ] Right-side vertical ornament visible at desktop sizes
- [ ] `Vibe<span>M</span>ap` title has the M in burgundy
- [ ] No emojis as icons
- [ ] No neon, no glow, no dark background
- [ ] Build passes
- [ ] Page works at 1440px, 1024px, 768px, 375px
