# Technology Stack

**Analysis Date:** 2026-02-11

## Languages

**Primary:**
- TypeScript 5.x - All application code (strict mode enabled)
- JavaScript ES2017+ - Runtime target and configuration files

**Secondary:**
- SQL - SQLite database via Prisma ORM
- Shell - Docker entrypoint and backup scripts

## Runtime

**Environment:**
- Node.js 20 LTS (development and Docker)
- Development machine: Node.js v22.22.0

**Package Manager:**
- npm (package-lock.json present)
- Lockfile version: v3 format

## Frameworks

**Core:**
- Next.js 15.5.4 - Full-stack React framework with App Router
- React 19.1.0 - UI framework
- Prisma 6.16.3 - Database ORM and migrations

**Testing:**
- Vitest 4.0.18 - Unit testing framework
- Node environment for tests

**Build/Dev:**
- TypeScript 5.x - Type checking and compilation
- ESLint 9.x - Code linting (Next.js config with TypeScript rules)
- PostCSS - CSS processing for Tailwind
- Tailwind CSS 4.x - Utility-first CSS framework
- tsx 4.20.6 - TypeScript execution for scripts

## Key Dependencies

**Critical:**
- `@prisma/client` 6.16.3 - Database client (SQLite)
- `next-auth` 5.0.0-beta.29 - Authentication with JWT sessions
- `bcryptjs` 3.0.2 - Password hashing

**Infrastructure:**
- `zod` 4.3.6 - Runtime schema validation
- `react-hook-form` 7.63.0 - Form state management
- `sharp` 0.34.4 - Image processing and optimization

**UI Components:**
- `@headlessui/react` 2.2.9 - Unstyled accessible components
- `@heroicons/react` 2.2.0 - Icon library

**AI/ML:**
- `@anthropic-ai/sdk` 0.72.1 - Claude AI client for OCR and categorization
- `openai` 6.19.0 - OpenAI SDK (multi-provider adapter for OpenAI, OpenRouter, Ollama, custom)

**File Processing:**
- `pdf-lib` 1.17.1 - PDF manipulation and generation
- `file-type` 21.0.0 - MIME type detection
- `xlsx` 0.18.5 - Excel file generation
- `archiver` 7.0.1 - Archive creation for backups
- `tar` 7.5.7 - Tarball compression

**Communication:**
- `nodemailer` 6.10.1 - Email notifications (SMTP, Gmail OAuth2, Office365 OAuth2)

## Configuration

**Environment:**
- `.env` file for secrets (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, UPLOAD_DIR)
- `.env.example` template provided
- `config/system-settings.json` for runtime settings (organization, security, AI providers, email)
- Sensitive fields encrypted at rest in system-settings.json

**Build:**
- `tsconfig.json` - TypeScript configuration (strict mode, path aliases with `@/*`)
- `next.config.ts` - Next.js config with standalone output for Docker
- `tailwind.config.ts` - Custom design system with CSS variables
- `postcss.config.mjs` - Tailwind CSS processing
- `eslint.config.mjs` - FlatCompat-based ESLint config
- `vitest.config.ts` - Test runner configuration

**TypeScript:**
- Target: ES2017
- Module: ESNext with bundler resolution
- Strict mode: enabled
- Path alias: `@/*` maps to `./src/*`

## Platform Requirements

**Development:**
- Node.js 20+ LTS
- npm 9+
- SQLite (embedded, no separate installation required)

**Production:**
- Docker with multi-stage build support
- Alpine Linux base image (node:20-alpine)
- OpenSSL, SQLite, Ghostscript (for PDF operations)
- Persistent volumes for `/app/data`, `/app/uploads`, `/app/config`

**Deployment:**
- Next.js standalone output mode
- Docker Compose for orchestration
- NAS-compatible (file-based SQLite database)

---

*Stack analysis: 2026-02-11*
