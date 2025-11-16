# Terminal Content Generator

A Node.js/TypeScript terminal script that generates language learning content (stories, images, audio) using Google's Gemini AI and saves files directly to your Desktop.

## Features

- Generate simple, beginner-friendly stories in your target language
- Create synchronized audio files for each sentence (target language + Spanish)
- Generate or fetch images for each story segment
- Save all files in an organized folder structure
- Comprehensive logging throughout the generation process

## Prerequisites

- Node.js 18+ (for native fetch support)
- Google Gemini API Key

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_api_key_here
GENERATE_IMAGES=false
VITE_STUDYING_LANGUAGE=Portuguese
```

**Note:** The script checks `VITE_STUDYING_LANGUAGE` first, then falls back to `STUDYING_LANGUAGE` if not set.

## Usage

Run the script:
```bash
npm run generate
```

The script will:
1. Prompt you for a story prompt
2. Ask for the number of sentences (default: 10)
3. Generate content using Gemini AI
4. Save all files to `/Users/geoffreycohen/Desktop/language_generated_content/{timestamp}/`
5. Automatically create MP4 videos from the generated content (requires FFmpeg)

## Output Structure

Each generation creates a timestamped folder containing:
- `image_1.png`, `image_2.png`, ... - Images for each segment
- `audio_1.wav`, `audio_2.wav`, ... - Audio files in target language
- `audio_1_es.wav`, `audio_2_es.wav`, ... - Spanish audio files
- `transcripts.txt` - Target language transcripts
- `transcripts_es.txt` - Spanish transcripts
- `segments/` - Directory containing intermediate video segments (created during video generation)

**Video Output:**
After generating content, the script automatically creates MP4 videos:
- Target language video → `~/Desktop/Mandarin CI/YYYYMMDD_HHMMSS.mp4`
- Spanish video → `~/Desktop/Spanish CI/YYYYMMDD_HHMMSS.mp4` (if Spanish audio exists)

**Note:** FFmpeg must be installed for video generation. Install with `brew install ffmpeg` on macOS.

## Example

```bash
$ npm run generate

🎬 Terminal Content Generator
============================

📚 Target Language: Portuguese
🖼️  Image Generation: Disabled (Picsum Photos)

Enter your story prompt: A cat sleeping on a sofa
Number of sentences (default: 10): 10

📝 Generating 10 story segments...
✅ Generated 10 story segments

🎤 Generating audio for target language (Portuguese)...
✅ Generated batch audio for target language

🌐 Translating to Spanish...
✅ Translated 10 sentences to Spanish

🎤 Generating Spanish audio...
✅ Generated batch audio for Spanish

🔊 Processing audio segments...
✅ Processed 10 audio segments

🖼️  Generating images...
  Generating image 1/10...
  Generating image 2/10...
  ...
✅ Generated 10 images

💾 Saving files to /Users/geoffreycohen/Desktop/language_generated_content/20241215_143022...
  Saving image_1.png...
  ...
✅ All files saved successfully!

✅ Complete! Files saved to: /Users/geoffreycohen/Desktop/language_generated_content/20241215_143022
```

## Troubleshooting

- **API Key Error**: Make sure your `.env` file exists and contains a valid `GEMINI_API_KEY`
- **Image Download Errors**: If using Picsum Photos, check your internet connection. Consider enabling `GENERATE_IMAGES=true` to use Imagen API instead
- **Audio Processing Errors**: Ensure you have sufficient disk space and memory

