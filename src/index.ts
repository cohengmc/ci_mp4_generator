#!/usr/bin/env node

import * as readline from 'readline';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { generateStorySegments, generateNAScriptSegments, generateStoryboard, generateImage, generateAudioBatch, translateToSpanish } from './services/geminiService.js';
import { decode, decodeAudioData, splitAudioBySilence, sliceAudioBuffer, encodeAudioBufferToPCMBase64, adjustAudioSpeed } from './utils/audioUtils.js';
import { saveImage, saveAudio, saveTranscript, saveStructuredScript, saveStoryboardPrompts, ensureDirectory } from './utils/fileUtils.js';
import { createVideos } from './utils/videoUtils.js';
import { getStudyingLanguage } from './config/language.js';
import { buildImagePromptFromVisualCue } from './prompts/geminiPrompts.js';
import type { StorySegment } from './types.js';

// Load environment variables
dotenv.config();

const SENTENCE_BATCH_SIZE = 10;
const SAMPLE_RATE = 24000;
const NUM_CHANNELS = 1;
const OUTPUT_BASE_DIR = '/Users/geoffreycohen/Desktop/language_generated_content';

/**
 * Prompt user for input
 */
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Normalize audio ranges to match sentence count
 */
function normalizeRangesToCount(
  inputRanges: { startSample: number; endSample: number }[],
  count: number,
  sampleRate: number
): { startSample: number; endSample: number }[] {
  let out = [...inputRanges];
  
  // Merge tiny ranges first
  for (let i = 0; i < out.length - 1; ) {
    const dur = (out[i].endSample - out[i].startSample) / sampleRate;
    if (dur < 0.25) {
      out[i].endSample = out[i + 1].endSample;
      out.splice(i + 1, 1);
    } else {
      i++;
    }
  }
  
  // If still more than needed, merge smallest with neighbor
  while (out.length > count && out.length > 1) {
    let minIdx = 0;
    let minDur = Infinity;
    for (let i = 0; i < out.length; i++) {
      const dur = (out[i].endSample - out[i].startSample) / sampleRate;
      if (dur < minDur) { minDur = dur; minIdx = i; }
    }
    if (minIdx < out.length - 1) {
      out[minIdx].endSample = out[minIdx + 1].endSample;
      out.splice(minIdx + 1, 1);
    } else {
      out[minIdx - 1].endSample = out[minIdx].endSample;
      out.splice(minIdx, 1);
    }
  }
  
  // If fewer than needed, split the longest
  while (out.length < count) {
    let maxIdx = 0;
    let maxDur = -1;
    for (let i = 0; i < out.length; i++) {
      const dur = (out[i].endSample - out[i].startSample) / sampleRate;
      if (dur > maxDur) { maxDur = dur; maxIdx = i; }
    }
    const seg = out[maxIdx];
    const mid = Math.floor((seg.startSample + seg.endSample) / 2);
    const left = { startSample: seg.startSample, endSample: mid };
    const right = { startSample: mid, endSample: seg.endSample };
    out.splice(maxIdx, 1, left, right);
  }
  
  return out.slice(0, count);
}

/**
 * Main content generation function
 */
async function generateContent(storyTopic: string, estimatedDuration: string, targetLevel: string, generateSpanish: boolean, audioSpeed: number): Promise<StorySegment[]> {
  console.log(`\n📝 Generating NA Script segments for "${storyTopic}" (${estimatedDuration})...`);
  const segmentsData = await generateNAScriptSegments(storyTopic, estimatedDuration, targetLevel);
  console.log(`✅ Generated ${segmentsData.length} script segments`);

  console.log(`\n🎨 Refining storyboard for visual consistency...`);
  let storyboardPrompts: string[] = [];
  try {
    storyboardPrompts = await generateStoryboard(segmentsData);
    console.log(`✅ Storyboard refined with ${storyboardPrompts.length} prompts`);
  } catch (error) {
    console.warn(`⚠️  Warning: Failed to refine storyboard, falling back to raw visual cues.`, error);
  }

  // Extract transcript segments for TTS
  const transcripts = segmentsData.map(s => s.transcript);
  
  console.log(`\n🎤 Generating audio for target language (${getStudyingLanguage().displayName})...`);
  let batchedAudioBase64 = await generateAudioBatch(transcripts);
  
  // Adjust audio speed if needed
  if (audioSpeed !== 1.0) {
    console.log(`  Adjusting audio speed to ${audioSpeed}x...`);
    batchedAudioBase64 = await adjustAudioSpeed(batchedAudioBase64, audioSpeed, SAMPLE_RATE);
  }
  console.log(`✅ Generated batch audio for target language`);

  // Conditionally generate Spanish content
  let spanishTranscripts: string[] = [];
  let spanishBatchedAudioBase64 = '';
  let spanishAudioClipsBase64: string[] = [];
  let spanishMatchedRanges: { startSample: number; endSample: number }[] = [];

  if (generateSpanish) {
    console.log(`\n🌐 Translating to Spanish...`);
    spanishTranscripts = await translateToSpanish(transcripts);
    console.log(`✅ Translated ${spanishTranscripts.length} segments to Spanish`);

    console.log(`\n🎤 Generating Spanish audio...`);
    spanishBatchedAudioBase64 = await generateAudioBatch(spanishTranscripts, 'Spanish');
    
    // Adjust Spanish audio speed if needed
    if (audioSpeed !== 1.0) {
      console.log(`  Adjusting Spanish audio speed to ${audioSpeed}x...`);
      spanishBatchedAudioBase64 = await adjustAudioSpeed(spanishBatchedAudioBase64, audioSpeed, SAMPLE_RATE);
    }
    console.log(`✅ Generated batch audio for Spanish`);
  }

  console.log(`\n🔊 Processing audio segments...`);
  
  // Decode and split by silence
  const decodedBytes = decode(batchedAudioBase64);
  const audioBuffer = decodeAudioData(decodedBytes, SAMPLE_RATE, NUM_CHANNELS);

  const ranges = splitAudioBySilence(audioBuffer, {
    rmsThreshold: 0.015,
    minSilenceMs: 450,
    frameMs: 20,
    hopMs: 10,
  });

  // Normalize ranges to match segment count
  const matchedRanges = normalizeRangesToCount(ranges, transcripts.length, SAMPLE_RATE);

  // Extract individual audio clips
  const audioClipsBase64: string[] = matchedRanges.map(r => {
    const segBuffer = sliceAudioBuffer(audioBuffer, r.startSample, r.endSample);
    return encodeAudioBufferToPCMBase64(segBuffer);
  });

  // Process Spanish audio if enabled
  if (generateSpanish && spanishBatchedAudioBase64) {
    const spanishDecodedBytes = decode(spanishBatchedAudioBase64);
    const spanishAudioBuffer = decodeAudioData(spanishDecodedBytes, SAMPLE_RATE, NUM_CHANNELS);

    const spanishRanges = splitAudioBySilence(spanishAudioBuffer, {
      rmsThreshold: 0.015,
      minSilenceMs: 450,
      frameMs: 20,
      hopMs: 10,
    });

    spanishMatchedRanges = normalizeRangesToCount(spanishRanges, spanishTranscripts.length, SAMPLE_RATE);

    spanishAudioClipsBase64 = spanishMatchedRanges.map(r => {
      const segBuffer = sliceAudioBuffer(spanishAudioBuffer, r.startSample, r.endSample);
      return encodeAudioBufferToPCMBase64(segBuffer);
    });
  }

  console.log(`✅ Processed ${audioClipsBase64.length} audio segments`);

  // Generate images
  console.log(`\n🖼️  Generating images...`);
  const newSegments: StorySegment[] = [];
  const storyboardNegativeSuffix = ' Negative Prompt: text, words, translation, subtitles, font, letters, handwriting, captions.';
  for (let i = 0; i < segmentsData.length; i++) {
    const segment = segmentsData[i];
    console.log(`  Generating image ${i + 1}/${segmentsData.length}...`);
    
    const previousImage = i > 0 ? newSegments[i - 1].imageUrl : undefined;
    
    const storyboardPrompt = storyboardPrompts[i];
    let imagePrompt: string;
    if (storyboardPrompt) {
      imagePrompt = `${storyboardPrompt}${storyboardNegativeSuffix}`;
    } else {
      imagePrompt = buildImagePromptFromVisualCue(segment.visual_cue, !!previousImage);
    }

    const imageUrl = await generateImage(imagePrompt, previousImage);
    
    newSegments.push({
      id: randomUUID(),
      targetSentence: segment.transcript, // Use transcript as targetSentence for compatibility
      imagePrompt: imagePrompt,
      imageUrl,
      audioBase64: audioClipsBase64[i] ?? '',
      spanishSentence: generateSpanish ? (spanishTranscripts[i] ?? undefined) : undefined,
      spanishAudioBase64: generateSpanish ? (spanishAudioClipsBase64[i] ?? undefined) : undefined,
      // Add NA Script fields
      time: segment.time,
      transcript: segment.transcript,
      visualCue: segment.visual_cue,
      naPrinciple: segment.na_principle,
      storyboardPrompt: storyboardPrompt ?? undefined,
    });
  }
  console.log(`✅ Generated ${newSegments.length} images`);

  return newSegments;
}

/**
 * Save all files to output directory
 */
async function saveFiles(segments: StorySegment[], outputDir: string, generateSpanish: boolean): Promise<void> {
  console.log(`\n💾 Saving files to ${outputDir}...`);
  
  await ensureDirectory(outputDir);

  // Save images
  for (let i = 0; i < segments.length; i++) {
    const imagePath = join(outputDir, `image_${i + 1}.png`);
    console.log(`  Saving image_${i + 1}.png...`);
    await saveImage(segments[i].imageUrl, imagePath);
  }

  // Save target language audio
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].audioBase64) {
      const audioPath = join(outputDir, `audio_${i + 1}.wav`);
      console.log(`  Saving audio_${i + 1}.wav...`);
      await saveAudio(segments[i].audioBase64, audioPath, SAMPLE_RATE);
    }
  }

  // Save Spanish audio (only if enabled)
  if (generateSpanish) {
    for (let i = 0; i < segments.length; i++) {
      const spanishAudio = segments[i].spanishAudioBase64;
      if (spanishAudio) {
        const audioPath = join(outputDir, `audio_${i + 1}_es.wav`);
        console.log(`  Saving audio_${i + 1}_es.wav...`);
        await saveAudio(spanishAudio, audioPath, SAMPLE_RATE);
      }
    }
  }

  // Save transcripts
  const transcriptPath = join(outputDir, 'transcripts.txt');
  console.log(`  Saving transcripts.txt...`);
  await saveTranscript(segments, transcriptPath, false);

  // Save Spanish transcript (only if enabled)
  if (generateSpanish) {
    const spanishTranscriptPath = join(outputDir, 'transcripts_es.txt');
    console.log(`  Saving transcripts_es.txt...`);
    await saveTranscript(segments, spanishTranscriptPath, true);
  }

  // Save structured NA script output
  const structuredScriptPath = join(outputDir, 'na_script_structure.md');
  console.log(`  Saving na_script_structure.md...`);
  await saveStructuredScript(segments, structuredScriptPath);

  const storyboardPath = join(outputDir, 'storyboard_prompts.txt');
  console.log(`  Saving storyboard_prompts.txt...`);
  await saveStoryboardPrompts(segments, storyboardPath);

  console.log(`✅ All files saved successfully!`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🎬 Terminal Content Generator');
    console.log('============================\n');

    // Check API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ Error: GEMINI_API_KEY environment variable not set');
      console.error('   Please create a .env file with your API key');
      process.exit(1);
    }

    const language = getStudyingLanguage();
    const generateSpanish = process.env.GENERATE_SPANISH === 'true';
    
    // Get audio speed from environment (default to 1.0 if not set)
    let audioSpeed = process.env.AUDIO_SPEED ? parseFloat(process.env.AUDIO_SPEED) : 1.0;
    if (isNaN(audioSpeed) || audioSpeed < 0.5 || audioSpeed > 2.0) {
      console.warn(`⚠️  Warning: Invalid AUDIO_SPEED value (must be between 0.5 and 2.0), using default 1.0`);
      audioSpeed = 1.0;
    }
    
    // Get pause gap duration from environment (default to 0 if not set)
    let pauseGapDuration = process.env.PAUSE_GAP_DURATION ? parseFloat(process.env.PAUSE_GAP_DURATION) : 0;
    if (isNaN(pauseGapDuration) || pauseGapDuration < 0) {
      console.warn(`⚠️  Warning: Invalid PAUSE_GAP_DURATION value, using default 0`);
      pauseGapDuration = 0;
    }
    
    console.log(`📚 Target Language: ${language.displayName}`);
    console.log(`🖼️  Image Generation: ${process.env.GENERATE_IMAGES === 'true' ? 'Enabled (Imagen API)' : 'Disabled (Picsum Photos)'}`);
    console.log(`🌐 Spanish Generation: ${generateSpanish ? 'Enabled' : 'Disabled'}`);
    console.log(`🎵 Audio Speed: ${audioSpeed}`);
    console.log(`⏸️  Pause Gap Duration: ${pauseGapDuration}s`);
    console.log();

    // Prompt for Story/Topic
    const storyTopic = await promptUser('Enter Story/Topic: ');
    if (!storyTopic) {
      console.error('❌ Error: Story/Topic cannot be empty');
      process.exit(1);
    }

    // Prompt for Estimated Duration
    const estimatedDuration = await promptUser('Estimated Duration (e.g., 5:00 or 0:30): ');
    if (!estimatedDuration) {
      console.error('❌ Error: Estimated Duration cannot be empty');
      process.exit(1);
    }

    // Hard code Target Level
    const targetLevel = 'A1/Beginner';

    // Generate content
    const segments = await generateContent(storyTopic, estimatedDuration, targetLevel, generateSpanish, audioSpeed);

    // Create output directory with timestamp (YYYYMMDD_HHMMSS format)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    const outputDir = join(OUTPUT_BASE_DIR, timestamp);

    // Save files
    await saveFiles(segments, outputDir, generateSpanish);

    console.log(`\n✅ Complete! Files saved to: ${outputDir}\n`);

    // Create videos from the generated content
    await createVideos(outputDir, language.displayName, generateSpanish);
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run main function
main();

