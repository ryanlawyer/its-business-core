# Technology Stack

**Analysis Date:** 2026-02-04

## Languages

**Primary:**
- TypeScript 5 - All application code, strict mode enabled
- JavaScript (React 19.1.0) - JSX rendering and client components

## Runtime

**Environment:**
- Node.js v22.22.0 - Application runtime
- npm 10.9.4 - Package manager
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 15.5.4 - Framework and server runtime (App Router)
  - Server components by default
  - API routes at `src/app/api/**`
  - Static and dynamic pages at `src/app/**`

**UI & Styling:**
- React 19.1.0 - UI library
- Tailwind CSS 4 - Utility-first CSS framework
- Headless UI 2.2.9 - Unstyled, accessible components
- Heroicons 2.2.0 - SVG icon library

**Form Management:**
- React Hook Form 7.63.0 - Form state and validation

**Authentication:**
- NextAuth.js 5.0.0-beta.29 - Session and credential-based auth
  - Credentials provider (local login only)
  - JWT session strategy
  - Config: `src/auth.ts`

**Database:**
- Prisma ORM 6.16.3 - Database abstraction
  - Client: `@prisma/client 6.16.3`
  - CLI: `prisma 6.16.3`
  - Schema: `prisma/schema.prisma`
  - SQLite provider

**Testing:**
- Vitest 4.0.18 - Unit test runner
- Run commands: `npm run test` (single), `npm run test:watch` (watch mode)

**Build & Development:**
- TypeScript 5 - Type checking and compilation
- ESLint 9 - Code linting (Next.js config)
- PostCSS with Tailwind CSS 4 - CSS processing
- tsx 4.20.6 - TypeScript executor for scripts

## Key Dependencies

**Critical:**
- `@anthropic-ai/sdk 0.72.1` - Claude Vision API for receipt OCR
- `@prisma/client 6.16.3` - Database client and migrations
- `bcryptjs 3.0.2` - Password hashing for authentication
- `next-auth 5.0.0-beta.29` - Authentication system

**File Processing:**
- `xlsx 0.18.5` - Excel file parsing and generation
- `pdf-lib 1.17.1` - PDF creation and manipulation
- `sharp 0.34.4` - Image processing (resizing, format conversion)
- `file-type 21.0.0` - Detect MIME types from file buffers

## Configuration

**Environment:**
- `.env` file (local development)
- `.env.example` (template with defaults)
- Key variables:
  - `DATABASE_URL` - SQLite file path (default: `file:./dev.db`)
  - `NEXTAUTH_URL` - Auth callback URL (default: `http://localhost:3000`)
  - `NEXTAUTH_SECRET` - JWT signing key (required, must be 32-byte base64)
  - `ANTHROPIC_API_KEY` - Claude Vision API key (optional, required for OCR)
  - `UPLOAD_DIR` - Receipt file upload directory (default: `./uploads/receipts`)

**Build:**
- `tsconfig.json` - TypeScript strict mode, ES2017 target
  - Path aliases: `@/*` → `./src/*`
  - Incremental builds enabled
  - Isolated modules enabled
- `next.config.ts`:
  - ESLint ignored during builds (configured in CLAUDE.md)
  - TypeScript errors ignored during builds
  - Standalone output enabled (Docker-compatible)
- `.eslintrc` or `eslint.config.js` with Next.js rules
- Tailwind CSS v4 with PostCSS

## Platform Requirements

**Development:**
- Node.js v22.x
- npm v10.x
- Modern browser (Chrome, Firefox, Safari, Edge)
- SQLite support (built into all OSes)

**Production:**
- Node.js v22.x runtime
- SQLite database file must be on shared storage (NAS) for multi-instance deployments
- Standalone output mode for Docker/container deployment
- 512MB minimum RAM
- HTTPS required for secure auth cookies

**Optional Dependencies:**
- Anthropic API account for receipt OCR
- Local filesystem with at least 1GB for uploads directory

---

*Stack analysis: 2026-02-04*
