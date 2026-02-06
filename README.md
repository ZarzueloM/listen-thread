# Listen Thread 🎧

Convierte hilos de Twitter/X a audio mediante text-to-speech.

## Características

- 🔍 **Scraping de hilos**: Extrae tweets del autor original (OP) usando Playwright
- 🧹 **Normalización de texto**: Elimina URLs, emojis, "RT", menciones (@usuario)
- 🔊 **Text-to-Speech**: Convierte el texto a audio
- 📦 **División en chunks**: Divide textos largos en fragmentos de ~1500 caracteres
- 🎵 **Unión de audio**: Combina todos los chunks en un único archivo MP3
- 🌐 **API REST**: Backend con Node.js y Express

## Requisitos

- Node.js (v18 o superior)
- FFmpeg (para procesamiento de audio)
- (Opcional) Credenciales de Google Cloud Text-to-Speech

### Instalar FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg espeak
```

**macOS:**
```bash
brew install ffmpeg espeak
```

**Windows:**
Descarga FFmpeg desde [ffmpeg.org](https://ffmpeg.org/download.html)

## Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/ZarzueloM/listen-thread.git
cd listen-thread
```

2. Instala las dependencias:
```bash
npm install
```

3. Instala los navegadores de Playwright:
```bash
npx playwright install chromium
```

4. (Opcional) Configura Google Cloud TTS:
   - Crea un proyecto en Google Cloud
   - Habilita la API de Text-to-Speech
   - Descarga las credenciales JSON
   - Configura la variable de entorno:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

## Uso

1. Inicia el servidor:
```bash
npm start
```

2. Abre tu navegador en `http://localhost:3000`

3. Pega la URL de un tweet que sea parte de un hilo

4. Haz clic en "Convertir a Audio"

5. Espera a que se procese el hilo y descarga el audio

## API

### POST /api/convert

Convierte un hilo de Twitter/X a audio.

**Request:**
```json
{
  "url": "https://twitter.com/username/status/1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "audioUrl": "/audio/merged_1234567890.mp3",
  "tweets": 5,
  "chunks": 3
}
```

### GET /api/health

Verifica el estado del servidor.

**Response:**
```json
{
  "status": "ok"
}
```

## Arquitectura

```
listen-thread/
├── index.js                 # Servidor Express principal
├── src/
│   ├── scraper.js          # Scraping con Playwright
│   ├── textNormalizer.js   # Normalización de texto
│   ├── tts.js              # Text-to-Speech
│   └── audioMerger.js      # Unión de archivos de audio
├── public/
│   └── index.html          # Frontend web
├── audio/                   # Archivos de audio generados
└── package.json
```

## Proceso de Conversión

1. **Scraping**: Playwright navega al tweet y extrae todos los tweets del hilo del autor original
2. **Normalización**: Limpia el texto eliminando URLs, emojis, RTs y menciones
3. **Chunking**: Divide el texto en fragmentos de ~1500 caracteres
4. **TTS**: Convierte cada chunk a audio (MP3)
5. **Merge**: Une todos los archivos de audio en uno solo
6. **Cleanup**: Elimina los archivos temporales
7. **Response**: Devuelve la URL del audio final

## Notas

- El scraping puede fallar si Twitter/X cambia su estructura HTML
- Sin credenciales de Google Cloud TTS, se usa espeak como fallback
- Los archivos de audio se almacenan en la carpeta `audio/`
- Se recomienda implementar limpieza periódica de archivos antiguos

## Licencia

ISC
