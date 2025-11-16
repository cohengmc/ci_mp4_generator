import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';

/**
 * Check if FFmpeg is installed
 */
async function checkFFmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    ffmpeg.on('error', () => resolve(false));
    ffmpeg.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Run FFmpeg command and handle errors
 */
async function runFFmpegCommand(cmd: string[], description: string): Promise<boolean> {
  return new Promise((resolve) => {
    const [program, ...args] = cmd;
    const childProcess = spawn(program, args);
    
    let stderr = '';
    
    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    childProcess.on('error', (error) => {
      if ((error as any).code === 'ENOENT') {
        console.error('❌ Error: FFmpeg not found. Please install FFmpeg first.');
        console.error('   Install with: brew install ffmpeg');
        // Exit the Node.js process
        process.exit(1);
      } else {
        console.error(`❌ Error: ${description}`);
        console.error(`   Error: ${error.message}`);
      }
      resolve(false);
    });
    
    childProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ Error: ${description}`);
        if (stderr) {
          console.error(`   FFmpeg error: ${stderr}`);
        }
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Find the maximum segment number by scanning audio files
 */
async function findMaxSegmentNumber(contentDir: string, audioSuffix: string = ''): Promise<number> {
  const files = await fs.readdir(contentDir);
  let maxSegment = 0;

  for (const file of files) {
    if (audioSuffix) {
      // Look for files like audio_1_es.wav
      const match = file.match(new RegExp(`^audio_(\\d+)${audioSuffix}\\.wav$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSegment) maxSegment = num;
      }
    } else {
      // Look for files like audio_1.wav (but not audio_1_es.wav)
      const match = file.match(/^audio_(\d+)\.wav$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSegment) maxSegment = num;
      }
    }
  }

  return maxSegment;
}

/**
 * Process video creation for a specific language variant
 */
async function processLanguage(
  contentDir: string,
  segmentsDir: string,
  outputDir: string,
  timestamp: string,
  audioSuffix: string = '',
  languageLabel: string
): Promise<boolean> {
  const maxSegment = await findMaxSegmentNumber(contentDir, audioSuffix);
  if (maxSegment === 0) {
    return false;
  }

  console.log(`📊 Found ${maxSegment} segment(s) for ${languageLabel}`);
  console.log();

  // Step 1: Generate individual video segments
  console.log(`Step 1: Creating individual video segments for ${languageLabel}...`);
  const segmentsCreated: string[] = [];
  const segmentPrefix = audioSuffix ? `segment${audioSuffix}` : 'segment';

  for (let i = 1; i <= maxSegment; i++) {
    const imageFile = join(contentDir, `image_${i}.png`);
    const audioFile = audioSuffix
      ? join(contentDir, `audio_${i}${audioSuffix}.wav`)
      : join(contentDir, `audio_${i}.wav`);
    const segmentFile = join(segmentsDir, `${segmentPrefix}_${i}.mp4`);

    // Check if files exist
    try {
      await fs.access(imageFile);
    } catch {
      const imageName = `image_${i}.png`;
      console.log(`⚠️  Warning: ${imageName} not found, skipping segment ${i}`);
      continue;
    }
    
    try {
      await fs.access(audioFile);
    } catch {
      const audioName = audioSuffix ? `audio_${i}${audioSuffix}.wav` : `audio_${i}.wav`;
      console.log(`⚠️  Warning: ${audioName} not found, skipping segment ${i}`);
      continue;
    }

    console.log(`  Creating segment ${i}/${maxSegment}...`);

    // FFmpeg command to create segment
    const cmd = [
      'ffmpeg',
      '-loop', '1',
      '-i', imageFile,
      '-i', audioFile,
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      '-y', // Overwrite output file
      segmentFile
    ];

    if (await runFFmpegCommand(cmd, `creating segment ${i}`)) {
      console.log(`  ✅ Segment ${i} created successfully`);
      segmentsCreated.push(segmentFile);
    } else {
      console.log(`  ❌ Error creating segment ${i}`);
      return false;
    }
  }

  if (segmentsCreated.length === 0) {
    console.log(`❌ No segments were created for ${languageLabel}. Please check your input files.`);
    return false;
  }

  console.log();
  console.log(`Step 2: Creating concatenation list for ${languageLabel}...`);

  // Step 2: Create concatenation list file
  const concatList = join(segmentsDir, `concat_list${audioSuffix}.txt`);
  // Use absolute paths for concat file (like Python script)
  const concatLines = segmentsCreated.map(file => `file '${resolve(file)}'`).join('\n');
  await fs.writeFile(concatList, concatLines, 'utf-8');

  console.log(`  ✅ Concatenation list created with ${segmentsCreated.length} segments`);
  console.log();

  // Step 3: Concatenate all segments
  console.log(`Step 3: Concatenating all segments into final video for ${languageLabel}...`);
  await fs.mkdir(outputDir, { recursive: true });
  const finalOutput = join(outputDir, `${timestamp}.mp4`);

  const cmd = [
    'ffmpeg',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatList,
    '-c', 'copy',
    '-y',
    finalOutput
  ];

  if (await runFFmpegCommand(cmd, `concatenating segments for ${languageLabel}`)) {
    console.log();
    console.log(`✅ SUCCESS! Final video created: ${finalOutput}`);
    console.log();

    // Get file size
    try {
      const stats = await fs.stat(finalOutput);
      const sizeMb = stats.size / (1024 * 1024);
      console.log(`📊 File size: ${sizeMb.toFixed(2)} MB`);
    } catch {
      // Ignore file size error
    }

    return true;
  } else {
    console.log();
    console.log(`❌ Error during concatenation for ${languageLabel}`);
    return false;
  }
}

/**
 * Create MP4 videos from the generated content
 */
export async function createVideos(contentDir: string, languageLabel: string, generateSpanish: boolean): Promise<void> {
  // Check if FFmpeg is installed
  if (!(await checkFFmpeg())) {
    console.error('❌ Error: FFmpeg not found. Please install FFmpeg first.');
    console.error('   Install with: brew install ffmpeg');
    throw new Error('FFmpeg not installed');
  }

  console.log('\n🎬 Starting video creation process...');
  console.log(`📁 Content directory: ${contentDir}`);
  console.log();

  // Create segments directory
  const segmentsDir = join(contentDir, 'segments');
  await fs.mkdir(segmentsDir, { recursive: true });

  // Generate timestamp for output filename
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

  // Determine output directories based on language
  // For now, we'll use the same structure as the Python script
  // Target language goes to "Mandarin CI" folder (legacy naming)
  // Spanish goes to "Spanish CI" folder
  const targetLanguageDir = '/Users/geoffreycohen/Desktop/Mandarin CI';
  const spanishDir = '/Users/geoffreycohen/Desktop/Spanish CI';

  await fs.mkdir(targetLanguageDir, { recursive: true });
  await fs.mkdir(spanishDir, { recursive: true });

  // Process target language (no suffix)
  const hasTargetLanguage = await findMaxSegmentNumber(contentDir, '');
  if (hasTargetLanguage > 0) {
    await processLanguage(contentDir, segmentsDir, targetLanguageDir, timestamp, '', languageLabel);
    console.log();
  }

  // Process Spanish language (_es suffix) - only if enabled
  if (generateSpanish) {
    const hasSpanish = await findMaxSegmentNumber(contentDir, '_es');
    if (hasSpanish > 0) {
      await processLanguage(contentDir, segmentsDir, spanishDir, timestamp, '_es', 'Spanish');
      console.log();
    }
  }

  console.log('🎉 Video creation process complete!');
}

