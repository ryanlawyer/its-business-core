# Appliance-Style Deployment Design

**Date:** 2026-02-04
**Status:** Approved
**Goal:** Make ITS Business Core deployable as a single Docker container with zero external dependencies, first-run wizard, and easy backup/restore.

---

## Overview

Transform the deployment experience into a true "appliance" - users run one command, complete a web wizard, and have a fully functional system. Everything the app needs (database, uploads, config) lives inside the container's persistent volume.

### Key Principles

- **Docker-first** - Primary deployment target; Proxmox users run Docker inside LXC/VM
- **Zero external dependencies** - SQLite database, local file storage, no external services required
- **First-run wizard** - Web UI guides initial setup, no config files to edit
- **Self-contained backups** - Single file captures entire application state

---

## First-Run Detection & Wizard Flow

### Detection Mechanism

The app checks for a "configured" state on every request using Next.js middleware. The signal is a `setup_complete` record in the database's `SystemConfig` table.

### Unconfigured State

- Middleware redirects ALL routes to `/setup/*` except static assets
- No authentication required (there's no admin yet)
- Setup wizard is a multi-step form at `/setup`

### After Wizard Completes

- Wizard writes all config to database + creates admin user
- Sets `setup_complete = true`
- Redirects to `/auth/signin`
- From then on, `/setup` returns 404

### Container Behavior

- `docker-entrypoint.sh` initializes empty database if not exists (current behavior)
- App boots normally - middleware handles the redirect logic
- No container restart needed after setup

### Auto-Generated Values

- `NEXTAUTH_SECRET` - auto-generated using `crypto.randomBytes(32)` if not provided
- Stored in `/app/data/.secrets` (inside persistent volume)
- `DATABASE_URL` - fixed path `/app/data/database.db`
- `UPLOAD_DIR` - fixed path `/app/uploads`
- `NEXTAUTH_URL` - auto-detected from request host during wizard

---

## Wizard Steps

### Step 1: Welcome

- Brief intro: "Welcome to ITS Business Core"
- Shows what will be configured
- Single "Get Started" button

### Step 2: Admin Account

- Email address (will be username)
- Password + confirm password
- Full name
- Validation: email format, password strength (min 8 chars)

### Step 3: Organization

- Organization/company name
- Logo upload (optional) - stored in `/app/uploads/branding/`
- First department name (defaults to "General", required)
- Timezone picker (dropdown, defaults to detected from browser)
- Fiscal year start month (dropdown, defaults to January)

### Step 4: Integrations (Optional)

Collapsible sections, all skippable:

- **AI/OCR**: Anthropic API key for receipt scanning (test connection button)
- **Email**: Provider picker (Gmail/Office365/SMTP/None), credentials if selected
- Each section shows "Configure later in Settings" option

### Step 5: Review & Finish

- Summary of all entered values (passwords masked)
- "Complete Setup" button
- On submit: creates admin user, saves settings, marks configured
- Shows success message with "Go to Login" button

### Auto-Created Data

The following are created automatically without user input:

- Default roles: ADMIN, MANAGER, USER (with full permission sets)
- System settings record with defaults

The following are created by the wizard:

- Admin user (assigned ADMIN role)
- Initial department
- Organization settings

---

## Backup & Restore System

### Backup Types

#### Quick Backup (Data Only)

- **Contents:** SQLite database + `/app/uploads` folder
- **Format:** Single `.tar.gz` file
- **Naming:** `its-backup-data-2026-02-04-143022.tar.gz`
- **Use case:** Daily/routine backups, small file size

#### Full Snapshot

- **Contents:** Database + uploads + `/app/data/.secrets` + system config export
- **Format:** Single `.tar.gz` file
- **Naming:** `its-backup-full-2026-02-04-143022.tar.gz`
- **Use case:** Migration to new server, disaster recovery

### Access Methods

#### CLI (for scripting/cron)

```bash
# Create backups (output to stdout, redirect to file)
docker exec its-core backup data > backup-data.tar.gz
docker exec its-core backup full > backup-full.tar.gz

# Restore from backup
docker exec -i its-core restore < backup.tar.gz
```

#### Web UI (for admins)

Located at Settings → Backup & Restore:

- "Download Data Backup" / "Download Full Snapshot" buttons
- "Restore from Backup" with file upload
- Shows last backup date, backup history

### Restore Behavior

1. Validates backup format before applying
2. Stops accepting requests during restore (maintenance mode)
3. Extracts to temporary location first
4. On success, swaps with current data
5. On failure, preserves original data
6. Runs migrations after restore if schema changed
7. Requires admin re-login after restore

---

## CI/CD & Image Publishing

### GitHub Actions Workflow

File: `.github/workflows/release.yml`

Triggered on git tags matching `v*` (e.g., `v1.0.0`, `v1.2.3`).

#### Pipeline Steps

1. Checkout code
2. Set up Docker Buildx (multi-platform support)
3. Login to GitHub Container Registry
4. Extract version from tag (`v1.2.3` → `1.2.3`)
5. Build and push with tags:
   - `ghcr.io/yourorg/its-business-core:1.2.3` (exact version)
   - `ghcr.io/yourorg/its-business-core:1.2` (minor version)
   - `ghcr.io/yourorg/its-business-core:latest` (only for non-prerelease)

### Multi-Architecture Support

- Builds for `linux/amd64` and `linux/arm64`
- Covers standard servers and Raspberry Pi / ARM-based NAS

### Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Commit: `git commit -m "chore: release v1.2.3"`
4. Tag: `git tag v1.2.3`
5. Push: `git push && git push --tags`
6. GitHub Actions builds and publishes automatically

### Package Settings

- Public visibility (users can pull without auth)
- Linked to repository for discoverability

---

## Security Considerations

### Setup Wizard Security

- Wizard only accessible when `setup_complete = false`
- Rate limiting on wizard submission (prevent brute force)
- HTTPS strongly recommended (secrets transmitted during setup)
- Wizard auto-expires after 24 hours of container uptime if not completed

### Secret Management

- `NEXTAUTH_SECRET` auto-generated using `crypto.randomBytes(32)`
- Stored in `/app/data/.secrets` (inside persistent volume)
- API keys (Anthropic, email) encrypted at rest using NEXTAUTH_SECRET as key
- Secrets file permissions: `600` (owner read/write only)

### Restore Safety

- Backup format validated before extraction
- Version compatibility check (backup includes schema version)
- If restore fails, original data preserved
- Requires current admin password to initiate restore via web UI

### Container Hardening

- Non-root user (already in place)
- Read-only filesystem where possible
- Writable only: `/app/data` and `/app/uploads`
- No shell access needed for normal operation
- Health check endpoint doesn't expose sensitive info

### Upgrade Path

- New container version pulls, existing data volume mounts
- Entrypoint runs `prisma db push` for schema migrations
- Breaking changes documented in CHANGELOG with migration steps

---

## Documentation Deliverables

### In-App Documentation

1. **Setup wizard help text** - Contextual explanations on each step
2. **Admin guide page** (`/admin/help`) - Backup/restore, configuration reference, troubleshooting
3. **Tooltips/info icons** - Throughout settings pages

### Repository Documentation

1. **README.md** - One-command deploy, first-run explanation, env var reference
2. **docs/deployment.md** - Docker Compose, Proxmox, reverse proxy, SSL
3. **docs/backup-restore.md** - CLI usage, automation scripts, migration procedures

---

## User Experience Summary

### Deployment

```bash
docker run -d -p 3000:3000 -v its-data:/app/data ghcr.io/yourorg/its-business-core
```

### First Run

1. Open browser to `http://server:3000`
2. Complete 5-step wizard (2-3 minutes)
3. Login with admin credentials
4. Start using app

### Routine Backup

```bash
docker exec its-core backup data > /backups/its-$(date +%Y%m%d).tar.gz
```

### Migration to New Server

```bash
# On old server
docker exec its-core backup full > migration.tar.gz

# On new server
docker run -d -p 3000:3000 -v its-data:/app/data ghcr.io/yourorg/its-business-core
docker exec -i its-core restore < migration.tar.gz
```

---

## Implementation Phases

### Phase 1: First-Run Wizard

- Setup detection middleware
- Wizard UI (5 steps)
- Auto-generation of secrets
- Role/department bootstrapping

### Phase 2: Backup & Restore

- CLI backup/restore commands
- Web UI for backup management
- Backup validation and safe restore

### Phase 3: CI/CD Pipeline

- GitHub Actions workflow
- Multi-arch builds
- GHCR publishing

### Phase 4: Documentation

- In-app help system
- README updates
- Deployment and backup guides

---

*Design approved: 2026-02-04*
