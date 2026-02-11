# Codebase Structure

**Analysis Date:** 2026-02-11

## Directory Layout

```
its-business-core/
├── prisma/                     # Database schema and migrations
├── public/                     # Static assets
├── src/
│   ├── app/                    # Next.js App Router (pages + API routes)
│   │   ├── (standalone)/       # Route group (no Navbar)
│   │   ├── admin/              # Admin-only pages
│   │   ├── api/                # API Routes (backend)
│   │   ├── auth/               # Authentication pages
│   │   ├── setup/              # Initial setup wizard
│   │   ├── timeclock/          # Timeclock user pages
│   │   ├── *.tsx               # Feature pages (POs, receipts, etc.)
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home/dashboard
│   ├── components/             # Shared React components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Business logic and utilities
│   │   ├── ai/                 # AI provider abstraction
│   │   └── __tests__/          # Unit tests
│   ├── types/                  # TypeScript type definitions
│   └── auth.ts                 # NextAuth configuration
├── config/                     # Runtime configuration (gitignored)
└── package.json                # Dependencies and scripts
```

## Directory Purposes

**`prisma/`:**
- Purpose: Database schema, migrations, and seed scripts
- Contains: `schema.prisma` (Prisma schema), migration history
- Key files: `schema.prisma` (single source of truth for database structure)

**`src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components, layouts, route handlers
- Key files: `layout.tsx` (root layout), `page.tsx` (home page)

**`src/app/api/`:**
- Purpose: Backend API endpoints (RESTful routes)
- Contains: Route handlers organized by resource (users, purchase-orders, receipts, etc.)
- Key files: `*/route.ts` (GET/POST/PUT/DELETE handlers)

**`src/app/admin/`:**
- Purpose: Admin-only pages requiring elevated permissions
- Contains: Budget management, departments, roles, audit log, timeclock config
- Key files: `settings/page.tsx`, `roles/page.tsx`, `audit-log/page.tsx`

**`src/app/(standalone)/`:**
- Purpose: Pages without standard navigation (route group)
- Contains: Kiosk-mode timeclock interface
- Key files: `clock/page.tsx` (standalone clock-in/out interface)

**`src/components/`:**
- Purpose: Reusable React components
- Contains: UI components, form elements, specialized widgets
- Key files: `Navbar.tsx`, `SessionProvider.tsx`, `ReceiptUploader.tsx`

**`src/lib/`:**
- Purpose: Business logic, utilities, and shared functions
- Contains: Database client, permissions, calculations, file handling, AI integration
- Key files: `prisma.ts`, `check-permissions.ts`, `audit.ts`, `settings.ts`

**`src/lib/ai/`:**
- Purpose: AI provider abstraction and task implementations
- Contains: Provider adapters, task functions (categorize, summarize), usage tracking
- Key files: `provider.ts`, `adapters/anthropic.ts`, `adapters/openai-compatible.ts`

**`config/`:**
- Purpose: Runtime configuration (not checked into git)
- Contains: `system-settings.json` (encrypted sensitive settings)
- Key files: `system-settings.json` (AI keys, email config, organization settings)

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout with fonts, SessionProvider, Navbar
- `src/app/page.tsx`: Home page/dashboard
- `src/auth.ts`: NextAuth configuration and providers
- `src/app/api/auth/[...nextauth]/route.ts`: NextAuth API handler

**Configuration:**
- `prisma/schema.prisma`: Database schema
- `package.json`: Dependencies and scripts
- `tsconfig.json`: TypeScript configuration
- `tailwind.config.ts`: Tailwind CSS configuration
- `next.config.ts`: Next.js configuration
- `config/system-settings.json`: Runtime settings (gitignored)

**Core Logic:**
- `src/lib/prisma.ts`: Prisma client singleton
- `src/lib/check-permissions.ts`: Permission validation functions
- `src/lib/audit.ts`: Audit logging system
- `src/lib/settings.ts`: System settings management with encryption
- `src/lib/ai/provider.ts`: AI provider factory

**Testing:**
- `src/lib/__tests__/overtime.test.ts`: Overtime calculation tests
- `src/lib/__tests__/setup-status.test.ts`: Setup status detection tests
- `src/lib/__tests__/setup-api.test.ts`: Setup API tests

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Components: `PascalCase.tsx` (e.g., `Navbar.tsx`, `SessionProvider.tsx`)
- Utilities: `kebab-case.ts` (e.g., `check-permissions.ts`, `budget-tracking.ts`)
- Tests: `*.test.ts` (e.g., `overtime.test.ts`)

**Directories:**
- API resources: `kebab-case` (e.g., `purchase-orders/`, `budget-items/`)
- Pages: `kebab-case` (e.g., `auth/signin/`, `admin/settings/`)
- Route groups: `(parentheses)` (e.g., `(standalone)/`)
- Dynamic routes: `[brackets]` (e.g., `receipts/[id]/`)

**Database (Prisma):**
- Models: `PascalCase` in schema (e.g., `BudgetItem`, `PurchaseOrder`)
- Table names: `snake_case` via `@@map()` (e.g., `budget_items`, `purchase_orders`)
- Fields: `camelCase` in schema (e.g., `createdAt`, `budgetAmount`)
- Enums: `SCREAMING_SNAKE_CASE` values (e.g., `POStatus.PENDING_APPROVAL`)

## Where to Add New Code

**New Feature Page:**
- Primary code: `src/app/[feature-name]/page.tsx`
- Layout (if needed): `src/app/[feature-name]/layout.tsx`
- Tests: `src/lib/__tests__/[feature-name].test.ts`

**New API Endpoint:**
- Implementation: `src/app/api/[resource]/route.ts`
- Nested routes: `src/app/api/[resource]/[id]/route.ts`
- Sub-actions: `src/app/api/[resource]/[id]/[action]/route.ts`

**New Component/Module:**
- Shared components: `src/components/[ComponentName].tsx`
- Feature-specific components: Colocate in `src/app/[feature]/` directory
- Business logic: `src/lib/[module-name].ts`

**Utilities:**
- Shared helpers: `src/lib/[utility-name].ts`
- Type definitions: `src/types/[module].d.ts`
- Custom hooks: `src/hooks/[hookName].ts`

**Database Changes:**
- Schema: Edit `prisma/schema.prisma`
- Migration: Run `npx prisma migrate dev --name [description]`
- Generate client: Auto-runs after migration, or `npx prisma generate`

**AI Tasks:**
- New AI task: `src/lib/ai/tasks/[task-name].ts`
- New provider adapter: `src/lib/ai/adapters/[provider-name].ts`
- Update factory: Add provider case to `src/lib/ai/provider.ts`

**Admin Pages:**
- New admin page: `src/app/admin/[feature]/page.tsx`
- Permission-gated in Navbar via `hasPermission(permissions, section, permission)`

## Special Directories

**`src/app/(standalone)/`:**
- Purpose: Pages that render without the standard Navbar/layout
- Generated: No
- Committed: Yes
- Use case: Kiosk-mode interfaces, public pages, print views

**`node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes (via `npm install`)
- Committed: No (gitignored)

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes (via `npm run build` or `npm run dev`)
- Committed: No (gitignored)

**`config/`:**
- Purpose: Runtime configuration with encrypted secrets
- Generated: No (created manually or by setup wizard)
- Committed: No (gitignored - contains secrets)
- Note: `config/system-settings.json` must exist for app to run

**`prisma/.data/`:**
- Purpose: SQLite database files
- Generated: Yes (via `npx prisma db push` or migrations)
- Committed: No (gitignored)
- Production: Should be backed up regularly via Admin > Settings > Backup

**`.planning/`:**
- Purpose: GSD codebase mapping documents
- Generated: Yes (by GSD commands)
- Committed: Yes
- Contains: STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md, INTEGRATIONS.md

## Route Patterns

**Page Routes:**
- Home: `/` → `src/app/page.tsx`
- Feature list: `/[feature]` → `src/app/[feature]/page.tsx`
- Detail view: `/[feature]/[id]` → `src/app/[feature]/[id]/page.tsx`
- Create: `/[feature]/new` → `src/app/[feature]/new/page.tsx`
- Admin: `/admin/[feature]` → `src/app/admin/[feature]/page.tsx`

**API Routes:**
- List/Create: `/api/[resource]` → `src/app/api/[resource]/route.ts` (GET, POST)
- Read/Update/Delete: `/api/[resource]/[id]` → `src/app/api/[resource]/[id]/route.ts` (GET, PUT, DELETE)
- Actions: `/api/[resource]/[id]/[action]` → `src/app/api/[resource]/[id]/[action]/route.ts` (POST)

**Authentication Routes:**
- Sign in page: `/auth/signin` → `src/app/auth/signin/page.tsx`
- NextAuth API: `/api/auth/*` → handled by NextAuth.js via `src/app/api/auth/[...nextauth]/route.ts`

## Import Patterns

**Path Alias:**
- `@/` resolves to `src/` (configured in `tsconfig.json`)
- Example: `import { prisma } from '@/lib/prisma'`

**Typical Imports in API Routes:**
```typescript
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
```

**Typical Imports in Pages:**
```typescript
'use client';  // If client component
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
```

**Server Components (default):**
```typescript
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
```

---

*Structure analysis: 2026-02-11*
