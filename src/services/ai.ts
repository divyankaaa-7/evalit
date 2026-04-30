import { GoogleGenAI } from "@google/genai";
import { AnswerKeySection, SegmentedAnswer } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

export const aiService = {
  processAnswerSheet: async (
    pdfBase64: string,
    answerKey: AnswerKeySection[]
  ): Promise<SegmentedAnswer[]> => {
    const model = "gemini-3-flash-preview";
    
    // Clean base64 (remove data:application/pdf;base64,)
    const base64Data = pdfBase64.split(',')[1] || pdfBase64;

      const prompt = `
      You are an expert academic evaluator. You are given a handwritten student answer sheet as a PDF.
      
      TASK:
      1. Digitize the handwritten text from the PDF precisely.
      2. Identify diagrams and describe them briefly in brackets like [Diagram: Description].
      3. Segment the digitized text strictly into question numbers. 
         - If an ANSWER KEY is provided below, use its question numbers.
         - If the ANSWER KEY is empty ([]), automatically detect the question numbers written by the student (e.g., Q1, Ans 2, 3(a)) and segment the text accordingly.
      4. For each question:
         - Provide the digitized text for that specific answer.
         - If an ANSWER KEY is provided, compare the student's answer against it and determine if the points were mentioned.
      
      ANSWER KEY:
      ${JSON.stringify(answerKey, null, 2)}
      
      OUTPUT FORMAT:
      Return a JSON array of SegmentedAnswer objects. Use regex-like precision to ensure that text belonging to one question does not bleed into another.
      interface SegmentedAnswer {
        questionId: string;
        questionNumber: string;
        text: string;
        matches: {
          point: string;
          found: boolean;
        }[];
      }

      Important: ONLY return the JSON array. Do not include markdown formatting or explanations.
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      let responseText = response.text || "[]";
      // Strip markdown code blocks if the AI added them
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/```\n?/, '').replace(/\n?```$/, '');
      }
      
      const result = JSON.parse(responseText.trim() || "[]");
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error("AI Error:", error);
      throw error;
    }
  },
};
