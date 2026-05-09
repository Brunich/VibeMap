import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useDropzone, type FileRejection, type DropEvent } from 'react-dropzone'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'strict',
  fontFamily: 'Inter, system-ui, sans-serif',
  themeVariables: {
    primaryColor: '#eef2ff',
    primaryTextColor: '#1e1b4b',
    primaryBorderColor: '#a5b4fc',
    secondaryColor: '#f1f5f9',
    tertiaryColor: '#f8fafc',
    lineColor: '#94a3b8',
    textColor: '#334155',
    mainBkg: '#eef2ff',
    secondBkg: '#f1f5f9',
    tertiaryBkg: '#ffffff',
    nodeBorder: '#a5b4fc',
    clusterBkg: '#fafafa',
    clusterBorder: '#e2e8f0',
    titleColor: '#1e1b4b',
    edgeLabelBackground: '#ffffff',
    actorBkg: '#1e293b',
    actorBorder: '#1e1b4b',
    actorTextColor: '#ffffff',
    actorLineColor: '#94a3b8',
    signalColor: '#64748b',
    signalTextColor: '#1e1b4b',
    labelBoxBkgColor: '#eef2ff',
    labelBoxBorderColor: '#a5b4fc',
    labelTextColor: '#1e1b4b',
    noteBkgColor: '#fef3c7',
    noteTextColor: '#78350f',
    noteBorderColor: '#fde68a',
    activationBkgColor: '#c7d2fe',
    activationBorderColor: '#818cf8',
  },
})

type ProjectFile = { path: string; content: string }

type OverviewArchivo = {
  ruta: string
  rol: string
  importancia: 'alta' | 'media' | 'baja'
}

type FlujoPaso = {
  paso: number
  accion: string
  archivos: string[]
}

type Overview = {
  resumen: string
  estructura_general: string
  diagrama_mermaid: string
  flujo_principal: FlujoPaso[]
  archivos: OverviewArchivo[]
  recapitulacion: string[]
}

type FuncionDefinida = {
  real: string
  humana: string
  llama_a: string[]
}

type FuncionUsada = {
  nombre: string
  donde: string
  como: string
}

type FileMap = {
  explicacion: string
  estructura: string
  diagrama_mermaid: string
  flujo_ejecucion: string[]
  funciones_definidas: FuncionDefinida[]
  funciones_usadas: FuncionUsada[]
  puntos_clave: string[]
  resumen_archivo: string
}

type ImportanciaLevel = 'alta' | 'media' | 'baja'

type TreeNode = {
  name: string
  path: string
  isFile: boolean
  children: TreeNode[]
  importancia?: ImportanciaLevel
  isReadable: boolean
}

function buildTree(files: ProjectFile[], importanceMap: Map<string, ImportanciaLevel>): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isFile: false, children: [], isReadable: true }

  for (const f of files) {
    const parts = f.path.split('/').filter(Boolean)
    if (parts.length === 0) continue
    let cur = root
    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1
      const fullPath = '/' + parts.slice(0, i + 1).join('/')
      let next = cur.children.find((c) => c.name === part && c.isFile === isLast)
      if (!next) {
        next = {
          name: part,
          path: isLast ? f.path : fullPath,
          isFile: isLast,
          children: [],
          isReadable: isLast ? !f.content.startsWith('[') && f.content.length > 5 : true,
          ...(isLast && importanceMap.has(f.path) ? { importancia: importanceMap.get(f.path) } : {}),
        }
        cur.children.push(next)
      }
      cur = next
    })
  }

  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
      return a.name.localeCompare(b.name)
    })
    n.children.forEach(sortRec)
  }
  sortRec(root)
  return root.children
}

function nodeMatchesSearch(node: TreeNode, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  if (node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)) return true
  return node.children.some((c) => nodeMatchesSearch(c, q))
}

const importanciaPillStyles: Record<ImportanciaLevel, string> = {
  alta: 'bg-indigo-100 text-indigo-700',
  media: 'bg-slate-100 text-slate-600',
  baja: 'bg-slate-50 text-slate-400',
}

function FileTreeNode({
  node,
  depth,
  selectedPath,
  expanded,
  toggleFolder,
  onSelectFile,
  search,
}: {
  node: TreeNode
  depth: number
  selectedPath: string | null
  expanded: Set<string>
  toggleFolder: (path: string) => void
  onSelectFile: (node: TreeNode) => void
  search: string
}) {
  if (search && !nodeMatchesSearch(node, search)) return null

  if (node.isFile) {
    const isSelected = selectedPath === node.path
    return (
      <button
        type="button"
        onClick={() => onSelectFile(node)}
        disabled={!node.isReadable}
        className={`
          w-full text-left flex items-center gap-2 py-1.5 pr-2 rounded-lg text-sm group
          ${isSelected ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'}
          ${!node.isReadable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        `}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        title={node.isReadable ? node.path : `${node.path} (binario o vacío)`}
      >
        <span className="text-slate-400 text-xs shrink-0">📄</span>
        <span className="truncate flex-1 font-mono text-[13px]">{node.name}</span>
        {node.importancia && (
          <span
            className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md shrink-0 ${importanciaPillStyles[node.importancia]}`}
          >
            {node.importancia}
          </span>
        )}
      </button>
    )
  }

  // search: auto-expand folders that contain matches
  const isOpen = expanded.has(node.path) || (search.length > 0 && nodeMatchesSearch(node, search))

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleFolder(node.path)}
        className="w-full text-left flex items-center gap-2 py-1.5 rounded-lg text-sm hover:bg-slate-50 text-slate-800 font-semibold"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <span className="text-slate-500 text-xs shrink-0 w-3">{isOpen ? '▼' : '▶'}</span>
        <span className="text-slate-500 shrink-0">📁</span>
        <span className="truncate">{node.name}</span>
        <span className="text-[10px] font-normal text-slate-400">
          {countFiles(node)}
        </span>
      </button>
      {isOpen &&
        node.children.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            expanded={expanded}
            toggleFolder={toggleFolder}
            onSelectFile={onSelectFile}
            search={search}
          />
        ))}
    </div>
  )
}

function countFiles(node: TreeNode): number {
  if (node.isFile) return 1
  return node.children.reduce((sum, c) => sum + countFiles(c), 0)
}

const Mermaid = ({ chart, dense = false }: { chart: string; dense?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [renderTick, setRenderTick] = useState(0)

  useEffect(() => {
    if (!ref.current || !chart) return
    setRenderError(null)
    const id = `mermaid-${crypto.randomUUID()}`
    mermaid
      .render(id, chart.trim())
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg
      })
      .catch((err) => {
        console.error('Mermaid render error:', err)
        setRenderError(err?.message?.split('\n')[0] || 'Sintaxis inválida')
      })
  }, [chart, renderTick])

  if (!chart) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-500 italic">
        No se generó diagrama para este nivel.
      </div>
    )
  }

  if (renderError) {
    return (
      <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-sm font-bold text-amber-900">
            ⚠️ El diagrama tiene un error de sintaxis
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 underline"
            >
              {showRaw ? 'Ocultar' : 'Ver código'}
            </button>
            <button
              type="button"
              onClick={() => setRenderTick((t) => t + 1)}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 underline"
            >
              Reintentar
            </button>
          </div>
        </div>
        <p className="text-xs text-amber-800/80 mb-2">{renderError}</p>
        {showRaw && (
          <pre className="text-[11px] whitespace-pre-wrap font-mono text-amber-900/80 bg-white/60 p-3 rounded-xl border border-amber-100 overflow-x-auto">
            {chart}
          </pre>
        )}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={`
        flex justify-start overflow-auto bg-white rounded-3xl border border-slate-100 shadow-sm
        [&_svg]:max-w-none [&_svg]:h-auto
        ${dense ? 'p-4 my-0 min-h-[360px]' : 'p-8 my-2 min-h-[560px]'}
      `}
    />
  )
}

const isBinary = (buffer: Uint8Array): boolean => {
  const checkSize = Math.min(buffer.length, 1024)
  let nonPrintable = 0
  for (let i = 0; i < checkSize; i++) {
    if (buffer[i] === 0) return true
    if (buffer[i]! < 32 && ![9, 10, 13].includes(buffer[i]!)) nonPrintable++
  }
  return nonPrintable / checkSize > 0.3
}

const IGNORED_PATH_RE =
  /(^|\/)(node_modules|\.git|dist|build|bin|obj|\.next|\.cache|\.import|\.godot|\.turbo|\.svelte-kit|target|out)(\/|$)/

const isIgnoredPath = (path: string): boolean => IGNORED_PATH_RE.test(path)

const errorMessage = (err: unknown, fallback: string): string => {
  return err instanceof Error && err.message ? err.message : fallback
}

const readSingleFile = async (file: File, path: string): Promise<ProjectFile> => {
  if (file.size > 1024 * 1024 * 10) {
    return { path, content: '[CONTENIDO OMITIDO: ARCHIVO MAYOR A 10MB]' }
  }
  try {
    const buf = new Uint8Array(await file.arrayBuffer())
    if (isBinary(buf)) {
      return { path, content: '[ARCHIVO BINARIO O MULTIMEDIA]' }
    }
    return { path, content: new TextDecoder('utf-8', { fatal: false }).decode(buf) }
  } catch (err) {
    console.error(`Error leyendo ${path}:`, err)
    return { path, content: '[ERROR DE LECTURA]' }
  }
}

const readEntry = async (entry: FileSystemEntry): Promise<ProjectFile[]> => {
  if (isIgnoredPath(entry.fullPath)) return []

  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    return new Promise((resolve) => {
      fileEntry.file(
        async (file) => resolve([await readSingleFile(file, entry.fullPath)]),
        () => resolve([{ path: entry.fullPath, content: '[ERROR DE LECTURA]' }]),
      )
    })
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry
    const reader = dirEntry.createReader()
    const readAll = async () => {
      let all: FileSystemEntry[] = []
      let batch: FileSystemEntry[]
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve) => {
          reader.readEntries(resolve, () => resolve([]))
        })
        all = all.concat(batch)
      } while (batch.length > 0)
      return all
    }
    const entries = await readAll()
    const results = await Promise.all(entries.map((e) => readEntry(e)))
    return results.flat()
  }

  return []
}

const importanciaStyles: Record<OverviewArchivo['importancia'], string> = {
  alta: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  media: 'bg-slate-100 text-slate-600 ring-slate-200',
  baja: 'bg-slate-50 text-slate-400 ring-slate-100',
}

function FileCard({
  archivo,
  onExpand,
  expanded,
  fileMap,
  loading,
  error,
}: {
  archivo: OverviewArchivo
  onExpand: () => void
  expanded: boolean
  fileMap: FileMap | null
  loading: boolean
  error: string | null
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onExpand}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ring-1 ${importanciaStyles[archivo.importancia]}`}
            >
              {archivo.importancia}
            </span>
            <code className="text-sm font-mono text-slate-500 truncate">{archivo.ruta}</code>
          </div>
          <p className="text-base text-slate-800 font-medium leading-snug">{archivo.rol}</p>
        </div>
        <div className="text-slate-300 group-hover:text-indigo-500 transition-colors mt-1">
          <svg
            className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-6 py-6 bg-slate-50/40">
          <FileMapDetail fileMap={fileMap} loading={loading} error={error} />
        </div>
      )}
    </div>
  )
}

function FileMapDetail({
  fileMap,
  loading,
  error,
}: {
  fileMap: FileMap | null
  loading: boolean
  error: string | null
}) {
  return (
    <div className="space-y-5">
      {loading && (
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
          </div>
          Generando mapa de este archivo…
        </div>
      )}

      {error && (
        <div className="text-rose-700 text-sm bg-rose-50 border border-rose-100 rounded-xl p-3">
          ⚠️ {error}
        </div>
      )}

      {fileMap && (
        <>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
              Explicación con ejemplo
            </div>
            <p className="text-lg text-slate-800 leading-relaxed">{fileMap.explicacion}</p>
            <p className="text-sm text-slate-500 leading-relaxed mt-3">
              Lee el diagrama de arriba hacia abajo: cada flecha representa una llamada o paso real
              dentro del archivo, y las notas marcan momentos importantes del flujo.
            </p>
          </div>

          {fileMap.estructura && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
                Estructura usada
              </div>
              <p className="text-sm text-slate-700 font-mono bg-slate-100/60 inline-block px-3 py-1.5 rounded-xl">
                {fileMap.estructura}
              </p>
            </div>
          )}

          <div className="grid 2xl:grid-cols-[minmax(320px,0.8fr)_minmax(640px,1.2fr)] gap-6 items-start">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-3">
                Cómo funciona, paso a paso
              </div>
              {fileMap.flujo_ejecucion && fileMap.flujo_ejecucion.length > 0 ? (
                <ol className="space-y-2 border-l-2 border-indigo-200 pl-5">
                  {fileMap.flujo_ejecucion.map((paso, i) => (
                    <li key={i} className="relative text-slate-800 text-sm leading-relaxed">
                      <span className="absolute -left-[1.65rem] top-0.5 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span>{paso.replace(/^\d+\.\s*/, '')}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-400 italic">Sin pasos numerados.</p>
              )}
            </div>
            <div className="xl:sticky xl:top-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-3">
                Diagrama de secuencia
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                Este mapa muestra el orden de ejecución dentro del archivo seleccionado: quién llama a quién,
                en qué momento ocurre y qué piezas externas participan.
              </p>
              <Mermaid chart={fileMap.diagrama_mermaid} />
            </div>
          </div>

          {fileMap.funciones_definidas && fileMap.funciones_definidas.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
                Funciones que define este archivo
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100/70 text-slate-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left font-bold px-4 py-2">Nombre real</th>
                      <th className="text-left font-bold px-4 py-2">Qué hace y cuándo</th>
                      <th className="text-left font-bold px-4 py-2">Llama a</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {fileMap.funciones_definidas.map((fn) => (
                      <tr key={fn.real}>
                        <td className="px-4 py-2 font-mono text-indigo-700 align-top whitespace-nowrap">{fn.real}</td>
                        <td className="px-4 py-2 text-slate-700 align-top">{fn.humana}</td>
                        <td className="px-4 py-2 align-top">
                          {fn.llama_a.length === 0 ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {fn.llama_a.map((c) => (
                                <code
                                  key={c}
                                  className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md"
                                >
                                  {c}
                                </code>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {fileMap.funciones_usadas && fileMap.funciones_usadas.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
                Funciones que usa de fuera
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100/70 text-slate-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left font-bold px-4 py-2">Función</th>
                      <th className="text-left font-bold px-4 py-2">De dónde</th>
                      <th className="text-left font-bold px-4 py-2">Cómo se usa aquí</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {fileMap.funciones_usadas.map((fn, i) => (
                      <tr key={`${fn.nombre}-${i}`}>
                        <td className="px-4 py-2 font-mono text-emerald-700 align-top whitespace-nowrap">{fn.nombre}</td>
                        <td className="px-4 py-2 text-slate-500 align-top text-xs">{fn.donde}</td>
                        <td className="px-4 py-2 text-slate-700 align-top">{fn.como}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {fileMap.puntos_clave.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
                Puntos clave
              </div>
              <ul className="space-y-1.5">
                {fileMap.puntos_clave.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700 text-sm">
                    <span className="text-indigo-400 mt-1">●</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fileMap.resumen_archivo && (
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 mb-1">
                En resumen
              </div>
              <p className="text-slate-800 text-sm font-medium">{fileMap.resumen_archivo}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function App() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [streamingText, setStreamingText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState<number>(0)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const [fileMaps, setFileMaps] = useState<Record<string, FileMap>>({})
  const [fileMapLoading, setFileMapLoading] = useState<Record<string, boolean>>({})
  const [fileMapErrors, setFileMapErrors] = useState<Record<string, string>>({})
  const [treeSelectedPath, setTreeSelectedPath] = useState<string | null>(null)
  const [treeExpandedFolders, setTreeExpandedFolders] = useState<Set<string>>(new Set())
  const [treeSearch, setTreeSearch] = useState('')

  const filesByPath = useMemo(() => {
    const map = new Map<string, ProjectFile>()
    for (const f of files) map.set(f.path, f)
    return map
  }, [files])

  const importanceMap = useMemo(() => {
    const m = new Map<string, ImportanciaLevel>()
    if (overview) {
      for (const a of overview.archivos) m.set(a.ruta, a.importancia)
    }
    return m
  }, [overview])

  const tree = useMemo(
    () => (files.length > 0 ? buildTree(files, importanceMap) : []),
    [files, importanceMap],
  )

  useEffect(() => {
    if (tree.length === 0) return
    setTreeExpandedFolders((prev) => {
      if (prev.size > 0) return prev
      const next = new Set<string>()
      const seedDepth = (nodes: TreeNode[], depth: number) => {
        for (const n of nodes) {
          if (n.isFile) continue
          if (depth <= 1) next.add(n.path)
          if (depth < 2) seedDepth(n.children, depth + 1)
        }
      }
      seedDepth(tree, 0)
      return next
    })
  }, [tree])

  const totalFilesInTree = useMemo(() => tree.reduce((s, n) => s + countFiles(n), 0), [tree])
  const selectedTreeFile = treeSelectedPath ? filesByPath.get(treeSelectedPath) : undefined

  const toggleFolder = useCallback((path: string) => {
    setTreeExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const runOverview = useCallback(async (collected: ProjectFile[]) => {
    setLoading(true)
    setError(null)
    setOverview(null)
    setStreamingText('')
    setExpandedPath(null)
    setFileMaps({})
    setFileMapErrors({})

    try {
      const response = await fetch('/api/overview-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: collected }),
      })

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Error generando el mapa general')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalOverview: Overview | null = null
      let streamErr: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const evt of events) {
          if (!evt.trim()) continue
          const lines = evt.split('\n')
          let evtName = 'message'
          let dataStr = ''
          for (const line of lines) {
            if (line.startsWith('event:')) evtName = line.slice(6).trim()
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
          }
          if (!dataStr) continue
          try {
            const payload = JSON.parse(dataStr)
            if (evtName === 'chunk') {
              setStreamingText(payload.accumulated ?? '')
            } else if (evtName === 'done') {
              finalOverview = payload as Overview
            } else if (evtName === 'error') {
              streamErr = payload.error ?? 'Error desconocido'
            }
          } catch {
            /* ignore malformed event */
          }
        }
      }

      if (streamErr) throw new Error(streamErr)
      if (!finalOverview) throw new Error('El mapa general nunca se completó.')
      setOverview(finalOverview)
      setStreamingText('')
    } catch (err: unknown) {
      setError(errorMessage(err, 'Error inesperado en VibeMap'))
    } finally {
      setLoading(false)
    }
  }, [])

  const startProcessing = useCallback(async (collected: ProjectFile[]) => {
    setLoading(true)
    setError(null)
    setOverview(null)
    setStreamingText('')
    setTreeSelectedPath(null)
    setTreeSearch('')
    setTreeExpandedFolders(new Set())

    const filtered = collected.filter((f) => !isIgnoredPath(f.path))

    if (filtered.length === 0) {
      setError('No se encontraron archivos procesables. Asegúrate de subir una carpeta con código.')
      setLoading(false)
      setFileCount(0)
      setFiles([])
      return
    }

    setFileCount(filtered.length)
    setFiles(filtered)
    await runOverview(filtered)
  }, [runOverview])

  const onDrop = useCallback(async (_acceptedFiles: File[], _fileRejections: FileRejection[], event: DropEvent) => {
    try {
      const dataTransfer = (event as DragEvent | undefined)?.dataTransfer
      const items = dataTransfer?.items

      let collected: ProjectFile[] = []

      if (items && items.length > 0) {
        const entries = Array.from(items)
          .map((item) => item.webkitGetAsEntry?.())
          .filter((e): e is FileSystemEntry => Boolean(e))

        if (entries.length > 0) {
          const nested = await Promise.all(entries.map((e) => readEntry(e)))
          collected = nested.flat()
        }
      }

      // Fallback: lee los archivos del DataTransfer directamente (sin estructura)
      if (collected.length === 0 && dataTransfer?.files && dataTransfer.files.length > 0) {
        collected = await Promise.all(
          Array.from(dataTransfer.files).map((f) => readSingleFile(f, '/' + f.name)),
        )
      }

      if (collected.length === 0) {
        throw new Error('No pude leer la carpeta. Prueba con los botones de abajo.')
      }

      await startProcessing(collected)
    } catch (err: unknown) {
      setError(errorMessage(err, 'Error inesperado en VibeMap'))
      setLoading(false)
    }
  }, [startProcessing])

  const handlePickedFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    try {
      const collected = await Promise.all(
        Array.from(fileList).map((f) => {
          const anyF = f as File & { webkitRelativePath?: string }
          const rel = anyF.webkitRelativePath && anyF.webkitRelativePath.length > 0
            ? '/' + anyF.webkitRelativePath
            : '/' + f.name
          return readSingleFile(f, rel)
        }),
      )
      await startProcessing(collected)
    } catch (err: unknown) {
      setError(errorMessage(err, 'Error inesperado leyendo archivos'))
      setLoading(false)
    }
  }, [startProcessing])

  const handleRetry = useCallback(() => {
    if (files.length > 0) runOverview(files)
  }, [files, runOverview])

  const ensureFileMap = useCallback(
    async (ruta: string) => {
      if (fileMaps[ruta] || fileMapLoading[ruta]) return

      const file = filesByPath.get(ruta)
      if (!file) {
        setFileMapErrors((p) => ({ ...p, [ruta]: 'Archivo no encontrado en el upload.' }))
        return
      }
      if (!file.content || file.content.startsWith('[')) {
        setFileMapErrors((p) => ({ ...p, [ruta]: 'No hay contenido legible para este archivo.' }))
        return
      }

      setFileMapLoading((p) => ({ ...p, [ruta]: true }))
      setFileMapErrors((p) => {
        const next = { ...p }
        delete next[ruta]
        return next
      })

      try {
        const response = await fetch('/api/file-map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: file.path,
            content: file.content,
            projectContext: overview?.resumen ?? '',
          }),
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || 'Error generando mapa del archivo')
        }
        const data: FileMap = await response.json()
        setFileMaps((p) => ({ ...p, [ruta]: data }))
      } catch (err: unknown) {
        setFileMapErrors((p) => ({ ...p, [ruta]: errorMessage(err, 'Error inesperado') }))
      } finally {
        setFileMapLoading((p) => ({ ...p, [ruta]: false }))
      }
    },
    [fileMaps, fileMapLoading, filesByPath, overview],
  )

  const handleExpandFile = useCallback(
    async (ruta: string) => {
      if (expandedPath === ruta) {
        setExpandedPath(null)
        return
      }
      setExpandedPath(ruta)
      await ensureFileMap(ruta)
    },
    [expandedPath, ensureFileMap],
  )

  const handleSelectFromTree = useCallback(
    (node: TreeNode) => {
      if (!node.isFile || !node.isReadable) return
      setTreeSelectedPath(node.path)
      ensureFileMap(node.path)
      setTimeout(() => {
        document.getElementById('diagram-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
    },
    [ensureFileMap],
  )

  const { getRootProps, isDragActive } = useDropzone({ onDrop, noClick: true, noKeyboard: true })

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 font-sans antialiased text-slate-900">
      <header className="text-center mb-16">
        <div className="inline-block px-4 py-1.5 mb-6 text-sm font-bold tracking-widest text-indigo-600 uppercase bg-indigo-50 rounded-full">
          Hackathon Edition v2.0
        </div>
        <h1 className="text-8xl font-black tracking-tighter mb-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 bg-clip-text text-transparent">
          VibeMap
        </h1>
        <p className="text-2xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
          ¿Codex o Claude te generó código y no entiendes qué hace?
          <br />
          Súbelo y te lo explico como mapa mental, en palabras simples.
        </p>
      </header>

      <main className="space-y-12">
        <section
          {...getRootProps()}
          className={`
            relative group border-2 border-dashed rounded-[3rem] p-16 text-center transition-all duration-700
            ${
              isDragActive
                ? 'border-indigo-600 bg-indigo-50/30 scale-[1.01] ring-8 ring-indigo-50'
                : 'border-slate-200 bg-white hover:border-indigo-300'
            }
          `}
        >
          <div className="space-y-6">
            <div className="w-24 h-24 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl group-hover:scale-105 transition-transform duration-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-black tracking-tight text-slate-900">
                {isDragActive ? '¡Suéltala aquí!' : 'Arrastra tu carpeta de proyecto'}
              </p>
              <p className="text-slate-400 text-base font-medium">
                Acepta cualquier tipo de archivo (incluyendo .env, .gitignore, Dockerfile, README, etc.)
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <label
                onClick={(e) => e.stopPropagation()}
                className="relative inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 cursor-pointer overflow-hidden"
              >
                <input
                  type="file"
                  multiple
                  // @ts-expect-error — webkitdirectory no está en los tipos estándar
                  webkitdirectory=""
                  directory=""
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    handlePickedFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <span>📁</span>
                <span>Elegir carpeta</span>
              </label>
              <label
                onClick={(e) => e.stopPropagation()}
                className="relative inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-800 border-2 border-slate-200 rounded-2xl font-bold text-sm hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer overflow-hidden"
              >
                <input
                  type="file"
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    handlePickedFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <span>📄</span>
                <span>Elegir archivos sueltos</span>
              </label>
            </div>

            <p className="text-[11px] text-slate-400 pt-2">
              Se ignoran automáticamente <code className="bg-slate-100 px-1 rounded">node_modules</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">.git/</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">dist/</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">build/</code> y similares.
            </p>
          </div>

        </section>

        {loading && (
          <div className="bg-white rounded-[3rem] p-12 shadow-xl border border-slate-100 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce"></div>
              </div>
              <div>
                <p className="text-xl font-black text-slate-900">
                  Mapeando {fileCount} archivos…
                </p>
                <p className="text-slate-500 text-sm font-medium">Gemini está armando el mapa general.</p>
              </div>
            </div>
            {streamingText && (
              <pre className="text-xs font-mono text-slate-400 bg-slate-50 p-4 rounded-2xl overflow-hidden max-h-40 whitespace-pre-wrap">
                {streamingText.slice(-1200)}
              </pre>
            )}
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border-2 border-rose-100 p-8 rounded-[2.5rem] flex items-center justify-between gap-5">
            <div className="flex items-center gap-5">
              <div className="bg-rose-500 text-white p-3 rounded-2xl shadow-lg shadow-rose-200 shrink-0">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-black text-rose-950">Algo falló</p>
                <p className="text-rose-700 font-medium">{error}</p>
              </div>
            </div>
            {files.length > 0 && (
              <button
                type="button"
                onClick={handleRetry}
                className="shrink-0 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-2xl transition-colors shadow-md shadow-rose-200"
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        {overview && (
          <>
            {tree.length > 0 && (
              <section className="grid xl:grid-cols-[340px_minmax(0,1fr)] gap-8 items-start">
                <aside className="bg-white border border-slate-100 rounded-3xl p-6 xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black tracking-tight text-slate-900">Explorador</h2>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                      {totalFilesInTree} archivos
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTreeSelectedPath(null)}
                    className={`w-full text-left rounded-2xl border px-4 py-3 mb-4 transition-colors ${
                      treeSelectedPath === null
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-950'
                        : 'border-slate-100 bg-slate-50/70 text-slate-700 hover:border-indigo-200'
                    }`}
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1">
                      Vista principal
                    </div>
                    <div className="font-bold">Mapa general del proyecto</div>
                    <div className="text-xs text-slate-500 mt-1">Arquitectura, flujo completo y conexiones.</div>
                  </button>
                  <input
                    type="search"
                    value={treeSearch}
                    onChange={(e) => setTreeSearch(e.target.value)}
                    placeholder="Buscar archivo o carpeta…"
                    className="w-full text-sm px-3 py-2 mb-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                  />
                  <div className="-mx-2">
                    {tree.map((node) => (
                      <FileTreeNode
                        key={node.path}
                        node={node}
                        depth={0}
                        selectedPath={treeSelectedPath}
                        expanded={treeExpandedFolders}
                        toggleFolder={toggleFolder}
                        onSelectFile={handleSelectFromTree}
                        search={treeSearch}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                    Selecciona un archivo para cambiar el visor al diagrama específico. Los grises son binarios o vacíos.
                  </p>
                </aside>

                <section id="diagram-workspace" className="min-w-0 bg-white rounded-[3rem] shadow-[0_30px_60px_-16px_rgba(0,0,0,0.08)] border border-slate-50 overflow-hidden">
                  {!treeSelectedPath ? (
                    <>
                      <div className="bg-slate-950 px-8 py-6 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="text-indigo-400 font-mono text-xs font-bold tracking-[0.35em] uppercase mb-2">
                            Mapa General
                          </div>
                          <h2 className="text-2xl font-black text-white tracking-tight">Cómo se conecta todo</h2>
                        </div>
                        <div className="px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                          <span className="text-indigo-300 text-xs font-black uppercase tracking-widest">
                            {fileCount} archivos
                          </span>
                        </div>
                      </div>
                      <div className="p-8 lg:p-10 space-y-8">
                        <div className="grid 2xl:grid-cols-[minmax(0,0.85fr)_minmax(680px,1.25fr)] gap-8 items-start">
                          <div className="space-y-6">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
                                De qué va el proyecto
                              </div>
                              <p className="text-2xl text-slate-800 leading-relaxed font-medium">{overview.resumen}</p>
                            </div>
                            {overview.estructura_general && (
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
                                  Estructura general
                                </div>
                                <p className="text-base text-slate-700 font-mono bg-slate-100/60 inline-block px-4 py-2 rounded-xl">
                                  {overview.estructura_general}
                                </p>
                              </div>
                            )}
                            <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 mb-2">
                                Cómo leer este diagrama
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed">
                                Cada bloque agrupa funciones o datos de un archivo. Las flechas explican qué pieza llama,
                                usa o crea a otra. Úsalo como mapa de navegación: primero ubica los archivos grandes,
                                luego sigue las flechas para entender el flujo real del programa.
                              </p>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-3">
                                Flujo principal, paso a paso
                              </div>
                              {overview.flujo_principal && overview.flujo_principal.length > 0 ? (
                                <ol className="space-y-3">
                                  {overview.flujo_principal.map((p) => (
                                    <li
                                      key={p.paso}
                                      className="flex gap-3 bg-slate-50/80 border border-slate-100 rounded-2xl p-3"
                                    >
                                      <span className="shrink-0 w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
                                        {p.paso}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-slate-800 leading-relaxed text-sm">{p.accion}</p>
                                        {p.archivos.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {p.archivos.map((ruta) => (
                                              <code
                                                key={ruta}
                                                className="text-[10px] font-mono bg-white text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-md"
                                              >
                                                {ruta}
                                              </code>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <p className="text-sm text-slate-400 italic">No se generó flujo numerado.</p>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-3">
                              Diagrama principal
                            </div>
                            <Mermaid chart={overview.diagrama_mermaid} />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 lg:p-10 space-y-6">
                      <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-100">
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
                            Diagrama específico
                          </div>
                          <code className="text-base font-mono text-slate-900 break-all">
                            {treeSelectedPath}
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTreeSelectedPath(null)}
                          className="shrink-0 text-slate-400 hover:text-slate-700 text-sm font-medium"
                        >
                          Cerrar ✕
                        </button>
                      </div>
                      {!selectedTreeFile ? (
                        <p className="text-rose-700 text-sm">Archivo no encontrado en el upload.</p>
                      ) : (
                        <FileMapDetail
                          fileMap={fileMaps[treeSelectedPath] ?? null}
                          loading={!!fileMapLoading[treeSelectedPath]}
                          error={fileMapErrors[treeSelectedPath] ?? null}
                        />
                      )}
                    </div>
                  )}
                </section>
              </section>
            )}

            <section>
              <div className="flex items-end justify-between mb-4 px-2">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Archivos recomendados</h2>
                <p className="text-sm text-slate-400 font-medium">
                  Atajos a los archivos que Gemini marcó como importantes
                </p>
              </div>
              <div className="space-y-3">
                {overview.archivos.map((a) => (
                  <FileCard
                    key={a.ruta}
                    archivo={a}
                    expanded={expandedPath === a.ruta}
                    onExpand={() => handleExpandFile(a.ruta)}
                    fileMap={fileMaps[a.ruta] ?? null}
                    loading={!!fileMapLoading[a.ruta]}
                    error={fileMapErrors[a.ruta] ?? null}
                  />
                ))}
              </div>
            </section>

            {overview.recapitulacion && overview.recapitulacion.length > 0 && (
              <section className="bg-gradient-to-br from-indigo-50 via-white to-indigo-50/40 rounded-[3rem] p-12 border border-indigo-100">
                <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 mb-3">
                  Para llevarte
                </div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-6">
                  Si solo recuerdas {overview.recapitulacion.length === 1 ? 'una cosa' : `${overview.recapitulacion.length} cosas`}…
                </h2>
                <ul className="space-y-3">
                  {overview.recapitulacion.map((punto, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center">
                        {i + 1}
                      </span>
                      <p className="text-lg text-slate-800 leading-relaxed font-medium pt-0.5">{punto}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mt-32 text-center pb-20 space-y-4">
        <div className="w-20 h-1 bg-slate-200 mx-auto rounded-full mb-10"></div>
        <p className="text-slate-400 font-bold tracking-widest uppercase text-sm">
          VibeMap Hackathon Engine &copy; 2026
        </p>
        <p className="text-slate-300 text-sm">Diseñado para entender código generado por IA</p>
      </footer>
    </div>
  )
}

export default App
