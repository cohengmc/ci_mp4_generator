import dotenv from 'dotenv';

dotenv.config();

export type LanguageKey = 'English' | 'Spanish' | 'Portuguese' | 'French' | 'Mandarin Chinese';

export interface LanguageConfig {
  key: LanguageKey;
  displayName: string;
  englishName: string;
  bcp47: string;
  geminiLocaleTag: string;
  ttsVoiceName: string;
}

export const LANGUAGE_MAP: Record<LanguageKey, LanguageConfig> = {
  English: { key: 'English', displayName: 'English', englishName: 'English', bcp47: 'en-US', geminiLocaleTag: 'en', ttsVoiceName: 'Puck' },
  Spanish: { key: 'Spanish', displayName: 'Spanish', englishName: 'Spanish', bcp47: 'es-ES', geminiLocaleTag: 'es', ttsVoiceName: 'Puck' },
  Portuguese: { key: 'Portuguese', displayName: 'Portuguese', englishName: 'Portuguese', bcp47: 'pt-PT', geminiLocaleTag: 'pt', ttsVoiceName: 'Puck' },
  French: { key: 'French', displayName: 'French', englishName: 'French', bcp47: 'fr-FR', geminiLocaleTag: 'fr', ttsVoiceName: 'Puck' },
  'Mandarin Chinese': { key: 'Mandarin Chinese', displayName: 'Mandarin Chinese', englishName: 'Mandarin Chinese', bcp47: 'zh-CN', geminiLocaleTag: 'zh', ttsVoiceName: 'Puck' },
};

function resolveKey(raw?: string | null): LanguageKey {
  const v = (raw || '').trim().toLowerCase();
  if (v === 'english' || v === 'en') return 'English';
  if (v === 'spanish' || v === 'es') return 'Spanish';
  if (v === 'portuguese' || v === 'portugues' || v === 'pt') return 'Portuguese';
  if (v === 'french' || v === 'fr') return 'French';
  if (v === 'mandarin chinese' || v === 'chinese' || v === 'zh' || v === 'zh-cn') return 'Mandarin Chinese';
  return 'Portuguese';
}

export function getStudyingLanguage(): LanguageConfig {
  // Check VITE_STUDYING_LANGUAGE first, then fall back to STUDYING_LANGUAGE
  const envDefault = process.env.VITE_STUDYING_LANGUAGE || process.env.STUDYING_LANGUAGE;
  const key = resolveKey(envDefault);
  return LANGUAGE_MAP[key];
}

