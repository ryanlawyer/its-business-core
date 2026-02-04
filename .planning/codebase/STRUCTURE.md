# Codebase Structure

**Analysis Date:** 2026-02-04

## Directory Layout

```
its-business-core/
├── src/
│   ├── app/                          # Next.js App Router (pages + API routes)
│   │   ├── layout.tsx                # Root layout with SessionProvider, fonts
│   │   ├── page.tsx                  # Timeclock dashboard (authenticated users)
│   │   ├── auth/
│   │   │   └── signin/page.tsx       # Login page
│   │   ├── admin/                    # Admin-only pages
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── departments/
│   │   │   ├── timeclock/            # Timeclock admin config
│   │   │   │   ├── managers/         # Manager assignment
│   │   │   │   └── templates/        # Export templates
│   │   │   ├── budget-*              # Budget management pages
│   │   │   ├── audit-log/
│   │   │   ├── fiscal-years/
│   │   │   └── settings/
│   │   ├── receipts/                 # Receipt management pages
│   │   ├── vendors/
│   │   ├── purchase-orders/
│   │   ├── statements/
│   │   ├── reports/
│   │   ├── budget-items/
│   │   ├── api/                      # RESTful API routes
│   │   │   ├── auth/[...nextauth]/   # NextAuth configuration
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── timeclock/            # Timeclock endpoints
│   │   │   │   ├── clock-in/
│   │   │   │   ├── clock-out/
│   │   │   │   ├── [id]/approve
│   │   │   │   ├── [id]/reject
│   │   │   │   ├── export/
│   │   │   │   ├── config/
│   │   │   │   ├── templates/
│   │   │   │   ├── pending/
│   │   │   │   ├── alerts/
│   │   │   │   └── team/
│   │   │   ├── receipts/
│   │   │   ├── budget-*/
│   │   │   ├── vendors/
│   │   │   ├── departments/
│   │   │   ├── statements/
│   │   │   └── settings/
│   │   └── globals.css               # Global Tailwind styles
│   ├── lib/                          # Shared utilities and business logic
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   ├── auth.ts                   # NextAuth configuration
│   │   ├── check-permissions.ts      # Server-side permission utilities
│   │   ├── client-permissions.ts     # Client-side permission parsing
│   │   ├── permissions.ts            # Permission definitions and helpers
│   │   ├── overtime.ts               # Overtime calculation logic
│   │   ├── pay-period.ts             # Pay period calculation logic
│   │   ├── audit.ts                  # Audit logging utilities
│   │   ├── file-validation.ts        # File upload validation
│   │   ├── budget-tracking.ts        # Budget balance calculations
│   │   ├── transaction-matcher.ts    # Bank statement matching
│   │   ├── statement-parser.ts       # CSV/OFX parsing
│   │   ├── categorizer.ts            # AI receipt categorization
│   │   ├── ocr.ts                    # Receipt OCR processing
│   │   ├── image-processing.ts       # Image resize/thumbnail
│   │   ├── image-to-pdf.ts           # Multi-image PDF generation
│   │   ├── cache.ts                  # In-memory caching
│   │   ├── currency.ts               # Currency utilities
│   │   ├── settings.ts               # System settings
│   │   └── __tests__/                # Unit tests
│   │       └── overtime.test.ts      # Overtime calculation tests
│   ├── components/                   # Reusable React components
│   │   ├── Navbar.tsx                # Main navigation (client component)
│   │   ├── SessionProvider.tsx       # NextAuth session wrapper
│   │   ├── OvertimeAlertBanner.tsx   # Overtime warnings
│   │   ├── ReceiptUpload.tsx         # Receipt upload widget
│   │   ├── BudgetItemSelector.tsx    # Budget selection component
│   │   ├── POLineItemModal.tsx       # PO line item editor
│   │   ├── OvertimeIndicator.tsx     # Visual OT indicator
│   │   └── receipts/
│   │       ├── ReceiptCard.tsx       # Receipt display card
│   │       └── ReceiptUpload.tsx     # Detailed receipt upload
│   ├── types/                        # TypeScript type definitions
│   └── auth.ts                       # NextAuth configuration export
├── prisma/
│   ├── schema.prisma                 # Database schema definition
│   ├── seed.ts                       # Database seeding script
│   └── migrations/                   # Database migration files
├── public/                           # Static assets
│   └── favicon.ico
├── package.json                      # Dependencies, scripts
├── tsconfig.json                     # TypeScript configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── next.config.ts                    # Next.js configuration
└── .env / .env.example               # Environment variables
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router - all pages and API routes
- Contains: Page components (.tsx), API route handlers (route.ts), layouts
- Key files: `page.tsx` (file-based routes), `layout.tsx` (nested layouts), `globals.css` (styles)

**`src/app/admin/`:**
- Purpose: Admin configuration pages (users, roles, departments, timeclock config)
- Contains: Admin-only pages with full edit/delete capabilities
- Key files: `src/app/admin/timeclock/page.tsx` (timeclock admin dashboard), `src/app/admin/roles/manage/page.tsx` (role editor)

**`src/app/api/`:**
- Purpose: RESTful API endpoints for all data operations
- Contains: Route handlers following Next.js conventions (`route.ts`)
- Key files: `src/app/api/timeclock/route.ts` (GET timeclock data), `src/app/api/receipts/upload/route.ts` (file upload)

**`src/lib/`:**
- Purpose: Shared business logic, utilities, helpers
- Contains: Pure functions for calculations, data transformations, validation
- Key files: `src/lib/overtime.ts` (core OT calculation), `src/lib/pay-period.ts` (period boundaries), `src/lib/check-permissions.ts` (auth)

**`src/components/`:**
- Purpose: Reusable React components (server and client)
- Contains: UI components, form components, layout components
- Key files: `src/components/Navbar.tsx` (navigation), `src/components/SessionProvider.tsx` (auth wrapper)

**`prisma/`:**
- Purpose: Database schema and migrations
- Contains: Prisma schema definitions, migration history
- Key files: `prisma/schema.prisma` (all data models), `prisma/seed.ts` (initial data)

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML structure, global setup
- `src/app/page.tsx`: Timeclock dashboard (main user-facing page)
- `src/app/auth/signin/page.tsx`: Login page
- `src/app/api/auth/[...nextauth]/route.ts`: Authentication handler

**Configuration:**
- `src/lib/auth.ts`: NextAuth credential provider, JWT/session callbacks
- `prisma/schema.prisma`: All database models and relationships
- `tailwind.config.ts`: Tailwind CSS variables (colors, spacing, fonts)
- `next.config.ts`: Next.js runtime configuration
- `.env`: Database URL, upload directory, API keys

**Core Logic:**
- `src/lib/overtime.ts`: Overtime calculation algorithm
- `src/lib/pay-period.ts`: Pay period boundary calculations
- `src/lib/check-permissions.ts`: Permission validation (server-side)
- `src/lib/client-permissions.ts`: Permission parsing (client-side)
- `src/lib/audit.ts`: Audit log creation and context extraction

**Testing:**
- `src/lib/__tests__/overtime.test.ts`: Unit tests for OT calculation

## Naming Conventions

**Files:**
- Page components: `page.tsx` (e.g., `src/app/receipts/page.tsx`)
- API routes: `route.ts` (e.g., `src/app/api/users/route.ts`)
- Client components: `.tsx` with `'use client'` directive (e.g., `src/components/Navbar.tsx`)
- Server utilities: `.ts` (e.g., `src/lib/audit.ts`)
- Test files: `.test.ts` or `.test.tsx` (e.g., `overtime.test.ts`)

**Directories:**
- Pages follow route structure: `app/[feature]/page.tsx`
- API endpoints follow resource structure: `api/[resource]/route.ts` or `api/[resource]/[id]/[action]/route.ts`
- Utilities grouped by domain: `lib/overtime.ts`, `lib/budget-tracking.ts`
- Components in feature folders: `components/receipts/`, `components/admin/`

**Variables & Functions:**
- camelCase: `getUserWithPermissions()`, `calculateOvertime()`, `fetchEntries()`
- Constants: `UPPERCASE_WITH_UNDERSCORES` (e.g., `UPLOAD_DIR = './uploads/receipts'`)
- Type names: PascalCase (e.g., `TimeclockEntry`, `PayPeriod`, `UserPermissions`)

## Where to Add New Code

**New Feature Endpoint:**
- Primary code: `src/app/api/[feature]/route.ts` (GET/POST) or `src/app/api/[feature]/[id]/[action]/route.ts`
- Pattern: Call `auth()`, check permissions with `hasPermission()`, query Prisma, log to audit
- Example: `src/app/api/timeclock/clock-in/route.ts`

**New Page/User Interface:**
- Implementation: `src/app/[feature]/page.tsx`
- Pattern: Server component by default, use `'use client'` only if interactive (forms, hooks)
- Styling: Use Tailwind CSS utility classes, reference colors from `--accent-primary` etc. in globals.css
- Example: `src/app/receipts/[id]/page.tsx` (receipt detail view)

**New Business Logic Function:**
- Implementation: `src/lib/[domain].ts`
- Pattern: Pure function taking domain objects, returning calculated results
- Testing: Add tests to `src/lib/__tests__/[domain].test.ts`
- Example: `src/lib/budget-tracking.ts` (budget balance calculations)

**Utilities and Helpers:**
- Shared: `src/lib/` (pagination, formatting, validation)
- Component-specific: Inline or in same file
- Example: `src/lib/file-validation.ts` (used by multiple upload endpoints)

## Special Directories

**`src/app/api/timeclock/`:**
- Purpose: All timeclock-related endpoints (core feature)
- Generated: No
- Committed: Yes
- Key endpoints: `clock-in`, `clock-out`, `[id]/approve`, `[id]/reject`, `export`, `config`, `pending`

**`src/app/admin/timeclock/`:**
- Purpose: Timeclock administration pages (manager assignment, export templates)
- Generated: No
- Committed: Yes
- Key pages: `managers/page.tsx` (assign managers), `templates/page.tsx` (export configs)

**`prisma/migrations/`:**
- Purpose: Database migration history
- Generated: Yes (by `prisma migrate dev --name <name>`)
- Committed: Yes
- Pattern: Each file represents a schema change, numbered sequentially

**`uploads/receipts/`:**
- Purpose: Receipt image/PDF file storage
- Generated: Yes (created on first file upload)
- Committed: No (in .gitignore)
- Path configuration: `UPLOAD_DIR` environment variable (default `./uploads/receipts`)

**`src/types/`:**
- Purpose: Global TypeScript type definitions
- Generated: No
- Committed: Yes
- Pattern: Types for API responses, database models, utility inputs/outputs

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)
- Contains: Compiled JavaScript, server functions, static exports

---

*Structure analysis: 2026-02-04*
