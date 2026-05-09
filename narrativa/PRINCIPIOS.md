# Principios de diseño — no romper al iterar

Reglas blandas pero importantes. Si una IA o un dev las ignora, VibeMap deja de ser VibeMap.

## 1. El usuario NO escribió este código

Toda explicación parte de ese supuesto. Cero jerga. Cero "ya sabes cómo funciona X". Si una palabra técnica es inevitable, va seguida de una metáfora entre paréntesis.

**Ejemplo bueno:** "Aquí se usa `useEffect` (un asistente que React llama cada vez que cambia algo en pantalla)."

**Ejemplo malo:** "Aquí se usa `useEffect` para manejar side-effects en el render lifecycle."

## 2. Metáfora obligatoria por archivo

Cada `FileMap` empieza con una metáfora del mundo real (un portero, una mochila, una cocina, una recepción). Es la firma del producto. Si el archivo es trivial, la metáfora también puede ser trivial — pero existe.

## 3. Diagramas cortos > diagramas exhaustivos

Mermaid generado por Gemini debe tener:
- Nodos en español, 1-3 palabras por nodo.
- Flechas etiquetadas con verbos ("usa", "envía a", "lee de").
- Idealmente menos de 12 nodos. Más de eso es demasiado para un mapa mental.

Mejor un diagrama incompleto pero legible que uno completo e ilegible.

## 4. Drill-down lazy, nunca pre-cargado

El overview se calcula al subir el proyecto. Los `file-map` SOLO al hacer click. Razones:

- Costo: pre-generar 50 mapas que el usuario no va a abrir es un desperdicio.
- Latencia percibida: el overview rápido + drill-down on-demand se siente más responsivo.
- Foco: si pre-mostramos todo, el usuario se pierde.

## 5. No alucinar conexiones

El backend pre-extrae imports y se los entrega a Gemini como "verdad". Si añades soporte para un nuevo lenguaje:

- Añade un patrón a `IMPORT_PATTERNS` en `src/server.ts`.
- Verifica que no genere falsos positivos (ej: `import` en strings de SQL).

Si un proyecto no tiene imports detectables, Gemini puede inferir, pero el system prompt le pide que diga "no estoy seguro" en lugar de inventar.

## 6. La UI debe sentirse en calma

VibeMap es un producto de comprensión, no de productividad. Animaciones suaves, espacios generosos, tipografía grande. Nada de toast notifications agresivas. Errores con tono pedagógico, no técnico.

**Bueno:** "No pude leer este archivo. ¿Es muy grande o binario?"
**Malo:** "ERROR 502: malformed JSON response from upstream"

## 7. Solo lectura, siempre

VibeMap nunca:
- Escribe en disco del usuario.
- Persiste contenido subido (los uploads viven en memoria del request).
- Manda telemetría sin consentimiento.

Si añades una feature de "editar/sugerir cambio", tiene que ser bajo flag explícito y con confirmación.

## 8. Salida estructurada, siempre

No regreses a parsear markdown libre. Si necesitas un nuevo tipo de respuesta, haz un nuevo schema en `geminiClient.ts`. Esto:

- Mantiene el frontend simple.
- Permite añadir validación.
- Hace los errores fáciles de debuggear (parse vs render).

## 9. Versiones de modelos

Default actual: `gemini-2.0-flash`. Si lo cambias:

- `flash` familia → respuesta rápida (3–8s overview), suficiente para hackathon y demos.
- `pro` familia → mejor razonamiento pero 15-30s. Solo si los mapas se ven mal.

Cuando subas a `pro`, baja `temperature` a 0.3 para compensar.

## 10. Cero forms en el flujo principal

Drop → ver. No login, no settings, no "elige un modelo". El producto es magia: tu carpeta entra, tu mapa sale. Si añades configuración, va escondida en un menú lateral, nunca antes del análisis.
