# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Side                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Web Interface (public/index.html)           │  │
│  │  - URL input form                                     │  │
│  │  - Audio player                                       │  │
│  │  - Progress/status display                            │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP POST /api/convert
                       │ { url: "..." }
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      Express Server                         │
│                        (index.js)                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Validate URL                                      │  │
│  │  2. Call scraper                                      │  │
│  │  3. Normalize text                                    │  │
│  │  4. Split into chunks                                 │  │
│  │  5. Convert to speech (each chunk)                    │  │
│  │  6. Merge audio files                                 │  │
│  │  7. Return audio URL                                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│   Scraper    │ │  Text    │ │   TTS    │ │    Audio     │
│  (Playwright)│ │Normalizer│ │ (espeak) │ │    Merger    │
│              │ │          │ │          │ │   (ffmpeg)   │
└──────────────┘ └──────────┘ └──────────┘ └──────────────┘
```

## Component Details

### 1. Express Server (index.js)

**Purpose**: Main application server and request orchestrator

**Responsibilities**:
- Serve static files (HTML, CSS, JS)
- Handle API requests
- Orchestrate the conversion pipeline
- Manage file system operations

**Key Functions**:
- `POST /api/convert`: Main conversion endpoint
- `GET /api/health`: Health check endpoint
- `splitTextIntoChunks()`: Splits text while preserving sentence boundaries

### 2. Scraper Module (src/scraper.js)

**Purpose**: Extract tweets from X threads

**Technology**: Playwright (headless Chromium)

**Process**:
1. Launch headless browser
2. Navigate to tweet URL
3. Wait for tweets to load
4. Identify the original poster (OP)
5. Extract all tweets from the OP in the thread
6. Return array of tweet texts

**Key Features**:
- Filters tweets by original poster
- Handles dynamic content loading
- Uses proper selectors for X DOM

### 3. Text Normalizer (src/textNormalizer.js)

**Purpose**: Clean and prepare text for TTS

**Transformations**:
- Remove URLs (http/https/www)
- Remove "RT" (retweet indicators)
- Remove @mentions
- Remove emojis (comprehensive Unicode ranges)
- Clean up whitespace
- Add natural pauses (convert newlines to periods)
- Fix punctuation spacing

**Output**: Clean, TTS-ready text

### 4. Text-to-Speech Module (src/tts.js)

**Purpose**: Convert text to audio

**Implementations**:

1. **Primary**: Google Cloud Text-to-Speech
   - High-quality voice synthesis
   - Multiple language/voice options
   - Requires credentials

2. **Fallback**: espeak + ffmpeg
   - Local, no credentials needed
   - Uses execFile for security
   - Converts to MP3 format

**Process**:
- Generate unique filename (UUID-based)
- Convert text to audio
- Save as MP3 in audio directory
- Return file path

### 5. Audio Merger (src/audioMerger.js)

**Purpose**: Combine multiple audio chunks into one file

**Technology**: FFmpeg with fluent-ffmpeg wrapper

**Process**:
1. Create concat file with absolute paths
2. Use FFmpeg concat demuxer
3. Copy codec (no re-encoding for speed)
4. Output single MP3 file
5. Clean up temporary concat file

**Optimizations**:
- Single file: direct copy (no merging needed)
- Multiple files: concat demuxer (fast)

## Data Flow

### Typical Request Flow

```
User submits URL
    ↓
Server validates URL
    ↓
Playwright scrapes thread
    ↓
Extract 5 tweets (example)
    ↓
Normalize text (remove URLs, emojis, etc.)
    ↓
Split into 3 chunks (1500 chars each)
    ↓
Generate audio for chunk 0 → chunk_0_uuid.mp3
    ↓
Generate audio for chunk 1 → chunk_1_uuid.mp3
    ↓
Generate audio for chunk 2 → chunk_2_uuid.mp3
    ↓
Merge chunks → merged_uuid.mp3
    ↓
Delete chunk files
    ↓
Return audio URL to client
    ↓
Client plays audio
```

## File Organization

```
listen-thread/
├── index.js              # Main server
├── package.json          # Dependencies
├── .env.example          # Configuration template
├── .gitignore           # Git ignore rules
│
├── src/                 # Source modules
│   ├── scraper.js       # Web scraping
│   ├── textNormalizer.js # Text cleaning
│   ├── tts.js           # Text-to-speech
│   └── audioMerger.js   # Audio processing
│
├── public/              # Static files
│   └── index.html       # Web interface
│
├── audio/               # Generated audio (gitignored)
│   └── .gitkeep         # Keep directory in git
│
└── docs/                # Documentation
    ├── README.md
    ├── EXAMPLES.md
    ├── DEPLOYMENT.md
    ├── CONTRIBUTING.md
    └── ARCHITECTURE.md
```

## Security Measures

1. **Input Validation**
   - URL format validation
   - X domain check

2. **Command Injection Prevention**
   - Use `execFile()` instead of `exec()`
   - Arguments passed as array, not string

3. **File System Security**
   - Absolute paths for file operations
   - UUID-based filenames to prevent collisions
   - Isolated audio directory

4. **Process Isolation**
   - Playwright runs in sandboxed browser
   - No user input directly to shell

5. **Rate Limiting**
   - Límites por IP en `/api/convert` (p. ej. 5 req/15 min) y en endpoints API (p. ej. 100 req/15 min).
   - Respuesta 429 con JSON `{ error, retryAfter }` y cabeceras estándar `RateLimit-*`.

## Scalability Considerations

### Current Limitations
- Sequential processing (one request at a time)
- Files stored on local filesystem
- No request queuing
- Rate limiting por IP en memoria (configurable por env; sin store distribuido)

### Improvement Opportunities

1. **Add Queue System**
   - Use Bull/BullMQ for job queue
   - Process requests asynchronously
   - Handle multiple concurrent requests

2. **Cloud Storage**
   - Store audio in S3/Cloud Storage
   - Generate signed URLs
   - Automatic cleanup policies

3. **Caching**
   - Cache converted threads
   - Use URL as cache key
   - Reduce duplicate processing

4. **Horizontal Scaling**
   - Stateless server design allows multiple instances
   - Load balancer distributes requests
   - Shared storage for audio files

5. **Rate Limiting** (implementado)
   - Límites por IP en `/api/convert` y en el resto de la API; configurables por env.
   - Mejoras futuras: store Redis para múltiples instancias, límites por usuario/API key.

## Dependencies

### Core Dependencies
- **express**: Web server framework
- **playwright**: Browser automation for scraping
- **@google-cloud/text-to-speech**: Google TTS API
- **fluent-ffmpeg**: FFmpeg wrapper for audio processing
- **uuid**: Unique ID generation

### System Dependencies
- **Node.js** (v18+): Runtime environment
- **FFmpeg**: Audio processing
- **espeak**: TTS fallback
- **Chromium**: Browser for Playwright

## Performance Metrics

### Typical Processing Times
- Scraping: 3-10 seconds (depends on thread size)
- Text normalization: <100ms
- TTS per chunk: 1-3 seconds
- Audio merging: <1 second
- Total: 10-30 seconds for average thread

### Resource Usage
- Memory: ~200-500MB (including Chromium)
- Disk: ~1-10MB per audio file
- CPU: High during TTS and audio processing

## Error Handling

1. **Scraping Errors**
   - Network timeouts
   - Invalid URLs
   - Private/deleted tweets
   - Changed X structure

2. **TTS Errors**
   - Missing credentials
   - API quota exceeded
   - System tool not installed

3. **Audio Processing Errors**
   - File system permissions
   - Disk space issues
   - FFmpeg failures

All errors are caught and returned as JSON with appropriate HTTP status codes.

## Future Enhancements

1. **Multiple Platforms**
   - Instagram threads
   - Reddit threads
   - LinkedIn posts

2. **Advanced Features**
   - Voice selection
   - Speed control
   - Background music
   - Multiple languages

3. **API Improvements**
   - Authentication
   - Rate limiting con store distribuido (Redis) si se escala horizontalmente
   - Webhooks for completion
   - Progress updates via WebSocket

4. **UI Enhancements**
   - Download progress bar
   - Preview before generation
   - History of conversions
   - Shareable links
