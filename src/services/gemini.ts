import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getChatResponse(
  messages: Message[],
  targetLanguage: string,
  userLevel: string = 'beginner'
) {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are a friendly and supportive language tutor named "Lin". 
Your goal is to help the user practice their ${targetLanguage} through conversation. 
The user's level is ${userLevel}.

Guidelines:
1. Speak primarily in ${targetLanguage}, but occasionally include English translations or explanations in brackets [like this] if the user is a beginner or looks confused.
2. If the user makes a mistake, gently correct them but keep the conversation flowing.
3. Ask open-ended questions to keep the user talking.
4. Be encouraging and use emojis occasionally to feel more approachable.
5. Keep your responses relatively short (2-3 sentences) so the conversation feels natural and fast.

Current conversation history:
${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      })),
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm sorry, I encountered an error. Could you try saying that again?";
  }
}
