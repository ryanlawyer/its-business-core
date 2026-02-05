# Backup & Restore Guide

ITS Business Core provides multiple ways to backup and restore your data.

## Table of Contents

- [Backup Types](#backup-types)
- [CLI Backup](#cli-backup)
- [CLI Restore](#cli-restore)
- [Web UI](#web-ui)
- [Automated Backups](#automated-backups)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)

---

## Backup Types

### Data Backup (Quick)

**Contents:**
- SQLite database (`database.db`)
- Uploaded files (`/app/uploads/`)

**Use for:**
- Daily/routine backups
- Quick snapshots before changes
- Smaller file size

**File naming:** `its-backup-data-YYYY-MM-DD-HHMMSS.tar.gz`

### Full Backup (Complete)

**Contents:**
- Everything in Data Backup, plus:
- Secrets file (`.secrets`)
- System configuration export

**Use for:**
- Migration to new server
- Disaster recovery
- Before major upgrades

**File naming:** `its-backup-full-YYYY-MM-DD-HHMMSS.tar.gz`

---

## CLI Backup

The CLI scripts output to stdout, making them easy to pipe to files or other commands.

### Data Backup

```bash
docker exec its-core /app/scripts/backup.sh data > backup-data.tar.gz
```

### Full Backup

```bash
docker exec its-core /app/scripts/backup.sh full > backup-full.tar.gz
```

### With Timestamp

```bash
docker exec its-core /app/scripts/backup.sh data > "its-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
```

### To Remote Server (via SSH)

```bash
docker exec its-core /app/scripts/backup.sh full | ssh user@backup-server "cat > /backups/its-core-$(date +%Y%m%d).tar.gz"
```

### To S3-Compatible Storage

```bash
docker exec its-core /app/scripts/backup.sh full | aws s3 cp - s3://my-bucket/backups/its-core-$(date +%Y%m%d).tar.gz
```

---

## CLI Restore

### Basic Restore

```bash
docker exec -i its-core /app/scripts/restore.sh < backup.tar.gz
```

### From Remote Server

```bash
ssh user@backup-server "cat /backups/its-core-latest.tar.gz" | docker exec -i its-core /app/scripts/restore.sh
```

### From S3

```bash
aws s3 cp s3://my-bucket/backups/its-core-20240101.tar.gz - | docker exec -i its-core /app/scripts/restore.sh
```

### What Happens During Restore

1. **Validation** - Backup format and manifest are verified
2. **Safety backup** - Current data is backed up to `/app/data/pre-restore-backup/`
3. **Extraction** - Backup contents extracted to temporary location
4. **Replacement** - Old data replaced with backup data
5. **Verification** - Database integrity checked

If restore fails at any step, your original data is preserved.

---

## Web UI

Administrators can manage backups from **Settings → Backup & Restore**.

### Download Backup

1. Go to **Settings → Backup & Restore**
2. Click **Download Data Backup** or **Download Full Backup**
3. Save the `.tar.gz` file

### Restore from Backup

1. Go to **Settings → Backup & Restore**
2. Click **Choose File** and select your backup
3. Click **Restore**
4. Confirm the restore operation
5. Wait for completion
6. Log in again (sessions are invalidated)

### Viewing Backup History

The web UI shows:
- Last backup date (if using web UI)
- Database size
- Uploads size

---

## Automated Backups

### Cron Job (Linux)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * docker exec its-core /app/scripts/backup.sh data > /backups/its-core-$(date +\%Y\%m\%d).tar.gz 2>/dev/null

# Add weekly full backup on Sundays at 3 AM
0 3 * * 0 docker exec its-core /app/scripts/backup.sh full > /backups/its-core-full-$(date +\%Y\%m\%d).tar.gz 2>/dev/null
```

### With Rotation (Keep Last 30 Days)

Create a backup script:

```bash
#!/bin/bash
# /usr/local/bin/backup-its-core.sh

BACKUP_DIR="/backups/its-core"
DATE=$(date +%Y%m%d)
RETENTION_DAYS=30

# Create backup directory if needed
mkdir -p "$BACKUP_DIR"

# Create backup
docker exec its-core /app/scripts/backup.sh data > "$BACKUP_DIR/its-core-$DATE.tar.gz"

# Check if backup was successful
if [ $? -eq 0 ] && [ -s "$BACKUP_DIR/its-core-$DATE.tar.gz" ]; then
    echo "Backup successful: its-core-$DATE.tar.gz"

    # Remove old backups
    find "$BACKUP_DIR" -name "its-core-*.tar.gz" -mtime +$RETENTION_DAYS -delete
    echo "Cleaned up backups older than $RETENTION_DAYS days"
else
    echo "Backup failed!"
    exit 1
fi
```

Make executable and schedule:

```bash
chmod +x /usr/local/bin/backup-its-core.sh
# Add to cron
0 2 * * * /usr/local/bin/backup-its-core.sh >> /var/log/its-backup.log 2>&1
```

### Synology Task Scheduler

1. Open **Control Panel → Task Scheduler**
2. Create → **Scheduled Task → User-defined script**
3. Schedule: Daily at desired time
4. Task Settings → Run command:

```bash
docker exec its-core /app/scripts/backup.sh data > /volume1/Backups/its-core-$(date +%Y%m%d).tar.gz
find /volume1/Backups -name "its-core-*.tar.gz" -mtime +30 -delete
```

### Docker Health Check + Backup

Include backup verification in monitoring:

```bash
#!/bin/bash
# Verify last backup is recent and valid

BACKUP_DIR="/backups/its-core"
LATEST=$(ls -t "$BACKUP_DIR"/its-core-*.tar.gz 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
    echo "CRITICAL: No backups found"
    exit 2
fi

# Check age (should be less than 25 hours old)
AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST")) / 3600 ))
if [ $AGE -gt 25 ]; then
    echo "WARNING: Latest backup is $AGE hours old"
    exit 1
fi

# Check size (should be > 10KB at minimum)
SIZE=$(stat -c %s "$LATEST")
if [ $SIZE -lt 10240 ]; then
    echo "WARNING: Backup suspiciously small ($SIZE bytes)"
    exit 1
fi

echo "OK: Backup $LATEST ($AGE hours old, $SIZE bytes)"
exit 0
```

---

## Migration Guide

### Migrating to a New Server

**On the old server:**

```bash
# Create full backup
docker exec its-core /app/scripts/backup.sh full > migration-backup.tar.gz

# Copy to new server
scp migration-backup.tar.gz user@new-server:/tmp/
```

**On the new server:**

```bash
# Start fresh container
docker run -d \
  --name its-core \
  -p 3000:3000 \
  -v its-data:/app/data \
  -v its-uploads:/app/uploads \
  ghcr.io/ryanlawyer/its-business-core:latest

# Wait for container to initialize (about 10 seconds)
sleep 10

# Restore backup
docker exec -i its-core /app/scripts/restore.sh < /tmp/migration-backup.tar.gz

# Verify
docker logs its-core
```

Access the new server and log in with your existing credentials.

### Migrating Between Docker Hosts

Same process as above. The backup contains everything needed.

### Upgrading with Data Preservation

```bash
# Backup before upgrade
docker exec its-core /app/scripts/backup.sh full > pre-upgrade-backup.tar.gz

# Pull new image
docker pull ghcr.io/ryanlawyer/its-business-core:latest

# Stop and remove old container (volumes preserved)
docker stop its-core
docker rm its-core

# Start with new image
docker run -d \
  --name its-core \
  -p 3000:3000 \
  -v its-data:/app/data \
  -v its-uploads:/app/uploads \
  --restart unless-stopped \
  ghcr.io/ryanlawyer/its-business-core:latest
```

The entrypoint automatically runs database migrations.

---

## Troubleshooting

### Backup Fails

**Check container is running:**
```bash
docker ps | grep its-core
```

**Check disk space:**
```bash
docker exec its-core df -h /app/data
```

**Check database exists:**
```bash
docker exec its-core ls -la /app/data/
```

### Restore Fails

**Check backup file is valid:**
```bash
# List contents
tar -tzf backup.tar.gz

# Should contain:
# ./manifest.json
# ./database.db
# ./uploads/
```

**Check manifest:**
```bash
tar -xzf backup.tar.gz -O ./manifest.json
```

### "Database is locked" Error

SQLite doesn't support concurrent access. Ensure:
- Only one container is running
- No other process is accessing the database
- Wait and retry

### Corrupted Database After Restore

If database is corrupted:

```bash
# Enter container
docker exec -it its-core sh

# Check database integrity
sqlite3 /app/data/database.db "PRAGMA integrity_check;"

# If corrupted, restore from an older backup
```

### Backup is Empty or Very Small

Check that the database exists:

```bash
docker exec its-core ls -la /app/data/database.db
```

If missing, the setup wizard may not have been completed.

### Permission Denied

Ensure the container user has write access:

```bash
docker exec its-core ls -la /app/data/
docker exec its-core ls -la /app/uploads/
```

Files should be owned by `nextjs:nodejs` (uid 1001).

---

## Backup Contents Reference

### manifest.json

```json
{
  "type": "data|full",
  "timestamp": "2024-01-15-143022",
  "version": "1.0",
  "created_by": "its-business-core-backup"
}
```

### Data Backup Structure

```
backup.tar.gz
├── manifest.json
├── database.db
└── uploads/
    ├── receipts/
    └── documents/
```

### Full Backup Structure

```
backup.tar.gz
├── manifest.json
├── database.db
├── .secrets
├── system_config.json
└── uploads/
    ├── receipts/
    └── documents/
```

---

## Best Practices

1. **Test your backups** - Periodically restore to a test environment
2. **Use full backups for disaster recovery** - Data backups don't include secrets
3. **Store backups off-site** - Don't keep backups only on the same server
4. **Encrypt sensitive backups** - Use GPG or similar for backups containing secrets
5. **Document your backup schedule** - Know when and where backups run
6. **Monitor backup success** - Alert on backup failures
7. **Keep multiple generations** - Don't overwrite with a single backup file

### Encrypting Backups

```bash
# Backup with encryption
docker exec its-core /app/scripts/backup.sh full | gpg --symmetric --cipher-algo AES256 > backup.tar.gz.gpg

# Restore encrypted backup
gpg --decrypt backup.tar.gz.gpg | docker exec -i its-core /app/scripts/restore.sh
```
