import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });

async function test() {
  console.log("Starting test...");
  try {
    const pdfBase64 = fs.readFileSync('sample_script.pdf').toString('base64');
    
    console.log("Sending to Gemini...");
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBase64,
                },
              },
              { text: "Return a JSON array like [{'questionId':'q1', 'questionNumber':'1', 'text':'hello', 'matches':[]}]" },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        }
      });
      console.log("Success! Response:");
      console.log(response.text);
  } catch(e) {
    console.error("ERROR:", e);
  }
}
test();
