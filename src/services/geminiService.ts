import { GoogleGenAI, Type } from "@google/genai";
import { CallAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeCallAudio(base64Audio: string, mimeType: string, fileName?: string): Promise<CallAnalysis> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType,
            },
          },
          {
            text: `You are an expert sales and support call auditor. Analyze the provided audio recording of a call.
          
  Extract and evaluate the following information:
  1. Agent's Name
  2. Agent's Employee Code (Get the Agent EMP CODE in the file starting with IN followed by numbers. Extract exactly what was said).
  3. Call Disposition. Choose exactly one from this list: CALLBK, CC, CNP, NI, DNC, DNQ, SALE. If unsure, pick the closest one or UNKNOWN.
  4. What went wrong in the call (areas of failure, missed opportunities, mistakes).
  5. What could have been done better (actionable feedback for the agent).
  6. Detailed analysis of specific skills:
     - Pitch: How was the delivery, tone, and clarity of the value proposition?
     - Attitude: Was the agent professional, empathetic, enthusiastic, or rude/bored?
     - Need Creating: Did the agent successfully build a need for the product/service?
     - Discovery Questions: Did the agent ask good open-ended questions to understand the prospect?
     - Qualifying Questions: Did the agent properly qualify the prospect (budget, authority, need, timeline)?
  7. Tone Analysis: Deeply analyze the agent's vocal tone, energy, empathy, and pacing. Provide specific coaching feedback based on their tone.
  8. Overall Score: A number from 0 to 100 representing the overall quality of the call.
  9. Summary: A brief 2-3 sentence summary of the entire interaction.
  10. Transcript: Provide a full conversation flow (transcript) distinguishing between the Agent and the Customer.
  
  Be objective, deep, and highly analytical. Provide constructive criticism.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            agentName: { type: Type.STRING, description: "The name of the agent." },
            employeeCode: { type: Type.STRING, description: "The agent's employee code, starting with IN followed by numbers." },
            disposition: { 
              type: Type.STRING, 
              enum: ["CALLBK", "CC", "CNP", "NI", "DNC", "DNQ", "SALE", "UNKNOWN"],
              description: "The final disposition of the call."
            },
            whatWentWrong: { type: Type.STRING, description: "Detailed explanation of what went wrong." },
            whatCouldHaveBeenDone: { type: Type.STRING, description: "Actionable advice on what could have been improved." },
            analysis: {
              type: Type.OBJECT,
              properties: {
                pitch: { type: Type.STRING },
                attitude: { type: Type.STRING },
                needCreating: { type: Type.STRING },
                discoveryQuestions: { type: Type.STRING },
                qualifyingQuestions: { type: Type.STRING }
              },
              required: ["pitch", "attitude", "needCreating", "discoveryQuestions", "qualifyingQuestions"]
            },
            toneAnalysis: {
              type: Type.OBJECT,
              properties: {
                overallTone: { type: Type.STRING, description: "Overall description of the agent's tone (e.g., 'Professional but rushed', 'Empathetic and calm')." },
                energyLevel: { type: Type.STRING, description: "The agent's energy level (e.g., 'High', 'Medium', 'Low')." },
                empathyScore: { type: Type.NUMBER, description: "Score from 0 to 100 representing how empathetic the agent sounded." },
                pacing: { type: Type.STRING, description: "The speed and pacing of the agent's speech (e.g., 'Too fast', 'Appropriate', 'Too slow')." },
                coachingFeedback: { type: Type.STRING, description: "Specific, actionable coaching feedback focused entirely on improving the agent's tone." }
              },
              required: ["overallTone", "energyLevel", "empathyScore", "pacing", "coachingFeedback"]
            },
            overallScore: { type: Type.NUMBER, description: "Score from 0 to 100." },
            summary: { type: Type.STRING, description: "Brief summary of the call." },
            transcript: {
              type: Type.ARRAY,
              description: "The conversation flow distinguishing between Agent and Customer.",
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING, description: "Either 'Agent' or 'Customer'" },
                  text: { type: Type.STRING, description: "What the speaker said" }
                },
                required: ["speaker", "text"]
              }
            }
          },
          required: ["agentName", "employeeCode", "disposition", "whatWentWrong", "whatCouldHaveBeenDone", "analysis", "toneAnalysis", "overallScore", "summary", "transcript"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    const parsed = JSON.parse(text) as Omit<CallAnalysis, 'employeeCodeValid' | 'employeeCodeFeedback' | 'dispositionFeedback'>;
    
    // Extract from filename if available
    let extractedCodeFromFilename = "";
    if (fileName) {
      const match = fileName.match(/IN\d+/i);
      if (match) {
        extractedCodeFromFilename = match[0].toUpperCase();
      }
    }

    // Strict Employee Code Validation
    const empCodeRegex = /^IN\d+$/;
    let employeeCodeValid = false;
    let employeeCodeFeedback = "";
    
    const code = extractedCodeFromFilename || (parsed.employeeCode ? parsed.employeeCode.trim().toUpperCase() : "");

    if (extractedCodeFromFilename) {
      employeeCodeValid = true;
      employeeCodeFeedback = `Extracted from filename: ${code}`;
    } else if (!code) {
      employeeCodeValid = false;
      employeeCodeFeedback = "No employee code detected in the call or filename.";
    } else if (!empCodeRegex.test(code)) {
      employeeCodeValid = false;
      employeeCodeFeedback = `Invalid format: '${code}'. Must start with 'IN' followed by numbers.`;
    } else {
      employeeCodeValid = true;
      employeeCodeFeedback = "Valid employee code format.";
    }

    // Strict Disposition Validation
    const validDispositions = ['CALLBK', 'CC', 'CNP', 'NI', 'DNC', 'DNQ', 'SALE'];
    let finalDisposition = parsed.disposition;
    let dispositionFeedback = "Valid disposition.";

    if (!validDispositions.includes(finalDisposition) || finalDisposition === 'UNKNOWN') {
      dispositionFeedback = `Original disposition was '${finalDisposition || 'missing'}'. Defaulted to 'NI' due to unrecognized or UNKNOWN status.`;
      finalDisposition = 'NI';
    }

    return {
      ...parsed,
      employeeCode: code,
      employeeCodeValid,
      employeeCodeFeedback,
      disposition: finalDisposition,
      dispositionFeedback
    } as CallAnalysis;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Check if it's a quota/rate limit error (429)
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('quota')) {
      throw new Error("You have exceeded the AI processing quota. Please wait a few minutes and try again, or try uploading a shorter audio clip.");
    }
    
    // Re-throw other errors
    throw error;
  }
}
