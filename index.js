require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { scrapeThread } = require('./src/scraper');
const { normalizeText } = require('./src/textNormalizer');
const { textToSpeech } = require('./src/tts');
const { mergeAudioFiles } = require('./src/audioMerger');
const { runCleanup, scheduleCleanup } = require('./src/audioCleanup');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for correct IP detection when deployed behind a proxy
app.set('trust proxy', 1);

// Rate limit config (env with defaults; lightweight for 1 instance / 1 GB RAM)
const parseEnvInt = (key, defaultVal) => {
  const v = process.env[key];
  if (v === undefined || v === '') return defaultVal;
  const n = parseInt(v, 10);
  return Number.isNaN(n) || n < 0 ? defaultVal : n;
};
const RATE_LIMIT_CONVERT_WINDOW_MS = parseEnvInt('RATE_LIMIT_CONVERT_WINDOW_MS', 15 * 60 * 1000);
const RATE_LIMIT_CONVERT_MAX = parseEnvInt('RATE_LIMIT_CONVERT_MAX', 5);
const RATE_LIMIT_API_WINDOW_MS = parseEnvInt('RATE_LIMIT_API_WINDOW_MS', 15 * 60 * 1000);
const RATE_LIMIT_API_MAX = parseEnvInt('RATE_LIMIT_API_MAX', 100);

// Shared 429 handler: JSON body and retryAfter (seconds)
function rateLimitHandler(req, res, _next, optionsUsed) {
  const info = req.rateLimit;
  const windowSec = optionsUsed?.windowMs ? Math.ceil(optionsUsed.windowMs / 1000) : 900;
  const retryAfter = info?.resetTime
    ? Math.max(0, Math.ceil((info.resetTime - Date.now()) / 1000))
    : windowSec;
  res.status(429).json({ error: 'Too many requests', retryAfter });
}

// Rate limiting for the /api/convert endpoint (stricter)
const convertLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONVERT_WINDOW_MS,
  max: RATE_LIMIT_CONVERT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// General rate limiting for other API endpoints (more lenient)
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_API_WINDOW_MS,
  max: RATE_LIMIT_API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Resolve absolute paths for static directories
const publicDir = path.join(__dirname, 'public');
const audioDir = path.join(__dirname, 'audio');

// Middleware
app.use(express.json());
app.use(express.static(publicDir));
app.use('/audio', express.static(audioDir));

// Ensure audio directory exists
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir);
}

// Cleanup old merged audio files (TTL from AUDIO_MAX_AGE_HOURS, 0 = disabled)
runCleanup(audioDir);
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
scheduleCleanup(CLEANUP_INTERVAL_MS, audioDir);

// Explicit root route to serve the web UI
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Map gender to Speechify voiceId (carmen / carlos)
function getVoiceIdFromGender(gender) {
  if (gender === 'female') return 'carmen';
  return 'carlos'; // default: male
}

// API endpoint to process tweet thread
app.post('/api/convert', convertLimiter, async (req, res) => {
  try {
    const { url, gender: rawGender } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Tweet URL is required' });
    }

    // Validate URL (only accept X URLs)
    if (!url.match(/x\.com/)) {
      return res.status(400).json({ error: 'Invalid X URL (only x.com is accepted)' });
    }

    // Validate gender: accept 'male' | 'female', default to 'male'
    const validGenders = ['male', 'female'];
    const gender = validGenders.includes(rawGender) ? rawGender : 'male';
    const voiceId = getVoiceIdFromGender(gender);

    console.log('Processing URL:', url, 'voice:', voiceId);

    // Step 1: Scrape the thread
    const tweets = await scrapeThread(url);
    console.log(`Extracted ${tweets.length} tweets from thread`);

    if (tweets.length === 0) {
      return res.status(404).json({ error: 'No tweets found in thread' });
    }

    // Step 2: Combine and normalize text
    const fullText = tweets.join('\n\n');
    const normalizedText = normalizeText(fullText);
    console.log('Text normalized, length:', normalizedText.length);

    // Step 3: Split into chunks (1500 characters)
    const chunks = splitTextIntoChunks(normalizedText, 1500);
    console.log(`Text split into ${chunks.length} chunks`);

    // Step 4: Convert each chunk to speech
    const audioFiles = [];
    for (let i = 0; i < chunks.length; i++) {
      const audioFile = await textToSpeech(chunks[i], i, { voiceId });
      audioFiles.push(audioFile);
      console.log(`Generated audio for chunk ${i + 1}/${chunks.length}`);
    }

    // Step 5: Merge audio files
    const outputFile = await mergeAudioFiles(audioFiles);
    console.log('Audio files merged:', outputFile);

    // Step 6: Clean up chunk files
    audioFiles.forEach(file => {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        console.error('Error deleting chunk file:', err);
      }
    });

    // Return the audio file URL
    const audioUrl = `/audio/${path.basename(outputFile)}`;
    res.json({
      success: true,
      audioUrl,
      tweets: tweets.length,
      chunks: chunks.length
    });

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      error: 'Failed to process thread',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', apiLimiter, (req, res) => {
  res.json({ status: 'ok' });
});

// Helper function to split text into chunks
function splitTextIntoChunks(text, maxChunkSize) {
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxChunkSize) {
      currentChunk += sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

const host = process.env.HOST || '0.0.0.0';
app.listen(PORT, host, () => {
  console.log(`Server running on http://${host}:${PORT}`);
});
