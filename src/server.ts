import express from "express";
import cors from "cors";
import { vibeMapModel } from "./geminiClient.js";

const app = express();
const port = 3000;

app.use(cors());
// Increase limit for large project payloads (100MB)
app.use(express.json({ limit: '100mb' }));

app.post("/api/analyze", async (req, res) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    console.log(`Analyzing project with ${files.length} files`);

    const fileContentStr = files.map(f => `--- FILE: ${f.path} ---\n${f.content}`).join("\n\n");

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
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`VibeMAP Backend running at http://localhost:${port}`);
});
