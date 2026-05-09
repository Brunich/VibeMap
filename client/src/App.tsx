import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import ReactMarkdown from 'react-markdown'
import mermaid from 'mermaid'

const Mermaid = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mermaid.initialize({ 
      startOnLoad: true, 
      theme: 'neutral',
      securityLevel: 'loose'
    })
    if (ref.current) {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
      mermaid.render(id, chart).then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg
      }).catch(err => {
        console.error("Mermaid render error:", err)
        if (ref.current) ref.current.innerHTML = `<div class="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-500">Error en diagrama: ${err.message || 'Sintaxis inválida'}</div>`
      })
    }
  }, [chart])

  return <div ref={ref} className="flex justify-center my-12 overflow-x-auto p-4 bg-white rounded-3xl border border-slate-50 shadow-sm" />
}

function App() {
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState<number>(0)
  const [analyzedFiles, setAnalyzedFiles] = useState<string[]>([])

  const isBinary = (buffer: Uint8Array): boolean => {
    // Check first 1024 bytes for null bytes or high concentration of non-printable chars
    const checkSize = Math.min(buffer.length, 1024);
    let nonPrintable = 0;
    for (let i = 0; i < checkSize; i++) {
      if (buffer[i] === 0) return true; // Null byte is a strong binary indicator
      if (buffer[i]! < 32 && ![9, 10, 13].includes(buffer[i]!)) nonPrintable++;
    }
    return nonPrintable / checkSize > 0.3;
  }

  const readEntry = async (entry: FileSystemEntry): Promise<{ path: string, content: string }[]> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      return new Promise((resolve) => {
        fileEntry.file(async (file) => {
          try {
            if (file.size > 1024 * 1024 * 10) {
              resolve([{ path: entry.fullPath, content: "[CONTENIDO OMITIDO: ARCHIVO MAYOR A 10MB]" }]);
              return;
            }

            const arrayBuffer = await file.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            
            if (isBinary(uint8)) {
              // Even if binary, let's keep the path so Gemini knows it exists
              resolve([{ path: entry.fullPath, content: "[ARCHIVO BINARIO O MULTIMEDIA]" }]);
              return;
            }

            const decoder = new TextDecoder('utf-8', { fatal: false });
            const content = decoder.decode(uint8);
            resolve([{ path: entry.fullPath, content }]);
          } catch (err) {
            console.error(`Error leyendo ${entry.fullPath}:`, err);
            resolve([{ path: entry.fullPath, content: "[ERROR DE LECTURA]" }]);
          }
        });
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry
      const reader = dirEntry.createReader();
      
      const readAllEntries = async () => {
        let allEntries: FileSystemEntry[] = [];
        let results: FileSystemEntry[] = [];
        do {
          results = await new Promise<FileSystemEntry[]>((resolve) => {
            reader.readEntries(resolve, () => resolve([]));
          });
          allEntries = allEntries.concat(results);
        } while (results.length > 0);
        return allEntries;
      }

      const entries = await readAllEntries();
      const filteredEntries = entries.filter(e => 
        !['node_modules', '.git', 'dist', '.import', '.godot', 'build', 'bin', 'obj'].includes(e.name)
      );
      
      const results = await Promise.all(filteredEntries.map(e => readEntry(e)));
      return results.flat();
    }
    return [];
  }

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: any, event: any) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setFileCount(0)
    setAnalyzedFiles([])

    try {
      let filesToAnalyze: { path: string, content: string }[] = [];
      const items = event.dataTransfer?.items;
      
      if (items) {
        const entries = Array.from(items)
          .map((item: any) => item.webkitGetAsEntry())
          .filter(Boolean);
        
        const nestedFiles = await Promise.all(entries.map(e => readEntry(e)));
        filesToAnalyze = nestedFiles.flat();
      } else {
        filesToAnalyze = await Promise.all(acceptedFiles.map(async (f) => ({
          path: f.name,
          content: await f.text()
        })));
      }

      if (filesToAnalyze.length === 0) {
        throw new Error("No se encontraron archivos procesables.");
      }

      setFileCount(filesToAnalyze.length);
      setAnalyzedFiles(filesToAnalyze.map(f => f.path));

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filesToAnalyze }),
      })

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error en el servidor de análisis');
      }

      const data = await response.json()
      setResult(data.result)
    } catch (err: any) {
      setError(err.message || 'Error inesperado en VibeMAP')
    } finally {
      setLoading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 font-sans antialiased text-slate-900">
      <header className="text-center mb-20">
        <div className="inline-block px-4 py-1.5 mb-6 text-sm font-bold tracking-widest text-indigo-600 uppercase bg-indigo-50 rounded-full">
          Hackathon Edition v2.0
        </div>
        <h1 className="text-8xl font-black tracking-tighter mb-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 bg-clip-text text-transparent">
          VibeMAP
        </h1>
        <p className="text-2xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
          Ingeniería inversa visual inteligente. Sube cualquier proyecto y mira la arquitectura cobrar vida.
        </p>
      </header>

      <main className="space-y-20">
        <section 
          {...getRootProps()} 
          className={`
            relative group border-2 border-dashed rounded-[3rem] p-24 text-center transition-all duration-700
            ${isDragActive 
              ? 'border-indigo-600 bg-indigo-50/30 scale-[1.01] ring-8 ring-indigo-50' 
              : 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]'}
          `}
        >
          <input {...getInputProps()} />
          <div className="space-y-8">
            <div className="w-28 h-28 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-4xl font-black tracking-tight text-slate-900">Suelta tu proyecto aquí</p>
              <p className="text-slate-400 text-xl font-medium">Soporte universal: Godot, Unity, React, Python, C++, etc.</p>
            </div>
          </div>
        </section>

        {loading && (
          <div className="bg-white rounded-[3rem] p-20 shadow-xl border border-slate-100 flex flex-col items-center text-center space-y-8">
            <div className="flex space-x-2">
              <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce"></div>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-black text-slate-900">Analizando {fileCount} archivos</p>
              <p className="text-slate-500 text-lg font-medium">Gemini está reconstruyendo la arquitectura visual...</p>
            </div>
            <div className="w-full max-w-md bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full w-full animate-[progress_20s_ease-in-out]"></div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border-2 border-rose-100 p-10 rounded-[3rem] flex items-center space-x-6 animate-in fade-in zoom-in duration-300">
            <div className="bg-rose-500 text-white p-4 rounded-2xl shadow-lg shadow-rose-200">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-black text-rose-950">Fallo de Escaneo</p>
              <p className="text-rose-700 text-lg font-medium">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-[4rem] shadow-[0_40px_80px_-16px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-50 animate-in fade-in slide-in-from-bottom-20 duration-1000">
            <div className="bg-slate-950 px-12 py-8 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                  <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                  <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                </div>
                <div className="h-6 w-px bg-slate-800 mx-2"></div>
                <span className="text-indigo-400 font-mono text-sm font-bold tracking-[0.4em] uppercase">VibeMAP Analysis Report</span>
              </div>
              <div className="px-4 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                <span className="text-indigo-400 text-xs font-black uppercase tracking-widest">{fileCount} Archivos Mapeados</span>
              </div>
            </div>
            <div className="p-20 prose prose-slate prose-xl max-w-none 
              prose-headings:text-slate-900 prose-headings:font-black prose-headings:tracking-tighter
              prose-p:leading-relaxed prose-p:text-slate-600
              prose-strong:text-slate-900 prose-strong:font-bold
              prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-2 prose-code:py-0.5 prose-code:rounded-lg prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-slate-900 prose-pre:rounded-[2rem] prose-pre:p-8 prose-pre:shadow-2xl">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    const content = String(children).replace(/\n$/, '')
                    if (!inline && match && match[1] === 'mermaid') {
                      return <Mermaid chart={content} />
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {result}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-40 text-center pb-24 space-y-4">
        <div className="w-20 h-1 bg-slate-200 mx-auto rounded-full mb-12"></div>
        <p className="text-slate-400 font-bold tracking-widest uppercase text-sm">VibeMAP Hackathon Engine &copy; 2026</p>
        <p className="text-slate-300 text-sm">Diseñado para la comprensión visual de sistemas complejos</p>
      </footer>

      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 95%; }
        }
      `}</style>
    </div>
  )
}

export default App
