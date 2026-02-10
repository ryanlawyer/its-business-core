# ITS Business Core

## Overview
ITS Business System - Lightweight SMB Core application for small-to-medium businesses (1-250 employees). Features include user management, purchase orders, budgeting, timeclock, audit logging, and admin settings.

## Tech Stack
- **Framework**: Next.js 15.5.4 with React 19
- **Language**: TypeScript
- **Database**: SQLite via Prisma ORM (env var: `SQLITE_URL`)
- **Auth**: NextAuth v5 beta
- **Styling**: Tailwind CSS v4
- **AI**: Anthropic Claude (optional)

## Project Structure
- `src/app/` - Next.js App Router pages and API routes
- `prisma/schema.prisma` - Database schema (SQLite, uses `SQLITE_URL` env var)
- `prisma/seed.ts` - Database seeder
- `config/` - System settings
- `public/` - Static assets
- `scripts/` - Utility scripts

## Environment Variables
- `SQLITE_URL` - SQLite database connection (default: `file:./dev.db`)
- `NEXTAUTH_SECRET` - NextAuth session secret
- `NEXTAUTH_URL` - NextAuth callback URL
- `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` - Show demo login on sign-in page
- `UPLOAD_DIR` - File upload directory
- `ANTHROPIC_API_KEY` - Optional, for AI features

## Development
- Dev server: `npx next dev -H 0.0.0.0 -p 5000`
- Database push: `npx prisma db push`
- Database seed: `npx tsx prisma/seed.ts`

## Demo Credentials
- Admin: admin@example.com / admin123
- Manager: manager@example.com / manager123
- User: user@example.com / user123

## Important Notes
- The Prisma schema uses `SQLITE_URL` instead of `DATABASE_URL` to avoid conflicts with Replit's managed PostgreSQL env var.
- Next.js config includes `allowedDevOrigins` for Replit proxy compatibility.
- Deployment uses standalone output mode.
