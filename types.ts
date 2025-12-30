export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  audioBuffer?: AudioBuffer; // For replaying
  isTranslating?: boolean;
}

export interface VoicePersona {
  id: string;
  name: string;
  description: string;
  voiceName: string; // internal API name (Puck, Kore, etc)
}

export enum AppState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  LISTENING = 'listening',
  ERROR = 'error'
}

export interface AudioVisualizerData {
  volume: number;
}
