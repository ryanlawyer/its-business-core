# Docker Deployment Guide

This guide covers deploying ITS Business Core as a standalone Docker container.

## 📋 Prerequisites

- Docker installed on your system
- Docker Compose (optional, but recommended)

## 🚀 Quick Start with Docker Compose

### 1. Build and Start the Container

```bash
cd its-business-core
docker-compose up -d
```

This will:
- Build the Docker image
- Create persistent volumes for database and uploads
- Start the container on port 3000
- Automatically initialize the database with seed data

### 2. Access the Application

Open your browser to: **http://localhost:3000**

### 3. Login with Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123 |
| Manager | manager@example.com | manager123 |
| User | user@example.com | user123 |

### 4. View Logs

```bash
docker-compose logs -f
```

### 5. Stop the Container

```bash
docker-compose down
```

**Note:** This stops the container but keeps your data (volumes persist).

### 6. Remove Everything (Including Data)

```bash
docker-compose down -v
```

**⚠️ Warning:** This deletes all data including the database and uploaded files.

---

## 🔧 Manual Docker Commands

### Build the Image

```bash
docker build -t its-business-core:latest .
```

### Run the Container

```bash
docker run -d \
  --name its-business-core \
  -p 3000:3000 \
  -v its-data:/app/data \
  -v its-uploads:/app/uploads \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NEXTAUTH_SECRET=change-this-secret \
  its-business-core:latest
```

### View Logs

```bash
docker logs -f its-business-core
```

### Stop and Remove

```bash
docker stop its-business-core
docker rm its-business-core
```

---

## 🔐 Production Configuration

Before deploying to production, update these environment variables in `docker-compose.yml`:

```yaml
environment:
  # Change the URL to your actual domain
  - NEXTAUTH_URL=https://yourdomain.com

  # Generate a random secret (use: openssl rand -base64 32)
  - NEXTAUTH_SECRET=your-random-secret-here

  # Set your timezone
  - TZ=America/New_York
```

### Generating a Secure Secret

```bash
openssl rand -base64 32
```

---

## 📦 Persistent Data

The Docker setup uses two volumes to persist data:

### 1. Database Volume (`its-data`)
- Location: `/app/data` (inside container)
- Contains: `database.db` (SQLite database)

### 2. Uploads Volume (`its-uploads`)
- Location: `/app/uploads` (inside container)
- Contains: Uploaded documents (receipts, invoices, etc.)

### Backup Your Data

#### Backup Database

```bash
docker cp its-business-core:/app/data/database.db ./backup-database.db
```

#### Backup Uploads

```bash
docker cp its-business-core:/app/uploads ./backup-uploads
```

#### Restore Database

```bash
docker cp ./backup-database.db its-business-core:/app/data/database.db
docker restart its-business-core
```

---

## 🌐 Synology NAS Deployment

### Using Docker Package

1. Open **Docker** package on Synology DSM
2. Go to **Registry** → Search for your image (if pushed to registry)
3. Or upload the built image via **Image** → **Add** → **Add from File**
4. Go to **Container** → **Create**
5. Configure:
   - Port: Map `3000` → `3000` (or your preferred port)
   - Volume: Map folders for `/app/data` and `/app/uploads`
   - Environment: Set `NEXTAUTH_URL` and `NEXTAUTH_SECRET`
6. Start the container

### Using Docker Compose on Synology

1. Enable SSH on Synology
2. Copy `docker-compose.yml` to your NAS
3. Run:

```bash
cd /path/to/its-business-core
docker-compose up -d
```

---

## 🔄 Updating the Application

### With Docker Compose

```bash
# Stop the current container
docker-compose down

# Pull latest code changes (if using git)
git pull

# Rebuild and start
docker-compose up -d --build
```

### Manual Update

```bash
# Stop and remove old container
docker stop its-business-core
docker rm its-business-core

# Rebuild image
docker build -t its-business-core:latest .

# Start new container (data volumes persist)
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Container Won't Start

Check logs:
```bash
docker-compose logs
```

### Database Issues

Reset database (⚠️ loses all data):
```bash
docker-compose down -v
docker-compose up -d
```

### Permission Issues

Ensure volumes have correct permissions:
```bash
docker exec -it its-business-core ls -la /app/data
docker exec -it its-business-core ls -la /app/uploads
```

### Port Already in Use

Change the port in `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Use port 8080 instead
```

Then update `NEXTAUTH_URL`:
```yaml
- NEXTAUTH_URL=http://localhost:8080
```

---

## 📊 Resource Usage

**Typical resource usage:**
- **CPU**: <5% (idle), 20-40% (active)
- **Memory**: 200-400 MB
- **Disk**: ~300 MB (image) + database + uploads

**Recommended minimum specs:**
- 1 CPU core
- 512 MB RAM
- 2 GB disk space (for image + data)

---

## 🔐 Security Best Practices

1. **Change default credentials** immediately after first login
2. **Set a strong `NEXTAUTH_SECRET`** (32+ characters)
3. **Use HTTPS** in production (reverse proxy with nginx/Traefik)
4. **Regular backups** of database and uploads
5. **Keep Docker updated** (`docker-compose pull`)
6. **Restrict port access** (use firewall rules)
7. **Monitor logs** for suspicious activity

---

## 🌐 Reverse Proxy Setup (Optional)

### Using nginx

```nginx
server {
    listen 80;
    server_name yourdomain.com;

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

### Using Traefik (docker-compose)

Add labels to your service in `docker-compose.yml`:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.its-business.rule=Host(`yourdomain.com`)"
  - "traefik.http.services.its-business.loadbalancer.server.port=3000"
```

---

## 📝 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `production` | Yes |
| `PORT` | Application port | `3000` | Yes |
| `DATABASE_URL` | SQLite database path | `file:/app/data/database.db` | Yes |
| `NEXTAUTH_URL` | Application URL | `http://localhost:3000` | Yes |
| `NEXTAUTH_SECRET` | Auth secret key | - | Yes |
| `TZ` | Container timezone | `America/New_York` | No |

---

## ✅ Health Check

The container includes a health check that runs every 30 seconds:

```bash
# Check container health
docker ps

# Should show "healthy" status
```

If unhealthy, check logs:
```bash
docker logs its-business-core
```

---

**Need help?** Check the logs first, then review the troubleshooting section above.
