import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { vibeMapModel } from "./geminiClient.js";

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

const analyzeLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '10mb' }));

app.post("/api/analyze", analyzeLimit, async (req, res) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    if (files.length > 500) {
      return res.status(400).json({ error: "Too many files (max 500)" });
    }

    const validFiles = files.filter(
      (f: any) => typeof f.path === "string" && typeof f.content === "string"
    );

    if (validFiles.length === 0) {
      return res.status(400).json({ error: "No valid files provided" });
    }

    console.log(`Analyzing project with ${validFiles.length} files`);

    const fileContentStr = validFiles
      .map((f: any) => `--- FILE: ${f.path.replace(/[\r\n]/g, "")} ---\n${f.content}`)
      .join("\n\n");

    const prompt = `
Has recibido un proyecto completo. Tu misión es realizar una ingeniería inversa exhaustiva y visual.

REQUISITOS DE SALIDA:
1. **Arquitectura General**: Comienza con un diagrama de flujo o arquitectura general del proyecto completo usando bloques de código MERMAID (usando \`graph TD\` o \`subgraph\`).
2. **Desglose por Módulos/Archivos**: Para cada archivo o componente principal, proporciona:
   - Una explicación breve y técnica.
   - Un diagrama de secuencia o de flujo LOCAL (específico para ese archivo) usando MERMAID.
3. **Estilo**: El tono debe ser de arquitecto senior. Los diagramas deben ser claros y fáciles de entender.

CONTENIDO DEL PROYECTO:
${fileContentStr}
`;

    const result = await vibeMapModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ result: text });
  } catch (error: any) {
    console.error("Analysis failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`VibeMAP Backend running at http://localhost:${port}`);
});
