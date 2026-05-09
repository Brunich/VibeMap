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
    BIEN: "Inventory guarda los objetos del jugador. Cuando el jugador recoge una Pokeball,
           se llama inventory.add_item(pokeball) y queda en items[] hasta que use(id)
           la elimina y dispara su acción."
- Nunca expliques sintaxis del lenguaje. Explica QUÉ HACE y POR QUÉ existe.
- Si no estás seguro de algo, dilo. Nunca inventes conexiones que no veas en el código.

REGLA MAESTRA: TODO TIENE QUE ESTAR EN ORDEN
El usuario quiere entender cómo funciona el código PASO A PASO, no solo qué se conecta
con qué. Cada explicación, lista y diagrama tiene que respetar el orden REAL de
ejecución: qué pasa primero, qué pasa después, qué llama a qué y cuándo.

REGLAS ESTRICTAS DE MERMAID:

1) DIAGRAMA DEL PROYECTO ENTERO (overview) — usa 'flowchart TD' con subgraphs:
   - Agrupa funciones por archivo/clase con subgraph.
   - Conecta funciones entre archivos con flechas etiquetadas con la operación real.
   - Identifica estructuras de datos (items: Array de Item, cache: Map de String, etc.).
   Ejemplo válido:
     flowchart TD
       subgraph Player
         P_ready[ready]
         P_use[use_item]
       end
       subgraph Inventory
         I_items[items: Array de Item]
         I_add[add_item]
         I_use[use]
       end
       P_ready -->|llama a| I_add
       I_add -->|append a| I_items
       P_use -->|llama a| I_use

2) DIAGRAMA DE UN ARCHIVO INDIVIDUAL — usa 'sequenceDiagram' (orden temporal):
   - Cada participant es una clase, módulo u objeto involucrado.
   - Las flechas '->>' son llamadas. Las '-->>' son retornos.
   - Cada línea va EN ORDEN cronológico (de arriba a abajo = de primero a último).
   - Etiqueta cada flecha con la llamada concreta y argumentos: 'add_item(pokeball)'.
   - Usa 'Note over X: ...' para clarificar pasos.
   Ejemplo válido:
     sequenceDiagram
       participant Player
       participant Inventory
       participant Pokeball
       Note over Player: al iniciar la escena
       Player->>Pokeball: new()
       Player->>Inventory: add_item(pokeball)
       Inventory->>Inventory: items.append(pokeball)
       Note over Player: cuando el usuario presiona usar
       Player->>Inventory: use(0)
       Inventory->>Pokeball: apply()
       Pokeball-->>Inventory: print(\"lanzaste pokeball\")

REGLAS COMUNES DE MERMAID:
- IDs sin espacios (P_ready, I_add). Texto en español va entre [].
- Sin caracteres '(', ')', '/', '#' dentro de los corchetes [] del flowchart.
  En sequenceDiagram el texto después de ':' SÍ admite paréntesis para argumentos.
- Para flechas con etiqueta en flowchart usa SIEMPRE '|texto|'. NUNCA ': texto'.

OBJETIVO: que alguien que recibió este código de una IA pueda entender, paso a paso,
qué hace y en qué orden.
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
      description: "Patrón arquitectónico real que se ve en el código. Ej: 'Cliente React + servidor Express con API REST', 'Juego con escenas Godot organizadas por entidad', 'Pipeline de scripts Python en cadena'.",
    },
    diagrama_mermaid: {
      type: SchemaType.STRING,
      description: "Diagrama Mermaid 'flowchart TD' con subgraphs por archivo/clase. Dentro de cada subgraph lista las 2-4 funciones más importantes y las estructuras de datos relevantes. Conecta funciones entre archivos con flechas etiquetadas con '|texto|'.",
    },
    flujo_principal: {
      type: SchemaType.ARRAY,
      description: "Pasos numerados del flujo principal de ejecución del proyecto, en ORDEN cronológico. Describe qué pasa primero, segundo, etc. Cubre el caso de uso típico de principio a fin.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          paso: {
            type: SchemaType.INTEGER,
            description: "Número del paso, empezando en 1.",
          },
          accion: {
            type: SchemaType.STRING,
            description: "Qué pasa en este paso, en una frase clara con la función o archivo concreto involucrado. Ej: 'Player._ready() crea una Pokeball y se la pasa a inventory.add_item().'",
          },
          archivos: {
            type: SchemaType.ARRAY,
            description: "Rutas de los archivos involucrados en este paso (1-3 normalmente).",
            items: { type: SchemaType.STRING },
          },
        },
        required: ["paso", "accion", "archivos"],
      },
    },
    archivos: {
      type: SchemaType.ARRAY,
      description: "Lista de archivos principales del proyecto, ordenada por importancia (más importante primero). Ignora archivos triviales o auto-generados.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ruta: { type: SchemaType.STRING },
          rol: {
            type: SchemaType.STRING,
            description: "Una línea (max 14 palabras) describiendo qué hace este archivo, mencionando al menos una función concreta cuando ayude.",
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
      description: "3-5 puntos clave que el usuario debe llevarse del análisis. Frases cortas, sin jerga.",
      items: { type: SchemaType.STRING },
    },
  },
  required: ["resumen", "estructura_general", "diagrama_mermaid", "flujo_principal", "archivos", "recapitulacion"],
};

export const fileMapSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    explicacion: {
      type: SchemaType.STRING,
      description: "Explicación del archivo CON UN EJEMPLO CONCRETO del propio código. NO metáforas tipo 'es como X'. Estructura: '[archivo] hace [qué]. Cuando [evento concreto del proyecto], [acción concreta con función/variable real].' 2-4 líneas.",
    },
    estructura: {
      type: SchemaType.STRING,
      description: "Estructura/patrón principal usado. Ej: 'Clase Godot con Array de Item', 'Componente React con dos useState', 'Función pura que recibe Player y devuelve Bool', 'Singleton de Resource con dict de configs'.",
    },
    diagrama_mermaid: {
      type: SchemaType.STRING,
      description: "Diagrama Mermaid 'sequenceDiagram' (orden temporal de arriba a abajo). Muestra los participants involucrados (Player, Inventory, etc.), las llamadas con sus argumentos reales, y los retornos. Usa 'Note over X: ...' para clarificar fases. CRÍTICO: respeta el orden cronológico real del código.",
    },
    flujo_ejecucion: {
      type: SchemaType.ARRAY,
      description: "Pasos numerados de lo que hace el archivo, en ORDEN cronológico. Cada paso una línea corta describiendo QUÉ pasa y CUÁL función lo hace. Ej: '1. _ready() se ejecuta al cargar la escena.' '2. Crea una Pokeball nueva con Pokeball.new().' '3. Llama a inventory.add_item(pokeball) para guardarla.'",
      items: { type: SchemaType.STRING },
    },
    funciones_definidas: {
      type: SchemaType.ARRAY,
      description: "Funciones que ESTE archivo declara. Para cada una: nombre real, qué hace + cuándo, qué otras funciones invoca.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          real: {
            type: SchemaType.STRING,
            description: "Nombre real exacto, tal cual está en el código.",
          },
          humana: {
            type: SchemaType.STRING,
            description: "Qué hace + cuándo se ejecuta + un mini-ejemplo si ayuda. Máximo 22 palabras.",
          },
          llama_a: {
            type: SchemaType.ARRAY,
            description: "Otras funciones (de este archivo o de fuera) que esta función invoca. Vacío si no llama a nada.",
            items: { type: SchemaType.STRING },
          },
        },
        required: ["real", "humana", "llama_a"],
      },
    },
    funciones_usadas: {
      type: SchemaType.ARRAY,
      description: "Funciones EXTERNAS que este archivo usa pero NO define (vienen de imports, librerías, otros archivos del proyecto, o métodos heredados). Para cada una: nombre, dónde vive, y CÓMO se usa aquí (con ejemplo de la llamada real).",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: {
            type: SchemaType.STRING,
            description: "Nombre de la función o método. Si es método de objeto, usa 'objeto.metodo' (ej: 'inventory.add_item').",
          },
          donde: {
            type: SchemaType.STRING,
            description: "De dónde viene. Ej: 'Inventory.gd', 'librería express', 'método heredado de CharacterBody2D'.",
          },
          como: {
            type: SchemaType.STRING,
            description: "Cómo se usa en este archivo, con la llamada concreta. Ej: 'inventory.add_item(Pokeball.new()) dentro de _ready() para añadir el objeto inicial'. Máximo 25 palabras.",
          },
        },
        required: ["nombre", "donde", "como"],
      },
    },
    puntos_clave: {
      type: SchemaType.ARRAY,
      description: "2-4 ideas específicas que vale la pena recordar de este archivo.",
      items: { type: SchemaType.STRING },
    },
    resumen_archivo: {
      type: SchemaType.STRING,
      description: "Una sola frase final que recapitule lo explicado. Ej: 'En resumen: Player coordina el inventario y reacciona al usuario, delegando la lógica de objetos a Inventory.'",
    },
  },
  required: [
    "explicacion",
    "estructura",
    "diagrama_mermaid",
    "flujo_ejecucion",
    "funciones_definidas",
    "funciones_usadas",
    "puntos_clave",
    "resumen_archivo",
  ],
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
