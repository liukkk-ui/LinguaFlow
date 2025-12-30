// Utilities for handling Raw PCM audio data for Gemini Live API

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Convert Float32 from microphone to Int16 PCM for the API
export function createPcmBlob(data: Float32Array, sampleRate: number = 16000): { data: string; mimeType: string } {
  const l = data.length;
  // Downsample or upsample logic could go here, but we assume input context is already 16k
  // or we just send raw chunks and let the server handle minor discrepancies, 
  // though typically we want to match the target sample rate.
  
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to [-1, 1] before converting
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  return {
    data: arrayBufferToBase64(int16.buffer),
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
}

export function concatenateAudioBuffers(
  buffers: (AudioBuffer | undefined | null)[],
  ctx: AudioContext
): AudioBuffer | undefined {
  const validBuffers = buffers.filter((b): b is AudioBuffer => !!b);
  if (validBuffers.length === 0) return undefined;
  if (validBuffers.length === 1) return validBuffers[0];

  const totalLength = validBuffers.reduce((acc, b) => acc + b.length, 0);
  const result = ctx.createBuffer(
    validBuffers[0].numberOfChannels,
    totalLength,
    validBuffers[0].sampleRate
  );

  for (let channel = 0; channel < result.numberOfChannels; channel++) {
    const resultData = result.getChannelData(channel);
    let offset = 0;
    for (const buffer of validBuffers) {
      if (buffer.numberOfChannels > channel) {
        resultData.set(buffer.getChannelData(channel), offset);
      }
      offset += buffer.length;
    }
  }
  return result;
}
