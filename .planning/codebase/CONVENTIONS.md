# Coding Conventions

**Analysis Date:** 2026-02-11

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension (`Navbar.tsx`, `ReceiptCard.tsx`, `POLineItemModal.tsx`)
- Utilities/libraries: kebab-case with `.ts` extension (`check-permissions.ts`, `setup-status.ts`, `image-to-pdf.ts`)
- API routes: `route.ts` in directory-based structure (`api/receipts/route.ts`, `api/timeclock/[id]/route.ts`)
- Test files: `*.test.ts` in `__tests__` directories (`overtime.test.ts`, `setup-status.test.ts`)

**Functions:**
- camelCase for all functions (`getUserWithPermissions`, `hasPermission`, `calculateOvertime`)
- Async functions prefixed with verbs (`getSettings`, `createAuditLog`, `fetchReceipts`)
- Boolean functions use `is`, `can`, `has` prefixes (`isSetupComplete`, `canViewPO`, `hasPermission`)

**Variables:**
- camelCase for variables and parameters (`userWithPerms`, `searchParams`, `periodStart`)
- UPPER_SNAKE_CASE for constants (limited use in codebase)
- Inline type definitions for API responses use PascalCase (`Receipt`, `TimeclockEntry`)

**Types:**
- PascalCase for type definitions and interfaces (`UserPermissions`, `AuditAction`, `PayPeriod`)
- Types prefixed with component/feature name when specific (`TimeclockEntryForCalculation`, `PrismaTransactionClient`)
- Union types use literal strings in UPPER_SNAKE_CASE (`'USER_CREATED' | 'USER_UPDATED'`)

## Code Style

**Formatting:**
- No explicit formatter config detected (.prettierrc not found)
- Consistent 2-space indentation throughout
- Single quotes for strings in TypeScript
- Double quotes in JSON files
- Semicolons used consistently
- Trailing commas in multi-line objects and arrays

**Linting:**
- ESLint with `eslint-config-next` (flat config format via FlatCompat)
- Config: `eslint.config.mjs` extending `next/core-web-vitals` and `next/typescript`
- TypeScript strict mode enabled (`strict: true` in `tsconfig.json`)
- No explicit custom rules beyond Next.js defaults

## Import Organization

**Order:**
1. External dependencies (`react`, `next`, `@prisma/client`)
2. Next.js framework imports (`next/server`, `next/navigation`)
3. Authentication (`@/auth`)
4. Internal utilities using `@/` alias (`@/lib/prisma`, `@/lib/check-permissions`, `@/components/Navbar`)
5. Type-only imports (`import type { ... }`)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json` and `vitest.config.ts`)
- All internal imports use `@/` prefix: `import { prisma } from '@/lib/prisma'`
- No relative imports (`../..`) found in modern code

## Error Handling

**Patterns:**
- API routes use try-catch with console.error + 500 response:
  ```typescript
  try {
    // logic
  } catch (error) {
    console.error('Error fetching timeclock entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  ```
- Fire-and-forget error handling for audit logs (never break operations):
  ```typescript
  try {
    await prisma.auditLog.create({ ... });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw
  }
  ```
- Validation uses Zod with explicit error messages returned to client
- Permission checks return 401 for no session, 403 for no permissions

## Logging

**Framework:** Native `console` methods

**Patterns:**
- `console.error()` for all error logging with descriptive context
- Errors logged before returning error responses
- No debug or info logging in production code
- Audit trail handled separately via `createAuditLog()` in `src/lib/audit.ts`

## Comments

**When to Comment:**
- Deprecation warnings with migration guidance (see `src/lib/permissions.ts`)
- Complex business logic explanations (overtime calculation logic)
- JSDoc-style function headers rare; code is self-documenting via TypeScript types
- TODO comments minimal (1 found: `// TODO: Read from system settings when fiscal year management is implemented`)

**JSDoc/TSDoc:**
- Used sparingly for exported utility functions:
  ```typescript
  /**
   * Create an audit log entry
   * This function is async but catches all errors to prevent audit failures from breaking operations
   */
  export async function createAuditLog(data: AuditLogData): Promise<void>
  ```
- Not used for API routes or React components

## Function Design

**Size:** Functions are focused; API route handlers 50-160 lines, utilities 10-50 lines

**Parameters:**
- Prefer single object parameter for functions with 3+ arguments
- Type all parameters explicitly
- Use destructuring for object parameters: `{ user, permissions }`
- Optional parameters marked with `?` or `| null`

**Return Values:**
- API routes return `NextResponse.json()` consistently
- Utilities return typed values (no `any` returns)
- Async functions always return Promise types
- Validation helpers return discriminated unions: `{ success: true; data: T } | { success: false; error: string }`

## Module Design

**Exports:**
- Named exports preferred over default exports for utilities
- Default exports used only for React components and API route handlers
- One primary responsibility per module (SRP)

**Barrel Files:**
- Not used; each module imported directly
- No `index.ts` re-export pattern detected

## Type Safety

**TypeScript Configuration:**
- Strict mode enabled (`strict: true`)
- Target: ES2017
- Module resolution: bundler
- `noEmit: true` (Next.js handles compilation)

**Patterns:**
- All function parameters and return types explicitly typed
- Prisma types imported directly (`import { OvertimeConfig } from '@prisma/client'`)
- Custom types defined at file level or in dedicated type files
- Type guards for runtime validation combined with Zod schemas
- `any` usage avoided; when used, limited to dynamic Prisma where clauses

## Authorization Pattern

**Server-Side (API Routes):**
```typescript
const session = await auth();
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const userWithPerms = await getUserWithPermissions(session.user.id);
if (!userWithPerms) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

const { user, permissions } = userWithPerms;

if (!hasPermission(permissions, 'receipts', 'canViewAll')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Client-Side (Components):**
```typescript
const permissions = useMemo(
  () => (user?.permissions ? parsePermissions(user.permissions) : null),
  [user?.permissions]
);

const canManage = hasPermission(permissions, 'users', 'canManage');
```

## Validation Pattern

**Zod Schemas:**
- Defined in `src/lib/validation.ts`
- Reusable schemas exported with descriptive names (`userCreateSchema`, `timeclockEditSchema`)
- Custom refinements for cross-field validation
- Helper function `parseWithErrors()` for consistent error handling

**Usage:**
```typescript
const result = schema.safeParse(data);
if (!result.success) {
  const messages = result.error.issues.map((e) => e.message).join(', ');
  return NextResponse.json({ error: messages }, { status: 400 });
}
```

## Prisma Patterns

**Client:**
- Singleton instance in `src/lib/prisma.ts`
- Imported as `import { prisma } from '@/lib/prisma'`

**Model Names:**
- Prisma schema uses camelCase
- Maps to snake_case tables via `@@map()` directive

**Queries:**
- Type-safe queries using generated types
- Include/select patterns for related data
- Transaction support: `prisma.$transaction()`

---

*Convention analysis: 2026-02-11*
