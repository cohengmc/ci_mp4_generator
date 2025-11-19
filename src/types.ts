export interface NAScriptSegment {
  time: string;           // "[0:00]"
  transcript: string;     // "El gato es muy grande."
  visual_cue: string;   // "Drawing: Simple drawing of a cat."
  na_principle: string;  // "Maximize CI (Context)"
}

export interface StorySegment {
  id: string;
  targetSentence: string;
  imagePrompt: string;
  imageUrl: string;
  audioBase64: string;
  // Spanish translations
  spanishSentence?: string;
  spanishAudioBase64?: string;
  // Natural Approach fields (optional for backward compatibility)
  time?: string;
  transcript?: string;
  visualCue?: string;
  naPrinciple?: string;
  storyboardPrompt?: string;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface GeneratedContent {
  id: string;
  prompt: string;
  segments: StorySegment[];
  batchAudioBase64: string;
  batchRanges: { startSample: number; endSample: number }[];
  createdAt: Date;
}

