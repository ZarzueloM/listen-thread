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

### Deploy to VM with GitHub Actions (e.g. Google Cloud)

The repo includes a workflow (`.github/workflows/deploy.yml`) that deploys to a VM on every push to `main`. It uses SSH + rsync and PM2 on the VM.

**Path on VM:** `/var/www/listen-thread`

**Secrets required** (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `SSH_PRIVATE_KEY` | Full private key (including `-----BEGIN ... END ...-----`) for SSH to the VM. If you get "Load key ... error in libcrypto", re-paste the key (no extra spaces/newlines) or use base64: run `base64 -w0 your_key` (Linux) or `base64 < your_key | tr -d '\n'` (macOS) and set the secret to `base64:` + that output. |
| `SSH_USERNAME` | SSH user on the VM (e.g. Debian default user) |
| `SSH_HOST` | VM IP or hostname |
| `DOTENV_CONTENT` | Full contents of `.env` for production (e.g. `PORT=3000`, `SPEECHIFY_API_KEY=...`, `AUDIO_MAX_AGE_HOURS=24`) |

**SSH keys for GitHub Actions — step-by-step**

Do this once. Use a dedicated key pair only for deploy (not your personal SSH key).

1. **Create the key pair (on your machine)**

   ```bash
   cd ~/.ssh
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_listen_thread -N ""
   ```

   This creates:
   - `deploy_listen_thread` — **private** key (→ GitHub Secret)
   - `deploy_listen_thread.pub` — **public** key (→ VM)

2. **Install the public key on the VM**

   From your machine, with your normal SSH access to the VM. If you use a **key** (no password), set `MY_KEY` to that key path and use it in every command:

   ```bash
   # Replace USER, VM_IP and, if you use a key, MY_KEY (e.g. ~/.ssh/id_rsa or ~/.ssh/google_compute_engine)
   MY_KEY=~/.ssh/tu_clave_actual   # la que ya usas para entrar a la VM
   ssh -i "$MY_KEY" USER@VM_IP "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
   scp -i "$MY_KEY" ~/.ssh/deploy_listen_thread.pub USER@VM_IP:~/.ssh/
   ssh -i "$MY_KEY" USER@VM_IP "cat ~/.ssh/deploy_listen_thread.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && rm ~/.ssh/deploy_listen_thread.pub"
   ```

   Or manually: SSH in with your key (`ssh -i "$MY_KEY" USER@VM_IP`), then edit `~/.ssh/authorized_keys` and paste the **entire** content of `deploy_listen_thread.pub` as a single line.

   **If you only use Google Cloud in-browser SSH** (no local SSH): you have the private key as text and need to get the public key and add it on the VM. On your **local** machine: save the private key to a file (e.g. `deploy_key`), then run `ssh-keygen -y -f deploy_key` — the output is the public key (one line). Copy it. In the **Google Cloud console** → Compute Engine → your VM → **SSH** (browser window). In that terminal run: `mkdir -p ~/.ssh && echo 'PEGA_AQUÍ_LA_LÍNEA_PÚBLICA' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`. Replace `PEGA_AQUÍ_LA_LÍNEA_PÚBLICA` with the line you got from `ssh-keygen -y`. Then you can delete the local `deploy_key` file if you prefer.

3. **Test login from your machine (same key GitHub will use)**

   ```bash
   ssh -i ~/.ssh/deploy_listen_thread USER@VM_IP "echo OK"
   ```

   You must see `OK`. If you get "Permission denied (publickey)", the public key is not correctly in `authorized_keys` or the user/path is wrong.

4. **Put the private key in GitHub Secrets**

   - Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `SSH_PRIVATE_KEY`
   - Value: either paste the **entire** content of `deploy_listen_thread` (from `-----BEGIN OPENSSH PRIVATE KEY-----` to `-----END OPENSSH PRIVATE KEY-----`), or use base64 to avoid paste issues:
     ```bash
     # Linux
     echo -n "base64:$(base64 -w0 ~/.ssh/deploy_listen_thread)"
     # Copy the output and paste as the secret value (including the "base64:" prefix)
     ```
   - Also create/check: `SSH_USERNAME` = same `USER` as above, `SSH_HOST` = same `VM_IP` (or hostname).

5. **Trigger the workflow** (push to `main`) and check the Actions tab.

**Checklist — only you can do (VM and GitHub):**

- **VM and access**
  - Create the instance (e.g. Google Cloud: Debian 12, 2 vCPU, 1 GB RAM, 10 GB disk) and allow SSH (port 22).
  - Generate an SSH key pair for GitHub Actions; add the **public** key to the VM (`~/.ssh/authorized_keys`).
  - Store the **private** key in the repo secret `SSH_PRIVATE_KEY`.
- **GitHub**
  - Add the four secrets above.
- **VM one-time setup**
  - Install Node.js 18+ (e.g. NodeSource or nvm). If you use nvm, the workflow runs remote commands in a login shell (`bash -lc`) so nvm’s PATH is available.
  - Install rsync (required for deploy): `sudo apt-get install -y rsync`. The workflow can install it automatically if the user has passwordless sudo.
  - Install FFmpeg: `apt-get install -y ffmpeg`.
  - Optional: `apt-get install -y espeak` for TTS fallback without Speechify.
  - Install PM2: `npm install -g pm2`.
  - Create deploy dir: `sudo mkdir -p /var/www/listen-thread && sudo chown $USER:$USER /var/www/listen-thread`.
  - After the first successful deploy, run `pm2 startup` (apply the suggested command), then `pm2 save`.
- **Check**
  - Test SSH: `ssh -i <private_key> <SSH_USERNAME>@<SSH_HOST>`.
  - After a push to `main`, check the Actions tab and on the VM run `pm2 logs listen-thread`.

**Note (1 GB RAM):** If the app or Chromium runs out of memory, consider adding `--disable-dev-shm-usage` and `--disable-gpu` to the Chromium launch args in `src/scraper.js`.

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
