import { promises as fs } from 'fs';
import { join } from 'path';
import { pcmBase64ToWavBuffer } from './audioUtils.js';
import type { StorySegment } from '../types.js';

/**
 * Download image from URL and save to file system
 */
export async function saveImage(imageUrl: string, filepath: string): Promise<void> {
  try {
    // Handle data URLs (base64 images from Imagen API)
    if (imageUrl.startsWith('data:image')) {
      const base64Data = imageUrl.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(filepath, imageBuffer);
      return;
    }

    // Handle regular URLs (Picsum Photos)
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filepath, buffer);
  } catch (error) {
    console.error(`Error saving image to ${filepath}:`, error);
    throw error;
  }
}

/**
 * Convert PCM base64 to WAV and save to file system
 */
export async function saveAudio(pcmBase64: string, filepath: string, sampleRate: number = 24000): Promise<void> {
  try {
    const wavBuffer = pcmBase64ToWavBuffer(pcmBase64, sampleRate);
    await fs.writeFile(filepath, wavBuffer);
  } catch (error) {
    console.error(`Error saving audio to ${filepath}:`, error);
    throw error;
  }
}

/**
 * Save transcript text file
 */
export async function saveTranscript(segments: StorySegment[], filepath: string, useSpanish: boolean = false): Promise<void> {
  try {
    const lines = segments.map((segment, index) => {
      const sentence = useSpanish ? (segment.spanishSentence ?? '') : segment.targetSentence;
      return `${index + 1}. ${sentence}`;
    }).join('\n\n');
    
    await fs.writeFile(filepath, lines, 'utf-8');
  } catch (error) {
    console.error(`Error saving transcript to ${filepath}:`, error);
    throw error;
  }
}

/**
 * Ensure directory exists, create if it doesn't
 */
export async function ensureDirectory(dirpath: string): Promise<void> {
  try {
    await fs.access(dirpath);
  } catch {
    await fs.mkdir(dirpath, { recursive: true });
  }
}

