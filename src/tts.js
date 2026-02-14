const textToSpeechLib = require('@google-cloud/text-to-speech');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFilePromise = promisify(execFile);

/** @type {import('@speechify/api').SpeechifyClient | null} */
let speechifyClient = null;

function getSpeechifyClient() {
  if (!process.env.SPEECHIFY_API_KEY) return null;
  if (!speechifyClient) {
    const { SpeechifyClient } = require('@speechify/api');
    speechifyClient = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });
  }
  return speechifyClient;
}

/**
 * Converts text to speech using Speechify API and writes MP3 to disk.
 * @param {string} text
 * @param {string} voiceId - e.g. 'carlos' | 'carmen'
 * @param {string} outputFile
 * @returns {Promise<void>}
 */
async function synthesizeWithSpeechify(text, voiceId, outputFile) {
  const client = getSpeechifyClient();
  if (!client) return false;
  const result = await client.tts.audio.speech({ input: text, voiceId });
  const buffer = Buffer.from(result.audioData, 'base64');
  await fs.promises.writeFile(outputFile, buffer, 'binary');
  return true;
}

/**
 * Converts text to speech using Google Cloud TTS and writes MP3 to disk.
 * @param {string} text
 * @param {string} outputFile
 * @param {'male'|'female'} gender
 * @returns {Promise<boolean>} - true if synthesis succeeded
 */
async function synthesizeWithGoogle(text, outputFile, gender = 'male') {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) return false;
  const client = new textToSpeechLib.TextToSpeechClient();
  const request = {
    input: { text },
    voice: {
      languageCode: 'es-ES',
      name: gender === 'female' ? 'es-ES-Standard-A' : 'es-ES-Standard-B',
      ssmlGender: gender === 'female' ? 'FEMALE' : 'MALE',
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
      pitch: 0.0,
    },
  };
  const [response] = await client.synthesizeSpeech(request);
  await fs.promises.writeFile(outputFile, response.audioContent, 'binary');
  return true;
}

/**
 * Converts text to speech using espeak + ffmpeg, or creates a silent placeholder on failure.
 * @param {string} text
 * @param {string} outputFile
 * @returns {Promise<void>}
 */
async function synthesizeWithEspeak(text, outputFile) {
  try {
    const wavFile = outputFile.replace('.mp3', '.wav');
    await execFilePromise('espeak', ['-v', 'es', '-w', wavFile, text]);
    await execFilePromise('ffmpeg', ['-i', wavFile, '-codec:a', 'libmp3lame', '-qscale:a', '2', outputFile, '-y']);
    fs.unlinkSync(wavFile);
  } catch {
    console.warn('TTS engine not available, creating placeholder audio');
    await execFilePromise('ffmpeg', ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1', '-q:a', '9', '-acodec', 'libmp3lame', outputFile, '-y']);
  }
}

/**
 * Converts text to speech and saves as an audio file.
 * Priority: Speechify (if SPEECHIFY_API_KEY) → Google Cloud TTS → espeak+ffmpeg → silent placeholder.
 *
 * @param {string} text - The text to convert
 * @param {number} index - The chunk index
 * @param {{ voiceId?: string }}= options - Optional. voiceId for Speechify (e.g. 'carlos', 'carmen'). Defaults to 'carlos'.
 * @returns {Promise<string>} - Path to the generated audio file
 */
async function textToSpeech(text, index, { voiceId = 'carlos' } = {}) {
  const { v4: uuidv4 } = await import('uuid');
  const uniqueId = uuidv4();
  const outputFile = path.join(__dirname, '..', 'audio', `chunk_${index}_${uniqueId}.mp3`);

  try {
    // 1) Speechify (when API key is set)
    if (getSpeechifyClient()) {
      try {
        const ok = await synthesizeWithSpeechify(text, voiceId, outputFile);
        if (ok) return outputFile;
      } catch (err) {
        console.warn('Speechify TTS failed, falling back:', err.message);
      }
    }

    // 2) Google Cloud TTS
    const gender = voiceId === 'carmen' ? 'female' : 'male';
    try {
      const ok = await synthesizeWithGoogle(text, outputFile, gender);
      if (ok) return outputFile;
    } catch (err) {
      console.warn('Google TTS failed, falling back:', err.message);
    }

    // 3) espeak + ffmpeg, or silent placeholder
    await synthesizeWithEspeak(text, outputFile);
    return outputFile;
  } catch (error) {
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
}

module.exports = { textToSpeech };
