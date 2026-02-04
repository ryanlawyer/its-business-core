# Coding Conventions

**Analysis Date:** 2026-02-04

## Naming Patterns

**Files:**
- Page components: `[name]/page.tsx` (e.g., `src/app/users/page.tsx`)
- API routes: `route.ts` in dynamic directories (e.g., `src/app/api/users/route.ts`)
- React components: `PascalCase.tsx` (e.g., `src/components/Navbar.tsx`)
- Utility/library files: `camelCase.ts` (e.g., `src/lib/overtime.ts`, `src/lib/check-permissions.ts`)
- Test files: `__tests__/[name].test.ts` pattern (e.g., `src/lib/__tests__/overtime.test.ts`)

**Functions:**
- camelCase for all functions
- Async functions: no special prefix, return Promises naturally
- Helper functions: prefix with verb (e.g., `calculateOvertime`, `createAuditLog`, `getRequestContext`)
- Event handlers in React: `handleX` pattern (e.g., `handleSubmit`, `handleChange`)
- Memoized callbacks: no special prefix, wrapped with `useCallback`

**Variables:**
- camelCase for all variables and constants
- Boolean variables: prefix with `is`, `can`, `has`, or `show` (e.g., `isActive`, `canManageUsers`, `hasPermission`, `showModal`)
- State variables: descriptive names (e.g., `setUsers`, `setLoading`, `setCurrentPage`)
- Type definitions: PascalCase (e.g., `User`, `TimeclockEntry`, `UserPermissions`)

**Types & Interfaces:**
- PascalCase for all type names
- Suffix patterns: `Result` (e.g., `OvertimeCalculationResult`), `Config` (e.g., `OvertimeConfig`), `Props` (optional)
- Enum-like objects: use TypeScript type aliases with unions
- Database types imported from Prisma: direct from `@prisma/client`

## Code Style

**Formatting:**
- TypeScript strict mode enabled (`strict: true` in tsconfig.json)
- ESLint configured but disabled during Next.js builds (see `next.config.ts`)
- No explicit prettier configuration found - uses Next.js defaults
- Target: ES2017

**Linting:**
- ESLint 9 with `eslint-config-next` integration
- Build ignores ESLint errors and TypeScript errors (production safety valve)
- Developers should still follow conventions manually

**Semicolons:**
- Used consistently throughout all code
- No semicolon-free style

## Import Organization

**Order:**
1. External dependencies (`react`, `next`, third-party packages)
2. Next.js specific imports (`next/server`, `next/navigation`, `next-auth/react`)
3. Aliases from `@/` (internal project code)
4. Type imports when needed (can be mixed with regular imports)

**Path Aliases:**
- `@/*` resolves to `./src/*` (defined in tsconfig.json)
- Consistently used across all files (never relative paths like `../../../`)

**Examples from codebase:**
```typescript
// API route example (src/app/api/users/route.ts)
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { permissions } from '@/lib/permissions';
import bcrypt from 'bcryptjs';
import { createAuditLog, getRequestContext, sanitizeData } from '@/lib/audit';

// Component example (src/components/Navbar.tsx)
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { getRoleDisplay, getRoleBadgeColor } from '@/lib/permissions';
import { parsePermissions, hasPermission } from '@/lib/client-permissions';
```

## Error Handling

**Patterns:**
- Try-catch blocks wrap async operations and file operations
- Errors logged to console with `console.error()` before re-throwing or returning error response
- API responses use `NextResponse.json()` with appropriate HTTP status codes (401, 403, 400, 500)
- Error messages sent to client include context without exposing sensitive details

**Example pattern (src/app/api/users/route.ts):**
```typescript
try {
  // operation logic
} catch (error) {
  console.error('Error fetching users:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

**Status codes used:**
- 401: Unauthorized (no session/authentication)
- 403: Forbidden (authenticated but lacks permission)
- 400: Bad Request (missing required fields or validation failure)
- 500: Internal Server Error (catch-all for unexpected errors)

## Logging

**Framework:** `console` (console.error, console.log)

**Patterns:**
- Errors logged with context: `console.error('Error doing X:', error)`
- Warnings and info: not observed in current codebase
- No specialized logging framework in use

**Usage locations:**
- API routes: error logging on catch blocks
- Client components: error logging in useEffect and event handlers
- Library functions: error logging before throwing

## Comments

**When to Comment:**
- Complex algorithms get detailed comments explaining logic
- JSDoc comments on exported functions and types
- Inline comments for non-obvious calculations or business logic

**JSDoc/TSDoc:**
- Used for type definitions and exported functions
- Example from `src/lib/overtime.ts`:
```typescript
/**
 * Calculate overtime for a set of entries
 *
 * Daily OT: hours exceeding daily threshold per day
 * Weekly OT: hours exceeding weekly threshold (after daily OT is subtracted)
 *
 * @param entries - Array of timeclock entries with completed clock out
 * @param config - Overtime configuration (thresholds in minutes)
 * @returns Calculation results with regular and OT breakdown
 */
export function calculateOvertime(
  entries: TimeclockEntryForCalculation[],
  config: OvertimeConfig | null
): OvertimeCalculationResult {
```

## Function Design

**Size:**
- Keep functions focused to single responsibility
- Typical range: 10-50 lines
- Complex operations broken into smaller helper functions (e.g., `calculateEmployeeOvertime`, `getDateKey`)

**Parameters:**
- 1-3 parameters typical
- Complex parameter objects used when needed (e.g., config objects)
- No positional parameters beyond 3

**Return Values:**
- Explicit return types in TypeScript
- Objects structured with clear property names
- Null returned when no result (e.g., `checkAlertStatus` returns `null` when thresholds disabled)

**Example from src/lib/overtime.ts:**
```typescript
export function calculateEmployeeOvertime(
  entries: TimeclockEntryForCalculation[],
  config: OvertimeConfig | null
): EmployeeOvertimeResult {
  // ~80 lines handling logic
}
```

## Module Design

**Exports:**
- Named exports for utility functions (not default exports)
- Type exports use `export type` (e.g., `export type UserPermissions = {...}`)
- One main export plus helpers and types

**Barrel Files:**
- Not observed in current structure
- Prefer direct imports from module files

**Example structure (src/lib/check-permissions.ts):**
```typescript
// Type export
export type UserPermissions = {...}

// Function exports
export async function getUserWithPermissions(userId: string) {...}
export function getPermissionsFromSession(session: any) {...}
export function hasPermission(permissions, section, permission) {...}
```

## Client vs Server Components

**Marking:**
- Client components marked with `'use client'` at top of file
- Server components (pages) have no marking
- `'use client'` used when: state management, event handlers, hooks needed

**Example from src/components/Navbar.tsx:**
```typescript
'use client';  // <-- Marks this as client component

import { useState, useEffect } from 'react';
// ... rest of imports
```

## React/TypeScript Patterns

**Component Props:**
- Typed with inline interfaces or separate types
- Consistent destructuring of props

**State Management:**
- `useState` for component-level state
- Session state via `next-auth/react` useSession hook
- No global state management (Redux, Zustand, etc.)

**Hooks Usage:**
- `useCallback` for memoized event handlers and fetch operations
- `useMemo` for expensive computations and permission checks
- `useEffect` for side effects with proper dependency arrays

**Example from src/components/Navbar.tsx:**
```typescript
const permissions = useMemo(
  () => (user?.permissions ? parsePermissions(user.permissions) : null),
  [user?.permissions]
);

const userPermissions = useMemo(() => {
  if (!permissions) return null;
  return {
    canManageUsers: hasPermission(permissions, 'users', 'canManage'),
    // ... more checks
  };
}, [permissions]);
```

## Permission Checking Pattern

**Locations:**
- `src/lib/permissions.ts`: Server-side permission definitions
- `src/lib/check-permissions.ts`: Database-backed permission helpers
- `src/lib/client-permissions.ts`: Client-side permission parsing

**Pattern - Server Routes:**
```typescript
if (!permissions.canManageUsers(session.user.role as any)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Pattern - Client Components:**
```typescript
const permissions = useMemo(
  () => user?.permissions ? parsePermissions(user.permissions) : null,
  [user?.permissions]
);

const canManage = permissions && hasPermission(permissions, 'users', 'canManage');
```

---

*Convention analysis: 2026-02-04*
