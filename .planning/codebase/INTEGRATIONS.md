# External Integrations

**Analysis Date:** 2026-02-11

## APIs & External Services

**AI Providers (Multi-provider architecture):**
- Anthropic Claude - OCR, receipt categorization, text summarization
  - SDK/Client: `@anthropic-ai/sdk` 0.72.1
  - Adapter: `src/lib/ai/adapters/anthropic.ts`
  - Auth: `config/system-settings.json` (ai.anthropic.apiKey, encrypted) or `ANTHROPIC_API_KEY` env var
  - Models: claude-haiku-4-5-20251001, claude-sonnet-4-5-20250929
- OpenAI - Alternative AI provider
  - SDK/Client: `openai` 6.19.0
  - Adapter: `src/lib/ai/adapters/openai-compatible.ts`
  - Auth: `config/system-settings.json` (ai.openai.apiKey)
  - Endpoint: https://api.openai.com/v1
  - Models: gpt-4o (configurable)
- OpenRouter - AI model aggregator
  - SDK/Client: `openai` 6.19.0 (OpenAI-compatible)
  - Adapter: `src/lib/ai/adapters/openai-compatible.ts`
  - Auth: `config/system-settings.json` (ai.openrouter.apiKey)
  - Endpoint: https://openrouter.ai/api/v1
- Ollama - Local AI models
  - SDK/Client: `openai` 6.19.0 (OpenAI-compatible)
  - Adapter: `src/lib/ai/adapters/openai-compatible.ts`
  - Auth: Not required (local deployment)
  - Endpoint: Configurable base URL (ai.ollama.baseUrl)
- Custom OpenAI-compatible - Generic provider support
  - SDK/Client: `openai` 6.19.0
  - Adapter: `src/lib/ai/adapters/openai-compatible.ts`
  - Auth: Configurable API key (ai.custom.apiKey)
  - Endpoint: Configurable base URL (ai.custom.baseUrl)

**AI Provider Selection:**
- Factory pattern in `src/lib/ai/provider.ts`
- Lazy-loaded adapters with caching
- Auto-detection for backward compatibility (ANTHROPIC_API_KEY → anthropic provider)
- Usage tracking in `AIUsageLog` table via `src/lib/ai/usage-tracker.ts`

## Data Storage

**Databases:**
- SQLite 3
  - Connection: `DATABASE_URL` env var (file:./dev.db)
  - Client: Prisma ORM 6.16.3
  - Location: `/app/data/` in Docker, `prisma/dev.db` in development
  - Schema: `prisma/schema.prisma` (30+ models)

**File Storage:**
- Local filesystem
  - Receipts: `./uploads/receipts/` (configurable via `UPLOAD_DIR` env var)
  - Bank statements: `./uploads/statements/`
  - Documents: `./uploads/documents/`
  - Image optimization: Sharp library for thumbnails
  - PDF support: pdf-lib for manipulation, image-to-pdf conversion

**Caching:**
- In-memory caching for AI provider instances (lazy-loaded singletons)
- No external cache service (Redis, Memcached)

## Authentication & Identity

**Auth Provider:**
- NextAuth.js 5 (Credentials provider)
  - Implementation: JWT session strategy in `src/auth.ts`
  - Password hashing: bcryptjs
  - Session duration: 8 hours
  - JWT revalidation: Every 5 minutes
  - Rate limiting: In-memory (5 attempts per 15 minutes)
  - Secret: `NEXTAUTH_SECRET` env var

**Future Support:**
- Entra ID (Microsoft Azure AD) - Schema fields present (`entraIdObjectId`, `authProvider`)

## Monitoring & Observability

**Error Tracking:**
- None (console.error only)

**Logs:**
- Application logs: stdout/stderr (Docker container logs)
- Audit logs: Database table (`AuditLog`) for user actions
- AI usage logs: Database table (`AIUsageLog`) with token counts and cost estimates

## CI/CD & Deployment

**Hosting:**
- Self-hosted Docker containers
  - Multi-stage build: `Dockerfile`
  - Orchestration: `docker-compose.yml`, `docker-compose.local.yml`
  - Entry point: `docker-entrypoint.sh` (DB migration, config initialization)

**CI Pipeline:**
- GitHub Actions configurations present (`.github/` directory)

**Container Registry:**
- Not detected (likely private or manual build)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - SQLite database path
- `NEXTAUTH_SECRET` - JWT signing secret
- `NEXTAUTH_URL` - Application base URL

**Optional env vars:**
- `ANTHROPIC_API_KEY` - Anthropic API key (alternative to settings file)
- `UPLOAD_DIR` - Receipt upload directory
- `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` - Show demo login on sign-in page

**Secrets location:**
- Environment variables (`.env` file)
- `config/system-settings.json` (encrypted sensitive fields via `SENSITIVE_PATHS` array in `src/lib/settings.ts`)

## Webhooks & Callbacks

**Incoming:**
- None currently implemented
- Email receipt forwarding planned (configuration exists in settings)

**Outgoing:**
- None

## Email Integration

**Providers (Configurable):**
- SMTP - Direct mail server connection
  - Config: `email.smtp` in system-settings.json (host, port, secure, username, password, fromAddress)
- Gmail - OAuth2 authentication
  - Config: `email.gmail` (clientId, clientSecret, refreshToken)
  - Transport: nodemailer with OAuth2
- Office 365 - OAuth2 authentication
  - Config: `email.office365` (clientId, clientSecret, tenantId, refreshToken)
  - Transport: nodemailer with Outlook365 service
- None - Email disabled

**Use Cases:**
- Time entry rejection notifications (`sendRejectionNotification`)
- Missed punch alerts (`sendMissedPunchNotification`)
- Pending approval reminders (`sendPendingEntriesReminder`)
- Fire-and-forget pattern (errors logged but do not block operations)

## Backup & Restore

**Backup:**
- Custom scripts in `scripts/` directory
- Archive format: tar.gz via `archiver` library
- Includes: SQLite database, uploads, config files

**Restore:**
- Shell scripts in `scripts/` (executable permissions set in Dockerfile)

## Third-Party Integrations

**Planned (Future):**
- QuickBooks/Xero - GL account mapping fields present (`glAccountCode` in schema)
- Entra ID - Schema fields present, not implemented

**Not Used:**
- Payment processors
- Analytics services (Google Analytics, Mixpanel)
- CDN services
- External auth providers (OAuth, SAML) beyond future Entra ID

---

*Integration audit: 2026-02-11*
