import { VoicePersona } from "./types";

export const MODEL_NAME = 'gemini-2.0-flash-exp';

export const VOICE_PERSONAS: VoicePersona[] = [
  { id: '1', name: 'Professional Female', description: 'Clear, warm, standard tone', voiceName: 'Kore' },
  { id: '2', name: 'Deep Male', description: 'Authoritative, calm, steady', voiceName: 'Fenrir' },
  { id: '3', name: 'Casual Male', description: 'Friendly, conversational', voiceName: 'Puck' },
  { id: '4', name: 'Soft Female', description: 'Gentle, soothing', voiceName: 'Charon' },
];

export const SYSTEM_INSTRUCTION = `
You are an expert bilingual interpreter for Chinese (Mandarin) and English. 
Your goal is to provide natural, idiomatic, and culturally appropriate translations in real-time.

Rules:
1. If the input is in English, translate it to spoken, natural Chinese.
2. If the input is in Chinese, translate it to spoken, natural English.
3. Do not answer questions or engage in conversation yourself. ONLY TRANSLATE what is said.
4. Adopt the tone of the speaker (professional, casual, excited).
5. For idioms, find the cultural equivalent rather than translating literally.
6. Keep translations concise.
`;