# Architecture

**Analysis Date:** 2026-02-11

## Pattern Overview

**Overall:** Next.js 15 App Router with API Routes (Backend-For-Frontend)

**Key Characteristics:**
- Server-first architecture with React Server Components as default
- API Routes serve as backend layer, colocated with frontend pages
- JWT-based authentication with NextAuth.js 5
- Prisma ORM as data access layer over SQLite database
- Permission-based RBAC system with granular controls
- File-based system settings with encryption at rest

## Layers

**Presentation Layer:**
- Purpose: User interface rendering and client-side interactions
- Location: `src/app/**/page.tsx`, `src/components/*.tsx`
- Contains: React Server Components (default), Client Components (marked with 'use client')
- Depends on: API Routes, NextAuth session, client-side utilities
- Used by: End users via browser

**API Layer:**
- Purpose: HTTP endpoints for data operations, authentication, and business logic
- Location: `src/app/api/**/route.ts`
- Contains: Next.js Route Handlers (GET, POST, PUT, DELETE)
- Depends on: Business logic layer, Prisma, NextAuth
- Used by: Presentation layer (client-side fetches), external integrations

**Business Logic Layer:**
- Purpose: Domain logic, calculations, and cross-cutting concerns
- Location: `src/lib/*.ts`, `src/lib/ai/*.ts`
- Contains: Utilities, validation, calculations (overtime, budget tracking), AI provider abstraction
- Depends on: Prisma client, external SDKs (Anthropic, OpenAI)
- Used by: API routes, server components

**Data Access Layer:**
- Purpose: Database queries and schema management
- Location: `src/lib/prisma.ts`, `prisma/schema.prisma`
- Contains: Prisma client singleton, database schema definitions
- Depends on: SQLite database file
- Used by: Business logic layer, API routes

**Authentication Layer:**
- Purpose: User authentication, session management, permission validation
- Location: `src/auth.ts`, `src/lib/check-permissions.ts`
- Contains: NextAuth configuration, JWT callbacks, permission checks
- Depends on: Prisma (user/role lookups), bcrypt (password hashing)
- Used by: All authenticated API routes and server components

## Data Flow

**User Authentication Flow:**

1. User submits credentials to `/api/auth/signin` (NextAuth endpoint)
2. `src/auth.ts` Credentials provider validates email/password against database
3. JWT token created with user ID, role, department, permissions embedded
4. Token stored in HTTP-only cookie (8-hour expiration)
5. JWT re-validated every 5 minutes to refresh permissions from database
6. Invalidated tokens (deactivated users) return null session

**State Management:**
- Server state: Database via Prisma (single source of truth)
- Client state: React hooks (useState, useEffect) for UI state
- Session state: NextAuth JWT tokens, accessed via `auth()` on server, `useSession()` on client
- Settings state: File-based JSON at `config/system-settings.json`, cached in memory

**Typical API Request Flow:**

1. Client-side fetch to `/api/[resource]`
2. API route calls `auth()` to validate session
3. API route calls `getUserWithPermissions()` or `getPermissionsFromSession()`
4. API route calls `hasPermission()` to authorize specific action
5. Business logic in `src/lib/*` performs operation
6. Prisma executes database queries
7. `createAuditLog()` records action (fire-and-forget, never blocks)
8. JSON response returned to client

## Key Abstractions

**Permission System:**
- Purpose: Granular role-based access control
- Examples: `src/lib/check-permissions.ts`, `src/lib/permissions.ts`, `src/lib/client-permissions.ts`
- Pattern: JSON-based permission trees stored in Role.permissions, parsed per request
- Admin override: `_isAdmin: true` grants all permissions
- Helper functions: `hasPermission(permissions, section, permission)` returns boolean

**AI Provider Abstraction:**
- Purpose: Unified interface for multiple AI providers (Anthropic, OpenAI, OpenRouter, Ollama, custom)
- Examples: `src/lib/ai/provider.ts`, `src/lib/ai/adapters/*.ts`
- Pattern: Factory pattern with lazy caching, adapter pattern for provider implementations
- Interface: `AIProvider` with `complete()`, `vision()`, `testConnection()` methods
- Usage tracking: `trackAICall()` wrapper logs token usage to database (fire-and-forget)

**Audit Logging:**
- Purpose: Compliance and change tracking for all sensitive operations
- Examples: `src/lib/audit.ts`
- Pattern: Fire-and-forget async logging that never blocks operations
- Captures: userId, action, entityType, entityId, changes (before/after), IP, user agent
- Error handling: Audit failures logged to console but don't throw errors

**Budget Tracking:**
- Purpose: Real-time budget calculations with cached stored values
- Examples: `src/lib/budget-tracking.ts`
- Pattern: Denormalized counters (encumbered, actualSpent) updated on PO status changes
- Recalculation: Background job via API endpoint `/api/budget-items/recalculate`

**Overtime Calculation:**
- Purpose: CA labor law-compliant overtime tracking (daily + weekly)
- Examples: `src/lib/overtime.ts`
- Pattern: Pure functions that take entries and config, return categorized minutes
- Rules: >8 hours/day = daily OT, >40 hours/week = weekly OT (non-overlapping)

## Entry Points

**Main Application:**
- Location: `src/app/layout.tsx`
- Triggers: All page requests
- Responsibilities: HTML shell, font loading, SessionProvider wrapper, Navbar rendering

**Home Page:**
- Location: `src/app/page.tsx`
- Triggers: Root path `/`
- Responsibilities: Dashboard/landing page for authenticated users

**Authentication:**
- Location: `src/auth.ts` (NextAuth config), `/api/auth/[...nextauth]/route.ts`
- Triggers: Login attempts, session validation
- Responsibilities: Credentials validation, JWT generation, rate limiting (5 attempts per 15 min)

**Standalone Clock Interface:**
- Location: `src/app/(standalone)/clock/page.tsx`
- Triggers: `/clock` route (route group excludes Navbar)
- Responsibilities: Kiosk-mode timeclock for shared devices

**Initial Setup Wizard:**
- Location: `src/app/setup/page.tsx`, `src/app/setup/layout.tsx`
- Triggers: First-run detection via `src/lib/setup-status.ts`
- Responsibilities: Organization setup, admin account creation, integration configuration

## Error Handling

**Strategy:** Defensive error handling with graceful degradation

**Patterns:**
- API routes: try/catch with appropriate HTTP status codes (400, 401, 403, 404, 500)
- Database operations: Prisma errors caught and logged, generic error messages returned to client
- Audit logging: All errors caught internally, never propagate to caller
- AI operations: `AINotConfiguredError` thrown when provider not configured
- File operations: Existence checks before reading settings files
- Permission checks: Default-deny (missing permissions = false)

**Client-side:**
- Fetch errors: Caught in component, display user-friendly message
- Loading states: Skeleton UI while async data loads
- Empty states: Dedicated empty state components when no data exists

## Cross-Cutting Concerns

**Logging:** Console logging in development, error-only in production (Prisma log config)

**Validation:**
- API input: Manual validation in route handlers (no schema library currently)
- Form validation: `react-hook-form` in client components
- File validation: `src/lib/file-validation.ts` for uploads (type, size, magic byte checks)

**Authentication:**
- NextAuth.js session-based with JWT strategy
- `auth()` helper used in all protected API routes and server components
- Session cookie: HTTP-only, secure, 8-hour expiration, automatic renewal
- Permission re-validation: Every 5 minutes via JWT callback

**Encryption:**
- Passwords: bcrypt hashing (10 rounds) at user creation/update
- Secrets: AES-256-GCM encryption for sensitive settings fields (API keys, tokens)
- Encryption key: Derived from NEXTAUTH_SECRET via scrypt

**Rate Limiting:**
- Login attempts: In-memory Map tracking (5 attempts per 15 minutes per email)
- No global rate limiting on API routes (appliance deployment model)

**Caching:**
- AI provider: Singleton cached by configuration hash in `src/lib/ai/provider.ts`
- System settings: In-memory cache, invalidated on write in `src/lib/settings.ts`
- Prisma client: Global singleton to prevent connection exhaustion

---

*Architecture analysis: 2026-02-11*
