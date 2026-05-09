import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
dotenv.config();
async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY not found");
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // The SDK might not have a direct listModels, we might need to use the REST API or check the SDK docs.
        // Actually, the SDK has a listModels method on the GenerativeAI instance? No.
        // We can use the REST endpoint.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    }
    catch (error) {
        console.error("Error listing models:", error);
    }
}
listModels();
//# sourceMappingURL=listModels.js.map