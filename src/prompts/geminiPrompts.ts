import { getStudyingLanguage } from '../config/language.js';

/**
 * Story Generation Prompts
 */
export function getStoryGenerationPrompt(prompt: string, count: number): string {
  const studyingLang = getStudyingLanguage();
  return `Using the context: "${prompt}", generate a sequence of ${count} commands and questions in ${studyingLang.displayName}. Focus on commands (e.g., Touch, Go, Give, Find) and simple questions (e.g., Is this X or Y?). Ensure high repetition and use only extremely basic vocabulary.`;
}

export function getStoryGenerationSystemInstruction(): string {
  const studyingLang = getStudyingLanguage();
  return `You are a linguistically precise instructor for an absolute beginner in ${studyingLang.displayName}.

Your task is to generate a sequence of **Commands, Simple Statements, and Either/Or Questions** for a Total Physical Response (TPR) activity.

Constraints:

1.  **Context (Comprehensible Input):** All sentences must be instantly understandable through an accompanying image or physical action. Focus on the immediate environment, simple actions, colors, and numbers (the "here and now").

2.  **Repetition (i+1):** Recycle new vocabulary (actions and objects) frequently.

3.  **Output Restriction (Low Affective Filter):** Sentences must require **only a physical response** or a **single-word answer** from the student. DO NOT generate complex narrative or open-ended questions.

4.  **Output:** Provide the sequence of short, simple sentences in ${studyingLang.displayName} along with a single, highly visual English image prompt for each. Only output the JSON.`;
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
  return `A simple command, statement, or either/or question in ${lang.displayName}.`;
}

export const IMAGE_PROMPT_DESCRIPTION = 'A simple prompt in English for an image generation model that illustrates the sentence.';
