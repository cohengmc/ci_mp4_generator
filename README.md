# Terminal Content Generator

A Node.js/TypeScript terminal script that generates language learning content (stories, images, audio) using Google's Gemini AI and saves files directly to your Desktop. Automatically creates MP4 videos from the generated content.

## Features

- Generate simple, beginner-friendly stories in your target language using Gemini 2.5 Flash
- Create synchronized audio files for each sentence using Gemini 2.5 Flash Preview TTS
- Optional Spanish translation and audio generation
- Generate images using Imagen 4.0 (first image) and Gemini native image generation (subsequent images for consistency)
- Automatic audio segmentation using silence detection
- Audio speed adjustment (0.5x to 2.0x)
- Configurable pause gaps between video segments
- Save all files in an organized folder structure
- Automatic MP4 video generation with FFmpeg
- Comprehensive logging throughout the generation process

## Prerequisites

- Node.js 18+ (for native fetch support)
- Google Gemini API Key
- FFmpeg (for video generation): `brew install ffmpeg` on macOS

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
GENERATE_SPANISH=false
AUDIO_SPEED=1.0
PAUSE_GAP_DURATION=0
```

**Environment Variables:**
- `GEMINI_API_KEY` (required): Your Google Gemini API key
- `GENERATE_IMAGES` (optional, default: `false`): Set to `true` to use Imagen API for image generation. When `false`, uses Picsum Photos (placeholder images)
- `VITE_STUDYING_LANGUAGE` or `STUDYING_LANGUAGE` (optional, default: `Portuguese`): Target language for content generation. Supported: `English`, `Spanish`, `Portuguese`, `French`, `Mandarin Chinese`
- `GENERATE_SPANISH` (optional, default: `false`): Set to `true` to generate Spanish translations and audio
- `AUDIO_SPEED` (optional, default: `1.0`): Audio playback speed multiplier (0.5 to 2.0, e.g., `0.8` for 80% speed)
- `PAUSE_GAP_DURATION` (optional, default: `0`): Duration in seconds for pause gaps between video segments

## Usage

Run the script:
```bash
npm run generate
```

The script will:
1. Display current configuration (target language, image generation mode, Spanish generation, audio speed, pause gap duration)
2. Prompt you for a story prompt (prefixed with "Tell me a story...")
3. Ask for the number of sentences (default: 10)
4. Generate story segments using Gemini 2.5 Flash
5. Generate batched audio using Gemini 2.5 Flash Preview TTS
6. Optionally translate to Spanish and generate Spanish audio (if `GENERATE_SPANISH=true`)
7. Process audio segments using silence detection
8. Generate images (Imagen 4.0 for first image, Gemini native for subsequent images for consistency)
9. Save all files to `/Users/geoffreycohen/Desktop/language_generated_content/{timestamp}/`
10. Automatically create MP4 videos from the generated content (requires FFmpeg)

## Output Structure

Each generation creates a timestamped folder containing:
- `image_1.png`, `image_2.png`, ... - Images for each segment
- `audio_1.wav`, `audio_2.wav`, ... - Audio files in target language
- `audio_1_es.wav`, `audio_2_es.wav`, ... - Spanish audio files (if `GENERATE_SPANISH=true`)
- `transcripts.txt` - Target language transcripts
- `transcripts_es.txt` - Spanish transcripts (if `GENERATE_SPANISH=true`)
- `segments/` - Directory containing intermediate video segments (created during video generation)

**Video Output:**
After generating content, the script automatically creates MP4 videos:
- Target language video → `/Users/geoffreycohen/Desktop/Mandarin CI/YYYYMMDD_HHMMSS.mp4`
- Spanish video → `/Users/geoffreycohen/Desktop/Spanish CI/YYYYMMDD_HHMMSS.mp4` (if `GENERATE_SPANISH=true` and Spanish audio exists)

**Note:** 
- FFmpeg must be installed for video generation. Install with `brew install ffmpeg` on macOS.
- Video output directories are hardcoded to the Desktop folders above (legacy naming convention).
- If `PAUSE_GAP_DURATION > 0`, pause segments will be inserted between story segments in the final video.

## Example

```bash
$ npm run generate

🎬 Terminal Content Generator
============================

📚 Target Language: Portuguese
🖼️  Image Generation: Disabled (Picsum Photos)
🌐 Spanish Generation: Disabled
🎵 Audio Speed: 1
⏸️  Pause Gap Duration: 0s

Enter your story prompt - Tell me a story...: A cat sleeping on a sofa
Number of sentences (default: 10): 10

📝 Generating 10 story segments...
✅ Generated 10 story segments

🎤 Generating audio for target language (Portuguese)...
✅ Generated batch audio for target language

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

🎬 Starting video creation process...
📁 Content directory: /Users/geoffreycohen/Desktop/language_generated_content/20241215_143022

📊 Found 10 segment(s) for Portuguese

  Detecting image dimensions...
  ✅ Maximum dimensions: 1280x720

Step 1: Creating individual video segments for Portuguese...
  Creating segment 1/10...
  ✅ Segment 1 created successfully
  ...
Step 2: Creating concatenation list for Portuguese...
  ✅ Concatenation list created with 10 segments
Step 3: Concatenating all segments into final video for Portuguese...
✅ SUCCESS! Final video created: /Users/geoffreycohen/Desktop/Mandarin CI/20241215_143022.mp4
📊 File size: 2.45 MB

🎉 Video creation process complete!
```

## Technical Details

- **Story Generation**: Uses Gemini 2.5 Flash with structured JSON output
- **Audio Generation**: Uses Gemini 2.5 Flash Preview TTS with batched synthesis for efficiency
- **Audio Processing**: Automatic silence detection and segmentation to match sentence count
- **Image Generation**: 
  - First image: Imagen 4.0 (when `GENERATE_IMAGES=true`)
  - Subsequent images: Gemini native image generation (maintains visual consistency)
  - Fallback: Picsum Photos (when `GENERATE_IMAGES=false`)
- **Video Generation**: FFmpeg-based pipeline with automatic image dimension detection and scaling
- **Supported Languages**: English, Spanish, Portuguese, French, Mandarin Chinese

## Troubleshooting

- **API Key Error**: Make sure your `.env` file exists and contains a valid `GEMINI_API_KEY`
- **FFmpeg Not Found**: Install FFmpeg with `brew install ffmpeg` on macOS
- **Image Download Errors**: If using Picsum Photos, check your internet connection. Consider enabling `GENERATE_IMAGES=true` to use Imagen API instead
- **Audio Processing Errors**: Ensure you have sufficient disk space and memory
- **Video Generation Errors**: Check that FFmpeg is installed and all required files (images, audio) exist in the content directory
- **Invalid Audio Speed**: `AUDIO_SPEED` must be between 0.5 and 2.0

