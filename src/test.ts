import { vibeMapModel } from "./geminiClient.js";

async function runTest() {
  console.log("VibeMAP Testing connection...");
  
  const prompt = "Analiza este fragmento de código y descríbelo como un mapa mental: \n\n function hello() { console.log('world'); }";
  
  try {
    const result = await vibeMapModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("--- VibeMAP Response ---");
    console.log(text);
    console.log("------------------------");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTest();
