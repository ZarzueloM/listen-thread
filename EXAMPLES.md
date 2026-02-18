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

Con voz femenina (Speechify: `carmen`; sin Speechify usa la voz femenina de Google/espeak):

```bash
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://x.com/username/status/1234567890",
    "gender": "female"
  }'
```

Parámetros del body:
- `url` (requerido): URL del hilo en X.
- `gender` (opcional): `"male"` (por defecto, voz `carlos`) o `"female"` (voz `carmen`).

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

El módulo TTS usa esta prioridad (ver `ARCHITECTURE.md`): **Speechify** → Google Cloud TTS → espeak+ffmpeg.

**Con Speechify (recomendado, el que está implementado en el proyecto):**

```javascript
const { textToSpeech } = require('./src/tts');

async function test() {
  // Voz por defecto: 'carlos'. Alternativa: 'carmen'
  const audioFile = await textToSpeech('Hola mundo', 0, { voiceId: 'carlos' });
  console.log('Audio creado:', audioFile);
}

test();
```

**Con voz femenina (Speechify o Google):**

```javascript
const { textToSpeech } = require('./src/tts');

async function test() {
  const audioFile = await textToSpeech('Hola mundo', 0, { voiceId: 'carmen' });
  console.log('Audio creado:', audioFile);
}

test();
```

**Sin API keys (fallback espeak):**

```javascript
const { textToSpeech } = require('./src/tts');

async function test() {
  // Sin SPEECHIFY_API_KEY ni GOOGLE_APPLICATION_CREDENTIALS usa espeak + ffmpeg
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
  
  // Crear fragmentos (Speechify/Google/espeak según configuración)
  for (let i = 0; i < 3; i++) {
    const file = await textToSpeech(`Fragmento ${i}`, i, { voiceId: 'carlos' });
    files.push(file);
  }
  
  // Unir
  const merged = await mergeAudioFiles(files);
  console.log('Audio unificado:', merged);
}

test();
```

## Environment Variables

Crea un archivo `.env`:

```env
# Puerto del servidor (por defecto: 3000)
PORT=3000

# Speechify (principal TTS en el proyecto)
# Si está definido, se usa la API de Speechify para sintetizar voz
SPEECHIFY_API_KEY=tu_api_key_de_speechify

# Google Cloud TTS (opcional, fallback si no hay Speechify)
# Si no está definido y no hay Speechify, se usa espeak como fallback
GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/credentials.json
```

## Notas

- El scraper carga el hilo en un navegador headless (Playwright).
- Solo se extraen tweets del autor original (OP) del hilo.
- El texto se normaliza: se eliminan URLs, emojis, menciones y "RT".
- Los textos largos se dividen en fragmentos de ~1500 caracteres para mejor calidad TTS.
- Los fragmentos de audio se unen automáticamente en un solo MP3 (ffmpeg).
- Los archivos generados se guardan en el directorio `audio/`.

**Motores TTS (orden de uso):**

1. **Speechify**: si `SPEECHIFY_API_KEY` está definida. Voces: `carlos`, `carmen`.
2. **Google Cloud TTS**: si `GOOGLE_APPLICATION_CREDENTIALS` está definido.
3. **espeak + ffmpeg**: local, sin credenciales.

## Troubleshooting

### Scraping Fails

Si el scraping falla puede deberse a:
- Cambios en la estructura HTML de X
- Límites de tasa o bloqueos
- Problemas de conectividad

### TTS Not Working

Si el TTS no funciona:
- **Speechify**: comprueba que `SPEECHIFY_API_KEY` sea correcta y tenga cuota.
- **Google**: comprueba que las credenciales en `GOOGLE_APPLICATION_CREDENTIALS` sean válidas.
- **espeak**: asegúrate de tener instalados `espeak` y `ffmpeg`.
- Comprueba permisos de escritura en el directorio `audio/`.

### Audio Quality

Para mejorar la calidad del audio:
- Usa **Speechify** con `SPEECHIFY_API_KEY` (es la opción principal del proyecto).
- O configura Google Cloud Text-to-Speech con `GOOGLE_APPLICATION_CREDENTIALS`.
- Ajusta el tamaño de fragmentos en `index.js` (p. ej. 1500 caracteres).
- En `src/tts.js` puedes cambiar el `voiceId` (Speechify) o la voz de Google.
