// Data URI for a short silent WAV. Playing it inside a user gesture "unlocks"
// an <audio> element so a later async play() (e.g. after TTS synthesis, outside
// the user-activation window) is not rejected by the browser autoplay policy.
// Built once, lazily, in the browser (btoa) — never call during SSR.
let cached: string | null = null;

export function silentWavDataUri(): string {
  if (cached !== null) {
    return cached;
  }

  const samples = 960; // 120 ms @ 8 kHz, 8-bit mono
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      bytes[offset + i] = text.charCodeAt(i);
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true); // 8-bit
  writeAscii(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit silence

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  cached = `data:audio/wav;base64,${btoa(binary)}`;
  return cached;
}
