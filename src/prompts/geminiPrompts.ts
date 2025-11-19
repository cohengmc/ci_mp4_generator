import { getStudyingLanguage } from '../config/language.js';

/**
 * Natural Approach Script Engineering Prompts
 */
export function getNAScriptEngineeringPrompt(storyTopic: string, estimatedDuration: string, targetLevel: string): string {
  const studyingLang = getStudyingLanguage();
  return `You are a Natural Approach (NA) Script Engineer. Your task is to take a simple story concept and an estimated total video run time and break it down into a granular, four-column structured output.

**Input Parameters:**
- **Story/Topic:** ${storyTopic}
- **Target Level:** ${targetLevel}
- **Estimated Duration:** ${estimatedDuration}
- **Target Language:** ${studyingLang.displayName}

**Goal:** Generate a production script blueprint that maximizes Comprehensible Input (CI) and maintains a Low Affective Filter.

**Column 1: Time**
- Start at [0:00] and increment by a few seconds (e.g., 0:01, 0:03, 0:06, 0:09, etc.). Timestamps are placeholders for video production pacing.

**Column 2: Transcript Segment (Simplified Speech)**
- Break the story into extremely small, digestible spoken chunks (max 5-7 words, often less). Each chunk must represent a single, focused idea, mimicking the slow, deliberate rhythm of Foreigner Talk.
- Use only ${targetLevel} vocabulary.
- Actively build repetition and paraphrasing into the narrative flow to create the "Roughly-Tuned Net" effect.

**Column 3: Visual/Action Cues (CI Strategy)**
- For every single Transcript Segment, describe a necessary non-linguistic cue. This cue MUST be a direct visual translation of the spoken words. **IMPORTANT: The visual cue must be solely descriptive and must never include the actual ${studyingLang.displayName} sentence or an English translation.**
- Use one of these terms:
  - Drawing: (For nouns, settings, abstract concepts)
  - Mime/Gesture: (For verbs and emotions: eat, fear, walk)
  - Prop: (For real-world objects the narrator can hold)
  - Pointing: (To indicate a location or element in a drawing)

**Column 4: NA Principle Applied**
- For each line, identify the primary pedagogical goal being met. Use one of these specific terms:
  - Maximize CI (Context): Justifies the use of drawings/props/pointing
  - Maximize CI (Redundancy): Justifies sentence repetition/paraphrasing
  - Minimize Affective Filter: Justifies using simple language or a non-threatening tone
  - Foreigner Talk/Chunking: Justifies the slow pace and high granularity of the spoken segment

Output the structured JSON array with these four fields for each segment.`;
}

export function getNAScriptEngineeringSystemInstruction(): string {
  const studyingLang = getStudyingLanguage();
  return `You are a Natural Approach (NA) Script Engineer specializing in creating comprehensible input materials for ${studyingLang.displayName} learners.

Your expertise lies in breaking down stories into granular, digestible segments that maximize comprehensible input while maintaining a low affective filter. You understand the principles of Foreigner Talk, i+1 input, and contextual support through visual cues.

Always output structured JSON matching the required schema with time, transcript, visual_cue, and na_principle fields.`;
}

export const STORYBOARD_SYSTEM_INSTRUCTION = "You are a Visual Director AI. You convert simple script directions into detailed, sequential image generation prompts that maintain character consistency and visual flow.";

/**
 * Storyboard Enhancement Prompt
 * Transforms raw script cues into a consistent, fluid visual narrative.
 */
export function getStoryboardEnhancementPrompt(segments: { time: string; visual_cue: string }[]): string {
  const cuesList = segments
    .map((s, i) => {
      const time = s.time || `[Frame ${i + 1}]`;
      const cue = s.visual_cue || 'No visual cue provided';
      return `Frame ${i + 1} (${time}): ${cue}`;
    })
    .join('\n');

  return `You are an expert Visual Director for a language learning animation. Your task is to take a sequence of raw "Visual Cues" and rewrite them into a cohesive set of "Image Generation Prompts" that tell a fluid visual story.

**Input Sequence:**

${cuesList}

**Instructions:**

1.  **Define the Assets:** First, internally decide on the specific look of the main characters/objects (e.g., "The dog is a scruffy terrier with a red collar"). Use this exact description every time the object appears.
2.  **Ensure Continuity:** If Frame 2 follows Frame 1, explicitly describe it as "The SAME dog from the previous frame..."
3.  **Create Variation:** If two consecutive cues are similar (e.g., "Pointing to dog" then "Pointing to dog again"), you MUST create visual interest.
    * *Example:* Frame 1: "Wide shot of whiteboard drawing of a dog. A hand points to its nose."
    * *Example:* Frame 2: "Close up of the SAME dog drawing. The hand has moved and is now circling the dog's tail."
4.  **Style Enforcement:** Ensure every prompt specifies "Simple line drawing style, white background, minimal distraction."
5.  **Negative Constraints:** Do not include any text, words, or labels in the descriptions.

**Output Format:**

Return ONLY a JSON array of strings. Each string is the detailed image prompt for that frame.

Example:

[
  "A simple whiteboard style line drawing of a scruffy brown terrier dog sitting. White background.",
  "The SAME drawing of the terrier. A human hand enters from the right, index finger pointing at the dog's nose.",
  "Close up on the SAME terrier drawing. The hand is now making a circular motion around the dog's head."
]`;
}

/**
 * Build image prompt from visual cue with style constraints and negative prompts
 */
export function buildImagePromptFromVisualCue(visualCue: string, hasPreviousImage: boolean = false): string {
  const studyingLang = getStudyingLanguage();
  const baseStyle = "simple line drawing on a whiteboard style, friendly cartoon illustration";
  
  // Create a strong list of negative constraints to suppress text and boilerplate
  const negativeConstraints = [
    "words", 
    "text", 
    "font", 
    "lettering", 
    "translation", 
    "caption", 
    "subtitles",
    studyingLang.displayName,
    studyingLang.englishName
  ].join(", ");
  
  // Build the core positive prompt
  let prompt = `Content: ${visualCue}. Style: ${baseStyle}, vibrant, clear, and simple illustration for a language learning app. **Crucially, the image must be entirely visual and contain NO words, text, or letters of any kind.**`;
  
  // Add consistency constraints if applicable
  if (hasPreviousImage) {
    prompt += ` Maintain visual consistency with the previous image: reuse the same characters, objects, and art style. Keep the same character designs, color palette, and illustration style as the reference image.`;
  }
  
  // Append the negative prompt string to enforce the text-free rule
  prompt += ` Negative Prompt: ${negativeConstraints}`;
  
  return prompt;
}

/**
 * Story Generation Prompts (kept for backward compatibility)
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
