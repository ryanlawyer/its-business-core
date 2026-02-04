# External Integrations

**Analysis Date:** 2026-02-04

## APIs & External Services

**Claude Vision (Receipt OCR):**
- Service: Anthropic Claude Vision API
- What it's used for: Optical character recognition (OCR) on receipt images and PDFs
- SDK/Client: `@anthropic-ai/sdk 0.72.1`
- Implementation: `src/lib/ocr.ts`
  - `extractReceiptData()` - Process image/PDF with Claude Sonnet 4
  - `extractReceiptDataFromFile()` - Read file from disk and process
  - `processReceiptWithRetry()` - Retry logic with exponential backoff (3 retries)
  - Model: `claude-sonnet-4-20250514`
  - Max tokens: 1024
  - Supported formats: JPEG, PNG, GIF, WebP, PDF
- Auth: Environment variable `ANTHROPIC_API_KEY`
- Optional: System works without OCR (receipts can be manually entered)
- Error handling: Graceful fallback if API unavailable
  - `OCRServiceError` custom error class
  - Non-retriable errors: UNSUPPORTED_TYPE, FILE_READ_ERROR, PARSE_ERROR
  - API errors: Retried with exponential backoff (2s, 4s, 8s delays)
- Configuration check: `isOCRConfigured()` function

## Data Storage

**Databases:**
- SQLite (file-based)
  - Provider: sqlite
  - Connection URL: `file:./dev.db` (or `${UPLOAD_DIR}/dev.db`)
  - Client: `@prisma/client 6.16.3` (Prisma ORM)
  - Schema location: `prisma/schema.prisma`
  - Environment variable: `DATABASE_URL`
  - Can be deployed on NAS for shared access
  - Suitable for 1-250 employees (SMB size)

**File Storage:**
- Local filesystem only
  - Receipt images: `./uploads/receipts/` (configurable via `UPLOAD_DIR`)
  - Bank statements: Same directory
  - Purchase order attachments: Same directory
  - File naming: UUID + random suffix + original extension
  - Validation: File type detection with `file-type` library
  - Cleanup: No automatic cleanup implemented

**Caching:**
- None explicit - Next.js ISR (Incremental Static Regeneration) not used
- Prisma client caching handled internally

## Authentication & Identity

**Auth Provider:**
- Custom (Credentials-based) via NextAuth.js
- Implementation: `src/auth.ts`
  - Provider type: CredentialsProvider (username/password only)
  - Flow: Email + password → bcrypt verification → JWT session
  - Password hashing: `bcryptjs 3.0.2`
  - Session strategy: JWT (stateless)
  - Token expiry: Default NextAuth.js (30 days)
  - Sign-in page: `/auth/signin`

**User Model:**
- Email-based login (unique constraint on email)
- Future support: EntraID/Azure AD (fields present but not implemented)
  - `entraIdObjectId` field (optional)
  - `authProvider` field (default: "local")
- Password hashing: bcryptjs with salt rounds (default 10)
- Session includes:
  - User ID, email, name
  - Role ID, role code, role name
  - Department ID, department name
  - JSON permissions string from role
  - Legacy field: `role` (same as roleCode)

## Monitoring & Observability

**Error Tracking:**
- None integrated
- Manual error logging via audit logs

**Logs:**
- Prisma logging:
  - Development: error and warn levels
  - Production: error only
  - Output: Console only (no file persistence)
- Audit trail: `AuditLog` model
  - Tracks: User actions, entity changes, IP address, user agent
  - Tables: `audit_logs` in `prisma/schema.prisma`
  - Implementation: `src/lib/audit.ts`

## CI/CD & Deployment

**Hosting:**
- Docker-ready (standalone output mode)
- Typical deployment:
  - Node.js process + SQLite on shared storage
  - Environment-based configuration via `.env` file
  - No platform-specific requirements

**CI Pipeline:**
- Not configured in this codebase
- Build commands available:
  ```bash
  npm run lint    # ESLint validation
  npm run build   # Next.js production build
  npm run test    # Vitest unit tests
  ```

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - SQLite database path (critical)
- `NEXTAUTH_SECRET` - JWT signing secret (critical)
- `NEXTAUTH_URL` - Auth callback URL (critical for production)

**Optional env vars:**
- `ANTHROPIC_API_KEY` - Claude Vision API key (optional, required for receipt OCR)
- `UPLOAD_DIR` - Receipt upload directory (default: `./uploads/receipts`)
- `NODE_ENV` - Set to "production" for production deployments

**Secrets location:**
- `.env` file (git-ignored)
- Typically managed by deployment platform (Docker secrets, environment variables, vault, etc.)
- Never committed to repository

## Webhooks & Callbacks

**Incoming:**
- None - No webhook integrations

**Outgoing:**
- None - No outbound webhook integrations

## File Upload Handling

**Storage:**
- Files saved to local filesystem
- Default directory: `./uploads/receipts/`
- File naming: `[uuid]-[random]-[original-extension]`
- Supported formats:
  - Images: JPEG, PNG, GIF, WebP
  - Documents: PDF
  - Spreadsheets: XLSX (for bank statements)

**Processing Pipeline:**
1. File upload → `src/app/api/receipts/upload/route.ts`
2. Validation via `file-type` library (buffer-based MIME detection)
3. Storage to filesystem
4. Database record creation in `receipts` table
5. Async OCR processing → `src/app/api/receipts/[id]/process/route.ts`
6. OCR result stored in `rawOcrData` JSON field

**Image Processing:**
- Library: `sharp 0.34.4`
- Used for: Thumbnail generation, format conversion
- Implementation: `src/lib/image-processing.ts`

## Data Export

**Excel Export:**
- Library: `xlsx 0.18.5`
- Usage:
  - Timeclock exports: `src/app/api/timeclock/export/route.ts`
  - Expense reports: `src/app/api/reports/expense/excel/route.ts`
  - Format: XLSX (Excel 2007+)

**PDF Export:**
- Library: `pdf-lib 1.17.1`
- Usage:
  - Timeclock PDF export: `src/app/api/timeclock/export/route.ts`
  - Image-to-PDF conversion: `src/lib/image-to-pdf.ts`
  - Fonts: Standard PDF fonts (Helvetica, Times, Courier)

**Bank Statement Parsing:**
- Library: `xlsx 0.18.5`
- Usage: `src/lib/statement-parser.ts`
- Supports: XLSX bank statement imports
- Output: Transactions stored in `bank_transactions` table

---

*Integration audit: 2026-02-04*
