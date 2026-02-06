const express = require('express');
const path = require('path');
const fs = require('fs');
const { scrapeThread } = require('./src/scraper');
const { normalizeText } = require('./src/textNormalizer');
const { textToSpeech } = require('./src/tts');
const { mergeAudioFiles } = require('./src/audioMerger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/audio', express.static('audio'));

// Ensure audio directory exists using absolute path
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir);
}

// API endpoint to process tweet thread
app.post('/api/convert', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Tweet URL is required' });
    }

    // Validate URL
    if (!url.match(/twitter\.com|x\.com/)) {
      return res.status(400).json({ error: 'Invalid Twitter/X URL' });
    }

    console.log('Processing URL:', url);

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
      const audioFile = await textToSpeech(chunks[i], i);
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
app.get('/api/health', (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
