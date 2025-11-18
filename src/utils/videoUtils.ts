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
 * Get image dimensions using ffprobe
 */
async function getImageDimensions(imagePath: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json',
      imagePath
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('error', () => {
      resolve(null);
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      try {
        const result = JSON.parse(stdout);
        const streams = result.streams;
        if (streams && streams.length > 0) {
          const stream = streams[0];
          if (stream.width && stream.height) {
            resolve({
              width: parseInt(stream.width, 10),
              height: parseInt(stream.height, 10)
            });
            return;
          }
        }
      } catch {
        // JSON parse error
      }
      resolve(null);
    });
  });
}

/**
 * Find maximum image dimensions across all images
 */
async function findMaxImageDimensions(contentDir: string, maxSegment: number): Promise<{ width: number; height: number }> {
  let maxWidth = 0;
  let maxHeight = 0;

  console.log(`  Detecting image dimensions...`);
  
  for (let i = 1; i <= maxSegment; i++) {
    const imageFile = join(contentDir, `image_${i}.png`);
    try {
      await fs.access(imageFile);
      const dimensions = await getImageDimensions(imageFile);
      if (dimensions) {
        if (dimensions.width > maxWidth) maxWidth = dimensions.width;
        if (dimensions.height > maxHeight) maxHeight = dimensions.height;
      }
    } catch {
      // Image doesn't exist, skip
    }
  }

  if (maxWidth === 0 || maxHeight === 0) {
    // Default to 16:9 aspect ratio if detection fails
    maxWidth = 1344;
    maxHeight = 768;
  }

  console.log(`  ✅ Maximum dimensions: ${maxWidth}x${maxHeight}`);
  return { width: maxWidth, height: maxHeight };
}

/**
 * Create a silent audio file for pause duration
 */
async function createSilentAudio(outputPath: string, durationSeconds: number, sampleRate: number = 24000): Promise<boolean> {
  // Create silent audio using FFmpeg
  const cmd = [
    'ffmpeg',
    '-f', 'lavfi',
    '-i', `anullsrc=channel_layout=mono:sample_rate=${sampleRate}`,
    '-t', durationSeconds.toString(),
    '-y',
    outputPath
  ];
  return await runFFmpegCommand(cmd, `creating silent audio for ${durationSeconds}s pause`);
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
  languageLabel: string,
  pauseGapDuration: number = 0
): Promise<boolean> {
  const maxSegment = await findMaxSegmentNumber(contentDir, audioSuffix);
  if (maxSegment === 0) {
    return false;
  }

  console.log(`📊 Found ${maxSegment} segment(s) for ${languageLabel}`);
  console.log();

  // Step 0: Detect maximum image dimensions
  const maxDimensions = await findMaxImageDimensions(contentDir, maxSegment);
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

    // FFmpeg command to create segment with scaling to max dimensions
    const cmd = [
      'ffmpeg',
      '-loop', '1',
      '-i', imageFile,
      '-i', audioFile,
      '-vf', `scale=${maxDimensions.width}:${maxDimensions.height}:force_original_aspect_ratio=decrease,pad=${maxDimensions.width}:${maxDimensions.height}:(ow-iw)/2:(oh-ih)/2`,
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

  // Step 2: Create concatenation list with pause segments if needed
  const concatList = join(segmentsDir, `concat_list${audioSuffix}.txt`);
  const concatLines: string[] = [];
  
  // If pause duration is set, create pause segments between regular segments
  if (pauseGapDuration > 0) {
    console.log(`  Creating pause segments (${pauseGapDuration}s between segments)...`);
    const pauseSegmentsCreated: string[] = [];
    
    for (let i = 0; i < segmentsCreated.length; i++) {
      // Add the regular segment
      concatLines.push(`file '${resolve(segmentsCreated[i])}'`);
      
      // Create pause segment after each segment (except the last one)
      if (i < segmentsCreated.length - 1) {
        const segmentNum = i + 1;
        const imageFile = join(contentDir, `image_${segmentNum}.png`);
        const pauseAudioFile = join(segmentsDir, `pause_${segmentNum}${audioSuffix}.wav`);
        const pauseSegmentFile = join(segmentsDir, `pause_segment${audioSuffix}_${segmentNum}.mp4`);
        
        // Create silent audio for pause
        if (await createSilentAudio(pauseAudioFile, pauseGapDuration)) {
          // Create pause video segment (image + silent audio) with scaling
          const pauseCmd = [
            'ffmpeg',
            '-loop', '1',
            '-i', imageFile,
            '-i', pauseAudioFile,
            '-vf', `scale=${maxDimensions.width}:${maxDimensions.height}:force_original_aspect_ratio=decrease,pad=${maxDimensions.width}:${maxDimensions.height}:(ow-iw)/2:(oh-ih)/2`,
            '-c:v', 'libx264',
            '-tune', 'stillimage',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-shortest',
            '-y',
            pauseSegmentFile
          ];
          
          if (await runFFmpegCommand(pauseCmd, `creating pause segment ${segmentNum}`)) {
            concatLines.push(`file '${resolve(pauseSegmentFile)}'`);
            pauseSegmentsCreated.push(pauseSegmentFile);
          }
        }
      }
    }
    
    console.log(`  ✅ Created ${pauseSegmentsCreated.length} pause segments`);
  } else {
    // No pause, just add all segments
    concatLines.push(...segmentsCreated.map(file => `file '${resolve(file)}'`));
  }
  
  await fs.writeFile(concatList, concatLines.join('\n'), 'utf-8');

  console.log(`  ✅ Concatenation list created with ${concatLines.length} segments`);
  console.log();

  // Step 3: Concatenate all segments with re-encoding to normalize and fix timestamps
  console.log(`Step 3: Concatenating all segments into final video for ${languageLabel}...`);
  await fs.mkdir(outputDir, { recursive: true });
  const finalOutput = join(outputDir, `${timestamp}.mp4`);

  const cmd = [
    'ffmpeg',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatList,
    '-c:v', 'libx264',
    '-tune', 'stillimage',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
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
  // Get pause gap duration from environment (default to 0 if not set)
  let pauseGapDuration = process.env.PAUSE_GAP_DURATION ? parseFloat(process.env.PAUSE_GAP_DURATION) : 0;
  if (isNaN(pauseGapDuration) || pauseGapDuration < 0) {
    console.warn(`⚠️  Warning: Invalid PAUSE_GAP_DURATION value, using default 0`);
    pauseGapDuration = 0;
  }
  
  if (pauseGapDuration > 0) {
    console.log(`⏸️  Pause gap duration: ${pauseGapDuration}s between segments`);
  }
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
    await processLanguage(contentDir, segmentsDir, targetLanguageDir, timestamp, '', languageLabel, pauseGapDuration);
    console.log();
  }

  // Process Spanish language (_es suffix) - only if enabled
  if (generateSpanish) {
    const hasSpanish = await findMaxSegmentNumber(contentDir, '_es');
    if (hasSpanish > 0) {
      await processLanguage(contentDir, segmentsDir, spanishDir, timestamp, '_es', 'Spanish', pauseGapDuration);
      console.log();
    }
  }

  console.log('🎉 Video creation process complete!');
}

