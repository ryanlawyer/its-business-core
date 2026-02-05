# Deployment Guide

This guide covers various deployment options for ITS Business Core.

## Table of Contents

- [Docker (Recommended)](#docker-recommended)
- [Docker Compose](#docker-compose)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [SSL/HTTPS](#sslhttps)
- [Proxmox Deployment](#proxmox-deployment)
- [NAS Deployment](#nas-deployment)
- [Troubleshooting](#troubleshooting)

---

## Docker (Recommended)

The simplest deployment method. One command gets you running:

```bash
docker run -d \
  --name its-core \
  -p 3000:3000 \
  -v its-data:/app/data \
  -v its-uploads:/app/uploads \
  --restart unless-stopped \
  ghcr.io/ryanlawyer/its-business-core:latest
```

### Volume Descriptions

| Volume | Container Path | Purpose |
|--------|---------------|---------|
| `its-data` | `/app/data` | SQLite database, secrets, config |
| `its-uploads` | `/app/uploads` | Uploaded files (receipts, documents) |

### First Run

1. Open `http://your-server:3000` in a browser
2. Complete the 5-step setup wizard
3. Log in with your admin credentials

---

## Docker Compose

For more control and easier management:

```yaml
# docker-compose.yml
services:
  its-core:
    image: ghcr.io/ryanlawyer/its-business-core:latest
    container_name: its-core
    ports:
      - "3000:3000"
    volumes:
      - its-data:/app/data
      - its-uploads:/app/uploads
    environment:
      - TZ=America/New_York  # Optional: set timezone
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  its-data:
  its-uploads:
```

Commands:

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Update to latest version
docker-compose pull
docker-compose up -d
```

---

## Reverse Proxy Setup

For production deployments, run ITS Business Core behind a reverse proxy for SSL termination and better security.

### Nginx

```nginx
# /etc/nginx/sites-available/its-core
server {
    listen 80;
    server_name its.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name its.example.com;

    ssl_certificate /etc/letsencrypt/live/its.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/its.example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Upload size limit (for receipts)
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy

```caddyfile
# Caddyfile
its.example.com {
    reverse_proxy localhost:3000
}
```

Caddy automatically handles SSL certificates via Let's Encrypt.

### Traefik (Docker Labels)

```yaml
# docker-compose.yml with Traefik
services:
  its-core:
    image: ghcr.io/ryanlawyer/its-business-core:latest
    volumes:
      - its-data:/app/data
      - its-uploads:/app/uploads
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.its-core.rule=Host(`its.example.com`)"
      - "traefik.http.routers.its-core.entrypoints=websecure"
      - "traefik.http.routers.its-core.tls.certresolver=letsencrypt"
      - "traefik.http.services.its-core.loadbalancer.server.port=3000"
    restart: unless-stopped

volumes:
  its-data:
  its-uploads:
```

---

## SSL/HTTPS

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d its.example.com

# Auto-renewal is configured automatically
```

### Self-Signed (Development/Internal)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/its-core.key \
  -out /etc/ssl/certs/its-core.crt
```

---

## Proxmox Deployment

### Option 1: LXC Container with Docker

1. Create an Ubuntu LXC container:
   ```bash
   pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
     --hostname its-core \
     --memory 1024 \
     --cores 2 \
     --rootfs local-lvm:8 \
     --net0 name=eth0,bridge=vmbr0,ip=dhcp
   ```

2. Start and enter the container:
   ```bash
   pct start 100
   pct enter 100
   ```

3. Install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

4. Run ITS Business Core:
   ```bash
   docker run -d \
     --name its-core \
     -p 3000:3000 \
     -v its-data:/app/data \
     -v its-uploads:/app/uploads \
     --restart unless-stopped \
     ghcr.io/ryanlawyer/its-business-core:latest
   ```

### Option 2: VM with Docker

1. Create a VM with Ubuntu Server
2. Install Docker
3. Follow standard Docker deployment instructions

### Backup Integration

Add to your Proxmox backup schedule or use the built-in backup commands:

```bash
# Run inside the LXC/VM
docker exec its-core /app/scripts/backup.sh full > /var/backups/its-core-$(date +%Y%m%d).tar.gz
```

---

## NAS Deployment

### Synology (Container Manager / Docker)

1. Open **Container Manager** (or Docker package)
2. Go to **Registry** → Search for `ghcr.io/ryanlawyer/its-business-core`
3. Download the `latest` tag
4. Go to **Image** → Select the image → **Launch**
5. Configure:
   - **Container Name**: `its-core`
   - **Port Settings**: Local 3000 → Container 3000
   - **Volume Settings**:
     - `/volume1/docker/its-core/data` → `/app/data`
     - `/volume1/docker/its-core/uploads` → `/app/uploads`
6. Start the container
7. Access via `http://nas-ip:3000`

### QNAP (Container Station)

1. Open **Container Station**
2. Go to **Create** → **Create Application**
3. Use this compose file:

```yaml
services:
  its-core:
    image: ghcr.io/ryanlawyer/its-business-core:latest
    ports:
      - "3000:3000"
    volumes:
      - /share/Container/its-core/data:/app/data
      - /share/Container/its-core/uploads:/app/uploads
    restart: unless-stopped
```

4. Deploy and access via `http://nas-ip:3000`

### Automated Backups on NAS

Create a scheduled task to run daily:

```bash
#!/bin/bash
# /share/scripts/backup-its-core.sh

BACKUP_DIR="/share/Backups/its-core"
DATE=$(date +%Y%m%d)

# Create backup
docker exec its-core /app/scripts/backup.sh data > "$BACKUP_DIR/its-core-$DATE.tar.gz"

# Keep only last 30 days
find "$BACKUP_DIR" -name "its-core-*.tar.gz" -mtime +30 -delete
```

---

## Troubleshooting

### Container won't start

Check logs:
```bash
docker logs its-core
```

Common issues:
- **Port already in use**: Change the host port (e.g., `-p 3001:3000`)
- **Permission issues**: Ensure volumes are writable

### Setup wizard loops

The setup wizard redirects if the database isn't properly initialized:

```bash
# Check database exists
docker exec its-core ls -la /app/data/

# Force re-initialization (WARNING: destroys data)
docker stop its-core
docker rm its-core
docker volume rm its-data
# Then re-run the container
```

### Can't upload files

Check upload directory permissions:
```bash
docker exec its-core ls -la /app/uploads/
```

Ensure the volume is mounted correctly and writable.

### Database locked errors

SQLite doesn't support multiple concurrent writers. Ensure only one instance is running:
```bash
docker ps | grep its-core
```

### Reset admin password

If you forget your admin password:

```bash
# Enter the container
docker exec -it its-core sh

# Use SQLite to reset (sets password to "admin123")
sqlite3 /app/data/database.db "UPDATE user SET password='\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE email='admin@example.com';"
```

Then log in with `admin123` and change it immediately.

### Check system health

```bash
# Container status
docker ps

# Resource usage
docker stats its-core

# Disk usage
docker exec its-core du -sh /app/data /app/uploads
```

---

## Resource Requirements

| Deployment | RAM | CPU | Storage |
|------------|-----|-----|---------|
| Minimum | 512MB | 1 core | 1GB |
| Recommended | 1GB | 2 cores | 5GB |
| Production | 2GB | 2+ cores | 10GB+ |

Storage needs grow with:
- Number of uploaded receipts/documents
- Database size (users, POs, timeclock entries)
- Backup retention

---

## Security Checklist

- [ ] Run behind HTTPS (reverse proxy with SSL)
- [ ] Use strong admin password
- [ ] Keep Docker image updated
- [ ] Regular backups (test restores!)
- [ ] Firewall: only expose necessary ports
- [ ] Consider network isolation for the container

---

For backup and restore procedures, see [backup-restore.md](backup-restore.md).
