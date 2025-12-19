
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateBriefing = async (shipType: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a grizzled starfighter technician. Give a short (max 2 sentences) gritty briefing for a racer using a ${shipType} class kitbash ship. Focus on the danger and the ship's personality.`,
      config: {
        systemInstruction: "You are a technician in a clandestine underground RC starfighter racing league. Your tone is cynical, mechanical, and slightly rebellious.",
        temperature: 0.8,
      }
    });
    return response.text || "Just keep it in one piece, kid. This junk's expensive.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The comms are jammed. Just fly fast and don't hit the walls.";
  }
};
