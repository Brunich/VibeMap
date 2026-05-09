import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not set in the environment.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// system_instruction to force visual architect thinking
const systemInstruction = "Eres VibeMAP, un motor de ingeniería inversa visual. Tu misión es recibir código complejo (posiblemente generado por otras IAs) y transformarlo en un mapa mental de ingeniería.";

// We recommend using gemini-2.0-flash for general tasks, or gemini-1.5-pro for complex coding/reasoning.
export const vibeMapModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction: systemInstruction,
});
