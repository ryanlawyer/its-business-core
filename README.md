# ITS Business Core

> **Lightweight SMB solution for 1-250 employees**

A streamlined business management system built for small to medium businesses. Replaces Excel spreadsheets and paper receipts with a simple, powerful web application.

## Quick Start (Docker)

**One command to deploy:**

```bash
docker run -d \
  --name its-core \
  -p 3000:3000 \
  -v its-data:/app/data \
  -v its-uploads:/app/uploads \
  ghcr.io/ryanlawyer/its-business-core:latest
```

Open http://your-server:3000 and complete the setup wizard.

**That's it!** No database to configure, no config files to edit.

## First-Run Setup

On first launch, you'll be guided through a 5-step setup wizard:

1. **Welcome** - Introduction to the system
2. **Admin Account** - Create your administrator login
3. **Organization** - Company name, timezone, fiscal year
4. **Integrations** - Optional AI receipt scanning and email (can configure later)
5. **Review** - Confirm settings and complete setup

After setup, log in with your admin credentials and start using the system.

## Features

### Timeclock
- Clock in/out tracking with approval workflow
- Overtime calculation and alerts
- Manager approvals and team views
- Payroll export (CSV, Excel, PDF)

### Purchase Orders
- Create and manage POs with multi-line items
- Budget tracking per line item
- Attach receipts (eliminates paper!)
- Simple workflow: Draft → Pending → Approved → Completed

### Budget Management
- Budget line items with spend tracking
- Department organization
- Real-time encumbered and actual spend
- Fiscal year support with amendments

### Receipt Management
- Upload and attach receipts to POs
- AI-powered OCR extraction (optional)
- Automatic categorization suggestions

### User Management
- 3 roles: Admin, Manager, User
- Granular permissions per feature
- Department assignments

## Backup & Restore

### Quick Backup (CLI)
```bash
docker exec its-core /app/scripts/backup.sh data > backup.tar.gz
```

### Full Backup (for migration)
```bash
docker exec its-core /app/scripts/backup.sh full > backup-full.tar.gz
```

### Restore
```bash
docker exec -i its-core /app/scripts/restore.sh < backup.tar.gz
```

### Web UI
Admins can download backups and restore from **Settings → Backup & Restore**.

See [docs/backup-restore.md](docs/backup-restore.md) for detailed documentation.

## Deployment Options

### Docker (Recommended)
```bash
docker run -d \
  --name its-core \
  -p 3000:3000 \
  -v its-data:/app/data \
  -v its-uploads:/app/uploads \
  --restart unless-stopped \
  ghcr.io/ryanlawyer/its-business-core:latest
```

### Docker Compose
```yaml
services:
  its-core:
    image: ghcr.io/ryanlawyer/its-business-core:latest
    ports:
      - "3000:3000"
    volumes:
      - its-data:/app/data
      - its-uploads:/app/uploads
    restart: unless-stopped

volumes:
  its-data:
  its-uploads:
```

See [docs/deployment.md](docs/deployment.md) for:
- Reverse proxy setup (nginx, Caddy, Traefik)
- SSL/HTTPS configuration
- Proxmox LXC deployment
- NAS deployment (Synology, QNAP)

## Environment Variables

All settings can be configured through the setup wizard or admin panel. Environment variables are optional overrides:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXTAUTH_SECRET` | JWT signing key | Auto-generated |
| `NEXTAUTH_URL` | Public URL | Auto-detected |
| `ANTHROPIC_API_KEY` | Claude API key for OCR | None (optional) |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: SQLite (embedded, no server needed)
- **Auth**: NextAuth.js 5
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript

## User Roles

| Role | Capabilities |
|------|-------------|
| **User** | Clock in/out, view own data, create draft POs |
| **Manager** | Approve timeclock/POs, view team data, manage budgets |
| **Admin** | Full access, user management, system settings |

## Development

```bash
# Install dependencies
npm install

# Setup database
npx prisma db push

# Start development server
npm run dev
```

Visit http://localhost:3000

## Updating

Pull the latest image and restart:

```bash
docker pull ghcr.io/ryanlawyer/its-business-core:latest
docker stop its-core
docker rm its-core
docker run -d \
  --name its-core \
  -p 3000:3000 \
  -v its-data:/app/data \
  -v its-uploads:/app/uploads \
  --restart unless-stopped \
  ghcr.io/ryanlawyer/its-business-core:latest
```

Your data persists in the volumes.

## License

Private/Proprietary

---

**Built for SMBs who need simplicity, not complexity.**
