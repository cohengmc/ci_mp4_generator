import wavefile from 'wavefile';
const WaveFile = wavefile.WaveFile;

const SAMPLE_RATE = 24000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

export interface AudioBuffer {
  sampleRate: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

/**
 * Decode base64 string to Uint8Array
 */
export function decode(base64: string): Uint8Array {
  const buffer = Buffer.from(base64, 'base64');
  return new Uint8Array(buffer);
}

/**
 * Decode PCM16 data to AudioBuffer-like structure
 */
export function decodeAudioData(
  data: Uint8Array,
  sampleRate: number,
  numChannels: number,
): AudioBuffer {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  
  // Create Float32Array for channel data
  const channelData = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i * numChannels] / 32768.0;
  }

  return {
    sampleRate,
    length: frameCount,
    getChannelData: (channel: number) => {
      if (channel === 0) return channelData;
      // For mono, return same data for all channels
      return channelData;
    }
  };
}

/**
 * Encode a mono AudioBuffer to base64 PCM16
 */
export function encodeAudioBufferToPCMBase64(buffer: AudioBuffer): string {
  const channelData = buffer.getChannelData(0);
  const out = new Int16Array(channelData.length);
  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    out[i] = s < 0 ? s * 32768 : s * 32767;
  }
  const byteView = new Uint8Array(out.buffer);
  return Buffer.from(byteView).toString('base64');
}

/**
 * Split audio by silence using RMS threshold over short frames
 */
export function splitAudioBySilence(
  buffer: AudioBuffer,
  options?: {
    rmsThreshold?: number;
    minSilenceMs?: number;
    frameMs?: number;
    hopMs?: number;
  }
): { startSample: number; endSample: number }[] {
  const sampleRate = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const rmsThreshold = options?.rmsThreshold ?? 0.015;
  const minSilenceMs = options?.minSilenceMs ?? 450;
  const frameMs = options?.frameMs ?? 20;
  const hopMs = options?.hopMs ?? 10;

  const frameSize = Math.max(1, Math.floor(sampleRate * (frameMs / 1000)));
  const hopSize = Math.max(1, Math.floor(sampleRate * (hopMs / 1000)));
  const minSilenceFrames = Math.ceil(minSilenceMs / hopMs);

  const framesRms: number[] = [];
  for (let start = 0; start + frameSize <= data.length; start += hopSize) {
    let sum = 0;
    for (let i = 0; i < frameSize; i++) {
      const v = data[start + i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / frameSize);
    framesRms.push(rms);
  }

  const isSilence = framesRms.map(r => r < rmsThreshold);

  const boundaries: number[] = [];
  let run = 0;
  for (let i = 0; i < isSilence.length; i++) {
    if (isSilence[i]) {
      run++;
      if (run === minSilenceFrames) {
        const frameCenter = i - Math.floor(minSilenceFrames / 2);
        const sample = frameCenter * hopSize;
        boundaries.push(sample);
      }
    } else {
      run = 0;
    }
  }

  const samples: number[] = [0, ...boundaries, data.length];
  const segments: { startSample: number; endSample: number }[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const start = samples[i];
    const end = samples[i + 1];
    if (end - start > sampleRate * 0.2) {
      segments.push({ startSample: start, endSample: end });
    }
  }
  return segments;
}

/**
 * Slice an AudioBuffer range [start,end) into a new AudioBuffer
 */
export function sliceAudioBuffer(buffer: AudioBuffer, startSample: number, endSample: number): AudioBuffer {
  const length = Math.max(0, endSample - startSample);
  const src = buffer.getChannelData(0);
  const dst = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    dst[i] = src[startSample + i] ?? 0;
  }

  return {
    sampleRate: buffer.sampleRate,
    length: length,
    getChannelData: (channel: number) => {
      if (channel === 0) return dst;
      return dst;
    }
  };
}

/**
 * Convert PCM16 base64 to WAV file buffer
 */
export function pcmBase64ToWavBuffer(pcmBase64: string, sampleRate: number = SAMPLE_RATE): Buffer {
  const pcmData = decode(pcmBase64);
  const pcmInt16 = new Int16Array(pcmData.buffer);
  
  const wav = new WaveFile();
  wav.fromScratch(NUM_CHANNELS, sampleRate, '16', pcmInt16);
  return Buffer.from(wav.toBuffer());
}

