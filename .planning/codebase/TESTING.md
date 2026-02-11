# Testing Patterns

**Analysis Date:** 2026-02-11

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in assertions (Jest-compatible API)
- Imports: `import { describe, it, expect, vi, beforeEach } from 'vitest'`

**Run Commands:**
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
```

## Test File Organization

**Location:**
- Co-located in `__tests__` directories within source tree
- Pattern: `src/lib/__tests__/*.test.ts`

**Naming:**
- `*.test.ts` for all test files
- No `.spec.ts` files found in src (only in node_modules)
- File names match tested module: `overtime.test.ts` tests `overtime.ts`

**Structure:**
```
src/
├── lib/
│   ├── __tests__/
│   │   ├── overtime.test.ts
│   │   ├── setup-status.test.ts
│   │   └── setup-api.test.ts
│   ├── overtime.ts
│   └── setup-status.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('module-name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('functionName', () => {
    it('describes expected behavior in plain English', () => {
      // Arrange
      const input = createTestData();

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('handles edge case', () => {
      // Test implementation
    });
  });
});
```

**Patterns:**
- Nested `describe` blocks for grouping related tests
- One top-level describe per module
- Inner describe blocks per function or feature area
- `beforeEach` hooks for test isolation (clearing mocks)
- Explicit test names describing behavior, not implementation

## Mocking

**Framework:** Vitest mocking (`vi`)

**Patterns:**
```typescript
// Mock external modules at top of file
vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Import after mock definition
import { prisma } from '@/lib/prisma';

// Type-safe mock manipulation
vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue({
  id: '1',
  key: 'setup_complete',
  value: 'true',
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

**What to Mock:**
- Prisma client (database access)
- External service calls (AI providers, email)
- File system operations
- Date/time when testing time-sensitive logic

**What NOT to Mock:**
- Pure business logic functions
- Type definitions
- Constants and enums
- Helper functions under test

## Fixtures and Factories

**Test Data:**
```typescript
// Helper functions for creating test data
function createEntry(
  userId: string,
  clockIn: string,
  durationMinutes: number
): TimeclockEntryForCalculation {
  const clockInDate = new Date(clockIn);
  const clockOutDate = new Date(clockInDate.getTime() + durationMinutes * 60 * 1000);
  return {
    id: `entry-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    clockIn: clockInDate,
    clockOut: clockOutDate,
    duration: durationMinutes * 60, // seconds
    status: 'pending',
  };
}

function createConfig(
  dailyThreshold: number | null,
  weeklyThreshold: number | null
): OvertimeConfig {
  return {
    id: 'config-1',
    dailyThreshold,
    weeklyThreshold,
    alertBeforeDaily: null,
    alertBeforeWeekly: null,
    notifyEmployee: true,
    notifyManager: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
```

**Location:**
- Defined inline at top of test file
- Scoped to individual test files (no shared fixture directory)

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# No explicit coverage command configured
# Vitest supports coverage via --coverage flag
npm run test -- --coverage
```

## Test Types

**Unit Tests:**
- Pure function testing with mocked dependencies
- Focus on business logic (overtime calculation, validation)
- Example: `src/lib/__tests__/overtime.test.ts` (515 lines, comprehensive)

**Integration Tests:**
- Not currently used for API routes
- No E2E tests detected

**E2E Tests:**
- Not used
- Playwright installed as dev dependency but no test files found

## Common Patterns

**Async Testing:**
```typescript
it('returns false when setup_complete record does not exist', async () => {
  vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue(null);

  const result = await isSetupComplete();

  expect(result).toBe(false);
  expect(prisma.systemConfig.findUnique).toHaveBeenCalledWith({
    where: { key: 'setup_complete' },
  });
});
```

**Error Testing:**
```typescript
// Not demonstrated in current test files
// Typical pattern would be:
it('throws error when validation fails', () => {
  expect(() => validate(invalidData)).toThrow('Validation failed');
});

// For async errors:
it('rejects when API call fails', async () => {
  await expect(fetchData()).rejects.toThrow('Network error');
});
```

**Edge Cases Tested:**
```typescript
describe('edge cases', () => {
  it('handles empty entries array', () => {
    const config = createConfig(480, 2400);
    const result = calculateOvertime([], config);

    expect(Object.keys(result.employees)).toHaveLength(0);
    expect(result.totalRegularMinutes).toBe(0);
  });

  it('skips entries without clockOut', () => {
    const activeEntry: TimeclockEntryForCalculation = {
      id: 'entry-1',
      userId: 'user1',
      clockIn: new Date('2024-01-15T08:00:00'),
      clockOut: null,
      duration: null,
      status: 'pending',
    };

    const result = calculateOvertime([activeEntry], config);

    expect(Object.keys(result.employees)).toHaveLength(0);
  });
});
```

## Test Quality Characteristics

**Comprehensive Coverage:**
- `overtime.test.ts` covers 13 test suites with 30+ test cases
- Tests cover happy path, edge cases, boundary conditions, and multi-user scenarios

**Descriptive Test Names:**
- Names describe expected behavior: `'returns false when setup_complete record does not exist'`
- Not implementation-focused: avoid names like `'calls findUnique with correct params'`

**Arrange-Act-Assert Pattern:**
- Setup test data (arrange)
- Execute function under test (act)
- Verify expectations (assert)

**Test Isolation:**
- `beforeEach` clears all mocks
- Each test creates its own test data
- No shared mutable state between tests

## Configuration

**Vitest Config (`vitest.config.ts`):**
```typescript
export default defineConfig({
  test: {
    globals: true,        // Makes expect, describe, it available globally
    environment: 'node',  // Node environment (not jsdom)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // Match tsconfig paths
    },
  },
});
```

**Key Settings:**
- `globals: true` - No need to import `describe`, `it`, `expect` (though tests still import them explicitly)
- `environment: 'node'` - Server-side code testing (not DOM testing)
- Path alias `@` configured to match TypeScript config

## Current Test Coverage

**Files with Tests:**
- `src/lib/__tests__/overtime.test.ts` - Comprehensive overtime calculation logic (515 lines)
- `src/lib/__tests__/setup-status.test.ts` - Setup state management (81 lines)
- `src/lib/__tests__/setup-api.test.ts` - Existence noted in find results

**Files Without Tests:**
- API routes (no route tests detected)
- React components (no component tests detected)
- Most utility functions in `src/lib/`
- Client-side hooks

**Testing Philosophy:**
- Focus on complex business logic (overtime, budget tracking)
- Mock external dependencies (database, APIs)
- Test edge cases and boundary conditions
- Prefer isolated unit tests over integration tests

---

*Testing analysis: 2026-02-11*
