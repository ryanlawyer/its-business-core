# Architecture

**Analysis Date:** 2026-02-04

## Pattern Overview

**Overall:** Server-driven Full-Stack Next.js with Role-Based Access Control

**Key Characteristics:**
- Next.js 15 App Router (client and server components)
- RESTful API routes with permission-based access control
- Prisma ORM for data persistence (SQLite)
- NextAuth.js for session-based authentication
- Role-based permission system stored as JSON in database

## Layers

**Presentation Layer:**
- Purpose: User interface and client-side interactivity
- Location: `src/app/` and `src/components/`
- Contains: Server components (pages), client components (interactive UI), shared components
- Depends on: NextAuth session, API routes, custom hooks
- Used by: Browser clients, external users

**API Layer:**
- Purpose: Handle HTTP requests, validate permissions, interact with database
- Location: `src/app/api/`
- Contains: Route handlers (GET, POST, PUT, DELETE), middleware
- Depends on: Prisma client, authentication, permissions library
- Used by: Frontend pages, external integrations

**Business Logic Layer:**
- Purpose: Core domain logic separate from HTTP concerns
- Location: `src/lib/` (utilities like `overtime.ts`, `pay-period.ts`, `budget-tracking.ts`)
- Contains: Calculation functions, format utilities, data transformations
- Depends on: Prisma models, configuration
- Used by: API routes, frontend components

**Data Access Layer:**
- Purpose: Database operations and data models
- Location: `prisma/schema.prisma`, `src/lib/prisma.ts`
- Contains: Prisma schema definitions, ORM client
- Depends on: SQLite database
- Used by: All application layers

**Authentication & Authorization Layer:**
- Purpose: Session management and permission checks
- Location: `src/lib/auth.ts`, `src/lib/check-permissions.ts`, `src/lib/client-permissions.ts`
- Contains: NextAuth configuration, permission utility functions
- Depends on: Prisma, bcryptjs for password hashing
- Used by: API routes and client components

## Data Flow

**User Authentication Flow:**

1. User visits `/auth/signin` (server component)
2. Credentials submitted to NextAuth credentials provider (`src/lib/auth.ts`)
3. Provider queries user from Prisma, validates password with bcryptjs
4. JWT token created with user data + permissions JSON
5. Session callback enriches session object with permissions, roleCode, departmentId
6. Client components access session via `useSession()` hook

**API Request Flow (Protected Resource):**

1. Client component calls API endpoint (e.g., `fetch('/api/receipts/upload')`)
2. API route handler receives request
3. Route calls `auth()` to get session from JWT
4. Route calls `getUserWithPermissions()` or uses `getPermissionsFromSession()`
5. Route calls `hasPermission()` to check access
6. If allowed, route executes business logic, queries Prisma, logs to audit
7. Route returns NextResponse with data or error status

**Timeclock Entry Creation Flow:**

1. User clicks "Clock In" on `/` (client page)
2. Frontend calls `POST /api/timeclock/clock-in`
3. Route validates session, checks `canClockInOut` permission
4. Creates TimeclockEntry record in database
5. Calculates current PayPeriod based on PayPeriodConfig
6. Frontend calls `GET /api/timeclock` with period dates
7. Route calculates overtime using `calculateOvertime()` utility
8. Route returns entries + stats (regular/OT hours, pending/approved counts)
9. Frontend renders timeclock page with period selector and entry table

**Data Transformation Example (Receipts):**

1. File uploaded to `POST /api/receipts/upload`
2. File validated with `validateUploadedFile()`
3. File written to filesystem at `./uploads/receipts/`
4. Receipt record created in Prisma with `PENDING` status
5. Audit log created with file metadata and user IP
6. Future: Receipts queued for OCR processing, category suggestion

**State Management:**

- **Authentication State:** NextAuth session (JWT token stored in httpOnly cookie)
- **UI State:** React useState for client components (modal open/close, loading states)
- **Server State:** Rendered in initial page load (server components), fetched via API (client components)
- **Permissions State:** Embedded in session.user.permissions (JSON string), parsed client-side with `parsePermissions()`

## Key Abstractions

**Permission Model:**
- Purpose: Centralized role-based access control
- Examples: `src/lib/check-permissions.ts`, `src/lib/client-permissions.ts`
- Pattern: Permission checks return boolean, admin always has access override
- Usage: `hasPermission(permissions, 'section', 'action')` returns true if allowed

**Pay Period Calculation:**
- Purpose: Determine business-logic boundaries for timeclock/payroll
- Examples: `src/lib/pay-period.ts`
- Pattern: Utilities return PayPeriod objects with startDate, endDate, label
- Supports: Weekly, biweekly, semimonthly, monthly periods

**Overtime Calculation:**
- Purpose: Compute regular vs. overtime hours based on company thresholds
- Examples: `src/lib/overtime.ts`
- Pattern: Takes array of TimeclockEntry and OvertimeConfig, returns aggregated stats
- Uses: Daily threshold (e.g., 8 hrs) and weekly threshold (e.g., 40 hrs)

**Audit Logging:**
- Purpose: Track all data mutations for compliance and debugging
- Examples: `src/lib/audit.ts`
- Pattern: `createAuditLog()` called after every create/update/delete
- Records: User ID, action, entity type, before/after changes, IP, user agent

**File Validation:**
- Purpose: Ensure uploaded files are safe and match expected types
- Examples: `src/lib/file-validation.ts`
- Pattern: Validates MIME type, size limits, checks file signatures
- Used by: Receipt upload, purchase order receipts, bank statement imports

## Entry Points

**Web Application Root:**
- Location: `src/app/layout.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Root layout with SessionProvider, fonts, metadata, background effects

**Authentication Entry:**
- Location: `src/app/auth/signin/page.tsx`
- Triggers: Unauthenticated user access, manual signout
- Responsibilities: Credential form, login logic, error handling

**Dashboard/Timeclock:**
- Location: `src/app/page.tsx`
- Triggers: Authenticated user access to `/`
- Responsibilities: Display timeclock stats, manage clock in/out, show period entries

**Admin Panel:**
- Location: `src/app/admin/` (multiple sub-routes)
- Triggers: User with admin/manager role
- Responsibilities: System configuration, user management, report generation

**API Gateway:**
- Location: `src/app/api/[resource]/route.ts`
- Triggers: Client HTTP requests
- Responsibilities: Auth check, permission validation, data operation, audit logging

## Error Handling

**Strategy:** Consistent HTTP status codes with JSON error responses

**Patterns:**

- **401 Unauthorized:** No session present → `return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`
- **403 Forbidden:** Permission check fails → `return NextResponse.json({ error: 'Forbidden' }, { status: 403 })`
- **400 Bad Request:** Invalid input (missing file, invalid data) → includes details in error field
- **500 Internal Server Error:** Uncaught exceptions → logged to console, generic error to client
- **Client-side:** Try/catch blocks around fetch calls, console.error logging, UI state for loading/error

## Cross-Cutting Concerns

**Logging:** `console.error()` for errors, `console.log()` for debug (dev mode only). Audit logs use `createAuditLog()`.

**Validation:** File validation in `src/lib/file-validation.ts`. Permission validation in `check-permissions.ts`. Input validation inline in API routes.

**Authentication:** NextAuth session required for all API routes (except public endpoints like `/api/settings/public`). Client components guard with `useSession()` and conditional rendering.

**Authorization:** Two-layer system: API routes check permissions server-side, client components use permission flags to hide UI elements and prevent premature requests.

**Data Consistency:** Prisma handles ACID transactions implicitly. Manual transaction management in critical flows (e.g., budget amendments).

---

*Architecture analysis: 2026-02-04*
