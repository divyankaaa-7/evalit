import { GoogleGenAI } from "@google/genai";
import { AnswerKeySection, SegmentedAnswer } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

export const aiService = {
  extractAnswerKey: async (pdfBase64: string): Promise<{ sections: AnswerKeySection[], totalMaxMarks: number }> => {
    const model = "gemini-3-flash-preview";
    const base64Data = pdfBase64.split(',')[1] || pdfBase64;
    
    const prompt = `
      You are an expert academic assistant. You are given a document (PDF) which is an answer key.
      
      TASK:
      1. Extract all questions and their corresponding expected answer points.
      2. Identify the question number (e.g. Q1, Q2, 1, 2, etc.).
      3. Extract the points for each question.
      4. Determine the maximum marks for the question (default to 5 if not found).
      
      5. Find the total maximum marks for the entire exam (e.g., "Max Marks: 50").
      6. Determine the main question number for grouping. For example, if questionNumber is "1a" or "1.A", mainQuestionNumber is "1". If "Q2(i)", it is "2".
      
      OUTPUT FORMAT:
      Return a JSON object:
      {
        "totalMaxMarks": 50,
        "sections": [
          {
            "id": "random_string",
            "questionNumber": "1a",
            "mainQuestionNumber": "1",
            "points": ["point 1", "point 2"],
            "maxMarks": 5
          }
        ]
      }

      Important: ONLY return the JSON object. Do not include markdown formatting or explanations.
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

      const result = JSON.parse(response.text || "{}");
      const sections = (result.sections || []).map((r: any) => ({
        ...r,
        id: r.id || Math.random().toString(36).substr(2, 9)
      }));
      return { sections, totalMaxMarks: result.totalMaxMarks || 100 };
    } catch (error) {
      console.error("AI Error:", error);
      throw error;
    }
  },

  processAnswerSheet: async (
    pdfBase64: string,
    answerKey: AnswerKeySection[]
  ): Promise<SegmentedAnswer[]> => {
    const model = "gemini-3-flash-preview";
    
    // Clean base64 (remove data:application/pdf;base64,)
    const base64Data = pdfBase64.split(',')[1] || pdfBase64;

    const prompt = `
      You are an expert academic evaluator. You are given a handwritten student answer sheet as a PDF and a detailed answer key.
      
      TASK:
      1. Digitize the handwritten text from the PDF precisely.
      2. Identify diagrams and describe them briefly in brackets like [Diagram: Description].
      3. Segment the digitized text strictly into question numbers defined in the Answer Key.
      4. Format the digitized text nicely using Markdown (e.g. paragraphs, bullet points).
      5. CRITICAL: For any programming code, strictly use Markdown code blocks (e.g. \`\`\`python) and PRESERVE exact indentation from the handwritten text, as this is vital for languages like Python.
      6. For each question:
         - Provide the digitized text (with markdown formatting) for that specific answer.
         - Compare the student's answer against the "points" provided in the Answer Key.
         - For each point in the Answer Key, determine if the student mentioned it (found: true/false).
      
      ANSWER KEY:
      ${JSON.stringify(answerKey, null, 2)}
      
      OUTPUT FORMAT:
      Return a JSON array of SegmentedAnswer objects:
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

      const result = JSON.parse(response.text || "[]");
      return result;
    } catch (error) {
      console.error("AI Error:", error);
      throw error;
    }
  },
};
