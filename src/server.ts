import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  overviewModel,
  fileMapModel,
  streamingOverviewModel,
} from "./geminiClient.js";

const app = express();
const port = 3000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
}));

const apiLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: "10mb" }));

type ProjectFile = { path: string; content: string };

const MAX_FILES = 500;
const MAX_FILE_CHARS_FOR_OVERVIEW = 4000;
const MAX_TOTAL_CHARS_FOR_OVERVIEW = 180_000;
const MAX_FILE_CHARS_FOR_DETAIL = 30_000;

const SKIPPED_PATH_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /\.lock$/,
  /\.min\.(js|css)$/,
  /dist\//,
  /build\//,
];

function isSkippablePath(p: string): boolean {
  return SKIPPED_PATH_PATTERNS.some((re) => re.test(p));
}

function isProcessableContent(content: string): boolean {
  if (!content || content.length < 5) return false;
  if (content.startsWith("[ARCHIVO BINARIO")) return false;
  if (content.startsWith("[CONTENIDO OMITIDO")) return false;
  if (content.startsWith("[ERROR DE LECTURA")) return false;
  return true;
}

const IMPORT_PATTERNS = [
  /^\s*import\s+(?:[^'"`]+\s+from\s+)?['"`]([^'"`]+)['"`]/gm,
  /^\s*const\s+[\w{},\s]+=\s*require\(['"`]([^'"`]+)['"`]\)/gm,
  /^\s*from\s+([\w.]+)\s+import\s+/gm,
  /^\s*import\s+([\w.]+)/gm,
  /^\s*#include\s+["<]([^">]+)[">]/gm,
  /^\s*using\s+([\w.]+)\s*;/gm,
];

function extractImports(content: string): string[] {
  const found = new Set<string>();
  for (const pattern of IMPORT_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      if (m[1]) found.add(m[1].trim());
    }
  }
  return Array.from(found);
}

function buildDependencyHints(files: ProjectFile[]): string {
  const hints: string[] = [];
  for (const f of files) {
    if (!isProcessableContent(f.content)) continue;
    const imports = extractImports(f.content).slice(0, 12);
    if (imports.length === 0) continue;
    hints.push(`${f.path} → [${imports.join(", ")}]`);
  }
  return hints.slice(0, 80).join("\n");
}

function buildOverviewPrompt(files: ProjectFile[]): string {
  const usable = files
    .filter((f) => !isSkippablePath(f.path) && isProcessableContent(f.content));

  let totalChars = 0;
  const trimmed: ProjectFile[] = [];
  for (const f of usable) {
    const truncated = f.content.length > MAX_FILE_CHARS_FOR_OVERVIEW
      ? f.content.slice(0, MAX_FILE_CHARS_FOR_OVERVIEW) + "\n[...truncado...]"
      : f.content;
    if (totalChars + truncated.length > MAX_TOTAL_CHARS_FOR_OVERVIEW) {
      trimmed.push({ path: f.path, content: "[OMITIDO POR LÍMITE DE TAMAÑO]" });
      continue;
    }
    totalChars += truncated.length;
    trimmed.push({ path: f.path, content: truncated });
  }

  const fileContentStr = trimmed
    .map((f) => `--- FILE: ${f.path.replace(/[\r\n]/g, "")} ---\n${f.content}`)
    .join("\n\n");

  const dependencyHints = buildDependencyHints(usable);

  return `
Vas a ver un proyecto generado posiblemente por una IA. Tu trabajo es producir un
mapa mental de la arquitectura general en lenguaje SIMPLE para alguien que no
escribió este código.

GRAFO DE DEPENDENCIAS REAL (extraído por regex de imports/require/include).
Úsalo como verdad: las flechas del Mermaid deben respetar estas conexiones reales.
Si una conexión no aparece aquí, NO la inventes.

${dependencyHints || "(no se detectaron imports relevantes)"}

CONTENIDO DEL PROYECTO:
${fileContentStr}

INSTRUCCIONES PARA EL JSON DE SALIDA:
- "resumen": qué hace el proyecto, con UN ejemplo concreto (no metáforas tipo "es como X").
- "estructura_general": el patrón arquitectónico real que ves (no inventes uno).
- "diagrama_mermaid": 'flowchart TD' DETALLADO con subgraphs por archivo/clase. Dentro
  de cada subgraph lista las 2-4 funciones más importantes y las estructuras de datos
  relevantes. Conecta funciones entre archivos con flechas '-->|llama a|', '-->|usa|',
  '-->|crea|'. Etiquetas SIEMPRE con '|texto|', NUNCA con ': texto'.
- "flujo_principal": **CRÍTICO** — pasos numerados (1, 2, 3...) en ORDEN cronológico
  describiendo el caso de uso típico de principio a fin. Cada "accion" debe mencionar
  funciones reales y archivos. Ej: paso 1 'Player._ready() se ejecuta al cargar la
  escena y crea una nueva Pokeball', paso 2 'Player llama a inventory.add_item(pokeball)
  que la guarda en items[]', paso 3 '...'. Mínimo 3 pasos, máximo ~8.
- "archivos": ordena de más a menos importante. El "rol" debe mencionar al menos una
  función concreta del archivo cuando ayude a entender.
- "recapitulacion": 3-5 takeaways finales. Sin jerga. Cada uno una frase corta.
`.trim();
}

function buildFileMapPrompt(file: ProjectFile, projectContext?: string): string {
  const truncated = file.content.length > MAX_FILE_CHARS_FOR_DETAIL
    ? file.content.slice(0, MAX_FILE_CHARS_FOR_DETAIL) + "\n[...truncado...]"
    : file.content;

  return `
Explica este archivo de forma visual a alguien que NO lo escribió.

CONTEXTO DEL PROYECTO (resumen):
${projectContext || "(sin contexto adicional)"}

ARCHIVO: ${file.path}

CONTENIDO:
${truncated}

INSTRUCCIONES PARA EL JSON DE SALIDA:
- "explicacion": EXPLICA con un ejemplo del código mismo. NO uses "es como una mochila"
  ni metáforas vacías. Ejemplo válido: "Inventory guarda los objetos del jugador en un
  array. Cuando el jugador recoge una Pokeball, se llama add_item(pokeball) y queda en
  items[] hasta que use(id) la elimina y dispara su acción."
- "estructura": el tipo concreto de estructura/patrón usado en este archivo. Ej:
  "Resource de Godot con Array de Item", "Componente React con dos useState".
- "diagrama_mermaid": **OBLIGATORIO 'sequenceDiagram'**. Muestra los participants
  (clases/objetos involucrados) y las llamadas en ORDEN cronológico de arriba a abajo.
  Cada flecha es una llamada concreta con sus argumentos reales. Usa 'Note over X: ...'
  para marcar fases. No uses flowchart aquí — el usuario quiere ver el ORDEN de llamadas.
- "flujo_ejecucion": **CRÍTICO** — pasos numerados (cada string empieza con "1.", "2.",
  etc.) describiendo en ORDEN cronológico qué hace el archivo, mencionando la función
  responsable de cada paso. Mínimo 3 pasos. Ej:
    "1. _ready() se ejecuta al cargar la escena."
    "2. Crea una Pokeball nueva con Pokeball.new()."
    "3. Llama a inventory.add_item(pokeball) para guardarla en items[]."
- "funciones_definidas": funciones que ESTE archivo declara. Para cada una: 'real'
  (nombre exacto), 'humana' (qué hace y cuándo, con ejemplo), 'llama_a' (qué invoca).
- "funciones_usadas": funciones EXTERNAS que este archivo llama pero NO define.
  Pueden venir de imports, otros archivos del proyecto, o métodos heredados.
  Para cada una: 'nombre' (la función o método), 'donde' (de dónde viene),
  'como' (la llamada concreta tal cual aparece en el código + para qué la usa aquí).
- "puntos_clave": 2-4 cosas específicas para recordar de este archivo.
- "resumen_archivo": una sola frase de cierre que recapitule lo explicado.
`.trim();
}

type GeminiError = {
  status?: number;
  statusText?: string;
  errorDetails?: Array<{ "@type"?: string; retryDelay?: string }>;
  message?: string;
};

function describeGeminiError(err: unknown): { status: number; userMessage: string } {
  const e = err as GeminiError;
  const code = e?.status;
  if (code === 429) {
    const retryInfo = e?.errorDetails?.find((d) => d["@type"]?.includes("RetryInfo"));
    const wait = retryInfo?.retryDelay ?? "unos segundos";
    return {
      status: 429,
      userMessage: `Gemini está limitando peticiones. Espera ${wait} y vuelve a intentar. Si pasa seguido, tu cuota gratuita del día puede haberse agotado.`,
    };
  }
  if (code === 401 || code === 403) {
    return {
      status: code,
      userMessage: "La API key de Gemini no es válida o no tiene permiso. Revisa GEMINI_API_KEY en .env.",
    };
  }
  if (code === 503) {
    return {
      status: 503,
      userMessage: "Gemini está sobrecargado. Reintenta en un momento.",
    };
  }
  if (code === 400) {
    return {
      status: 400,
      userMessage: "Gemini rechazó la petición. Posiblemente el proyecto es demasiado grande o tiene contenido que no puede procesar.",
    };
  }
  return {
    status: 500,
    userMessage: "No pude generar el mapa. Intenta de nuevo en un momento.",
  };
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const e = err as GeminiError;
      const retryable = e?.status === 503 || e?.status === 429;
      if (!retryable || attempt === maxAttempts) throw err;
      const backoffMs = Math.min(1500 * 2 ** (attempt - 1), 8000);
      console.log(`[retry] attempt ${attempt} failed (${e?.status}), waiting ${backoffMs}ms`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastError;
}

function normalizeMermaid(chart: string): string {
  if (!chart) return chart;
  // En sequenceDiagram el ':' después de la flecha es sintaxis válida.
  // Solo normalizamos para flowchart/graph.
  const isSequence = /^\s*sequenceDiagram\b/m.test(chart);
  if (isSequence) return chart;

  let out = chart;

  // 1) 'A --|>|texto| B' → 'A -->|texto| B'
  out = out.replace(
    /(\w+)\s*--\|\>\|([^|\n]+)\|\s*(\w+)/g,
    (_, a, label, b) => `${a} -->|${label.trim()}| ${b}`,
  );

  // 2) 'A --|> B' (class-diagram inheritance) → 'A -->|hereda de| B'
  out = out.replace(
    /(\w+(?:\[[^\]]*\])?)\s*--\|\>\s*(\w+(?:\[[^\]]*\])?)/g,
    (_, a, b) => `${a} -->|hereda de| ${b}`,
  );

  // 3) 'A --> B: etiqueta' → 'A -->|etiqueta| B'
  out = out.replace(
    /(\w+(?:\[[^\]]*\])?)\s*-->\s*(\w+(?:\[[^\]]*\])?)\s*:\s*([^\n]+)/g,
    (_, from, to, label) => `${from} -->|${label.trim()}| ${to}`,
  );

  // 4) 'subgraph X [label/with.special]' → 'subgraph X ["label/with.special"]'
  //    (Mermaid v11 acepta strings comillados en subgraph titles)
  out = out.replace(
    /^(\s*subgraph\s+\w+\s+)\[([^\]\n]*[\/.\\#@:][^\]\n]*)\]/gm,
    (_, prefix, label) => `${prefix}["${label.replace(/"/g, "'").trim()}"]`,
  );

  // 5) Limpia paréntesis dentro de etiquetas de nodo: 'X[foo(bar)]' → 'X[foo bar]'
  //    Los parens rompen el parser de flowchart.
  out = out.replace(/\[([^\[\]\n]*)\]/g, (_, inner: string) => {
    const cleaned = inner
      .replace(/\(/g, " ")
      .replace(/\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return `[${cleaned}]`;
  });

  // 6) Limpia paréntesis dentro de paréntesis: '(foo(bar))' → '(foo bar)' (forma circular Mermaid)
  out = out.replace(/\(\(([^()\n]*)\)\)/g, (_, inner: string) => {
    return `((${inner.replace(/\(|\)/g, " ").replace(/\s+/g, " ").trim()}))`;
  });

  return out;
}

function fixMermaidInPayload<T extends { diagrama_mermaid?: string }>(payload: T): T {
  if (typeof payload?.diagrama_mermaid === "string") {
    payload.diagrama_mermaid = normalizeMermaid(payload.diagrama_mermaid);
  }
  return payload;
}

function validateFiles(files: unknown): { ok: true; files: ProjectFile[] } | { ok: false; error: string } {
  if (!files || !Array.isArray(files) || files.length === 0) {
    return { ok: false, error: "No files provided" };
  }
  if (files.length > MAX_FILES) {
    return { ok: false, error: `Demasiados archivos (máximo ${MAX_FILES})` };
  }
  const valid = files.filter(
    (f: any) => typeof f.path === "string" && typeof f.content === "string"
  );
  if (valid.length === 0) {
    return { ok: false, error: "No valid files provided" };
  }
  return { ok: true, files: valid as ProjectFile[] };
}

app.post("/api/overview", apiLimit, async (req, res) => {
  try {
    const validation = validateFiles(req.body?.files);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    console.log(`[overview] Analyzing ${validation.files.length} files`);
    const prompt = buildOverviewPrompt(validation.files);

    const result = await withRetry(() => overviewModel.generateContent(prompt));
    const text = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("[overview] Failed to parse JSON. Raw:", text.slice(0, 500));
      return res.status(502).json({ error: "Respuesta de IA inválida" });
    }
    res.json(fixMermaidInPayload(parsed));
  } catch (err) {
    console.error("[overview] Error:", err);
    const { status, userMessage } = describeGeminiError(err);
    res.status(status).json({ error: userMessage });
  }
});

app.post("/api/overview-stream", apiLimit, async (req, res) => {
  try {
    const validation = validateFiles(req.body?.files);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    console.log(`[overview-stream] Streaming for ${validation.files.length} files`);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const prompt = buildOverviewPrompt(validation.files);
    const stream = await withRetry(() => streamingOverviewModel.generateContentStream(prompt));
    let streamResponseError: unknown;
    const streamResponse = stream.response.catch((err) => {
      streamResponseError = err;
      console.error("[overview-stream] response promise failed:", err);
      return null;
    });

    let accumulated = "";
    try {
      for await (const chunk of stream.stream) {
        try {
          const piece = chunk.text();
          if (piece) {
            accumulated += piece;
            res.write(`event: chunk\ndata: ${JSON.stringify({ piece, accumulated })}\n\n`);
          }
        } catch (chunkErr) {
          console.warn("[overview-stream] chunk read failed:", chunkErr);
        }
      }
    } catch (streamErr) {
      console.error("[overview-stream] iterator error:", streamErr);
      if (accumulated.length === 0) throw streamErr;
      // si ya tenemos contenido parcial, intentamos parsearlo igual
    }

    const finalResponse = await streamResponse;
    const finalText = finalResponse?.text() || accumulated;
    if (!finalText.trim() && streamResponseError) {
      throw streamResponseError;
    }

    let parsed;
    try {
      parsed = JSON.parse(finalText);
    } catch {
      console.error("[overview-stream] Final parse failed. Raw:", finalText.slice(0, 500));
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Respuesta de IA inválida" })}\n\n`);
      res.end();
      return;
    }

    const normalized = fixMermaidInPayload(parsed);
    res.write(`event: done\ndata: ${JSON.stringify(normalized)}\n\n`);
    res.end();
  } catch (err) {
    console.error("[overview-stream] Error:", err);
    const { status, userMessage } = describeGeminiError(err);
    if (!res.headersSent) {
      res.status(status).json({ error: userMessage });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: userMessage })}\n\n`);
      res.end();
    }
  }
});

app.post("/api/file-map", apiLimit, async (req, res) => {
  try {
    const { path: filePath, content, projectContext } = req.body ?? {};
    if (typeof filePath !== "string" || typeof content !== "string") {
      return res.status(400).json({ error: "path y content (string) son requeridos" });
    }
    if (content.length > MAX_FILE_CHARS_FOR_DETAIL * 1.5) {
      return res.status(400).json({ error: "Archivo demasiado grande para análisis individual" });
    }

    console.log(`[file-map] ${filePath} (${content.length} chars)`);
    const prompt = buildFileMapPrompt(
      { path: filePath, content },
      typeof projectContext === "string" ? projectContext : undefined
    );

    const result = await withRetry(() => fileMapModel.generateContent(prompt));
    const text = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("[file-map] Parse failed. Raw:", text.slice(0, 500));
      return res.status(502).json({ error: "Respuesta de IA inválida" });
    }
    res.json(fixMermaidInPayload(parsed));
  } catch (err) {
    console.error("[file-map] Error:", err);
    const { status, userMessage } = describeGeminiError(err);
    res.status(status).json({ error: userMessage });
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

app.listen(port, () => {
  console.log(`VibeMap backend running at http://localhost:${port}`);
});
