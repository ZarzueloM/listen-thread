const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

/**
 * Merges multiple audio files into a single file
 * @param {string[]} audioFiles - Array of audio file paths
 * @returns {Promise<string>} - Path to the merged audio file
 */
async function mergeAudioFiles(audioFiles) {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(__dirname, '..', 'audio', `merged_${Date.now()}.mp3`);
    
    if (audioFiles.length === 0) {
      reject(new Error('No audio files to merge'));
      return;
    }

    if (audioFiles.length === 1) {
      // If only one file, just copy it
      fs.copyFileSync(audioFiles[0], outputFile);
      resolve(outputFile);
      return;
    }

    // Create a concat file for ffmpeg
    const concatFile = path.join(__dirname, '..', 'audio', `concat_${Date.now()}.txt`);
    const concatContent = audioFiles.map(file => `file '${path.basename(file)}'`).join('\n');
    fs.writeFileSync(concatFile, concatContent);

    // Use ffmpeg to concatenate audio files
    ffmpeg()
      .input(concatFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(outputFile)
      .on('end', () => {
        // Clean up concat file
        try {
          fs.unlinkSync(concatFile);
        } catch (err) {
          console.error('Error deleting concat file:', err);
        }
        resolve(outputFile);
      })
      .on('error', (err) => {
        // Clean up concat file
        try {
          fs.unlinkSync(concatFile);
        } catch (error) {
          console.error('Error deleting concat file:', error);
        }
        reject(new Error(`Failed to merge audio files: ${err.message}`));
      })
      .run();
  });
}

module.exports = { mergeAudioFiles };
