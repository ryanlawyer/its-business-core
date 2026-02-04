# Codebase Concerns

**Analysis Date:** 2026-02-04

## Tech Debt

**Monolithic Settings Page (1213 lines):**
- Issue: `src/app/admin/settings/page.tsx` contains all system configuration UI (organization, security, fiscal, audit, AI, email, etc.) in a single client component
- Files: `src/app/admin/settings/page.tsx`
- Impact: Difficult to maintain; complex state management; slow to render; changes to one section risk breaking others; testing individual sections is challenging
- Fix approach: Split into separate tab components (`SettingsOrganization.tsx`, `SettingsSecurity.tsx`, etc.) exported from `src/components/admin/settings/` and composed in main page

**Large Page Components (1000+ lines):**
- Issue: `src/app/receipts/[id]/page.tsx` (1134 lines), `src/app/purchase-orders/[id]/page.tsx` (770 lines), `src/app/statements/[id]/page.tsx` (669 lines), and `src/app/timeclock/team/[userId]/page.tsx` (608 lines) contain both logic and UI
- Files: Multiple files in `src/app/*/[id]/page.tsx`
- Impact: Difficult to test; high cognitive load; state management fragility; difficult to isolate features
- Fix approach: Extract form logic into custom hooks (e.g., `useReceiptForm`), extract sub-components for reuse, use container/presentational pattern

**Credential Storage in Settings UI:**
- Issue: API keys and credentials (Anthropic, OpenAI, Gmail OAuth, Office365 OAuth, SMTP) are stored in filesystem JSON (`config/system-settings.json`) without encryption
- Files: `src/lib/settings.ts`, `src/app/admin/settings/page.tsx` (lines 599-957)
- Impact: High security risk; credentials readable in plaintext; vulnerable to file system access attacks; audit logs expose credentials if not redacted
- Fix approach: Move sensitive values to environment variables only; implement encrypted vault for per-tenant secrets; mask secrets in audit logs; use secure storage pattern

**Settings Validation Gaps:**
- Issue: Settings PUT endpoint (`src/app/api/settings/route.ts` lines 71-77) only checks top-level structure, doesn't validate individual field values, ranges, formats
- Files: `src/app/api/settings/route.ts`, `src/lib/settings.ts`
- Impact: Invalid data (negative retention months, invalid email addresses, invalid fiscal months) can be saved; no type coercion
- Fix approach: Implement Zod/Yup schema validation with field-level rules; validate numeric ranges; validate email formats; validate provider-specific requirements

**Non-Atomic File Operations:**
- Issue: Receipt upload (`src/app/api/receipts/upload/route.ts` lines 79-95) writes file to disk then creates DB record; if DB write fails, orphaned file exists
- Files: `src/app/api/receipts/upload/route.ts`
- Impact: Disk space waste; inconsistent state; orphaned files accumulate; cleanup necessary
- Fix approach: Write to temporary location first; create DB record; on success, move to permanent location; on failure, clean up temp file

## Known Bugs

**innerHTML XSS Vulnerability (Not actual XSS due to controlled content):**
- Symptoms: Image load error handling uses `innerHTML` with user-controlled SVG markup
- Files: `src/components/receipts/ReceiptCard.tsx` (lines 69-75)
- Trigger: Receipt thumbnail fails to load; user hovers to see broken image
- Issue: Uses `innerHTML` to inject SVG fallback; while SVG here is hardcoded and safe, pattern is dangerous and will fail linting
- Workaround: Currently safe because SVG is static, but should refactor
- Fix: Create React component for fallback or use `textContent` for static text; never use `innerHTML` with any dynamic content

**Non-null Assertions (!) Without Validation:**
- Symptoms: Several places use `!.` to bypass TypeScript safety without runtime checks
- Files:
  - `src/app/receipts/[id]/page.tsx` (line ~823 - `categorySuggestion.category!.id`)
  - `src/app/api/budget-amendments/route.ts` (lines ~95-120 - `toBudgetItem!.fiscalYear`, etc.)
  - `src/app/api/timeclock/export/route.ts` (entriesByEmployee.get assertion)
  - `src/components/receipts/ReceiptCard.tsx` (line 69 - `target.parentElement!.innerHTML`)
- Impact: Runtime crashes if assertions fail; no graceful error handling
- Fix: Add proper null checks and handle null cases; use optional chaining `?.` instead

**Settings API Missing Redaction:**
- Symptoms: Audit logs store full settings including API keys in plaintext
- Files: `src/app/api/settings/route.ts` (line 92-93 - audit log creation)
- Trigger: Admin changes settings; audit log captures credentials
- Impact: Credentials exposed in audit logs; security vulnerability
- Fix approach: Implement redaction function that masks keys in audit payload before logging

## Security Considerations

**Unencrypted Sensitive Configuration:**
- Risk: API keys, OAuth tokens, and credentials stored in `config/system-settings.json` as plaintext
- Files: `src/lib/settings.ts`, configuration files
- Current mitigation: File system permissions (if configured), no console logging of values
- Recommendations:
  1. Move all secrets to environment variables (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
  2. For multi-tenant support, implement encrypted vault (e.g., Vault, AWS Secrets Manager)
  3. Never serialize credentials in audit logs
  4. Implement secret rotation mechanism

**Settings Endpoint Permission Check:**
- Risk: Settings endpoint checks `permissions.settings?.canManage` but permission format is inconsistent
- Files: `src/app/api/settings/route.ts` (lines 27-29, 63-65)
- Current mitigation: Role-based check exists
- Recommendations:
  1. Validate permission structure matches `src/lib/check-permissions.ts` patterns
  2. Use centralized `hasPermission()` utility instead of direct object access
  3. Add admin-only annotation to route

**File Upload Security Gaps:**
- Risk: Receipt uploads accept user-supplied file names and store in predictable path structure
- Files: `src/app/api/receipts/upload/route.ts` (lines 72-76)
- Current mitigation: File validation exists (`validateUploadedFile`), filename is randomized
- Recommendations:
  1. Verify `validateUploadedFile` checks file magic bytes, not just extension
  2. Store uploads outside web root (not accessible via `/uploads/` direct URL)
  3. Implement access control - verify user owns receipt before serving image
  4. Add file size limits to environment config

**Input Validation Inconsistency:**
- Risk: Different API endpoints have varying validation rigor
- Files: Multiple routes in `src/app/api/*/route.ts`
- Current mitigation: Some routes use validation helpers
- Recommendations:
  1. Create middleware or decorator for common validation patterns
  2. Validate numeric ranges (e.g., fiscal year month 1-12)
  3. Validate string lengths and character sets
  4. Centralize validation logic in `lib/validation.ts`

## Performance Bottlenecks

**Large Component Render Without Memoization:**
- Problem: Settings page (1213 lines) re-renders entire UI on any state change; nested tabs with no memoization
- Files: `src/app/admin/settings/page.tsx`
- Cause: No `React.memo` on nested components; full tree updates on form input
- Improvement path: Memoize tab content; use `useCallback` for handlers; consider splitting into separate routes

**N+1 Query Risk in Suggest API:**
- Problem: Receipt suggestion endpoints may query all categories/POs without pagination or limits
- Files: `src/app/api/receipts/[id]/suggest-category/route.ts`, `src/app/api/receipts/[id]/suggest-po/route.ts`
- Cause: `findMany()` without `take()` limit
- Improvement path: Implement pagination (limit 10-20 results), add sort by relevance, add indexes on join tables

**Unbounded In-Memory Cache:**
- Problem: `src/lib/cache.ts` uses simple Map with cleanup, but no maximum size limit; cache can grow unbounded
- Files: `src/lib/cache.ts`
- Cause: No LRU eviction or size limit
- Improvement path: Implement max size with LRU eviction, add metrics for cache hit rate

**Alert Status Checking on Every Request:**
- Problem: Timeclock endpoints likely check alert status (overtime) for all entries on every API call
- Files: `src/lib/overtime.ts` used by timeclock routes
- Cause: Calculation complexity scales with entries in period
- Improvement path: Cache overtime calculation results with TTL; invalidate on entry modification

## Fragile Areas

**Budget Amendment Transfer Logic:**
- Files: `src/app/api/budget-amendments/route.ts` (lines 85-125)
- Why fragile: Complex state transition with from/to budget items; uses `!.` assertions; batch queries without transaction wrapping
- Safe modification: Add explicit transaction boundaries; validate both items exist before attempting transfer; add comprehensive test cases
- Test coverage: Needs tests for: successful transfer, insufficient funds, missing items, concurrent transfers

**Permission System Complexity:**
- Files: `src/lib/check-permissions.ts`, `src/lib/permissions.ts`, multiple routes checking `.role.permissions`
- Why fragile: Permissions stored as JSON string in database; no schema validation; format inconsistency across routes
- Safe modification: Use centralized `hasPermission()` utility everywhere; document permission structure; add validation on role creation
- Test coverage: Needs comprehensive permission matrix testing

**Timeclock Entry Locking:**
- Files: Timeclock approval endpoints in `src/app/api/timeclock/`
- Why fragile: Entries must be locked after approval to prevent editing; concurrent modification risks
- Safe modification: Add explicit version field; implement optimistic locking; validate status before modification
- Test coverage: Needs concurrent modification test cases

## Scaling Limits

**SQLite Database:**
- Current capacity: Single-file SQLite suitable for ~1000 concurrent users with moderate data load; write locks become bottleneck at scale
- Limit: Write concurrency; complex JOINs over large tables; transaction management
- Scaling path: Migrate to PostgreSQL for multi-tenant deployments; implement connection pooling; add read replicas for reporting

**In-Memory Cache:**
- Current capacity: Unlimited until memory exhaustion
- Limit: No size limit; unbounded growth with many users
- Scaling path: Implement LRU cache with size limit; add cache metrics; consider Redis for distributed cache if needed

**File Storage (Receipt Images):**
- Current capacity: Local filesystem; no limit enforced; grows unbounded
- Limit: Disk space exhaustion; no retention policy
- Scaling path: Implement S3-compatible storage; add file cleanup job; implement soft deletion with retention period

## Dependencies at Risk

**NextAuth.js 5 Credentials Provider:**
- Risk: Using basic credentials provider without multi-factor authentication support; no IP whitelisting
- Impact: Account takeover via credential stuffing
- Migration plan: Implement optional 2FA using TOTP (library: `speakeasy`); add failed login rate limiting; consider future Passkey support

**Prisma ORM with SQLite:**
- Risk: SQLite not recommended for production multi-user systems; limited concurrent write support
- Impact: Scaling bottleneck; potential data corruption under load
- Migration plan: Evaluate PostgreSQL compatibility; test migration scripts; plan staging environment tests

**Direct File System Operations:**
- Risk: File upload/storage uses local filesystem without abstraction; NAS deployment may have path issues
- Impact: Deployment friction; difficult to scale horizontally
- Migration plan: Abstract file operations behind interface; implement S3 adapter; support both local and cloud storage

## Missing Critical Features

**Audit Log Redaction:**
- Problem: Credentials and sensitive data stored in plaintext audit logs
- Blocks: Compliance with security standards; data protection regulations
- Approach: Implement field-level redaction rules; mask credentials in audit payloads; add audit log viewer with permission checks

**Settings Validation Framework:**
- Problem: No systematic validation of settings; individual fields not validated
- Blocks: Preventing invalid configurations; data consistency
- Approach: Implement Zod schemas for all settings sections; add client-side validation; add server-side validation

**File Storage Abstraction:**
- Problem: Tight coupling to local filesystem for receipt images
- Blocks: Scaling to cloud deployments; S3 integration; NAS deployment simplicity
- Approach: Create abstract `FileStorage` interface; implement `LocalFileStorage` and `S3FileStorage` adapters; inject via DI

## Test Coverage Gaps

**Settings API Validation:**
- What's not tested: Invalid settings structure (missing required fields); numeric range validation; permission checks
- Files: `src/app/api/settings/route.ts` and integration tests
- Risk: Invalid data can be saved; permission bypasses undetected
- Priority: High

**Receipt Upload Error Handling:**
- What's not tested: File validation edge cases (corrupted files, wrong magic bytes); disk write failures; race conditions
- Files: `src/app/api/receipts/upload/route.ts`
- Risk: Orphaned files; invalid receipts saved; inconsistent state
- Priority: High

**Budget Amendment Transfers:**
- What's not tested: Concurrent transfer attempts; insufficient funds scenario; circular transfers
- Files: `src/app/api/budget-amendments/route.ts`
- Risk: Data corruption; state inconsistency; audit trail accuracy
- Priority: High

**Permission System:**
- What's not tested: Permission matrix combinations; role inheritance; edge cases (deleted roles, orphaned permissions)
- Files: `src/lib/check-permissions.ts`, permission-related routes
- Risk: Permission bypass; security vulnerabilities; inconsistent access control
- Priority: Critical

**Overtime Calculations (Partially Covered):**
- What IS tested: `src/lib/__tests__/overtime.test.ts` (514 lines) covers calculation logic well
- What's not tested: API integration; database persistence; alert notification triggers
- Risk: Calculation bugs in production; alert spam; calculation performance issues
- Priority: Medium

---

*Concerns audit: 2026-02-04*
