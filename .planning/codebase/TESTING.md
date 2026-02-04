# Testing Patterns

**Analysis Date:** 2026-02-04

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`
- Globals enabled (`globals: true`)
- Node environment (`environment: 'node'`)

**Assertion Library:**
- Vitest built-in expect (Vitest provides expect globally via globals)

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test:watch       # Watch mode for development
npm run test -- --coverage  # With coverage report (if configured)
```

## Test File Organization

**Location:**
- Co-located in `__tests__` directories next to source code
- Pattern: `src/lib/__tests__/overtime.test.ts`

**Naming:**
- `[module].test.ts` suffix for test files
- Matches the module being tested (e.g., `overtime.ts` → `overtime.test.ts`)

**Structure:**
```
src/
  lib/
    overtime.ts
    __tests__/
      overtime.test.ts  # Tests for overtime module
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';

describe('calculateOvertime', () => {
  describe('when config is null', () => {
    it('returns all time as regular', () => {
      // Arrange
      const entries = [createEntry('user1', '2024-01-15T08:00:00', 600)];

      // Act
      const result = calculateOvertime(entries, null);

      // Assert
      expect(result.employees['user1'].regularMinutes).toBe(600);
    });
  });

  describe('daily overtime', () => {
    it('calculates daily OT when exceeding daily threshold', () => {
      // Arrange, Act, Assert...
    });
  });
});
```

**Patterns:**
- Top-level `describe` for function being tested
- Nested `describe` for scenarios/contexts
- `it` for individual test cases
- Arrange-Act-Assert (AAA) pattern within each test
- Descriptive test names starting with action verb: "calculates", "handles", "returns", "skips"

## Mocking

**Framework:** Vitest built-in mocking (no external mock library required for this codebase)

**Patterns (from src/lib/__tests__/overtime.test.ts):**

**Helper Functions (not true mocks, but test doubles):**
```typescript
// Helper to create mock entries
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

// Helper to create mock config
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

// Helper with optional fields
function createConfigWithAlerts(
  dailyThreshold: number | null,
  weeklyThreshold: number | null,
  alertBeforeDaily: number | null,
  alertBeforeWeekly: number | null
): OvertimeConfig {
  return { ...createConfig(...), alertBeforeDaily, alertBeforeWeekly };
}
```

**What to Mock:**
- External service calls (not done in current test suite)
- Database operations (not done in current test suite - overtime.ts is pure)
- Time/dates (not done - tests use fixed dates directly)

**What NOT to Mock:**
- Pure functions (calculate, transform, validate logic)
- Type/interface implementations
- Simple utility functions

## Fixtures and Factories

**Test Data:**

Current approach uses helper functions defined at module level:

```typescript
function createEntry(
  userId: string,
  clockIn: string,
  durationMinutes: number
): TimeclockEntryForCalculation {
  // Creates realistic test data with all required fields
}

function createConfig(
  dailyThreshold: number | null,
  weeklyThreshold: number | null
): OvertimeConfig {
  // Creates config with sensible defaults
}
```

**Location:**
- Defined at top level of test file
- Reused across multiple test suites within same file
- Not extracted to separate fixtures file (current project scale doesn't require it)

**Pattern:**
- Factory functions that accept key parameters
- Fill in realistic defaults for other fields
- Generate unique IDs where needed (e.g., `Math.random().toString(36)`)

## Coverage

**Requirements:** Not enforced (no coverage threshold in vitest.config.ts)

**View Coverage:**
```bash
npm run test -- --coverage    # If coverage plugin is installed
```

**Current Status:** One test file exists (`src/lib/__tests__/overtime.test.ts`), coverage for overtime calculations only. Most of the codebase (API routes, components, pages) has no tests.

## Test Types

**Unit Tests:**
- Scope: Individual functions and their outputs
- Approach: Test each function in isolation with various inputs
- Location: `src/lib/__tests__/overtime.test.ts` (515 lines)
- Example: `calculateOvertime` tested with various entry combinations and configurations

**Integration Tests:**
- Not currently implemented
- Would be needed for: API routes, database operations, multi-module flows

**E2E Tests:**
- Not currently implemented
- Framework: Could use Playwright or Cypress (not configured)

## Common Patterns

**Async Testing:**
Currently not present in test suite (overtime calculations are synchronous).

When needed, pattern would be:
```typescript
it('async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expectedValue);
});
```

**Error Testing:**
Negative cases tested within normal test suites:

```typescript
describe('edge cases', () => {
  it('handles empty entries array', () => {
    const config = createConfig(480, 2400);
    const result = calculateOvertime([], config);

    expect(Object.keys(result.employees)).toHaveLength(0);
    expect(result.totalRegularMinutes).toBe(0);
  });

  it('skips entries without clockOut', () => {
    const config = createConfig(480, null);
    const activeEntry: TimeclockEntryForCalculation = {
      id: 'entry-1',
      userId: 'user1',
      clockIn: new Date('2024-01-15T08:00:00'),
      clockOut: null,  // <-- Edge case
      duration: null,
      status: 'pending',
    };

    const result = calculateOvertime([activeEntry], config);
    expect(Object.keys(result.employees)).toHaveLength(0);
  });
});
```

## Test Comprehensiveness

**Overtime Module Coverage (src/lib/__tests__/overtime.test.ts):**

Total: 63 test cases across 5 describe blocks

**Test Breakdown:**

1. **calculateOvertime - null config (2 tests)**
   - Null config returns all time as regular
   - Both thresholds null returns all time as regular

2. **calculateOvertime - daily overtime (4 tests)**
   - Exceeds daily threshold
   - Multiple entries same day
   - Entries under threshold
   - Multiple days correctly aggregated

3. **calculateOvertime - weekly overtime (2 tests)**
   - Exceeds weekly threshold
   - Weekly under threshold

4. **calculateOvertime - combined daily+weekly (2 tests)**
   - Both types calculated correctly
   - Weekly OT added on top of daily OT

5. **calculateOvertime - multiple employees (1 test)**
   - Separate calculations per employee
   - Correct aggregation

6. **calculateOvertime - edge cases (3 tests)**
   - Empty entries array
   - Entries without clockOut (active entries)
   - Entries without duration

7. **calculateDailyMinutes (2 tests)**
   - Calculates minutes for specific day
   - Returns 0 for day with no entries

8. **calculateWeeklyMinutes (2 tests)**
   - Calculates minutes for week
   - Excludes other weeks

9. **checkAlertStatus - null/disabled (2 tests)**
   - Null config returns null
   - Both thresholds disabled returns null

10. **checkAlertStatus - daily alerts (4 tests)**
    - Not exceeded/approaching
    - Approaching threshold
    - Exceeded threshold
    - Includes active minutes

11. **checkAlertStatus - weekly alerts (3 tests)**
    - Not exceeded/approaching
    - Approaching threshold
    - Exceeded threshold

12. **checkAlertStatus - combined alerts (1 test)**
    - Both thresholds with alert windows

13. **checkAlertStatus - edge cases (3 tests)**
    - No alert threshold set
    - Empty entries
    - Active minutes with empty entries

**Assertion Patterns Used:**
- `.toBe()`: Exact value matching
- `.toHaveLength()`: Array/object length checking
- Direct property assertion chains

## Quick Testing Commands

```bash
# Run tests once
npm run test

# Watch mode (recommended for development)
npm run test:watch

# Run specific file
npm run test -- overtime.test.ts

# Run with verbose output
npm run test -- --reporter=verbose
```

---

*Testing analysis: 2026-02-04*
