# Deployment Guide

Guía para desarrollo local y despliegue en una VM mediante GitHub Actions.

## Prerequisites

- Node.js 20 o 18 (LTS)
- FFmpeg
- Git
- espeak (opcional, para TTS fallback sin Speechify)

## Local Development

1. Clonar e instalar:

```bash
git clone https://github.com/ZarzueloM/listen-thread.git
cd listen-thread
npm install
npx playwright install chromium
```

2. Arrancar el servidor:

```bash
npm start
```

3. Abrir http://localhost:3000

## Production: Deploy to VM with GitHub Actions

El repositorio incluye un workflow (`.github/workflows/deploy.yml`) que despliega en una VM en cada push a `main`. Usa SSH, rsync y PM2 en la VM (p. ej. Google Cloud).

**Ruta en la VM:** `/var/www/listen-thread`

### Secrets necesarios

En el repo: **Settings** → **Secrets and variables** → **Actions**:

| Secret | Descripción |
|--------|-------------|
| `SSH_PRIVATE_KEY` | Clave privada SSH completa (incluyendo `-----BEGIN ... END ...-----`). Si aparece "Load key ... error in libcrypto", pegar de nuevo la clave o usar base64: `base64 -w0 tu_clave` (Linux) o `base64 < tu_clave \| tr -d '\n'` (macOS) y guardar el secret como `base64:` + esa salida. |
| `SSH_USERNAME` | Usuario SSH en la VM |
| `SSH_HOST` | IP o hostname de la VM |
| `DOTENV_CONTENT` | Contenido completo del `.env` de producción (véase ejemplo más abajo). El workflow escribe este contenido en `/var/www/listen-thread/.env` en cada deploy. |

**Ejemplo de contenido del secret `DOTENV_CONTENT`** (literal, sin comillas extra):

```
PORT=3000
NODE_ENV=production
HOST=127.0.0.1
SPEECHIFY_API_KEY=tu_api_key_si_la_tienes
AUDIO_MAX_AGE_HOURS=24
AUDIO_MIN_AGE_MINUTES=15
```

### Qué se transfiere (rsync)

El workflow excluye para no sobrescribir ni subir archivos innecesarios: `node_modules/`, `.env` (se genera en la VM desde el secret), `.git/`, `audio/`. El directorio `audio` en la VM lo crea la app al arrancar si no existe.

### Claves SSH para GitHub Actions (paso a paso)

Usar un par de claves solo para este deploy.

1. **Crear el par (en tu máquina)**

   ```bash
   cd ~/.ssh
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_listen_thread -N ""
   ```

   Se generan `deploy_listen_thread` (privada → GitHub Secret) y `deploy_listen_thread.pub` (pública → VM).

2. **Instalar la clave pública en la VM**

   Si **`authorized_keys` no existe** en la VM, hay que crearlo. Elige una opción según cómo entres a la VM.

   **Opción A — Entras por consola del proveedor (p. ej. Google Cloud “SSH”)**

   - En **tu máquina** (donde tienes la clave privada del deploy), obtén la línea pública:
     ```bash
     ssh-keygen -y -f ~/.ssh/deploy_listen_thread
     ```
     Copia la línea entera (empieza por `ssh-ed25519` o `ssh-rsa`).
   - En la **VM** (consola en el navegador), ejecuta (sustituye `TU_USUARIO` por el usuario con el que estás y pega la línea que copiaste en lugar de `LÍNEA_PÚBLICA`):
     ```bash
     mkdir -p ~/.ssh
     chmod 700 ~/.ssh
     echo 'LÍNEA_PÚBLICA' >> ~/.ssh/authorized_keys
     chmod 600 ~/.ssh/authorized_keys
     ```
     Ejemplo: `echo 'ssh-ed25519 AAAAC3... usuario@host' >> ~/.ssh/authorized_keys`

   **Opción B — Entras desde tu máquina por SSH con otra clave**

   ```bash
   MY_KEY=~/.ssh/tu_clave_actual
   USER=tu_usuario_en_la_vm
   VM_IP=la_ip_de_la_vm

   ssh -i "$MY_KEY" "$USER@$VM_IP" "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
   scp -i "$MY_KEY" ~/.ssh/deploy_listen_thread.pub "$USER@$VM_IP:~/.ssh/"
   ssh -i "$MY_KEY" "$USER@$VM_IP" "cat ~/.ssh/deploy_listen_thread.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && rm ~/.ssh/deploy_listen_thread.pub"
   ```
   (Si `authorized_keys` no existía, `>>` lo crea.)

3. **Probar conexión**

   ```bash
   ssh -i ~/.ssh/deploy_listen_thread USER@VM_IP "echo OK"
   ```

   Debe imprimir `OK`.

4. **Guardar la clave privada en GitHub**

   Secret `SSH_PRIVATE_KEY`: pegar todo el contenido de `deploy_listen_thread`, o usar el valor `base64:` + salida de `base64 -w0 ~/.ssh/deploy_listen_thread`. Crear también `SSH_USERNAME` y `SSH_HOST`.

5. **Disparar el deploy** (push a `main`) y revisar la pestaña Actions.

### Si aparece "Permission denied (publickey)"

Significa que la VM no acepta la clave que usa el workflow. Comprueba:

1. **Mismo par de claves**  
   La clave **pública** que está en la VM debe ser la pareja de la clave **privada** que guardaste en el secret `SSH_PRIVATE_KEY`.  
   En tu máquina, con la misma clave privada que usaste para el secret:
   ```bash
   ssh-keygen -y -f ~/.ssh/deploy_listen_thread
   ```
   Esa salida (una línea que empieza por `ssh-ed25519` o `ssh-rsa`) debe estar **exactamente** en `~/.ssh/authorized_keys` **del usuario** con el que te conectas (`SSH_USERNAME`). Si en la VM usas otro usuario, la clave debe estar en **ese** usuario: `~usuario/.ssh/authorized_keys`.

2. **Usuario correcto**  
   El secret `SSH_USERNAME` debe ser el usuario de la VM en cuyo `$HOME` añadiste la clave (p. ej. si entras con `mariano@IP`, en la VM la clave está en `/home/mariano/.ssh/authorized_keys`; entonces `SSH_USERNAME` debe ser `mariano`).

3. **Permisos en la VM**  
   En la VM:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```
   El directorio `$HOME` no debe ser escribible por otros (p. ej. `chmod 755` o más restrictivo).

4. **Probar desde tu máquina**  
   Con la **misma** clave privada que está en el secret:
   ```bash
   ssh -i ~/.ssh/deploy_listen_thread TU_USUARIO@IP_VM "echo OK"
   ```
   Si aquí falla, el problema está en la VM o en el par de claves; si aquí funciona y en Actions no, revisa que el secret `SSH_PRIVATE_KEY` sea exactamente esa clave (sin líneas de más, sin cortar; si usas base64, que el secret sea `base64:` + la salida de `base64 -w0` del archivo).

5. **Formato del secret**  
   Si al pegar la clave en GitHub da problemas (espacios, encoding), guarda el secret en base64: en tu máquina `base64 -w0 ~/.ssh/deploy_listen_thread`, y en GitHub pon como valor del secret: `base64:` seguido de esa salida (todo junto, sin saltos de línea).

### Orden recomendado (desde cero)

1. Crear la VM (p. ej. Google Cloud: Debian 12, 2 vCPU, 1 GB RAM, 10 GB disco) y asegurar acceso SSH (puerto 22 abierto).
2. Generar el par de claves para GitHub Actions e instalar la clave **pública** en la VM (`~/.ssh/authorized_keys`). Guardar la **privada** para el paso 4.
3. Preparación única en la VM: Node.js 20, rsync, FFmpeg, dependencias de Playwright/Chromium, PM2, directorio `/var/www/listen-thread` con permisos para tu usuario.
4. En GitHub: crear los cuatro secrets (`SSH_PRIVATE_KEY`, `SSH_USERNAME`, `SSH_HOST`, `DOTENV_CONTENT`).
5. Primer push a `main`; revisar el workflow en Actions. Luego, en la VM: ejecutar `pm2 startup` y aplicar el comando que indique (con sudo); después `pm2 save`.

### Checklist en la VM y en GitHub

- **VM y acceso:** Crear la instancia (p. ej. Google Cloud: Debian 12, 2 vCPU, 1 GB RAM, 10 GB disco), abrir puerto 22. Añadir la clave pública del deploy a `~/.ssh/authorized_keys` y la privada en el secret `SSH_PRIVATE_KEY`.
- **GitHub:** Configurar los cuatro secrets.
- **Setup único en la VM:**
  - Node.js 20 (global, no nvm). Debian/Ubuntu:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```
  - rsync: `sudo apt-get install -y rsync` (el workflow puede instalarlo si hay sudo sin contraseña).
  - FFmpeg: `sudo apt-get install -y ffmpeg`.
  - Dependencias de Playwright/Chromium (una vez): `npx playwright install-deps chromium`.
  - Opcional espeak: `sudo apt-get install -y espeak`.
  - PM2: `sudo npm install -g pm2`.
  - Directorio de deploy: `sudo mkdir -p /var/www/listen-thread && sudo chown $USER:$USER /var/www/listen-thread`.
  - **PM2 (primera vez):** Tras el primer deploy (o tras arrancar la app una vez), ejecutar `pm2 startup` en la VM; te mostrará un comando para ejecutar con sudo (cópialo y ejecútalo). Luego `pm2 save`. Así el proceso se levanta al reiniciar la VM. El workflow ya hace `pm2 restart`/`start` y `pm2 save` en cada deploy.
- **Comprobar:** Probar SSH desde tu máquina con la clave del deploy: `ssh -i <clave_privada> <SSH_USERNAME>@<SSH_HOST>`. Tras un push a `main`, revisar el run en la pestaña Actions y en la VM `pm2 logs listen-thread`.

**Nota (1 GB RAM):** Si la app o Chromium se quedan sin memoria, se pueden añadir `--disable-dev-shm-usage` y `--disable-gpu` a los argumentos de Chromium en `src/scraper.js`.

## Environment Variables

Configurar en producción (secret `DOTENV_CONTENT` o `.env` en la VM):

```env
PORT=3000
NODE_ENV=production

# Detrás de proxy (Nginx): atar la app solo a localhost (recomendado en producción)
HOST=127.0.0.1

# TTS: Speechify. Si está definido, se usan voces Carlos/Carmen.
SPEECHIFY_API_KEY=your_api_key   # Opcional

# Fallback TTS sin Speechify
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json   # Opcional

# Rate limiting (opcional; por defecto: 5 req/15 min convert, 100 req/15 min API)
RATE_LIMIT_CONVERT_MAX=5
RATE_LIMIT_CONVERT_WINDOW_MS=900000
RATE_LIMIT_API_MAX=100
RATE_LIMIT_API_WINDOW_MS=900000
```

Si existe `SPEECHIFY_API_KEY` se usa Speechify; si no, Google Cloud TTS o espeak.

**Rate limiting:** Límites por IP en memoria (sin Redis, adecuado para 1 instancia y 1 GB RAM). `/api/convert` usa `RATE_LIMIT_CONVERT_*`; el resto de la API (p. ej. `/api/health`) usa `RATE_LIMIT_API_*`. Las respuestas 429 incluyen `retryAfter` en segundos.

## Post-Deployment

### Proxy inverso y HTTPS (Nginx + Let's Encrypt)

Para publicar la app con tu dominio y HTTPS hace falta un proxy inverso en la VM. Requisitos previos: dominio contratado, DNS apuntando a la IP pública de la VM, y puertos **80** y **443** abiertos en el firewall de la red (Google Cloud Console → VPC → Firewall, o `gcloud compute firewall-rules create`). La app sigue en el puerto 3000; Nginx escucha 80/443 y reenvía al backend.

**Config versionada:** El repo incluye `deploy/nginx-listen-thread.conf` (solo HTTP en puerto 80). Certbot modificará ese archivo al ejecutar `certbot --nginx` para añadir el server 443 y la redirección HTTP→HTTPS.

**Comandos en la VM** (sustituir `TU_DOMINIO` por tu dominio; el archivo debe estar en la VM, p. ej. tras un deploy en `/var/www/listen-thread/deploy/`):

```bash
# Instalar Nginx
sudo apt-get update
sudo apt-get install -y nginx

# Copiar config y sustituir DOMINIO
sudo cp /var/www/listen-thread/deploy/nginx-listen-thread.conf /etc/nginx/sites-available/listen-thread
sudo sed -i 's/DOMINIO/TU_DOMINIO/g' /etc/nginx/sites-available/listen-thread

# Activar site y quitar default
sudo ln -sf /etc/nginx/sites-available/listen-thread /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Comprobar y recargar Nginx
sudo nginx -t && sudo systemctl reload nginx

# Certificado SSL (certbot modificará la config y añadirá HTTPS)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d TU_DOMINIO

# Comprobar renovación automática
sudo certbot renew --dry-run
```

**Optimización para 1 GB RAM:** La config del site ya usa buffers de proxy reducidos. Opcionalmente en la VM puedes editar `/etc/nginx/nginx.conf` y poner `worker_processes 1;` y en `events { }` el valor `worker_connections 512;` (referencia en `deploy/nginx-main-snippet.conf`). Luego: `sudo nginx -t && sudo systemctl reload nginx`.

### Logs

```bash
pm2 logs listen-thread
```

### Limpieza de audio

La app elimina automáticamente los MP3 fusionados más viejos que el TTL configurado.

- `AUDIO_MAX_AGE_HOURS` en `.env` (ej. `24`). `0` para desactivar.
- Los archivos más recientes que `AUDIO_MIN_AGE_MINUTES` (por defecto 15) no se borran.
- La limpieza se ejecuta al arrancar y cada hora.

## Security

- Usar HTTPS en producción.
- Validar y sanitizar entradas.
- Mantener dependencias actualizadas.
- Rate limiting activo por IP (configurable por env); en producción puede ajustarse según carga.
