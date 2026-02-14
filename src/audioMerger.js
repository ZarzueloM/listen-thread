const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function runMerge(concatFile, outputFile, useCopy) {
  return new Promise((resolve, reject) => {
    let ffmpegStderr = '';
    const outputOpts = useCopy
      ? ['-c', 'copy']
      : ['-c:a', 'libmp3lame', '-qscale:a', '2', '-ar', '44100', '-ac', '1'];
    const cmd = ffmpeg()
      .input(concatFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(outputOpts)
      .output(outputFile);

    cmd
      .on('stderr', (line) => { ffmpegStderr += line + '\n'; })
      .on('end', () => resolve({ ok: true }))
      .on('error', (err) => reject(new Error(`${err.message}\nffmpeg stderr:\n${ffmpegStderr.trim()}`)))
      .run();
  });
}

/**
 * Merges multiple audio files into a single file.
 * Tries stream copy first; if it fails (e.g. different codecs between chunks), retries with re-encode.
 * @param {string[]} audioFiles - Array of audio file paths
 * @returns {Promise<string>} - Path to the merged audio file
 */
async function mergeAudioFiles(audioFiles) {
  const uniqueId = uuidv4();
  const outputFile = path.join(__dirname, '..', 'audio', `merged_${uniqueId}.mp3`);

  if (audioFiles.length === 0) {
    throw new Error('No audio files to merge');
  }

  if (audioFiles.length === 1) {
    fs.copyFileSync(audioFiles[0], outputFile);
    return outputFile;
  }

  const concatFile = path.join(__dirname, '..', 'audio', `concat_${uniqueId}.txt`);
  const escapePath = (p) => path.resolve(p).replace(/'/g, "'\\''");
  const concatContent = audioFiles.map(file => `file '${escapePath(file)}'`).join('\n');
  fs.writeFileSync(concatFile, concatContent);

  try {
    await runMerge(concatFile, outputFile, true);
    return outputFile;
  } catch (copyErr) {
    console.warn('Merge with -c copy failed (chunks may have different format), retrying with re-encode:', copyErr.message.split('\n')[0]);
    try {
      await runMerge(concatFile, outputFile, false);
      return outputFile;
    } catch (reencodeErr) {
      throw new Error(`Failed to merge audio files: ${reencodeErr.message}`);
    }
  } finally {
    try { fs.unlinkSync(concatFile); } catch (e) { console.error('Error deleting concat file:', e); }
  }
}

module.exports = { mergeAudioFiles };
