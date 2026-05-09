# Prompts de VibeMap

## System instruction (compartida por todos los modelos)

Vive en `src/geminiClient.ts:baseSystemInstruction`. Tres reglas le dan a VibeMap su voz:

1. **Habla como si el usuario NO escribiera el código** (porque, literalmente, no lo escribió — fue una IA).
2. **Metáforas del mundo real** para todo concepto técnico. Ej: `useState` → "un cuaderno donde React anota cosas que cambian".
3. **No inventes conexiones**. Si algo no aparece en el código, no aparece en el mapa.

Las dos primeras son la firma del producto. La tercera es defensa contra alucinaciones.

## Schemas de salida

Ambos prompts usan `responseMimeType: "application/json"` + `responseSchema` para forzar salida estructurada. Esto:

- **Garantiza forma**: el frontend sabe qué campos esperar.
- **Reduce errores de parseo**: Gemini respeta el schema casi siempre.
- **Permite evolución**: añadir campos es cambiar el schema, no reescribir el prompt.

Schemas en `src/geminiClient.ts`:

- `overviewSchema` → resumen + diagrama + lista de archivos con importancia.
- `fileMapSchema` → metáfora + diagrama + funciones traducidas + puntos clave.

## Prompt del overview

Construido en `src/server.ts:buildOverviewPrompt`. Dos cosas importantes:

### 1. Grafo de dependencias real, antes del código

Antes del contenido de los archivos, le entregamos a Gemini un bloque así:

```
GRAFO DE DEPENDENCIAS REAL (extraído por regex de imports/require/include).
Úsalo como verdad: las flechas del Mermaid deben respetar estas conexiones reales.

src/server.ts → [express, cors, ./geminiClient.js, ...]
client/src/App.tsx → [react, mermaid, react-dropzone]
...
```

**Por qué**: Gemini puede ver el contenido y deducir relaciones, pero alucina. Si le decimos "esta es la verdad del grafo", solo nombra y explica los nodos — no inventa la topología.

### 2. Truncado por archivo + por total

- Cada archivo se trunca a 4 000 caracteres si es muy largo.
- Si el total supera 180 000 caracteres, el resto de archivos pasa como `[OMITIDO POR LÍMITE DE TAMAÑO]` (Gemini igual los ve listados).

Esto mantiene la llamada bajo el límite de tokens y predecible en costo.

## Prompt del file-map

`src/server.ts:buildFileMapPrompt`. Más simple: recibe un solo archivo y opcionalmente el `resumen` del overview como contexto.

Trunca a 30 000 caracteres por archivo. Si el archivo es más grande, el endpoint rechaza la petición.

## Por qué temperatura 0.4

- Más bajo (0.0–0.2) genera explicaciones aburridas y diagramas planos.
- Más alto (>0.6) inventa metáforas creativas pero también relaciones.
- 0.4 es el sweet spot para "interpretación creativa con base fáctica".

## Si quieres iterar el prompt

1. Cambia `baseSystemInstruction` en `src/geminiClient.ts`.
2. Si añades/quitas campos, actualiza también `overviewSchema` o `fileMapSchema` en el mismo archivo, y los tipos `Overview`/`FileMap` en `client/src/App.tsx`.
3. Prueba con un proyecto chico antes de pushear: el overview debería tomar 3–8s y el file-map 1–4s.
