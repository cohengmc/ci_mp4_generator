import { getStudyingLanguage } from '../config/language.js';

/**
 * Story Generation Prompts
 */
export function getStoryGenerationPrompt(prompt: string, count: number): string {
  const studyingLang = getStudyingLanguage();
  return `Create a very simple story in ${studyingLang.displayName} for an absolute beginner ${prompt}. The vocabulary and grammar must be extremely basic and repetitive. Generate the first ${count} sentences.`;
}

export function getStoryContinuationPrompt(context: string, count: number): string {
  const studyingLang = getStudyingLanguage();
  return `Continue this simple story for a beginner ${studyingLang.displayName} learner: "${context}". Generate the next ${count} sentences.`;
}

export function getStoryGenerationSystemInstruction(): string {
  const studyingLang = getStudyingLanguage();
  return `You are fluent in ${studyingLang.displayName}. Your task is to create a simple, continuous story in ${studyingLang.displayName} for a child who barely knows any words. Break the story into a sequence of short, simple sentences. For each sentence, provide a concise English description for an image that illustrates it. Only output the JSON.`;
}

/**
 * Image Generation Prompts
 */
export function getImageGenerationPrompt(imagePrompt: string, hasPreviousImage: boolean = false): string {
  const basePrompt = `A vibrant, clear, and simple illustration for a language learning app. Style: friendly, cartoonish, colorful. Content: ${imagePrompt}`;
  
  if (hasPreviousImage) {
    return `${basePrompt} Maintain visual consistency with the previous image: reuse the same characters, objects, and art style. Keep the same character designs, color palette, and illustration style as the reference image.`;
  }
  
  return basePrompt;
}

/**
 * Translation Prompts
 */
export function getTranslationPrompt(sentences: string[]): string {
  const text = sentences.join('\n');
  return `Translate the following sentences to Spanish. Maintain the same simple, beginner-friendly style. Return only the translations, one per line, in the same order:\n\n${text}`;
}

export const TRANSLATION_SYSTEM_INSTRUCTION = 'You are a translation assistant. Translate each sentence to Spanish while maintaining the same simple, beginner-friendly style. Return only the translations, one per line, in the exact same order as the input.';

/**
 * Schema Descriptions
 */
export function getTargetSentenceDescription(): string {
  const lang = getStudyingLanguage();
  return `A very simple sentence in ${lang.displayName}.`;
}

export const IMAGE_PROMPT_DESCRIPTION = 'A simple prompt in English for an image generation model that illustrates the sentence.';
