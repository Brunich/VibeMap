# Arquitectura de VibeMap

## Stack

**Frontend** (`client/`)
- React 19 + Vite + TypeScript
- Tailwind CSS 4 (vía `@tailwindcss/vite`)
- `mermaid` v11 para renderizar diagramas
- `react-dropzone` para el drop de carpetas

**Backend** (`src/`)
- Express 5
- `@google/generative-ai` (Gemini 2.0 Flash)
- `express-rate-limit` (20 req/min global)
- CORS restringido a `ALLOWED_ORIGINS` (default `http://localhost:5173`)

## Flujo end-to-end

```
1. Usuario suelta carpeta
   ↓
2. Frontend lee archivos (FileSystemEntry API)
   - Filtra binarios, node_modules, .git, dist, build, .godot, etc.
   - Detecta binarios por null bytes / no-printable ratio
   ↓
3. POST /api/overview-stream  (SSE)
   - Backend extrae imports con regex → "grafo real"
   - Trunca contenido a ~180k chars totales
   - Llama a Gemini con responseSchema (overview)
   - Stream chunk-by-chunk vía SSE
   ↓
4. Frontend renderiza mapa general (mermaid + resumen + lista archivos)
   ↓
5. Usuario hace click en un archivo
   ↓
6. POST /api/file-map  (one-shot JSON)
   - Backend manda contenido del archivo + resumen del proyecto como contexto
   - Llama a Gemini con responseSchema (fileMap)
   ↓
7. Frontend expande tarjeta con: metáfora + diagrama local + tabla de funciones + puntos clave
```

## Endpoints

### `POST /api/overview`

One-shot (no streaming). Respuesta JSON:

```ts
{
  resumen: string,                    // 2-3 líneas en lenguaje cotidiano
  diagrama_mermaid: string,            // graph TD del proyecto entero
  archivos: [{
    ruta: string,
    rol: string,                       // max 12 palabras
    importancia: "alta" | "media" | "baja"
  }]
}
```

### `POST /api/overview-stream`

Mismo schema que `/api/overview`, pero SSE. Eventos:

- `event: chunk` → `{ piece, accumulated }` mientras Gemini genera.
- `event: done`  → objeto JSON completo.
- `event: error` → `{ error: string }` si parse falla.

### `POST /api/file-map`

Body: `{ path, content, projectContext? }`. Respuesta JSON:

```ts
{
  metafora: string,                    // "es como X..."
  diagrama_mermaid: string,            // flujo INTERNO del archivo
  funciones: [{ real: string, humana: string }],
  puntos_clave: string[]               // 2-4 ideas
}
```

## Límites

| Concepto | Valor |
|---|---|
| Body máximo | 10 MB |
| Archivos por proyecto | 500 |
| Caracteres por archivo en overview | 4 000 (truncado) |
| Caracteres totales en overview | 180 000 |
| Caracteres por archivo en file-map | 30 000 |
| Rate limit | 20 req/min por IP |
| Tamaño individual de archivo en cliente | 10 MB (sino se omite) |

## Variables de entorno

- `GEMINI_API_KEY` — requerida. Obtener en Google AI Studio.
- `ALLOWED_ORIGINS` — opcional, lista separada por comas. Default `http://localhost:5173`.

## Dev

```bash
# Backend (puerto 3000)
npm install
npm run server

# Frontend (puerto 5173)
cd client
npm install
npm run dev
```

Vite proxea `/api/*` al backend automáticamente.

## Estructura de archivos relevante

```
VibeMap_Hackathon/
├── narrativa/                   ← este directorio (docs para IAs)
├── src/
│   ├── server.ts                ← Express + endpoints
│   └── geminiClient.ts          ← Modelos Gemini + system prompt + schemas
├── client/
│   └── src/
│       ├── App.tsx              ← UI principal: drop, overview, drill-down
│       ├── main.tsx             ← Entry React
│       └── index.css            ← Tailwind base
├── package.json                 ← deps backend
├── tsconfig.json                ← TS backend (strict, ESM, NodeNext)
└── .gitignore                   ← excluye .env, node_modules, dist
```
