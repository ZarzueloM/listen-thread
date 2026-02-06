const textToSpeechLib = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Note: For Google Cloud TTS, you need to set up credentials
// This is a fallback implementation that can work without credentials
// using a simpler approach with Web Speech API or another service

/**
 * Converts text to speech and saves as an audio file
 * @param {string} text - The text to convert
 * @param {number} index - The chunk index
 * @returns {Promise<string>} - Path to the generated audio file
 */
async function textToSpeech(text, index) {
  const uniqueId = uuidv4();
  const outputFile = path.join(__dirname, '..', 'audio', `chunk_${index}_${uniqueId}.mp3`);

  try {
    // Check if Google Cloud credentials are available
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use Google Cloud TTS
      const client = new textToSpeechLib.TextToSpeechClient();

      const request = {
        input: { text },
        voice: {
          languageCode: 'es-ES', // Spanish
          name: 'es-ES-Standard-A',
          ssmlGender: 'FEMALE'
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0.0
        }
      };

      const [response] = await client.synthesizeSpeech(request);
      await fs.promises.writeFile(outputFile, response.audioContent, 'binary');
      
    } else {
      // Fallback: Create a simple implementation using espeak or festival
      // For now, we'll use a system command approach
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const execFilePromise = promisify(execFile);

      // Try to use espeak if available (common on Linux)
      try {
        const wavFile = outputFile.replace('.mp3', '.wav');
        
        // Use execFile for safer command execution with arguments array
        await execFilePromise('espeak', ['-v', 'es', '-w', wavFile, text]);
        
        // Convert WAV to MP3 using ffmpeg
        await execFilePromise('ffmpeg', ['-i', wavFile, '-codec:a', 'libmp3lame', '-qscale:a', '2', outputFile, '-y']);
        
        // Delete WAV file
        fs.unlinkSync(wavFile);
        
      } catch (error) {
        // If espeak is not available, create a silent audio file as placeholder
        // This allows the application to run even without TTS engines
        console.warn('TTS engine not available, creating placeholder audio');
        
        // Create a 1-second silent audio file
        await execFilePromise('ffmpeg', ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1', '-q:a', '9', '-acodec', 'libmp3lame', outputFile, '-y']);
      }
    }

    return outputFile;

  } catch (error) {
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
}

module.exports = { textToSpeech };
