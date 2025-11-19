import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import { getStudyingLanguage, LANGUAGE_MAP, type LanguageKey } from '../config/language.js';
import dotenv from 'dotenv';
import {
  getStoryGenerationPrompt,
  getStoryGenerationSystemInstruction,
  getNAScriptEngineeringPrompt,
  getNAScriptEngineeringSystemInstruction,
  getStoryboardEnhancementPrompt,
  STORYBOARD_SYSTEM_INSTRUCTION,
  getImageGenerationPrompt,
  getTranslationPrompt,
  TRANSLATION_SYSTEM_INSTRUCTION,
  getTargetSentenceDescription,
  IMAGE_PROMPT_DESCRIPTION
} from '../prompts/geminiPrompts.js';
import type { NAScriptSegment } from '../types.js';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

function getStorySchema() {
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        target_sentence: {
          type: Type.STRING,
          description: getTargetSentenceDescription(),
        },
        image_prompt: {
          type: Type.STRING,
          description: IMAGE_PROMPT_DESCRIPTION,
        },
      },
      required: ["target_sentence", "image_prompt"],
    },
  };
}

function getNAScriptSchema() {
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        time: {
          type: Type.STRING,
          description: "Timestamp in format [0:00], [0:01], etc.",
        },
        transcript: {
          type: Type.STRING,
          description: "Simplified speech segment (max 5-7 words, often less)",
        },
        visual_cue: {
          type: Type.STRING,
          description: "Visual/action cue: Drawing, Mime/Gesture, Prop, or Pointing with description",
        },
        na_principle: {
          type: Type.STRING,
          description: "NA principle: Maximize CI (Context), Maximize CI (Redundancy), Minimize Affective Filter, or Foreigner Talk/Chunking",
        },
      },
      required: ["time", "transcript", "visual_cue", "na_principle"],
    },
  };
}

export async function generateStorySegments(prompt: string, context?: string, count: number = 5): Promise<{ target_sentence: string; image_prompt: string }[]> {
  const fullPrompt = getStoryGenerationPrompt(prompt, count);

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: getStorySchema(),
        systemInstruction: getStoryGenerationSystemInstruction()
      },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating story segments:", error);
    throw new Error("Failed to generate story from prompt.");
  }
}

export async function generateNAScriptSegments(storyTopic: string, estimatedDuration: string, targetLevel: string): Promise<NAScriptSegment[]> {
  const fullPrompt = getNAScriptEngineeringPrompt(storyTopic, estimatedDuration, targetLevel);

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: getNAScriptSchema(),
        systemInstruction: getNAScriptEngineeringSystemInstruction()
      },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating NA script segments:", error);
    throw new Error("Failed to generate NA script from prompt.");
  }
}

export async function generateStoryboard(segments: NAScriptSegment[]): Promise<string[]> {
  const simplifiedSegments = segments.map((segment, index) => ({
    time: segment.time ?? `[Frame ${index + 1}]`,
    visual_cue: segment.visual_cue ?? 'No visual cue provided',
  }));

  const storyboardPrompt = getStoryboardEnhancementPrompt(simplifiedSegments);

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: storyboardPrompt,
      config: {
        responseMimeType: 'application/json',
        systemInstruction: STORYBOARD_SYSTEM_INSTRUCTION,
      },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating storyboard prompts:", error);
    throw new Error("Failed to generate storyboard prompts.");
  }
}

export async function generateImage(prompt: string, previousImageBase64?: string): Promise<string> {
  const generateImages = process.env.GENERATE_IMAGES === "true";

  if (generateImages) {
    try {
      // Extract base64 data if it's a data URL
      let previousImageData: string | undefined;
      if (previousImageBase64) {
        if (previousImageBase64.startsWith('data:image')) {
          previousImageData = previousImageBase64.split(',')[1];
        } else {
          previousImageData = previousImageBase64;
        }
      }

      // If we have a previous image, use Gemini native image generation for editing
      if (previousImageData) {
        const contents: any[] = [
          { text: getImageGenerationPrompt(prompt, true) }
        ];
        
        // Add the previous image to the contents array
        contents.push({
          inlineData: {
            mimeType: 'image/png',
            data: previousImageData,
          },
        });

        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: contents,
          config: {
            imageConfig: {
              aspectRatio: '16:9',
            },
          },
        });

        // Extract image from response - try candidates pattern first (like audio generation)
        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageData = part.inlineData.data;
              return `data:image/png;base64,${imageData}`;
            }
          }
        }
        
        // Fallback to direct parts access (if response structure is different)
        if (response.parts) {
          for (const part of response.parts) {
            if (part.inlineData) {
              const imageData = part.inlineData.data;
              return `data:image/png;base64,${imageData}`;
            }
          }
        }
        
        throw new Error("No image data returned from API.");
      } else {
        // For the first image, use Imagen
        const response = await ai.models.generateImages({
          model: 'imagen-4.0-generate-001',
          prompt: getImageGenerationPrompt(prompt, false),
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: '16:9',
          },
        });

        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:image/png;base64,${base64ImageBytes}`;
      }
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
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: getTranslationPrompt(sentences),
      config: {
        systemInstruction: TRANSLATION_SYSTEM_INSTRUCTION,
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

