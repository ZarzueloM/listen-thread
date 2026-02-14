# Deployment Guide

This guide covers deploying the Listen Thread application to various platforms.

## Prerequisites

- Node.js 18 or higher
- FFmpeg installed
- espeak installed (for TTS fallback)
- Git

## Local Development

1. Clone and install:
```bash
git clone https://github.com/ZarzueloM/listen-thread.git
cd listen-thread
npm install
npx playwright install chromium
```

2. Start the server:
```bash
npm start
```

3. Open http://localhost:3000

## Production Deployment

### Using Docker (Recommended)

Create a `Dockerfile`:

```dockerfile
FROM node:18-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    espeak \
    chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production

# Install Playwright
RUN npx playwright install chromium --with-deps

# Copy application files
COPY . .

# Create audio directory
RUN mkdir -p audio

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t listen-thread .
docker run -p 3000:3000 listen-thread
```

### Deploy to Heroku

1. Create a `Procfile`:
```
web: npm start
```

2. Add buildpacks:
```bash
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
```

3. Deploy:
```bash
git push heroku main
```

### Deploy to Railway

1. Connect your GitHub repository to Railway
2. Add environment variables if needed
3. Railway will auto-detect and deploy Node.js app

### Deploy to Vercel

**Note:** Vercel has limitations with file system operations. Consider using serverless functions with external storage.

### Deploy to DigitalOcean

1. Create a Droplet with Ubuntu
2. SSH into the server
3. Install Node.js, FFmpeg, and espeak:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs ffmpeg espeak
```

4. Clone and setup:
```bash
git clone https://github.com/ZarzueloM/listen-thread.git
cd listen-thread
npm install
npx playwright install chromium --with-deps
```

5. Use PM2 for process management:
```bash
sudo npm install -g pm2
pm2 start index.js --name listen-thread
pm2 startup
pm2 save
```

6. Setup Nginx as reverse proxy:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Variables

Set these in your deployment platform:

```env
PORT=3000
NODE_ENV=production

# TTS: Speechify (primary). When set, voices are: male -> carlos, female -> carmen (selectable in the UI).
SPEECHIFY_API_KEY=your_api_key  # Optional; get it at https://speechify.com

# TTS fallback when SPEECHIFY_API_KEY is not set
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json  # Optional
```

**TTS priority:** If `SPEECHIFY_API_KEY` is set, Speechify is used and the user can choose voice gender (Masculino/Carlos or Femenino/Carmen) in the web UI. Otherwise the app uses Google Cloud TTS (if configured) or espeak.

## Post-Deployment

### Setup SSL with Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Monitor Logs

Using PM2:
```bash
pm2 logs listen-thread
```

Using Docker:
```bash
docker logs -f <container-id>
```

### Cleanup Old Audio Files

The app includes **built-in cleanup**: merged MP3 files older than a configurable TTL are removed automatically.

- Set `AUDIO_MAX_AGE_HOURS` in `.env` (e.g. `24` for 24 hours). Use `0` to disable.
- Files newer than `AUDIO_MIN_AGE_MINUTES` (default 15) are never deleted, so a file that was just created and is being played is safe.
- Cleanup runs at server startup and then every hour.
- Only `merged_*.mp3` files are removed; chunk files are already deleted right after each conversion.

Example:
```bash
AUDIO_MAX_AGE_HOURS=24
```

**Optional (external cron):** If you prefer to rely on cron instead of the built-in scheduler:

```bash
# Add to crontab (crontab -e)
0 2 * * * find /path/to/listen-thread/audio -name "merged_*.mp3" -mtime +1 -delete
```

If using cron, you can set `AUDIO_MAX_AGE_HOURS=0` to disable the in-app cleanup.

## Scaling Considerations

1. **Rate Limiting**: Add rate limiting to prevent abuse
2. **Queue System**: Use Bull or BullMQ for processing jobs
3. **Cloud Storage**: Store audio files in S3/Cloud Storage
4. **Load Balancing**: Use multiple instances behind a load balancer
5. **Caching**: Cache frequently requested threads

## Security Recommendations

1. Add API authentication
2. Implement rate limiting
3. Validate and sanitize all inputs
4. Keep dependencies updated
5. Use HTTPS in production
6. Set up monitoring and alerts

## Monitoring

Consider using:
- PM2 Plus for process monitoring
- New Relic or DataDog for application monitoring
- Sentry for error tracking
- Google Analytics for usage tracking
