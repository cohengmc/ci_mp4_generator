import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import { getStudyingLanguage, LANGUAGE_MAP, type LanguageKey } from '../config/language.js';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

function getStorySchema() {
  const lang = getStudyingLanguage();
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        target_sentence: {
          type: Type.STRING,
          description: `A very simple sentence in ${lang.displayName}.`,
        },
        image_prompt: {
          type: Type.STRING,
          description: "A simple prompt in English for an image generation model that illustrates the sentence.",
        },
      },
      required: ["target_sentence", "image_prompt"],
    },
  };
}

export async function generateStorySegments(prompt: string, context?: string, count: number = 5): Promise<{ target_sentence: string; image_prompt: string }[]> {
  const studyingLang = getStudyingLanguage();
  const fullPrompt = context
    ? `Continue this simple story for a beginner ${studyingLang.displayName} learner: "${context}". Generate the next ${count} sentences.`
    : `Based on the prompt "${prompt}", create a very simple story in ${studyingLang.displayName} for an absolute beginner. The vocabulary and grammar must be extremely basic and repetitive. Generate the first ${count} sentences.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: getStorySchema(),
        systemInstruction: `You are a language learning assistant. Your task is to create a simple, continuous story in ${studyingLang.displayName} for an absolute beginner. Break the story into a sequence of short, simple sentences. For each sentence, provide a concise English description for an image that illustrates it. Only output the JSON.`
      },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating story segments:", error);
    throw new Error("Failed to generate story from prompt.");
  }
}

export async function generateImage(prompt: string): Promise<string> {
  const generateImages = process.env.GENERATE_IMAGES === "true";

  if (generateImages) {
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `A vibrant, clear, and simple illustration for a language learning app. Style: friendly, cartoonish, colorful. Content: ${prompt}`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: '16:9',
        },
      });

      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return `data:image/png;base64,${base64ImageBytes}`;
    } catch (error) {
      console.error("Error generating image:", error);
      throw new Error("Failed to generate image using Gemini API.");
    }
  }

  // Return a Picsum image per sentence prompt
  // Seeded by prompt to get stable-but-varied images without API calls
  const seed = encodeURIComponent(prompt || "default");
  return `https://picsum.photos/seed/${seed}/1280/720`;
}

export async function generateAudio(text: string): Promise<string> {
  const studyingLang = getStudyingLanguage();
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: studyingLang.ttsVoiceName },
                },
            },
        },
    });
    
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
        throw new Error("No audio data returned from API.");
    }
    return audioData;
  } catch(error) {
    console.error("Error generating audio:", error);
    throw new Error("Failed to generate audio.");
  }
}

// Batched TTS: synthesize multiple sentences in one call
export async function generateAudioBatch(sentences: string[], languageKey?: LanguageKey): Promise<string> {
  const lang = languageKey ? LANGUAGE_MAP[languageKey] : getStudyingLanguage();
  const text = sentences.map(s => s.trim().replace(/\s+/g, ' ')).join('. ') + '.';
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: lang.ttsVoiceName },
        },
      },
    },
  });
  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) {
    throw new Error("No audio data returned from API (batch).");
  }
  return audioData;
}

/**
 * Translate sentences to Spanish
 */
export async function translateToSpanish(sentences: string[]): Promise<string[]> {
  try {
    const text = sentences.join('\n');
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following sentences to Spanish. Maintain the same simple, beginner-friendly style. Return only the translations, one per line, in the same order:\n\n${text}`,
      config: {
        systemInstruction: 'You are a translation assistant. Translate each sentence to Spanish while maintaining the same simple, beginner-friendly style. Return only the translations, one per line, in the exact same order as the input.',
      },
    });
    const translations = response.text.trim().split('\n').map(s => s.trim()).filter(s => s.length > 0);
    // Ensure we have the same number of translations as input sentences
    if (translations.length !== sentences.length) {
      console.warn(`Translation count mismatch: expected ${sentences.length}, got ${translations.length}`);
      // Pad or truncate as needed
      while (translations.length < sentences.length) {
        translations.push('');
      }
      return translations.slice(0, sentences.length);
    }
    return translations;
  } catch (error) {
    console.error("Error translating to Spanish:", error);
    throw new Error("Failed to translate to Spanish.");
  }
}

