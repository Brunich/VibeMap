# VibeMap — Qué es y para quién

## TL;DR

> **"Codex/Claude/cualquier IA me generó un proyecto. Funciona, pero no entiendo qué hace cada parte. VibeMap me lo explica como mapa mental, en español llano."**

VibeMap recibe una carpeta de proyecto, la analiza con Gemini, y devuelve dos cosas:

1. **Un mapa general** del proyecto entero (un diagrama Mermaid + un resumen humano).
2. **Mapas individuales por archivo** (bajo demanda, click en cualquier archivo): metáfora del mundo real, flujo interno, tabla de funciones traducidas a lenguaje humano, y puntos clave.

No genera código. No ejecuta nada. Solo **traduce código a comprensión**.

## Para quién

El usuario objetivo NO escribió este código. Lo recibió de una IA y necesita entenderlo:

- Estudiantes que piden a ChatGPT/Claude/Codex que les genere un proyecto.
- Devs probando código vibe-coded antes de adoptarlo.
- Profes evaluando entregas hechas con IA.
- Cualquiera que mire un repo desconocido y quiera "el mapa antes que el código".

Por eso el tono de las explicaciones es **deliberadamente simple, con metáforas**. No se asume conocimiento previo del lenguaje ni del framework.

## Lo que NO es VibeMap

- ❌ No es un generador de código (la dirección "idea → código" es de otro producto).
- ❌ No es un linter ni un revisor de seguridad.
- ❌ No es un autocompletador.
- ❌ No es un chat: el flujo es drop-and-explain, no conversación.

## Decisiones de producto importantes

1. **Solo lectura.** VibeMap nunca escribe en el proyecto del usuario. Los archivos viven solo en memoria del browser y se mandan al backend para análisis.
2. **Mermaid como output visual.** Es el formato más fácil de generar para una LLM y de renderizar en el browser.
3. **Salida JSON estructurada de Gemini.** Usamos `responseMimeType: "application/json"` + `responseSchema`. No parseamos markdown libre.
4. **Drill-down lazy.** El mapa general llega rápido. Los mapas por archivo se piden al hacer click — no pre-generamos lo que el usuario tal vez no mire.
5. **Pre-extracción de imports.** Antes de pedirle a Gemini el diagrama, extraemos `import`/`require`/`#include` con regex y se los entregamos como "verdad" del grafo. Esto reduce alucinaciones de relaciones.
6. **Streaming visual.** El overview se entrega vía SSE para que el usuario vea progreso real (no una barra falsa).

## Glosario interno

- **Overview**: el análisis del proyecto entero. Un solo objeto con resumen + diagrama Mermaid + lista de archivos.
- **FileMap**: el análisis de un archivo individual. Metáfora + diagrama Mermaid local + tabla de funciones + puntos clave.
- **Importancia**: cada archivo del overview tiene un nivel `alta | media | baja` para que el usuario sepa qué leer primero.
- **Metáfora**: comparación con algo del mundo real (una mochila, un portero, una cocina). Es la firma estilística del producto.

## Estado actual

- Hackathon edition v2.0
- Stack: React 19 + Vite + Tailwind 4 + Mermaid 11 (frontend); Express 5 + @google/generative-ai (backend); Gemini 2.0 Flash como modelo.
- Repo público: `CharlsMex24/VibeMap_Hackathon`.
