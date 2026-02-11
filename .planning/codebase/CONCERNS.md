# Codebase Concerns

**Analysis Date:** 2026-02-11

## Tech Debt

**Large Component Files:**
- Issue: Several React components exceed 1000 lines, indicating high complexity and multiple concerns mixed together
- Files: `src/app/admin/timeclock/page.tsx` (1431 lines), `src/app/admin/settings/page.tsx` (1398 lines), `src/app/receipts/[id]/page.tsx` (1191 lines), `src/app/page.tsx` (936 lines), `src/app/purchase-orders/[id]/page.tsx` (818 lines)
- Impact: Difficult to maintain, test, and reason about. High risk of bugs when making changes. Slower build times.
- Fix approach: Extract tab panels into separate components. Move business logic to custom hooks or server actions. Split multi-responsibility components into smaller, focused components.

**Hardcoded TODO Comment:**
- Issue: Fiscal year start date is hardcoded instead of reading from system settings
- Files: `src/app/api/budget-items/route.ts:21-22`
- Impact: Budget accrual calculations use incorrect dates if fiscal year doesn't start in January. Inconsistent with fiscal year configuration in database.
- Fix approach: Read fiscal year settings from SystemSettings or FiscalYear table. Use actual fiscal year start/end dates for accrual calculations.

**Inconsistent Type Safety:**
- Issue: Widespread use of `any` type and `@typescript-eslint/no-explicit-any` suppressions
- Files: `src/lib/settings.ts:67,71`, `src/lib/audit.ts:144,192-195,215`, `src/lib/ocr.ts:112`, `src/lib/timeclock-rules.ts:146`, `src/components/BudgetItemSelector.tsx:101-102`, and many API routes
- Impact: Loses TypeScript's type safety benefits. Runtime errors that could be caught at compile time. Harder to refactor safely.
- Fix approach: Define proper interfaces for complex objects. Use `unknown` with type guards instead of `any`. Add Zod schemas for runtime validation where needed.

**Empty Catch Blocks:**
- Issue: Numerous empty catch blocks and catch-with-console-log-only patterns
- Files: `src/lib/client-permissions.ts:10`, `src/lib/pdf-optimization.ts:145-146`, `src/auth.ts:141-143`, and 50+ instances throughout codebase
- Impact: Errors swallowed silently. Difficult to diagnose issues in production. No way to know when operations fail.
- Fix approach: At minimum, log errors with context. Consider error boundaries for UI. Add error tracking service integration.

**In-Memory Rate Limiter:**
- Issue: Login rate limiting uses in-memory Map, doesn't persist across restarts or scale horizontally
- Files: `src/auth.ts:15-38`
- Impact: Rate limits reset on app restart. Won't work with multiple instances (horizontal scaling). Attackers can bypass by restarting service.
- Fix approach: Move rate limiting to database table or Redis. Consider using NextAuth.js adapter with built-in rate limiting.

**Password Storage Without History:**
- Issue: Settings allow password reuse prevention (`preventReuse`), but no PasswordHistory table exists in schema
- Files: `src/lib/settings.ts:128,404-406`, `prisma/schema.prisma`
- Impact: Password policy feature is incomplete. Users can reuse old passwords despite policy setting.
- Fix approach: Add PasswordHistory table to schema. Hash and store previous passwords during password changes. Enforce in validation.

## Known Bugs

**Unused Router/Session Variables:**
- Symptoms: ESLint warnings for unused variables across many page components
- Files: `src/app/admin/settings/page.tsx:34-35`, `src/app/admin/timeclock/page.tsx:109-111`, `src/app/admin/roles/manage/page.tsx`, and 15+ other pages
- Trigger: Components destructure `session` and `router` from hooks but never use them
- Workaround: Prefix with underscore (`_router`) or remove destructuring
- Fix: Clean up unused imports and variables. May indicate incomplete features or refactoring artifacts.

**React Hooks Rules Violation:**
- Symptoms: Conditional hook usage causing potential runtime errors
- Files: `src/app/admin/roles/manage/page.tsx:111`
- Trigger: `useEffect` called after conditional return
- Workaround: None - this is a serious bug
- Fix: Move all hooks before conditional returns. Restructure component logic to avoid conditional rendering at top level.

**Missing Dependency Arrays:**
- Symptoms: useEffect hooks with incomplete dependency arrays
- Files: `src/app/admin/audit-log/page.tsx:67`, `src/app/admin/budget-dashboard/page.tsx:54`, and 10+ other pages
- Trigger: Functions used in useEffect but not included in dependency array
- Workaround: Functions re-create on every render, causing potential infinite loops or stale closures
- Fix: Include all dependencies in array, or wrap functions with useCallback, or move functions inside useEffect.

**HTML Link Instead of Next Link:**
- Symptoms: SEO and navigation issues from using `<a>` instead of `<Link>`
- Files: `src/app/(standalone)/clock/page.tsx:219`
- Trigger: Direct `<a href="/">` usage for navigation
- Impact: Full page reload instead of client-side navigation. Breaks Next.js routing optimizations.
- Fix: Replace with `<Link href="/">` from `next/link`.

## Security Considerations

**Weak NEXTAUTH_SECRET Validation:**
- Risk: Production systems could run with default/weak secrets
- Files: `src/auth.ts:6-12`
- Current mitigation: Validation at startup, but only rejects exact placeholder string
- Recommendations: Enforce minimum entropy/length requirements. Add secret rotation mechanism. Document secret generation in deployment guide.

**Sensitive Data in Audit Logs:**
- Risk: Passwords and secrets could be logged in audit trail
- Files: `src/lib/audit.ts:215-230`
- Current mitigation: Basic sanitization of password fields in `sanitizeData()`
- Recommendations: Expand sensitive field list (apiKey, token, secret, refreshToken, etc.). Add automated testing for sanitization. Consider hashing sensitive values instead of redacting.

**Encrypted Settings Key Rotation:**
- Risk: Changing NEXTAUTH_SECRET invalidates all encrypted settings, returns empty strings
- Files: `src/lib/settings.ts:48-51`
- Current mitigation: Graceful fallback to empty string on decryption failure
- Recommendations: Add key rotation support with versioned encryption. Provide migration tool for re-encrypting with new key. Log key change events.

**CSRF Protection Allows Missing Headers:**
- Risk: CSRF validation passes when Origin and Referer headers are both absent
- Files: `src/middleware.ts:100-102`
- Current mitigation: Relies on session cookies as fallback defense
- Recommendations: Consider requiring at least one header for state-changing requests. Add CSP headers. Document browser compatibility considerations.

**File Upload Without Virus Scanning:**
- Risk: Uploaded receipts and statements could contain malware
- Files: `src/app/api/receipts/upload/route.ts`, `src/app/api/statements/route.ts`
- Current mitigation: File type validation only (magic byte checking)
- Recommendations: Integrate ClamAV or similar scanner. Sandbox file processing. Implement Content Security Policy for uploaded files.

**No Session Timeout Enforcement:**
- Risk: Sessions configured with timeout settings but not enforced server-side
- Files: `src/lib/settings.ts:130-133`, `src/auth.ts:172-173`
- Current mitigation: JWT maxAge set to 8 hours, but inactivity timeout not implemented
- Recommendations: Track last activity timestamp in JWT. Validate inactivity timeout in middleware. Add client-side timeout warning.

## Performance Bottlenecks

**Uncached Settings File Reads:**
- Problem: System settings read from disk on every call to `getSettings()`
- Files: `src/lib/settings.ts:205-214`
- Cause: No caching mechanism for settings file
- Improvement path: Add in-memory cache with TTL. Invalidate on write. Consider moving frequently-accessed settings to database with Prisma caching.

**N+1 Queries in Audit Log:**
- Problem: Fetching audit logs without proper includes causes N+1 query pattern
- Files: `src/app/api/audit-log/route.ts`, `src/app/api/audit-log/export/route.ts`
- Cause: User data fetched separately after initial query
- Improvement path: Use Prisma `include` for user relation. Add database indexes on `createdAt`, `userId`, `action`. Consider pagination cursor instead of offset.

**Large Image Processing:**
- Problem: Receipt image optimization happens synchronously during upload
- Files: `src/lib/image-processing.ts`, `src/app/api/receipts/upload/route.ts`
- Cause: Sharp image processing blocks API response
- Improvement path: Move image processing to background job queue. Return immediately after upload. Process asynchronously. Consider edge/CDN image optimization.

**Unindexed Queries:**
- Problem: Several findMany queries without proper indexes
- Files: `src/lib/transaction-matcher.ts:74,174`, `src/lib/budget-tracking.ts:124,132`, query patterns across 20+ API routes
- Cause: SQLite has limited auto-indexing compared to PostgreSQL
- Improvement path: Add composite indexes for common query patterns (date + status, userId + date). Use `EXPLAIN QUERY PLAN` to identify missing indexes. Monitor slow query log.

**Statement Parser Memory Usage:**
- Problem: Large CSV/Excel files loaded entirely into memory for parsing
- Files: `src/lib/statement-parser.ts:262,437`
- Cause: XLSX library loads full workbook into memory
- Improvement path: Stream large files with csv-parser. Set file size limits. Process in chunks. Add memory monitoring and limits.

## Fragile Areas

**Timeclock Configuration Pages:**
- Files: `src/app/admin/timeclock/page.tsx`, `src/app/admin/timeclock/managers/page.tsx`
- Why fragile: State management across multiple tabs with 30+ form fields. Easy to desync UI state from server state. Complex overtime/rounding calculations spread throughout component.
- Safe modification: Extract each tab into separate component with isolated state. Add integration tests for workflow scenarios. Use form library (react-hook-form) for validation.
- Test coverage: Manual testing only - no automated tests for timeclock workflows

**Receipt OCR Pipeline:**
- Files: `src/lib/ocr.ts`, `src/app/api/receipts/upload/route.ts`
- Why fragile: Depends on external AI provider. JSON parsing with string manipulation. No retry logic for transient failures. Assumes specific JSON structure.
- Safe modification: Add comprehensive error handling with fallbacks. Validate AI response before parsing. Add retry with exponential backoff. Log failures for debugging.
- Test coverage: No unit tests for OCR parsing logic

**Budget Tracking Calculations:**
- Files: `src/lib/budget-tracking.ts`
- Why fragile: Stored values (`encumbered`, `actualSpent`) can drift from source data. No transaction guarantees. Manual recalculation required.
- Safe modification: Wrap recalculation in database transaction. Add validation queries to detect drift. Consider using database views instead of stored values.
- Test coverage: No tests for budget recalculation logic

**AI Provider Auto-Detection:**
- Files: `src/lib/ai/provider.ts:39-55`
- Why fragile: Fallback logic based on environment variable existence. Silent failures if multiple providers configured incorrectly. No validation of provider configuration.
- Safe modification: Require explicit provider selection in settings. Validate configuration on save. Add health check endpoint for AI provider connectivity.
- Test coverage: No tests for provider selection logic

**Settings Encryption/Decryption:**
- Files: `src/lib/settings.ts:78-98,221-234`
- Why fragile: Nested object traversal with `any` types. Silent failures on decryption errors. Redacted value preservation logic complex and error-prone.
- Safe modification: Add TypeScript strict mode. Use type-safe path traversal (lodash.get/set). Add extensive logging. Test all edge cases.
- Test coverage: No tests for encryption/redaction logic

## Scaling Limits

**SQLite Database:**
- Current capacity: Single file database, suitable for 1-250 employees
- Limit: Concurrent writes limited. No built-in replication. Single point of failure. File size limits (~280TB theoretical, ~100GB practical).
- Scaling path: Migrate to PostgreSQL for >250 employees. Add connection pooling. Implement read replicas. Consider Prisma Accelerate for caching.

**File Upload Storage:**
- Current capacity: Local filesystem in `uploads/` directory
- Limit: Limited by disk space. No redundancy. Difficult to scale horizontally.
- Scaling path: Move to object storage (S3, MinIO). Add CDN for receipt images. Implement lifecycle policies for archival.

**In-Memory Caching:**
- Current capacity: Simple LRU cache in application memory (`src/lib/cache.ts`)
- Limit: Lost on restart. Not shared across instances. Limited by Node.js heap size.
- Scaling path: Use Redis for distributed cache. Add cache warming on startup. Implement cache versioning for safe invalidation.

**Session Storage:**
- Current capacity: JWT-based sessions stored in cookies
- Limit: 4KB cookie size limit. No server-side revocation. Can't force logout.
- Scaling path: Use database or Redis session store. Implement token revocation list. Add session management UI for admins.

## Dependencies at Risk

**Next.js 15.5.4:**
- Risk: Beta/canary features in use (App Router still evolving)
- Impact: Breaking changes in minor versions. Middleware API changes. Cache behavior changes.
- Migration plan: Pin to specific version. Test thoroughly before upgrading. Follow Next.js upgrade guides. Consider staying one version behind stable.

**NextAuth.js 5.0.0-beta.29:**
- Risk: Still in beta, API unstable
- Impact: Breaking changes expected before v5 stable. Limited community support for beta issues.
- Migration plan: Monitor v5 stable release. Prepare for migration to Auth.js rebrand. Test authentication flows thoroughly after upgrades.

**Sharp Image Processing:**
- Risk: Native binaries required, platform-specific
- Impact: Deployment issues on different architectures. Build failures. Missing dependencies.
- Migration plan: Consider serverless-compatible alternatives (jimp). Use Docker for consistent build environment. Document system dependencies.

**XLSX Library:**
- Risk: Large bundle size (1MB+), security vulnerabilities in older versions
- Impact: Slower page loads. Memory usage spikes. Known CVEs in dependency chain.
- Migration plan: Evaluate alternatives (exceljs, xlsx-populate). Lazy load only when needed. Keep updated for security patches.

## Missing Critical Features

**Database Backups:**
- Problem: Backup/restore exists but no automated scheduling
- Blocks: Disaster recovery, compliance requirements
- Priority: High - data loss risk

**Audit Log Retention:**
- Problem: Retention policy exists in settings but not enforced
- Blocks: Compliance (GDPR, SOX), database bloat
- Priority: Medium - compliance risk

**Error Monitoring:**
- Problem: No centralized error tracking (Sentry, Rollbar)
- Blocks: Production debugging, performance monitoring
- Priority: Medium - operational risk

**Email Notifications:**
- Problem: Email infrastructure configured but not used for alerts
- Blocks: Overtime alerts, approval notifications, password resets
- Priority: Medium - user experience

**Multi-Factor Authentication:**
- Problem: Only username/password authentication supported
- Blocks: Security compliance, enterprise adoption
- Priority: Low - security enhancement

**API Rate Limiting:**
- Problem: No rate limiting on API routes (except login)
- Blocks: DoS protection, abuse prevention
- Priority: Medium - security risk

## Test Coverage Gaps

**Component Integration Tests:**
- What's not tested: Multi-step workflows (PO creation → approval → completion), timeclock entry submission and approval flow, receipt upload and OCR processing
- Files: All page components in `src/app/`
- Risk: UI regressions go unnoticed until production. State management bugs. Race conditions.
- Priority: High

**API Endpoint Tests:**
- What's not tested: Most API routes lack unit tests, error handling paths, permission checks
- Files: `src/app/api/**/route.ts` (only 3 test files exist for 100+ routes)
- Risk: Business logic bugs. Security vulnerabilities. Breaking changes undetected.
- Priority: High

**Database Layer Tests:**
- What's not tested: Prisma queries, transaction handling, constraint violations
- Files: `src/lib/budget-tracking.ts`, `src/lib/transaction-matcher.ts`, `src/lib/overtime.ts`
- Risk: Data corruption. Calculation errors. Race conditions in concurrent updates.
- Priority: High

**Settings and Configuration:**
- What's not tested: Encryption/decryption, nested value access, redaction logic
- Files: `src/lib/settings.ts` (0 tests)
- Risk: Config data loss. Security breaches from improper redaction. Silent failures.
- Priority: High

**AI Provider Abstraction:**
- What's not tested: Provider switching, error handling, response parsing
- Files: `src/lib/ai/provider.ts`, `src/lib/ai/adapters/*.ts`, `src/lib/ocr.ts`
- Risk: AI failures break critical features. Vendor lock-in. Silent data quality issues.
- Priority: Medium

**Edge Cases:**
- What's not tested: Concurrent edits, network failures, timeout scenarios, malformed inputs
- Files: Throughout codebase
- Risk: Undefined behavior in production. Data inconsistency. User frustration.
- Priority: Medium

---

*Concerns audit: 2026-02-11*
