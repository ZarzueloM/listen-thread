# Examples

## Using the Web Interface

1. Start the server:
```bash
npm start
```

2. Open http://localhost:3000 in your browser

3. Paste an X thread URL, for example:
   - `https://x.com/username/status/1234567890`

4. Click "Convertir a Audio"

5. Wait for the processing to complete

6. Listen to or download the generated audio

## Using the API

### Convert a Thread

```bash
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://x.com/username/status/1234567890"
  }'
```

Response:
```json
{
  "success": true,
  "audioUrl": "/audio/merged_abc123.mp3",
  "tweets": 5,
  "chunks": 3
}
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "ok"
}
```

## Testing Components

### Test Text Normalization

```javascript
const { normalizeText } = require('./src/textNormalizer');

const text = 'Hello @user! Check https://example.com 😀 RT: Test';
const normalized = normalizeText(text);
console.log(normalized); // "Hello! Check Test"
```

### Test Text-to-Speech

```javascript
const { textToSpeech } = require('./src/tts');

async function test() {
  const audioFile = await textToSpeech('Hello world', 0);
  console.log('Audio created:', audioFile);
}

test();
```

### Test Audio Merging

```javascript
const { textToSpeech } = require('./src/tts');
const { mergeAudioFiles } = require('./src/audioMerger');

async function test() {
  const files = [];
  
  // Create chunks
  for (let i = 0; i < 3; i++) {
    const file = await textToSpeech(`Chunk ${i}`, i);
    files.push(file);
  }
  
  // Merge
  const merged = await mergeAudioFiles(files);
  console.log('Merged audio:', merged);
}

test();
```

## Environment Variables

Create a `.env` file:

```env
# Server port (default: 3000)
PORT=3000

# Google Cloud TTS credentials (optional)
# If not set, the system will use espeak as fallback
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

## Notes

- The scraper works by loading the tweet in a headless browser (Playwright)
- It extracts only tweets from the original poster (OP) of the thread
- Text is normalized to remove URLs, emojis, mentions, and "RT"
- Long texts are split into ~1500 character chunks for better TTS quality
- Audio chunks are automatically merged into a single MP3 file
- Generated audio files are stored in the `audio/` directory

## Troubleshooting

### Scraping Fails

If scraping fails, it may be due to:
- X changing their HTML structure
- Rate limiting or blocking
- Network connectivity issues

### TTS Not Working

If TTS is not working:
- Ensure `espeak` and `ffmpeg` are installed
- Check if Google Cloud credentials are properly configured (optional)
- Verify file permissions in the `audio/` directory

### Audio Quality

To improve audio quality:
- Set up Google Cloud Text-to-Speech API credentials
- Adjust the chunk size in `index.js` (currently 1500 characters)
- Modify TTS voice settings in `src/tts.js`
