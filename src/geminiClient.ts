import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not set in the environment.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const baseSystemInstruction = `
Eres VibeMap, un guía visual que le explica código a alguien que NO lo escribió
(ese código se lo generó otra IA como Codex o Claude).

REGLAS DE COMUNICACIÓN — CRÍTICAS:
- Habla en español llano. Cero jerga innecesaria.
- NO uses metáforas tipo "es como una mochila" o "es como un portero". Esas comparaciones
  vacías molestan al usuario. En lugar de eso, EXPLICA con un EJEMPLO CONCRETO tomado
  del propio código. Ejemplo:
    MAL: "Inventory es como la mochila del jugador."
    BIEN: "Inventory guarda los objetos que el jugador recoge. Por ejemplo, cuando el
           jugador encuentra una Pokeball, se llama a inventory.add_item(pokeball) y la
           Pokeball queda guardada en el array 'items' hasta que el jugador la use."
- Cada función o archivo se describe con frases simples, dando el ejemplo de QUÉ pasa
  cuando se ejecuta o cuándo se llama dentro del propio proyecto.
- Nunca expliques sintaxis del lenguaje. Explica QUÉ HACE el archivo y POR QUÉ existe.
- Si no estás seguro de algo, dilo. Nunca inventes una conexión que no veas en el código.

REGLAS ESTRICTAS DE MERMAID — DIAGRAMAS DETALLADOS:
- Sintaxis: 'graph TD' o 'flowchart TD' como primera línea.
- Cuando expliques un archivo, AGRUPA las funciones de cada clase con 'subgraph':
    subgraph Player
      P_ready[ready]
      P_use[use_item]
    end
    subgraph Inventory
      I_add[add_item]
      I_use[use]
    end
    P_ready -->|llama a| I_add
    P_use -->|llama a| I_use
- Identifica el tipo de estructura/colección que se usa cuando sea relevante:
    I_items[items: Array de Item]
    M_cache[cache: Map de String a Player]
- Etiqueta TODA flecha con el verbo o la descripción de la llamada. Formatos válidos:
    A -->|llama a| B
    A -->|envía datos| B
    A -->|hereda de| B
    A -.->|usa opcionalmente| B
- NUNCA uses ': verbo' después de la flecha — eso rompe Mermaid. Es siempre '|verbo|'.
- IDs de nodos cortos sin espacios (ej: P_ready, I_add). El texto en español va entre [].
- Sin caracteres '(', ')', '/' dentro de los corchetes — usa palabras simples.
- Diagrama del proyecto entero: muestra cómo se conectan los archivos/clases principales
  Y qué función concreta hace cada conexión.
- Diagrama de un archivo: muestra las funciones del archivo, qué se llaman entre sí, y
  qué estructuras de datos manejan.

OBJETIVO: que alguien que recibió este código de una IA pueda entender la estructura
sin necesitar conocer el lenguaje a fondo.
`.trim();

export const overviewSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    resumen: {
      type: SchemaType.STRING,
      description: "2-3 líneas explicando QUÉ HACE el proyecto, dando un ejemplo concreto de uso (no metáforas).",
    },
    estructura_general: {
      type: SchemaType.STRING,
      description: "Patrón arquitectónico que se ve en el código. Ej: 'Cliente React + servidor Express con API REST', 'Juego con escenas Godot organizadas por entidad', 'Pipeline de scripts Python en cadena'.",
    },
    diagrama_mermaid: {
      type: SchemaType.STRING,
      description: "Diagrama Mermaid (graph TD o flowchart TD). DEBE incluir las clases/archivos principales como subgraph y dentro mostrar las funciones más importantes y qué llaman entre sí. Flechas siempre etiquetadas con '|texto|'.",
    },
    archivos: {
      type: SchemaType.ARRAY,
      description: "Lista de archivos principales del proyecto (ignora archivos triviales o auto-generados)",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ruta: { type: SchemaType.STRING },
          rol: {
            type: SchemaType.STRING,
            description: "Una línea (max 14 palabras) describiendo qué hace este archivo, idealmente con un ejemplo del propio código.",
          },
          importancia: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["alta", "media", "baja"],
            description: "Qué tan central es este archivo para entender el proyecto",
          },
        },
        required: ["ruta", "rol", "importancia"],
      },
    },
    recapitulacion: {
      type: SchemaType.ARRAY,
      description: "3-5 puntos clave que el usuario debe llevarse del análisis. Frases cortas, sin jerga, con ejemplos del proyecto cuando ayude. Aquí va el 'si solo recuerdas tres cosas, recuerda esto'.",
      items: { type: SchemaType.STRING },
    },
  },
  required: ["resumen", "estructura_general", "diagrama_mermaid", "archivos", "recapitulacion"],
};

export const fileMapSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    explicacion: {
      type: SchemaType.STRING,
      description: "Explicación del archivo CON UN EJEMPLO CONCRETO del propio código. NO metáforas tipo 'es como X'. Estructura ideal: '[archivo] hace [qué]. Por ejemplo, cuando [evento del proyecto], [archivo] [acción concreta]'. 2-4 líneas.",
    },
    estructura: {
      type: SchemaType.STRING,
      description: "Estructura/patrón principal usado en este archivo. Ej: 'Clase con array dinámico de items', 'Resource singleton con diccionario de configs', 'Componente React con varios useState', 'Función pura que recibe X y devuelve Y'.",
    },
    diagrama_mermaid: {
      type: SchemaType.STRING,
      description: "Diagrama Mermaid del flujo interno. DEBE mostrar las funciones del archivo como nodos, las llamadas entre ellas como flechas etiquetadas, y las estructuras de datos relevantes (arrays, mapas, etc.) como nodos auxiliares.",
    },
    funciones: {
      type: SchemaType.ARRAY,
      description: "Funciones o métodos importantes del archivo, traducidos a lenguaje humano con ejemplos concretos.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          real: {
            type: SchemaType.STRING,
            description: "Nombre real de la función tal cual aparece en el código",
          },
          humana: {
            type: SchemaType.STRING,
            description: "Qué hace y CUÁNDO se usa, con un mini-ejemplo si ayuda. Máximo 18 palabras.",
          },
          llama_a: {
            type: SchemaType.ARRAY,
            description: "Otras funciones (de este archivo o de otros) que esta función invoca directamente. Vacío si no llama a nada.",
            items: { type: SchemaType.STRING },
          },
        },
        required: ["real", "humana", "llama_a"],
      },
    },
    puntos_clave: {
      type: SchemaType.ARRAY,
      description: "2-4 ideas que vale la pena recordar de este archivo",
      items: { type: SchemaType.STRING },
    },
    resumen_archivo: {
      type: SchemaType.STRING,
      description: "Una sola frase final que recapitule lo que se acaba de explicar. Algo como 'En resumen: este archivo X y se usa cuando Y'.",
    },
  },
  required: ["explicacion", "estructura", "diagrama_mermaid", "funciones", "puntos_clave", "resumen_archivo"],
};

export const overviewModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: baseSystemInstruction,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: overviewSchema,
    temperature: 0.4,
  },
});

export const fileMapModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  systemInstruction: baseSystemInstruction,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: fileMapSchema,
    temperature: 0.4,
  },
});

export const streamingOverviewModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: baseSystemInstruction,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: overviewSchema,
    temperature: 0.4,
  },
});
