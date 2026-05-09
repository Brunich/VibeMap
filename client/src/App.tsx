import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { useDropzone, type FileRejection, type DropEvent } from 'react-dropzone'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'strict',
  fontFamily: 'Inter, system-ui, sans-serif',
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
    secondBkg: '#F4EFE0',
    tertiaryBkg: '#EFE8D6',
    nodeBorder: '#A88B4C',
    clusterBkg: '#F4EFE0',
    clusterBorder: '#D9CFB8',
    titleColor: '#18181B',
    edgeLabelBackground: '#F4EEDA',
    actorBkg: '#FAF5E5',
    actorBorder: '#A88B4C',
    actorTextColor: '#18181B',
    actorLineColor: '#3A3935',
    signalColor: '#3A3935',
    signalTextColor: '#18181B',
    labelBoxBkgColor: '#F4EEDA',
    labelBoxBorderColor: '#A88B4C',
    labelTextColor: '#18181B',
    noteBkgColor: '#F4EFE0',
    noteTextColor: '#3A3935',
    noteBorderColor: '#D9CFB8',
    activationBkgColor: '#F4EEDA',
    activationBorderColor: '#A88B4C',
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

type DiagramToCode = {
  lenguaje_detectado: string
  interpretacion: string
  codigo: string
  supuestos: string[]
  advertencias: string[]
}

type TargetLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'pseudocodigo'
  | 'go'
  | 'java'
  | 'csharp'
  | 'cpp'

const TARGET_LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  pseudocodigo: 'Pseudocódigo',
  go: 'Go',
  java: 'Java',
  csharp: 'C#',
  cpp: 'C++',
}

type TabKey = 'mapa' | 'diagrama'

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
  alta: 'bg-[#F4EFE0] text-[#A88B4C]',
  media: 'bg-[#F4EEDA] text-[#6B6357]',
  baja: 'bg-transparent text-[#8B8275]',
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
          w-full text-left flex items-center gap-2 py-1.5 pr-2 rounded text-sm group
          ${isSelected ? 'bg-[#F4EFE0] text-[#18181B] font-semibold' : 'hover:bg-[#F4EEDA] text-[#3A3935]'}
          ${!node.isReadable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        `}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        title={node.isReadable ? node.path : `${node.path} (binario o vacío)`}
      >
        <svg className="w-3.5 h-3.5 text-[#A88B4C] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 3h7l5 5v13H7V3z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 3v5h5" />
        </svg>
        <span className="truncate flex-1 font-mono text-[13px]">{node.name}</span>
        {node.importancia && (
          <span
            className={`text-[9px] smallcaps font-semibold px-1.5 py-0.5 rounded shrink-0 ${importanciaPillStyles[node.importancia]}`}
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
        className="w-full text-left flex items-center gap-2 py-1.5 rounded text-sm hover:bg-[#F4EEDA] text-[#18181B] font-semibold"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <span className="text-[#8B8275] text-xs shrink-0 w-3">{isOpen ? '▼' : '▶'}</span>
        <svg className="w-4 h-4 text-[#8B8275] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h7l2 2h9v10H3V7z" />
        </svg>
        <span className="truncate">{node.name}</span>
        <span className="text-[10px] font-normal text-[#8B8275]">
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

type ParsedNode = { id: string; label: string }
type ParsedEdge = { from: string; label: string; to: string }

const cleanMermaidLabel = (label: string): string => {
  return label.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ')
}

function parseMermaidSource(chart: string): { nodes: ParsedNode[]; edges: ParsedEdge[] } {
  const nodeMap = new Map<string, string>()
  const edges: ParsedEdge[] = []
  const idPattern = '[A-Za-z_][\\w]*'
  const shapePattern = '\\s*(?:\\[\\[?[^\\]\\n]+\\]\\]?|\\(\\(?[^\\)\\n]+\\)\\)?|\\{\\{?[^\\}\\n]+\\}\\}?)?'
  const nodeRe = new RegExp(`\\b(${idPattern})\\s*(?:\\[\\[?|\\(\\(?|\\{\\{?)([^\\]\\)\\}]+)(?:\\]\\]?|\\)\\)?|\\}\\}?)`, 'g')
  const flowEdgeRe = new RegExp(
    `\\b(${idPattern})\\b${shapePattern}\\s*[-.=]+>\\s*(?:\\|([^|]+)\\|\\s*)?\\b(${idPattern})\\b`,
    'g',
  )
  const labeledFlowEdgeRe = new RegExp(
    `\\b(${idPattern})\\b${shapePattern}\\s*--\\s*([^|\\n-]+?)\\s*-->\\s*\\b(${idPattern})\\b`,
    'g',
  )
  const sequenceParticipantRe = new RegExp(`^(?:participant|actor)\\s+(${idPattern})(?:\\s+as\\s+(.+))?$`, 'i')
  const sequenceEdgeRe = new RegExp(`^(${idPattern})\\s*(?:--|-)(?:>>|>|x|\\))\\+?\\s*(${idPattern})\\s*:\\s*(.+)$`)

  const addNode = (id: string, label = id) => {
    if (!nodeMap.has(id)) nodeMap.set(id, cleanMermaidLabel(label))
  }

  for (const rawLine of chart.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('%%')) continue

    const participantMatch = line.match(sequenceParticipantRe)
    if (participantMatch) {
      addNode(participantMatch[1]!, participantMatch[2] ?? participantMatch[1]!)
      continue
    }

    const sequenceEdgeMatch = line.match(sequenceEdgeRe)
    if (sequenceEdgeMatch) {
      const from = sequenceEdgeMatch[1]!
      const to = sequenceEdgeMatch[2]!
      addNode(from)
      addNode(to)
      edges.push({ from, label: cleanMermaidLabel(sequenceEdgeMatch[3] ?? ''), to })
      continue
    }

    if (/^(graph|flowchart|sequenceDiagram|subgraph|end|classDef|class|click|style|linkStyle)\b/.test(line)) {
      continue
    }

    nodeRe.lastIndex = 0
    let nodeMatch: RegExpExecArray | null
    while ((nodeMatch = nodeRe.exec(line)) !== null) {
      addNode(nodeMatch[1]!, nodeMatch[2]!)
    }

    labeledFlowEdgeRe.lastIndex = 0
    let labeledEdgeMatch: RegExpExecArray | null
    let hasLabeledEdge = false
    while ((labeledEdgeMatch = labeledFlowEdgeRe.exec(line)) !== null) {
      hasLabeledEdge = true
      const from = labeledEdgeMatch[1]!
      const to = labeledEdgeMatch[3]!
      addNode(from)
      addNode(to)
      edges.push({ from, label: cleanMermaidLabel(labeledEdgeMatch[2] ?? ''), to })
    }
    if (hasLabeledEdge) continue

    flowEdgeRe.lastIndex = 0
    let edgeMatch: RegExpExecArray | null
    while ((edgeMatch = flowEdgeRe.exec(line)) !== null) {
      const from = edgeMatch[1]!
      const to = edgeMatch[3]!
      addNode(from)
      addNode(to)
      edges.push({ from, label: cleanMermaidLabel(edgeMatch[2] ?? ''), to })
    }
  }

  const nodes = Array.from(nodeMap.entries()).map(([id, label]) => ({ id, label }))
  return { nodes, edges }
}

function StepByStepDiagram({ chart }: { chart: string }) {
  const { nodes, edges } = useMemo(() => parseMermaidSource(chart), [chart])
  const labelOf = useMemo(() => new Map(nodes.map((n) => [n.id, n.label])), [nodes])

  if (nodes.length === 0 && edges.length === 0) {
    return (
      <div className="p-6 bg-[#F4EEDA] border border-[#D9CFB8] rounded-md text-sm text-[#6B6357] text-center">
        No se pudo extraer ningun paso del diagrama.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {nodes.length > 0 && (
        <div>
          <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-3">
            Componentes detectados
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {nodes.map((n, i) => (
              <div
                key={n.id}
                className="flex items-center gap-3 p-3 bg-[#FAF5E5] rounded-md border border-[#D9CFB8] hover:border-[#C9AE74] transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-[#F4EEDA] border border-[#D9CFB8] text-[#5E3A3A] text-xs font-semibold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] text-[#8B8275] uppercase tracking-wider">{n.id}</div>
                  <div className="font-medium text-[#18181B] text-sm break-words">{n.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {edges.length > 0 ? (
        <div>
          <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-3">
            Flujo paso a paso
          </div>
          <ol className="space-y-3">
            {edges.map((edge, i) => (
              <li key={`${edge.from}-${edge.to}-${i}`} className="flex gap-3 bg-[#FAF5E5] rounded-md border border-[#D9CFB8] p-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-[#F4EEDA] border border-[#D9CFB8] text-[#5E3A3A] font-semibold text-sm flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 text-sm leading-relaxed">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#18181B]">{labelOf.get(edge.from) ?? edge.from}</span>
                    <span className="font-mono text-[10px] text-[#8B8275]">{edge.from}</span>
                    <span className="text-[#A88B4C] font-bold">-&gt;</span>
                    <span className="font-semibold text-[#18181B]">{labelOf.get(edge.to) ?? edge.to}</span>
                    <span className="font-mono text-[10px] text-[#8B8275]">{edge.to}</span>
                  </div>
                  {edge.label && (
                    <div className="mt-2 inline-block bg-[#F4EFE0] text-[#5E3A3A] px-2 py-1 rounded text-xs font-medium">
                      {edge.label}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-sm text-[#8B8275] italic">No se detectaron flechas entre componentes.</p>
      )}
    </div>
  )
}

function unlockSvgSize(container: HTMLElement | null) {
  if (!container) return
  const svg = container.querySelector('svg')
  if (!svg) return
  svg.removeAttribute('style')
  svg.style.maxWidth = 'none'
  svg.style.height = 'auto'
  svg.style.display = 'block'
}

function MermaidFullscreen({ chart, onClose }: { chart: string; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const dragState = useRef<{ active: boolean; x: number; y: number; sl: number; st: number }>({
    active: false,
    x: 0,
    y: 0,
    sl: 0,
    st: 0,
  })

  useEffect(() => {
    if (!stageRef.current || !chart) return
    const id = `mermaid-fs-${crypto.randomUUID()}`
    mermaid
      .render(id, chart.trim())
      .then(({ svg }) => {
        if (stageRef.current) {
          stageRef.current.innerHTML = svg
          unlockSvgSize(stageRef.current)
        }
      })
      .catch(() => {})
  }, [chart])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, z + 0.2))
      if (e.key === '-') setZoom((z) => Math.max(0.25, z - 0.2))
      if (e.key === '0') setZoom(1)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const onMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return
    dragState.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      sl: scrollRef.current.scrollLeft,
      st: scrollRef.current.scrollTop,
    }
    scrollRef.current.style.cursor = 'grabbing'
  }

  const onMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragState.current.active || !scrollRef.current) return
    scrollRef.current.scrollLeft = dragState.current.sl - (e.clientX - dragState.current.x)
    scrollRef.current.scrollTop = dragState.current.st - (e.clientY - dragState.current.y)
  }

  const stopDrag = () => {
    dragState.current.active = false
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab'
  }

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    setZoom((z) => Math.max(0.25, Math.min(4, z + (e.deltaY < 0 ? 0.15 : -0.15))))
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#EFE8D6]/95 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 bg-[#18181B] text-[#EFE8D6] border-b border-[#3A3935]">
        <span className="font-semibold text-sm smallcaps text-[#C9AE74]">Diagrama ampliado</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.2))}
            className="w-9 h-9 bg-transparent border border-[#C9AE74]/40 hover:border-[#C9AE74] rounded font-bold text-lg text-[#C9AE74]"
            title="Alejar (-)"
          >
            -
          </button>
          <span className="text-sm font-mono w-16 text-center text-[#EFE8D6]">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, z + 0.2))}
            className="w-9 h-9 bg-transparent border border-[#C9AE74]/40 hover:border-[#C9AE74] rounded font-bold text-lg text-[#C9AE74]"
            title="Acercar (+)"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-3 h-9 bg-transparent border border-[#C9AE74]/40 hover:border-[#C9AE74] rounded text-xs font-semibold text-[#C9AE74]"
            title="Tamano real (0)"
          >
            100%
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 px-4 h-9 bg-[#B0584C] hover:bg-[#9a4d42] rounded text-sm font-semibold text-[#EFE8D6]"
            title="Cerrar (Esc)"
          >
            Cerrar
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onWheel={onWheel}
        className="flex-1 overflow-auto bg-[#F4EEDA] select-none"
        style={{ cursor: 'grab' }}
      >
        <div
          ref={stageRef}
          className="p-12 inline-block"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        />
      </div>
      <div className="px-6 py-2 bg-[#18181B] text-[#C9AE74] text-xs text-center border-t border-[#3A3935]">
        Arrastra para mover. Ctrl + rueda para zoom. Esc para cerrar.
      </div>
    </div>
  )
}

const Mermaid = ({ chart, dense = false }: { chart: string; dense?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [renderTick, setRenderTick] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [view, setView] = useState<'visual' | 'pasos'>('visual')

  useEffect(() => {
    if (view !== 'visual') return
    if (!ref.current || !chart) return
    setRenderError(null)
    const id = `mermaid-${crypto.randomUUID()}`
    mermaid
      .render(id, chart.trim())
      .then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg
          unlockSvgSize(ref.current)
        }
      })
      .catch((err) => {
        console.error('Mermaid render error:', err)
        setRenderError(err?.message?.split('\n')[0] || 'Sintaxis inválida')
      })
  }, [chart, renderTick, view])

  const viewToggle = (
    <div className="inline-flex bg-[#F4EEDA] border border-[#D9CFB8] p-1 rounded">
      <button
        type="button"
        onClick={() => setView('visual')}
        className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
          view === 'visual' ? 'bg-[#FAF5E5] text-[#18181B]' : 'text-[#8B8275] hover:text-[#3A3935]'
        }`}
      >
        Visual
      </button>
      <button
        type="button"
        onClick={() => setView('pasos')}
        className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
          view === 'pasos' ? 'bg-[#FAF5E5] text-[#18181B]' : 'text-[#8B8275] hover:text-[#3A3935]'
        }`}
      >
        Paso a paso
      </button>
    </div>
  )

  if (!chart) {
    return (
      <div className="p-4 bg-[#F4EEDA] border border-[#D9CFB8] rounded-md text-sm text-[#6B6357] italic">
        No se generó diagrama para este nivel.
      </div>
    )
  }

  if (view === 'pasos') {
    return (
      <div className={`${dense ? 'my-0' : 'my-2'} bg-[#F4EEDA] rounded-md border border-[#D9CFB8] p-6`}>
        <div className="flex items-center justify-end mb-4">{viewToggle}</div>
        <StepByStepDiagram chart={chart} />
      </div>
    )
  }

  if (renderError) {
    return (
      <div className="p-5 bg-[#F4EFE0] border border-[#D9CFB8] rounded-md">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="text-sm font-semibold text-[#5E3A3A]">Error de sintaxis en el diagrama</div>
            <p className="text-xs text-[#6B6357] mt-1">
              Aun así puedes leerlo con la vista paso a paso.
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            {viewToggle}
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-xs font-semibold text-[#5E3A3A] hover:text-[#18181B] underline"
            >
              {showRaw ? 'Ocultar' : 'Ver código'}
            </button>
            <button
              type="button"
              onClick={() => setRenderTick((t) => t + 1)}
              className="text-xs font-semibold text-[#5E3A3A] hover:text-[#18181B] underline"
            >
              Reintentar
            </button>
          </div>
        </div>
        <p className="text-xs text-[#6B6357] mb-2">{renderError}</p>
        <StepByStepDiagram chart={chart} />
        {showRaw && (
          <pre className="text-[11px] whitespace-pre-wrap font-mono text-[#3A3935] bg-[#FAF5E5] p-3 rounded border border-[#D9CFB8] overflow-x-auto">
            {chart}
          </pre>
        )}
      </div>
    )
  }

  return (
    <>
      <div
        className={`
          relative overflow-hidden bg-[#F4EEDA] rounded-md border border-[#D9CFB8]
          ${dense ? 'my-0 min-h-[360px]' : 'my-2 min-h-[560px]'}
        `}
      >
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 flex-wrap justify-end">
          {viewToggle}
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="px-3 py-1.5 bg-[#18181B] hover:bg-[#3A3935] text-[#C9AE74] text-xs font-semibold rounded flex items-center gap-1.5"
            title="Ver en pantalla completa"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
            Ampliar
          </button>
        </div>
        <div
          ref={ref}
          className={`
            flex justify-start overflow-auto bg-[#F4EEDA]
            [&_svg]:max-w-none [&_svg]:h-auto
            ${dense ? 'p-4 pt-16 min-h-[360px]' : 'p-8 pt-20 min-h-[560px]'}
          `}
        />
      </div>
      {fullscreen && <MermaidFullscreen chart={chart} onClose={() => setFullscreen(false)} />}
    </>
  )
}

const MAX_FILES_FOR_OVERVIEW = 500
const MAX_FILES_IN_TREE = 1000
const MAX_GEMINI_AUTO_RETRIES = 2
const DEFAULT_GEMINI_RETRY_MS = 6_000
const MAX_GEMINI_RETRY_MS = 45_000

type ApiErrorPayload = {
  error?: string
  retryable?: boolean
  retryAfterMs?: number
}

type RetryableRequestError = Error & {
  retryable?: boolean
  retryAfterMs?: number
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))

const apiErrorFromPayload = (payload: ApiErrorPayload, fallback: string): RetryableRequestError => {
  const err = new Error(payload.error || fallback) as RetryableRequestError
  err.retryable = payload.retryable
  err.retryAfterMs = payload.retryAfterMs
  return err
}

const shouldAutoRetryGemini = (err: unknown): err is RetryableRequestError => {
  if (!(err instanceof Error)) return false
  const maybeRetryable = err as RetryableRequestError
  if (maybeRetryable.retryable === true) return true
  return /Gemini|limitando peticiones|sobrecargado|429|503|cuota/i.test(err.message)
}

const retryDelayFor = (err: RetryableRequestError, attempt: number): number => {
  const fallback = DEFAULT_GEMINI_RETRY_MS * (attempt + 1)
  return Math.min(err.retryAfterMs ?? fallback, MAX_GEMINI_RETRY_MS)
}

const isReadableProjectFile = (file: ProjectFile): boolean => {
  return file.content.length > 5 && !file.content.startsWith('[')
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
  alta: 'bg-[#F4EFE0] text-[#A88B4C] ring-[#D9CFB8]',
  media: 'bg-[#F4EEDA] text-[#6B6357] ring-[#E5DDC9]',
  baja: 'bg-transparent text-[#8B8275] ring-[#E5DDC9]',
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
    <div className="gallery-card row-hover rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onExpand}
        className="w-full text-left px-7 py-5 flex items-start justify-between gap-4 group cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`text-[10px] smallcaps font-semibold px-2 py-0.5 rounded ring-1 ${importanciaStyles[archivo.importancia]}`}
            >
              {archivo.importancia}
            </span>
            <code className="text-xs font-mono text-[#8B8275] truncate">{archivo.ruta}</code>
          </div>
          <p className="text-base serif text-[#18181B] leading-snug">{archivo.rol}</p>
        </div>
        <div className="text-[#A88B4C]/40 group-hover:text-[#A88B4C] transition-colors mt-1">
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
        <div className="border-t border-[#E5DDC9] px-7 py-7 bg-[#F4EEDA]/60">
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
        <div className="flex items-center gap-3 text-[#6B6357] text-sm">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-[#A88B4C] rounded-full animate-bounce" />
          </div>
          Generando mapa de este archivo…
        </div>
      )}

      {error && (
        <div className="text-[#B0584C] text-sm bg-[#F3DAD3]/40 border border-[#B0584C]/30 rounded p-3">
          {error}
        </div>
      )}

      {fileMap && (
        <>
          <div>
            <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-1">
              Explicación con ejemplo
            </div>
            <p className="text-lg text-[#18181B] leading-relaxed">{fileMap.explicacion}</p>
            <p className="text-sm text-[#6B6357] leading-relaxed mt-3">
              Lee el diagrama de arriba hacia abajo: cada flecha representa una llamada o paso real
              dentro del archivo, y las notas marcan momentos importantes del flujo.
            </p>
          </div>

          {fileMap.estructura && (
            <div>
              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-1">
                Estructura usada
              </div>
              <p className="text-sm text-[#3A3935] font-mono bg-[#F4EEDA] inline-block px-3 py-1.5 rounded border border-[#D9CFB8]">
                {fileMap.estructura}
              </p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-3">
                Cómo funciona, paso a paso
              </div>
              {fileMap.flujo_ejecucion && fileMap.flujo_ejecucion.length > 0 ? (
                <ol className="space-y-2 border-l-2 border-[#D9CFB8] pl-5">
                  {fileMap.flujo_ejecucion.map((paso, i) => (
                    <li key={i} className="relative text-[#3A3935] text-sm leading-relaxed">
                      <span className="absolute -left-[1.65rem] top-0.5 w-5 h-5 rounded-full bg-[#F4EEDA] border border-[#D9CFB8] text-[#5E3A3A] text-[10px] font-semibold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span>{paso.replace(/^\d+\.\s*/, '')}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-[#8B8275] italic">Sin pasos numerados.</p>
              )}
            </div>
            <div>
              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-3">
                Diagrama de secuencia
              </div>
              <p className="text-xs text-[#6B6357] leading-relaxed mb-3 max-w-3xl">
                Este mapa muestra el orden de ejecución dentro del archivo seleccionado: quién llama a quién,
                en qué momento ocurre y qué piezas externas participan.
              </p>
              <Mermaid chart={fileMap.diagrama_mermaid} />
            </div>
          </div>

          {fileMap.funciones_definidas && fileMap.funciones_definidas.length > 0 && (
            <div>
              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-2">
                Funciones que define este archivo
              </div>
              <div className="overflow-x-auto rounded-md border border-[#D9CFB8]">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-[#F4EEDA] text-[#6B6357] text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left font-bold px-4 py-2">Nombre real</th>
                      <th className="text-left font-bold px-4 py-2">Qué hace y cuándo</th>
                      <th className="text-left font-bold px-4 py-2">Llama a</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DDC9] bg-[#FAF5E5]">
                    {fileMap.funciones_definidas.map((fn) => (
                      <tr key={fn.real}>
                        <td className="px-4 py-2 font-mono text-[#5E3A3A] align-top whitespace-nowrap">{fn.real}</td>
                        <td className="px-4 py-2 text-[#3A3935] align-top">{fn.humana}</td>
                        <td className="px-4 py-2 align-top">
                          {fn.llama_a.length === 0 ? (
                            <span className="text-[#8B8275]">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {fn.llama_a.map((c) => (
                                <code
                                  key={c}
                                  className="text-xs bg-[#F4EEDA] text-[#6B6357] px-1.5 py-0.5 rounded border border-[#E5DDC9]"
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
              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-2">
                Funciones que usa de fuera
              </div>
              <div className="overflow-x-auto rounded-md border border-[#D9CFB8]">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-[#F4EEDA] text-[#6B6357] text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left font-bold px-4 py-2">Función</th>
                      <th className="text-left font-bold px-4 py-2">De dónde</th>
                      <th className="text-left font-bold px-4 py-2">Cómo se usa aquí</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DDC9] bg-[#FAF5E5]">
                    {fileMap.funciones_usadas.map((fn, i) => (
                      <tr key={`${fn.nombre}-${i}`}>
                        <td className="px-4 py-2 font-mono text-[#5E3A3A] align-top whitespace-nowrap">{fn.nombre}</td>
                        <td className="px-4 py-2 text-[#6B6357] align-top text-xs">{fn.donde}</td>
                        <td className="px-4 py-2 text-[#3A3935] align-top">{fn.como}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {fileMap.puntos_clave.length > 0 && (
            <div>
              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-2">
                Puntos clave
              </div>
              <ul className="space-y-1.5">
                {fileMap.puntos_clave.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-[#3A3935] text-sm">
                    <span className="text-[#A88B4C] mt-1">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fileMap.resumen_archivo && (
            <div className="bg-[#F4EFE0] border border-[#D9CFB8] rounded-md p-4">
              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-1">
                En resumen
              </div>
              <p className="text-[#18181B] text-sm font-medium">{fileMap.resumen_archivo}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const MAX_DIAGRAM_BYTES = 8 * 1024 * 1024

const LANG_TO_FILENAME: Record<TargetLanguage, string> = {
  python: 'generado.py',
  javascript: 'generado.js',
  typescript: 'generado.ts',
  pseudocodigo: 'generado.txt',
  go: 'generado.go',
  java: 'Generado.java',
  csharp: 'Generado.cs',
  cpp: 'generado.cpp',
}

function readImageAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Formato de imagen inesperado'))
        return
      }
      const commaIdx = result.indexOf(',')
      resolve({
        base64: commaIdx >= 0 ? result.slice(commaIdx + 1) : result,
        mimeType: file.type || 'image/jpeg',
      })
    }
    reader.readAsDataURL(file)
  })
}

function GeneratedCodeMap({
  fileMap,
  loading,
  error,
  onRetry,
}: {
  fileMap: FileMap | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const fallbackSteps = fileMap?.funciones_definidas.map((fn) => `${fn.real}: ${fn.humana}`) ?? []
  const steps = fileMap?.flujo_ejecucion?.length ? fileMap.flujo_ejecucion : fallbackSteps

  return (
    <section className="gallery-card rounded-md overflow-hidden">
      <div className="bg-[#18181B] px-6 py-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[#C9AE74] font-mono text-xs smallcaps font-semibold">
            Mapa del código
          </div>
          {fileMap?.estructura && (
            <p className="text-[#EFE8D6] text-sm mt-2 max-w-4xl">{fileMap.estructura}</p>
          )}
        </div>
        {loading && (
          <div className="flex gap-1.5">
            <span className="w-2 h-2 bg-[#C9AE74] rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-[#C9AE74] rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-[#C9AE74] rounded-full animate-bounce" />
          </div>
        )}
      </div>

      <div className="p-6 lg:p-8 space-y-7">
        {loading && !fileMap && (
          <p className="text-[#6B6357] text-sm">Generando mapa del código…</p>
        )}

        {error && (
          <div className="bg-[#F3DAD3]/40 border border-[#B0584C]/30 rounded p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[#B0584C] text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 bg-[#B0584C] text-[#EFE8D6] text-xs font-semibold rounded hover:bg-[#9a4d42]"
            >
              Reintentar
            </button>
          </div>
        )}

        {fileMap && (
          <>
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-2">
                    Qué hace
                  </div>
                  <p className="text-[#18181B] leading-relaxed">{fileMap.explicacion}</p>
                </div>
                {fileMap.resumen_archivo && (
                  <div className="bg-[#F4EFE0] border border-[#D9CFB8] rounded-md p-4">
                    <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-1">
                      Resumen
                    </div>
                    <p className="text-[#18181B] text-sm font-medium">{fileMap.resumen_archivo}</p>
                  </div>
                )}
              </div>

              <div className="bg-[#F4EEDA] border border-[#D9CFB8] rounded-md p-5">
                <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-4">
                  Flujo visual
                </div>
                <StepByStepDiagram chart={fileMap.diagrama_mermaid} />
              </div>
            </div>

            {steps.length > 0 && (
              <div>
                <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-4">
                  Ejecución paso a paso
                </div>
                <ol className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {steps.map((step, i) => (
                    <li key={`${step}-${i}`} className="bg-[#FAF5E5] border border-[#D9CFB8] rounded-md p-4">
                      <div className="w-8 h-8 rounded-full bg-[#F4EEDA] border border-[#D9CFB8] text-[#5E3A3A] font-semibold text-sm flex items-center justify-center mb-3">
                        {i + 1}
                      </div>
                      <p className="text-sm text-[#3A3935] leading-relaxed">{step.replace(/^\d+\.\s*/, '')}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {fileMap.funciones_definidas.length > 0 && (
              <div>
                <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-4">
                  Funciones principales
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {fileMap.funciones_definidas.map((fn) => (
                    <div key={fn.real} className="bg-[#F4EEDA] border border-[#D9CFB8] rounded-md p-4">
                      <code className="text-sm font-bold text-[#5E3A3A] break-words">{fn.real}</code>
                      <p className="text-sm text-[#3A3935] leading-relaxed mt-2">{fn.humana}</p>
                      {fn.llama_a.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {fn.llama_a.map((call) => (
                            <code key={call} className="text-[11px] bg-[#FAF5E5] border border-[#E5DDC9] text-[#6B6357] px-2 py-1 rounded">
                              {call}
                            </code>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function DiagramToCodePanel() {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [language, setLanguage] = useState<TargetLanguage>('python')
  const [result, setResult] = useState<DiagramToCode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [codeMap, setCodeMap] = useState<FileMap | null>(null)
  const [codeMapLoading, setCodeMapLoading] = useState(false)
  const [codeMapError, setCodeMapError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const handleFileChange = useCallback((file: File | null) => {
    setError(null)
    setResult(null)
    setCodeMap(null)
    setCodeMapError(null)
    setCopied(false)

    if (!file) {
      setImageFile(null)
      setImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG o WebP.')
      return
    }
    if (file.size > MAX_DIAGRAM_BYTES) {
      setError('La imagen pesa más de 8 MB. Reduce la calidad o recórtala.')
      return
    }

    const url = URL.createObjectURL(file)
    setImageFile(file)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
  }, [])

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setCameraReady(false)
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Tu navegador no soporta cámara web. Usa Chrome, Edge o Firefox actualizados.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
    } catch (err: unknown) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Permiso de cámara denegado. Habilítalo en tu navegador y vuelve a intentar.')
          return
        }
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No se detectó ninguna cámara conectada.')
          return
        }
      }
      setError(errorMessage(err, 'No se pudo abrir la cámara.'))
    }
  }, [])

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return

    const video = videoRef.current
    video.srcObject = streamRef.current
    const onReady = () => setCameraReady(true)
    video.addEventListener('loadedmetadata', onReady)
    video.play().catch(() => {
      setError('No se pudo iniciar la vista previa de la cámara.')
    })

    return () => video.removeEventListener('loadedmetadata', onReady)
  }, [cameraActive])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video || !cameraReady) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('No se pudo procesar la imagen de la cámara.')
      return
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('No se pudo generar la foto.')
          return
        }
        const file = new File([blob], `camara-${Date.now()}.jpg`, { type: 'image/jpeg' })
        handleFileChange(file)
        stopCamera()
      },
      'image/jpeg',
      0.92,
    )
  }, [cameraReady, handleFileChange, stopCamera])

  const fetchCodeMap = useCallback(async (code: string, lang: TargetLanguage, interpretation: string) => {
    if (!code.trim()) return
    setCodeMapLoading(true)
    setCodeMapError(null)
    setCodeMap(null)
    try {
      const response = await fetch('/api/file-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: LANG_TO_FILENAME[lang],
          content: code,
          projectContext: `Código generado a partir de un diagrama de flujo. Lectura del diagrama: ${interpretation}`,
        }),
      })
      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as ApiErrorPayload
        throw apiErrorFromPayload(errData, 'Error generando el mapa del código')
      }
      const data = (await response.json()) as FileMap
      setCodeMap(data)
    } catch (err: unknown) {
      setCodeMapError(errorMessage(err, 'Error inesperado generando mapa del código'))
    } finally {
      setCodeMapLoading(false)
    }
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!imageFile) return
    setLoading(true)
    setError(null)
    setResult(null)
    setCodeMap(null)
    setCodeMapError(null)
    setCopied(false)
    try {
      const { base64, mimeType } = await readImageAsBase64(imageFile)
      const response = await fetch('/api/diagram-to-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          lenguajeObjetivo: language,
        }),
      })
      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as ApiErrorPayload
        throw apiErrorFromPayload(errData, 'Error analizando el diagrama')
      }
      const data = (await response.json()) as DiagramToCode
      setResult(data)
      if (data.codigo?.trim()) void fetchCodeMap(data.codigo, language, data.interpretacion)
    } catch (err: unknown) {
      setError(errorMessage(err, 'Error inesperado analizando el diagrama'))
    } finally {
      setLoading(false)
    }
  }, [fetchCodeMap, imageFile, language])

  const handleCopy = useCallback(async () => {
    if (!result?.codigo) return
    try {
      await navigator.clipboard.writeText(result.codigo)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar al portapapeles')
    }
  }, [result])

  const handleClear = useCallback(() => {
    stopCamera()
    handleFileChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [handleFileChange, stopCamera])

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div className="space-y-5">
        {cameraActive ? (
          <div className="space-y-3">
            <div className="relative bg-[#18181B] rounded-md overflow-hidden border border-[#D9CFB8]">
              <video ref={videoRef} playsInline muted className="w-full max-h-[480px] object-contain bg-[#18181B]" />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-[#EFE8D6] text-sm">
                  Encendiendo cámara…
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady}
                className="flex-1 px-6 py-3 bg-[#18181B] hover:bg-[#3A3935] disabled:bg-[#D9CFB8] disabled:cursor-not-allowed text-[#EFE8D6] text-sm font-semibold rounded transition-colors"
              >
                Tomar foto
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-6 py-3 bg-[#F4EEDA] hover:bg-[#F4EFE0] border border-[#D9CFB8] text-[#3A3935] text-sm font-semibold rounded transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Vista previa del diagrama"
              className="w-full max-h-80 object-contain rounded-md border border-[#D9CFB8] bg-[#F4EEDA]"
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-3 right-3 px-3 py-1.5 bg-[#18181B] hover:bg-[#3A3935] text-[#EFE8D6] text-xs font-semibold rounded"
            >
              Quitar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label
              htmlFor="diagram-upload"
              className="block border border-dashed border-[#D9CFB8] hover:border-[#A88B4C] rounded-md p-8 text-center cursor-pointer transition-colors bg-[#FAF5E5]"
            >
              <input
                id="diagram-upload"
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <div className="space-y-3">
                <div className="w-14 h-14 bg-[#FAF5E5] border border-[#A88B4C]/40 text-[#A88B4C] rounded-full flex items-center justify-center mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h4l2-3h6l2 3h4v13H3V7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="serif text-xl text-[#18181B]">Subir archivo de imagen</p>
                <p className="text-[#6B6357] text-sm">JPG, PNG o WebP · máximo 8 MB</p>
              </div>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#D9CFB8]" />
              <span className="text-xs text-[#8B8275] smallcaps font-semibold">o</span>
              <div className="flex-1 h-px bg-[#D9CFB8]" />
            </div>
            <button
              type="button"
              onClick={startCamera}
              className="w-full px-6 py-4 bg-[#FAF5E5] border border-[#D9CFB8] hover:border-[#A88B4C] hover:bg-[#F4EFE0] text-[#18181B] text-base font-semibold rounded transition-colors flex items-center justify-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h4l2-3h6l2 3h4v13H3V7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Usar webcam
            </button>
          </div>
        )}

        <div>
          <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-3">
            Lenguaje destino
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TARGET_LANGUAGE_LABELS) as TargetLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-4 py-2 rounded text-sm font-semibold transition-colors border ${
                  language === lang
                    ? 'bg-[#18181B] text-[#C9AE74] border-[#18181B]'
                    : 'bg-[#F4EEDA] text-[#6B6357] border-[#D9CFB8] hover:border-[#A88B4C] hover:text-[#18181B]'
                }`}
              >
                {TARGET_LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!imageFile || loading}
          className="w-full px-6 py-4 bg-[#18181B] hover:bg-[#3A3935] disabled:bg-[#D9CFB8] disabled:cursor-not-allowed text-[#EFE8D6] text-base font-semibold rounded transition-colors"
        >
          {loading ? 'Analizando diagrama…' : 'Generar código'}
        </button>

          {error && (
            <div className="bg-[#F3DAD3]/40 border border-[#B0584C]/30 text-[#B0584C] rounded p-4 text-sm font-medium">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-5 min-w-0">
          {loading && (
            <div className="gallery-card rounded-md p-8 flex items-center gap-4">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-[#A88B4C] rounded-full animate-bounce" />
              </div>
              <p className="text-[#3A3935] font-medium">Gemini está leyendo el diagrama…</p>
            </div>
          )}
        </div>
      </div>

      {result && (
        <section className="gallery-card rounded-md p-6 lg:p-8 border-l-2 border-l-[#A88B4C]">
          <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-2">
            Interpretación
          </div>
          <p className="serif text-xl text-[#18181B] leading-relaxed whitespace-pre-line">{result.interpretacion}</p>

          {(result.supuestos.length > 0 || result.advertencias.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4 mt-6">
              {result.supuestos.length > 0 && (
                <div className="bg-[#F4EEDA] border border-[#D9CFB8] rounded-md p-4">
                  <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-2">
                    Supuestos
                  </div>
                  <ul className="space-y-1.5 text-sm text-[#3A3935]">
                    {result.supuestos.map((item, i) => (
                      <li key={i}>- {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.advertencias.length > 0 && (
                <div className="bg-[#F4EEDA] border border-[#D9CFB8] rounded-md p-4">
                  <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-2">
                    Advertencias
                  </div>
                  <ul className="space-y-1.5 text-sm text-[#3A3935]">
                    {result.advertencias.map((item, i) => (
                      <li key={i}>- {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {(codeMapLoading || codeMap || codeMapError) && (
        <GeneratedCodeMap
          fileMap={codeMap}
          loading={codeMapLoading}
          error={codeMapError}
          onRetry={() => result && fetchCodeMap(result.codigo, language, result.interpretacion)}
        />
      )}

      {result && (
        <section className="rounded-md overflow-hidden border border-[#3A3935] bg-[#18181B] shadow-[0_12px_32px_-16px_rgba(24,24,27,0.3)]">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[#3A3935] gap-3">
            <span className="text-[#C9AE74] font-mono text-xs smallcaps font-semibold">
              Código comentado · {result.lenguaje_detectado}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-1.5 bg-transparent border border-[#C9AE74]/40 hover:border-[#C9AE74] hover:bg-[#C9AE74]/10 text-[#C9AE74] text-[10px] smallcaps font-semibold rounded transition-colors"
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <pre className="p-5 lg:p-6 text-sm font-mono text-[#EFE8D6] overflow-x-auto whitespace-pre">
            {result.codigo || '// Sin código generado'}
          </pre>
        </section>
      )}
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('mapa')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [streamingText, setStreamingText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState<number>(0)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [overviewFiles, setOverviewFiles] = useState<ProjectFile[]>([])
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
      for (let attempt = 0; attempt <= MAX_GEMINI_AUTO_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            setStreamingText(`Reintentando con Gemini (${attempt + 1}/${MAX_GEMINI_AUTO_RETRIES + 1})...`)
          }

          const response = await fetch('/api/overview-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: collected }),
          })

          if (!response.ok || !response.body) {
            const errData = (await response.json().catch(() => ({}))) as ApiErrorPayload
            throw apiErrorFromPayload(errData, 'Error generando el mapa general')
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let finalOverview: Overview | null = null
          let streamErr: ApiErrorPayload | null = null

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
                  streamErr = payload as ApiErrorPayload
                }
              } catch {
                /* ignore malformed event */
              }
            }
          }

          if (streamErr) throw apiErrorFromPayload(streamErr, 'Error desconocido')
          if (!finalOverview) throw new Error('El mapa general nunca se completó.')
          setOverview(finalOverview)
          setStreamingText('')
          return
        } catch (err: unknown) {
          if (!shouldAutoRetryGemini(err) || attempt === MAX_GEMINI_AUTO_RETRIES) throw err

          const delayMs = retryDelayFor(err, attempt)
          const seconds = Math.max(1, Math.ceil(delayMs / 1000))
          setStreamingText(
            `Gemini respondió con un límite temporal. Reintento ${attempt + 1} de ${MAX_GEMINI_AUTO_RETRIES} en ${seconds}s...`,
          )
          await sleep(delayMs)
        }
      }
    } catch (err: unknown) {
      setError(errorMessage(err, 'Error inesperado en VibeMap'))
    } finally {
      setLoading(false)
    }
  }, [])

  const startProcessing = useCallback(async (collected: ProjectFile[]) => {
    setLoading(true)
    setError(null)
    setUploadNotice(null)
    setOverview(null)
    setStreamingText('')
    setTreeSelectedPath(null)
    setTreeSearch('')
    setTreeExpandedFolders(new Set())

    const filtered = collected.filter((f) => !isIgnoredPath(f.path))
    const readable = filtered.filter(isReadableProjectFile)
    const overviewReady = readable.slice(0, MAX_FILES_FOR_OVERVIEW)
    const unreadableCount = filtered.length - readable.length
    const limitCount = Math.max(readable.length - overviewReady.length, 0)
    const treeLimitCount = Math.max(filtered.length - MAX_FILES_IN_TREE, 0)
    const visibleFiles = filtered.slice(0, MAX_FILES_IN_TREE)

    if (overviewReady.length === 0) {
      setError('No se encontraron archivos procesables. Asegúrate de subir una carpeta con código.')
      setLoading(false)
      setFileCount(0)
      setFiles([])
      setOverviewFiles([])
      return
    }

    const omissions: string[] = []
    if (unreadableCount > 0) omissions.push(`${unreadableCount} binarios, vacíos, muy grandes o ilegibles`)
    if (limitCount > 0) omissions.push(`${limitCount} extras por límite de análisis`)
    if (treeLimitCount > 0) omissions.push(`${treeLimitCount} extras ocultos del explorador para mantenerlo rápido`)
    if (omissions.length > 0) {
      setUploadNotice(`Se analizarán ${overviewReady.length} archivos. Omití ${omissions.join('; ')}.`)
    }

    setFileCount(overviewReady.length)
    setFiles(visibleFiles)
    setOverviewFiles(overviewReady)
    await runOverview(overviewReady)
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
    if (overviewFiles.length > 0) runOverview(overviewFiles)
  }, [overviewFiles, runOverview])

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
    <div className="max-w-5xl mx-auto px-6 py-20 font-sans antialiased text-[#18181B]">
      <div className="corner-ornament corner-tl" aria-hidden="true"><span className="dot" /></div>
      <div className="corner-ornament corner-tr" aria-hidden="true"><span className="dot" /></div>
      <div className="corner-ornament corner-bl" aria-hidden="true"><span className="dot" /></div>
      <div className="corner-ornament corner-br" aria-hidden="true"><span className="dot" /></div>
      <div className="side-ornament" aria-hidden="true">
        <span className="mark-square" />
        <span className="mark-line" />
        <span className="mark-text">Vibe · Map</span>
        <span className="mark-line" />
        <span className="mark-dot" />
      </div>

      <header className="text-center mb-20">
        <div className="text-[10px] smallcaps text-[#A88B4C] mb-6 font-semibold">
          Hackathon Edition v2.0
        </div>
        <h1 className="serif text-7xl md:text-8xl font-medium tracking-tight mb-6 text-[#18181B] leading-none">
          Vibe<span className="text-[#5E3A3A]">M</span>ap
        </h1>
        <div className="flex items-center justify-center gap-3 mb-8" aria-hidden="true">
          <span className="h-px w-10 bg-[#18181B]" />
          <span className="text-[#A88B4C] text-base">◆</span>
          <span className="h-px w-10 bg-[#18181B]" />
        </div>
        <p className="serif italic text-xl md:text-2xl text-[#3A3935] max-w-2xl mx-auto leading-relaxed">
          ¿Codex o Claude te generó código y no entiendes qué hace?
        </p>
        <p className="text-base text-[#6B6357] max-w-xl mx-auto mt-3 leading-relaxed">
          Súbelo y te lo explico como mapa mental, en palabras simples.
        </p>
      </header>

      <nav className="flex justify-center mb-16" aria-label="Vistas de VibeMap">
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
      </nav>

      {activeTab === 'mapa' ? (
      <main className="space-y-12">
        <section
          {...getRootProps()}
          className={`
            gallery-card relative group border border-dashed rounded-md p-20 text-center transition-all duration-300
            ${
              isDragActive
                ? 'border-[#A88B4C] bg-[#F4EFE0]'
                : 'border-[#D9CFB8] hover:border-[#A88B4C] hover:bg-[#FAF5E5]'
            }
          `}
        >
          <div className="space-y-6">
            <div className="w-20 h-20 bg-[#FAF5E5] border border-[#A88B4C]/40 text-[#A88B4C] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:border-[#A88B4C] transition-all duration-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-9 w-9"
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
            <div className="space-y-3">
              <p className="serif text-3xl text-[#18181B] tracking-tight">
                {isDragActive ? 'Suéltala aquí' : 'Arrastra tu archivo o carpeta de proyecto'}
              </p>
              <p className="text-[#6B6357] text-sm leading-relaxed max-w-md mx-auto">
                Acepta cualquier tipo de archivo (incluyendo .env, .gitignore, Dockerfile, README, etc.)
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <label
                onClick={(e) => e.stopPropagation()}
                className="relative inline-flex items-center gap-2 px-7 py-3.5 bg-[#18181B] text-[#EFE8D6] rounded font-semibold text-sm hover:bg-[#3A3935] transition-colors cursor-pointer overflow-hidden"
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
                <svg className="w-4 h-4 text-[#C9AE74]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 3h7l5 5v13H7V3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 3v5h5" />
                </svg>
                <span>Elegir archivo</span>
              </label>
            </div>

            <p className="text-[11px] text-[#8B8275] pt-2">
              Se ignoran automáticamente <code className="bg-[#F4EEDA] border border-[#E5DDC9] px-1 rounded">node_modules</code>,{' '}
              <code className="bg-[#F4EEDA] border border-[#E5DDC9] px-1 rounded">.git/</code>,{' '}
              <code className="bg-[#F4EEDA] border border-[#E5DDC9] px-1 rounded">dist/</code>,{' '}
              <code className="bg-[#F4EEDA] border border-[#E5DDC9] px-1 rounded">build/</code> y similares.
            </p>
          </div>

        </section>

        {loading && (
          <div className="gallery-card rounded-md p-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex space-x-2">
                <div className="w-2.5 h-2.5 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2.5 h-2.5 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2.5 h-2.5 bg-[#A88B4C] rounded-full animate-bounce"></div>
              </div>
              <div>
                <p className="serif text-xl text-[#18181B]">
                  Componiendo el mapa de {fileCount} archivos…
                </p>
                <p className="text-[#6B6357] text-sm italic serif">Gemini está armando el mapa general.</p>
              </div>
            </div>
            {streamingText && (
              <pre className="text-xs font-mono text-[#6B6357] bg-[#F4EEDA] p-4 rounded overflow-hidden max-h-40 whitespace-pre-wrap border border-[#D9CFB8]">
                {streamingText.slice(-1200)}
              </pre>
            )}
          </div>
        )}

        {error && (
          <div className="bg-[#F3DAD3]/40 border border-[#B0584C]/30 p-8 rounded-md flex items-center justify-between gap-5">
            <div className="flex items-center gap-5">
              <div className="bg-[#B0584C]/15 border border-[#B0584C]/30 text-[#B0584C] p-3 rounded shrink-0">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="serif text-xl text-[#B0584C]">Algo falló</p>
                <p className="text-[#B0584C]/80 text-sm">{error}</p>
              </div>
            </div>
            {files.length > 0 && (
              <button
                type="button"
                onClick={handleRetry}
                className="shrink-0 px-5 py-2.5 bg-[#B0584C] hover:bg-[#9a4d42] text-[#EFE8D6] text-[10px] smallcaps font-semibold rounded transition-colors"
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        {uploadNotice && (
          <div className="bg-[#F4EFE0] border border-[#D9CFB8] text-[#5E3A3A] rounded px-5 py-4 text-sm font-medium">
            {uploadNotice}
          </div>
        )}

        {overview && (
          <>
            {tree.length > 0 && (
              <section className="space-y-8">
                <aside className="gallery-card rounded-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="serif text-2xl tracking-tight text-[#18181B]">Explorador</h2>
                    <span className="text-[10px] smallcaps font-semibold text-[#8B8275]">
                      {totalFilesInTree} archivos
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTreeSelectedPath(null)}
                    className={`w-full text-left rounded border px-4 py-3 mb-4 transition-colors ${
                      treeSelectedPath === null
                        ? 'border-[#A88B4C] bg-[#F4EFE0] text-[#18181B]'
                        : 'border-[#D9CFB8] bg-[#F4EEDA]/70 text-[#3A3935] hover:border-[#A88B4C]'
                    }`}
                  >
                    <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-1">
                      Vista principal
                    </div>
                    <div className="font-semibold">Mapa general del proyecto</div>
                    <div className="text-xs text-[#6B6357] mt-1">Arquitectura, flujo completo y conexiones.</div>
                  </button>
                  <input
                    type="search"
                    value={treeSearch}
                    onChange={(e) => setTreeSearch(e.target.value)}
                    placeholder="Buscar archivo o carpeta…"
                    className="w-full text-sm px-3 py-2 mb-3 bg-[#F4EEDA] border border-[#D9CFB8] rounded focus:outline-none focus:ring-2 focus:ring-[#C9AE74]/30 focus:border-[#A88B4C]"
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
                  <p className="text-[11px] text-[#8B8275] mt-4 leading-relaxed">
                    Selecciona un archivo para cambiar el visor al diagrama específico. Los grises son binarios o vacíos.
                  </p>
                </aside>

                <section id="diagram-workspace" className="gallery-card min-w-0 rounded-md overflow-hidden">
                  {!treeSelectedPath ? (
                    <>
                      <div className="bg-[#18181B] px-10 py-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#3A3935]">
                        <div>
                          <div className="text-[#C9AE74] font-mono text-[10px] smallcaps font-semibold mb-2">
                            — Sala I · Mapa General —
                          </div>
                          <h2 className="serif text-2xl text-[#EFE8D6] tracking-tight">Cómo se conecta todo</h2>
                        </div>
                        <div className="px-3 py-1 border border-[#C9AE74]/30 rounded">
                          <span className="text-[#C9AE74] text-[10px] smallcaps font-semibold">
                            {fileCount} archivos
                          </span>
                        </div>
                      </div>
                      <div className="p-8 lg:p-10 space-y-8">
                        <div className="space-y-8">
                          <div className="space-y-6">
                            <div>
                              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-3">
                                De qué va el proyecto
                              </div>
                              <p className="serif text-2xl text-[#18181B] leading-relaxed">{overview.resumen}</p>
                            </div>
                            {overview.estructura_general && (
                              <div>
                                <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-2">
                                  Estructura general
                                </div>
                                <p className="text-base text-[#3A3935] font-mono bg-[#F4EEDA] inline-block px-4 py-2 rounded border border-[#D9CFB8]">
                                  {overview.estructura_general}
                                </p>
                              </div>
                            )}
                            <div className="bg-[#F4EFE0] border border-[#D9CFB8] rounded-md p-4">
                              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-2">
                                Cómo leer este diagrama
                              </div>
                              <p className="text-sm text-[#3A3935] leading-relaxed">
                                Cada bloque agrupa funciones o datos de un archivo. Las flechas explican qué pieza llama,
                                usa o crea a otra. Úsalo como mapa de navegación: primero ubica los archivos grandes,
                                luego sigue las flechas para entender el flujo real del programa.
                              </p>
                            </div>
                            <div>
                              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-3">
                                Flujo principal, paso a paso
                              </div>
                              {overview.flujo_principal && overview.flujo_principal.length > 0 ? (
                                <ol className="space-y-3">
                                  {overview.flujo_principal.map((p) => (
                                    <li
                                      key={p.paso}
                                      className="flex gap-3 bg-[#FAF5E5] border border-[#D9CFB8] rounded-md p-3"
                                    >
                                      <span className="shrink-0 w-8 h-8 rounded-full bg-[#F4EEDA] border border-[#D9CFB8] text-[#5E3A3A] font-semibold text-sm flex items-center justify-center">
                                        {p.paso}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[#3A3935] leading-relaxed text-sm">{p.accion}</p>
                                        {p.archivos.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {p.archivos.map((ruta) => (
                                              <code
                                                key={ruta}
                                                className="text-[10px] font-mono bg-[#F4EEDA] text-[#6B6357] border border-[#E5DDC9] px-1.5 py-0.5 rounded"
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
                                <p className="text-sm text-[#8B8275] italic">No se generó flujo numerado.</p>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-3">
                              Diagrama principal
                            </div>
                            <Mermaid chart={overview.diagrama_mermaid} />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 lg:p-10 space-y-6">
                      <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#D9CFB8]">
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-1">
                            Diagrama específico
                          </div>
                          <code className="text-base font-mono text-[#18181B] break-all">
                            {treeSelectedPath}
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTreeSelectedPath(null)}
                          className="shrink-0 text-[#8B8275] hover:text-[#3A3935] text-sm font-medium"
                        >
                          Cerrar ✕
                        </button>
                      </div>
                      {!selectedTreeFile ? (
                        <p className="text-[#B0584C] text-sm">Archivo no encontrado en el upload.</p>
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
              <div className="flex items-end justify-between mb-6 px-1">
                <div>
                  <div className="text-[10px] smallcaps text-[#A88B4C] mb-1 font-semibold">— Sala II —</div>
                  <h2 className="serif text-3xl text-[#18181B] tracking-tight">Archivos recomendados</h2>
                </div>
                <p className="text-sm text-[#8B8275] serif italic">
                  Atajos a los archivos que Gemini marcó como importantes
                </p>
              </div>
              <div className="space-y-3">
                {overview.archivos.map((a, i) => (
                  <div key={a.ruta} className="flex items-start gap-4">
                    <span className="catalog-num text-sm pt-7 w-8 shrink-0 text-right">
                      {String(i + 1).padStart(2, '0')}.
                    </span>
                    <div className="flex-1">
                      <FileCard
                        archivo={a}
                        expanded={expandedPath === a.ruta}
                        onExpand={() => handleExpandFile(a.ruta)}
                        fileMap={fileMaps[a.ruta] ?? null}
                        loading={!!fileMapLoading[a.ruta]}
                        error={fileMapErrors[a.ruta] ?? null}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {overview.recapitulacion && overview.recapitulacion.length > 0 && (
              <section className="gallery-card rounded-md p-12 border-l-2 border-l-[#A88B4C]">
                <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
                  — Sala III · Para llevarte —
                </div>
                <h2 className="serif text-3xl tracking-tight text-[#18181B] mb-8 italic">
                  Si solo recuerdas {overview.recapitulacion.length === 1 ? 'una cosa' : `${overview.recapitulacion.length} cosas`}…
                </h2>
                <ul className="space-y-5">
                  {overview.recapitulacion.map((punto, i) => (
                    <li key={i} className="flex items-start gap-5">
                      <span className="catalog-num text-2xl shrink-0 leading-none mt-1 w-10 text-right">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <p className="serif text-lg text-[#18181B] leading-relaxed pt-0.5">{punto}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
      ) : (
      <main className="space-y-12">
        <section className="gallery-card rounded-md p-10 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[10px] smallcaps font-semibold text-[#A88B4C] mb-2">
                Diagrama a código
              </div>
              <h2 className="serif text-3xl tracking-tight text-[#18181B]">
                Convierte un flowchart en código ejecutable
              </h2>
            </div>
            <span className="px-3 py-1 bg-[#F4EEDA] text-[#5E3A3A] border border-[#D9CFB8] rounded text-[10px] smallcaps font-semibold">
              Nuevo
            </span>
          </div>
          <DiagramToCodePanel />
        </section>
      </main>
      )}

      <footer className="mt-32 text-center pb-16 space-y-4">
        <div className="gallery-divider mb-10">
          <span className="text-[#A88B4C] font-serif text-sm">◆</span>
        </div>
        <p className="text-[#8B8275] text-sm serif italic">Una galería para el código generado por IA</p>
      </footer>
    </div>
  )
}

export default App
