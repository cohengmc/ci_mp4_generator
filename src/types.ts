export interface StorySegment {
  id: string;
  targetSentence: string;
  imagePrompt: string;
  imageUrl: string;
  audioBase64: string;
  // Spanish translations
  spanishSentence?: string;
  spanishAudioBase64?: string;
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

