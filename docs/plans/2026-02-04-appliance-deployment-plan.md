# Appliance-Style Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ITS Business Core into a single-container appliance with first-run wizard, backup/restore, and automated GHCR publishing.

**Architecture:** Next.js middleware detects unconfigured state and redirects to `/setup` wizard. Wizard creates admin user, org settings, and marks system configured. CLI scripts handle backup/restore. GitHub Actions publishes multi-arch images on tags.

**Tech Stack:** Next.js 15, Prisma/SQLite, TypeScript, Vitest, Docker, GitHub Actions

---

## Phase 1: First-Run Wizard

### Task 1: Add SystemConfig Model to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add SystemConfig model to schema**

Add after the SystemSettings model in `prisma/schema.prisma`:

```prisma
// ============================================
// SYSTEM CONFIGURATION (First-run state)
// ============================================

model SystemConfig {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("system_config")
}
```

**Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 3: Push schema to database**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema"

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(setup): add SystemConfig model for first-run detection"
```

---

### Task 2: Create Setup Status Library

**Files:**
- Create: `src/lib/setup-status.ts`
- Test: `src/lib/__tests__/setup-status.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/setup-status.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { isSetupComplete, markSetupComplete } from '../setup-status';
import { prisma } from '@/lib/prisma';

describe('setup-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isSetupComplete', () => {
    it('returns false when setup_complete record does not exist', async () => {
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue(null);

      const result = await isSetupComplete();

      expect(result).toBe(false);
      expect(prisma.systemConfig.findUnique).toHaveBeenCalledWith({
        where: { key: 'setup_complete' },
      });
    });

    it('returns true when setup_complete record exists with value "true"', async () => {
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue({
        id: '1',
        key: 'setup_complete',
        value: 'true',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await isSetupComplete();

      expect(result).toBe(true);
    });

    it('returns false when setup_complete record exists with value "false"', async () => {
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue({
        id: '1',
        key: 'setup_complete',
        value: 'false',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await isSetupComplete();

      expect(result).toBe(false);
    });
  });

  describe('markSetupComplete', () => {
    it('upserts setup_complete record with value "true"', async () => {
      vi.mocked(prisma.systemConfig.upsert).mockResolvedValue({
        id: '1',
        key: 'setup_complete',
        value: 'true',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await markSetupComplete();

      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'setup_complete' },
        update: { value: 'true' },
        create: { key: 'setup_complete', value: 'true' },
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/__tests__/setup-status.test.ts`
Expected: FAIL - Cannot find module '../setup-status'

**Step 3: Write minimal implementation**

Create `src/lib/setup-status.ts`:

```typescript
import { prisma } from '@/lib/prisma';

/**
 * Check if the system has completed initial setup
 */
export async function isSetupComplete(): Promise<boolean> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'setup_complete' },
    });
    return config?.value === 'true';
  } catch (error) {
    // If database doesn't exist yet, setup is not complete
    console.error('Error checking setup status:', error);
    return false;
  }
}

/**
 * Mark the system as having completed setup
 */
export async function markSetupComplete(): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: 'setup_complete' },
    update: { value: 'true' },
    create: { key: 'setup_complete', value: 'true' },
  });
}

/**
 * Get a system config value by key
 */
export async function getSystemConfig(key: string): Promise<string | null> {
  const config = await prisma.systemConfig.findUnique({
    where: { key },
  });
  return config?.value ?? null;
}

/**
 * Set a system config value
 */
export async function setSystemConfig(key: string, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/__tests__/setup-status.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/setup-status.ts src/lib/__tests__/setup-status.test.ts
git commit -m "feat(setup): add setup status detection library"
```

---

### Task 3: Create Setup Middleware

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Update middleware to check setup status**

Replace contents of `src/middleware.ts`:

```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Setup status is cached in memory to avoid DB calls on every request
// It's invalidated when setup completes (requires app restart or cache clear)
let setupCompleteCache: boolean | null = null;

async function checkSetupComplete(): Promise<boolean> {
  if (setupCompleteCache !== null) {
    return setupCompleteCache;
  }

  try {
    // Dynamic import to avoid issues during build
    const { prisma } = await import("@/lib/prisma");
    const config = await prisma.systemConfig.findUnique({
      where: { key: "setup_complete" },
    });
    setupCompleteCache = config?.value === "true";
    return setupCompleteCache;
  } catch (error) {
    // Database might not exist yet - setup not complete
    console.error("Setup check error:", error);
    return false;
  }
}

// Export for testing/cache invalidation
export function clearSetupCache() {
  setupCompleteCache = null;
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Always allow static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check if setup is complete
  const isSetupComplete = await checkSetupComplete();

  // Setup routes
  const isSetupPage = pathname.startsWith("/setup");
  const isSetupApi = pathname.startsWith("/api/setup");

  if (!isSetupComplete) {
    // Not configured - only allow setup routes
    if (isSetupPage || isSetupApi) {
      return NextResponse.next();
    }
    // Redirect everything else to setup
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  // Setup complete - block setup routes
  if (isSetupPage || isSetupApi) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Normal auth flow for configured system
  const isLoggedIn = !!req.auth;
  const isAuthPage = pathname.startsWith("/auth");

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(setup): add setup detection to middleware"
```

---

### Task 4: Create Setup Wizard API - Complete Setup Endpoint

**Files:**
- Create: `src/app/api/setup/complete/route.ts`
- Test: `src/lib/__tests__/setup-api.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/setup-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the setup completion logic
describe('setup completion logic', () => {
  it('validates required fields', () => {
    const validateSetupData = (data: any) => {
      const errors: string[] = [];

      if (!data.admin?.email) errors.push('Admin email is required');
      if (!data.admin?.password) errors.push('Admin password is required');
      if (!data.admin?.name) errors.push('Admin name is required');
      if (!data.organization?.name) errors.push('Organization name is required');
      if (!data.organization?.departmentName) errors.push('Department name is required');

      if (data.admin?.password && data.admin.password.length < 8) {
        errors.push('Password must be at least 8 characters');
      }

      if (data.admin?.email && !data.admin.email.includes('@')) {
        errors.push('Invalid email format');
      }

      return { valid: errors.length === 0, errors };
    };

    // Missing all fields
    expect(validateSetupData({})).toEqual({
      valid: false,
      errors: expect.arrayContaining([
        'Admin email is required',
        'Admin password is required',
        'Admin name is required',
        'Organization name is required',
        'Department name is required',
      ]),
    });

    // Valid data
    expect(
      validateSetupData({
        admin: {
          email: 'admin@example.com',
          password: 'password123',
          name: 'Admin User',
        },
        organization: {
          name: 'Test Org',
          departmentName: 'General',
        },
      })
    ).toEqual({ valid: true, errors: [] });

    // Invalid email
    expect(
      validateSetupData({
        admin: {
          email: 'invalid',
          password: 'password123',
          name: 'Admin',
        },
        organization: {
          name: 'Test',
          departmentName: 'General',
        },
      })
    ).toEqual({
      valid: false,
      errors: ['Invalid email format'],
    });

    // Short password
    expect(
      validateSetupData({
        admin: {
          email: 'admin@test.com',
          password: 'short',
          name: 'Admin',
        },
        organization: {
          name: 'Test',
          departmentName: 'General',
        },
      })
    ).toEqual({
      valid: false,
      errors: ['Password must be at least 8 characters'],
    });
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npm run test -- src/lib/__tests__/setup-api.test.ts`
Expected: PASS (this is a pure logic test)

**Step 3: Create the API endpoint**

Create `src/app/api/setup/complete/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSetupComplete, markSetupComplete, setSystemConfig } from '@/lib/setup-status';
import { updateSettings, getDefaultSettings } from '@/lib/settings';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface SetupData {
  admin: {
    email: string;
    password: string;
    name: string;
  };
  organization: {
    name: string;
    logo?: string;
    departmentName: string;
    timezone: string;
    fiscalYearStartMonth: number;
  };
  integrations?: {
    anthropicApiKey?: string;
    emailProvider?: 'gmail' | 'office365' | 'smtp' | 'none';
    emailConfig?: Record<string, string>;
  };
}

function validateSetupData(data: SetupData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.admin?.email) errors.push('Admin email is required');
  if (!data.admin?.password) errors.push('Admin password is required');
  if (!data.admin?.name) errors.push('Admin name is required');
  if (!data.organization?.name) errors.push('Organization name is required');
  if (!data.organization?.departmentName) errors.push('Department name is required');

  if (data.admin?.password && data.admin.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (data.admin?.email && !data.admin.email.includes('@')) {
    errors.push('Invalid email format');
  }

  return { valid: errors.length === 0, errors };
}

export async function POST(req: NextRequest) {
  try {
    // Prevent setup if already complete
    if (await isSetupComplete()) {
      return NextResponse.json(
        { error: 'Setup already completed' },
        { status: 400 }
      );
    }

    const data: SetupData = await req.json();

    // Validate input
    const validation = validateSetupData(data);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Create default roles if they don't exist
    const adminRole = await prisma.role.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: {
        name: 'Administrator',
        code: 'ADMIN',
        description: 'Full system access and configuration',
        isSystem: true,
        permissions: JSON.stringify({
          _isAdmin: true,
          timeclock: {
            canClockInOut: true,
            canViewOwnEntries: true,
            canViewTeamEntries: true,
            canEditTeamEntries: true,
            canApproveEntries: true,
            canExportPayroll: true,
            canViewAllEntries: true,
            canManageConfig: true,
            canManageExportTemplates: true,
            canAssignManagers: true,
          },
          purchaseOrders: {
            canCreate: true,
            canViewOwn: true,
            canViewDepartment: true,
            canViewAll: true,
            canEdit: true,
            canApprove: true,
            canDelete: true,
            canVoid: true,
            canUploadReceipts: true,
          },
          budgetItems: {
            canView: true,
            canManage: true,
            canCreateAmendments: true,
            canTransferFunds: true,
            canViewAllCategories: true,
            canManageCategories: true,
            canCloseFiscalYear: true,
            canAccessClosedYears: true,
            canExportReports: true,
          },
          vendors: { canView: true, canManage: true },
          users: { canManage: true },
          departments: { canView: true, canManage: true, canViewAll: true },
          roles: { canManage: true },
          auditLog: { canView: true, canViewAll: true, canExport: true },
          settings: { canManage: true },
        }),
      },
    });

    // Create Manager and User roles
    await prisma.role.upsert({
      where: { code: 'MANAGER' },
      update: {},
      create: {
        name: 'Manager',
        code: 'MANAGER',
        description: 'Department management with approval authority',
        isSystem: true,
        permissions: JSON.stringify({
          timeclock: {
            canClockInOut: true,
            canViewOwnEntries: true,
            canViewTeamEntries: true,
            canEditTeamEntries: true,
            canApproveEntries: true,
            canExportPayroll: true,
            canViewAllEntries: false,
            canManageConfig: false,
            canManageExportTemplates: false,
            canAssignManagers: false,
          },
          purchaseOrders: {
            canCreate: true,
            canViewOwn: true,
            canViewDepartment: true,
            canViewAll: false,
            canEdit: true,
            canApprove: true,
            canDelete: false,
            canVoid: true,
            canUploadReceipts: true,
          },
          budgetItems: {
            canView: true,
            canManage: true,
            canCreateAmendments: true,
            canTransferFunds: true,
            canViewAllCategories: true,
            canManageCategories: false,
            canCloseFiscalYear: false,
            canAccessClosedYears: false,
            canExportReports: true,
          },
          vendors: { canView: true, canManage: true },
          users: { canManage: false },
          departments: { canView: true, canManage: false, canViewAll: true },
          roles: { canManage: false },
          auditLog: { canView: true, canViewAll: false, canExport: true },
          settings: { canManage: false },
        }),
      },
    });

    await prisma.role.upsert({
      where: { code: 'USER' },
      update: {},
      create: {
        name: 'User',
        code: 'USER',
        description: 'Basic employee access for day-to-day operations',
        isSystem: true,
        permissions: JSON.stringify({
          timeclock: {
            canClockInOut: true,
            canViewOwnEntries: true,
            canViewTeamEntries: false,
            canEditTeamEntries: false,
            canApproveEntries: false,
            canExportPayroll: false,
            canViewAllEntries: false,
            canManageConfig: false,
            canManageExportTemplates: false,
            canAssignManagers: false,
          },
          purchaseOrders: {
            canCreate: true,
            canViewOwn: true,
            canViewDepartment: false,
            canViewAll: false,
            canEdit: false,
            canApprove: false,
            canDelete: false,
            canVoid: false,
            canUploadReceipts: false,
          },
          budgetItems: {
            canView: true,
            canManage: false,
            canCreateAmendments: false,
            canTransferFunds: false,
            canViewAllCategories: false,
            canManageCategories: false,
            canCloseFiscalYear: false,
            canAccessClosedYears: false,
            canExportReports: false,
          },
          vendors: { canView: true, canManage: false },
          users: { canManage: false },
          departments: { canView: false, canManage: false, canViewAll: false },
          roles: { canManage: false },
          auditLog: { canView: false, canViewAll: false, canExport: false },
          settings: { canManage: false },
        }),
      },
    });

    // Create department
    const department = await prisma.department.create({
      data: {
        name: data.organization.departmentName,
        description: 'Initial department',
      },
    });

    // Create admin user
    const hashedPassword = await bcrypt.hash(data.admin.password, 10);
    await prisma.user.create({
      data: {
        email: data.admin.email,
        password: hashedPassword,
        name: data.admin.name,
        roleId: adminRole.id,
        departmentId: department.id,
        authProvider: 'local',
      },
    });

    // Update system settings
    const settings = getDefaultSettings();
    settings.organization.name = data.organization.name;
    settings.organization.logo = data.organization.logo || null;
    settings.fiscalYear.startMonth = data.organization.fiscalYearStartMonth || 1;

    // Set up integrations if provided
    if (data.integrations?.anthropicApiKey) {
      settings.ai.provider = 'anthropic';
      settings.ai.anthropic.apiKey = data.integrations.anthropicApiKey;
    }

    if (data.integrations?.emailProvider && data.integrations.emailProvider !== 'none') {
      settings.email.provider = data.integrations.emailProvider;
      // Copy email config based on provider
      if (data.integrations.emailConfig) {
        const config = data.integrations.emailConfig;
        switch (data.integrations.emailProvider) {
          case 'smtp':
            settings.email.smtp = {
              host: config.host || '',
              port: parseInt(config.port || '587'),
              secure: config.secure === 'true',
              username: config.username || '',
              password: config.password || '',
              fromAddress: config.fromAddress || '',
            };
            break;
          case 'gmail':
            settings.email.gmail = {
              clientId: config.clientId || '',
              clientSecret: config.clientSecret || '',
              refreshToken: config.refreshToken || '',
            };
            break;
          case 'office365':
            settings.email.office365 = {
              clientId: config.clientId || '',
              clientSecret: config.clientSecret || '',
              tenantId: config.tenantId || '',
              refreshToken: config.refreshToken || '',
            };
            break;
        }
      }
    }

    updateSettings(settings);

    // Store timezone
    await setSystemConfig('timezone', data.organization.timezone || 'UTC');

    // Store detected NEXTAUTH_URL if not already set
    const host = req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    if (host) {
      await setSystemConfig('nextauth_url', `${protocol}://${host}`);
    }

    // Generate NEXTAUTH_SECRET if not provided via env
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET === 'change-this-to-a-random-secret-in-production') {
      const secret = crypto.randomBytes(32).toString('base64');
      await setSystemConfig('nextauth_secret', secret);
    }

    // Mark setup as complete
    await markSetupComplete();

    return NextResponse.json({
      success: true,
      message: 'Setup completed successfully',
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed', details: String(error) },
      { status: 500 }
    );
  }
}
```

**Step 4: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/app/api/setup/complete/route.ts src/lib/__tests__/setup-api.test.ts
git commit -m "feat(setup): add setup completion API endpoint"
```

---

### Task 5: Create Setup Wizard UI - Welcome Page

**Files:**
- Create: `src/app/setup/page.tsx`
- Create: `src/app/setup/layout.tsx`

**Step 1: Create setup layout**

Create `src/app/setup/layout.tsx`:

```typescript
export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create welcome page**

Create `src/app/setup/page.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

export default function SetupWelcomePage() {
  const router = useRouter();

  const features = [
    'Create your administrator account',
    'Configure your organization details',
    'Set up optional integrations (AI, Email)',
    'Start using ITS Business Core',
  ];

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Welcome to ITS Business Core
        </h1>
        <p className="text-lg text-slate-300">
          Let&apos;s get your system set up in just a few minutes.
        </p>
      </div>

      <div className="bg-white/5 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          What we&apos;ll configure:
        </h2>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-3 text-slate-300">
              <CheckCircleIcon className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => router.push('/setup/admin')}
        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02]"
      >
        Get Started
      </button>

      <p className="text-center text-sm text-slate-400 mt-6">
        This wizard will only appear once. Your settings can be changed later in the admin panel.
      </p>
    </div>
  );
}
```

**Step 3: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/setup/layout.tsx src/app/setup/page.tsx
git commit -m "feat(setup): add setup wizard welcome page"
```

---

### Task 6: Create Setup Wizard UI - Admin Account Page

**Files:**
- Create: `src/app/setup/admin/page.tsx`

**Step 1: Create admin account setup page**

Create `src/app/setup/admin/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function SetupAdminPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const validate = () => {
    const newErrors: string[] = [];

    if (!formData.name.trim()) {
      newErrors.push('Full name is required');
    }

    if (!formData.email.trim()) {
      newErrors.push('Email is required');
    } else if (!formData.email.includes('@')) {
      newErrors.push('Please enter a valid email address');
    }

    if (!formData.password) {
      newErrors.push('Password is required');
    } else if (formData.password.length < 8) {
      newErrors.push('Password must be at least 8 characters');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.push('Passwords do not match');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      // Store in sessionStorage for next steps
      sessionStorage.setItem('setup_admin', JSON.stringify(formData));
      router.push('/setup/organization');
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-2 rounded-full transition-all ${
              step === 2
                ? 'w-8 bg-blue-500'
                : step < 2
                ? 'w-2 bg-blue-400'
                : 'w-2 bg-white/20'
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Create Admin Account
        </h1>
        <p className="text-slate-300">
          This will be your administrator account with full system access.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <ul className="list-disc list-inside text-red-300 text-sm space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="John Smith"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="admin@company.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
              placeholder="Minimum 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
              placeholder="Re-enter your password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showConfirm ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <button
          onClick={() => router.push('/setup')}
          className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleNext}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          Next
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/setup/admin/page.tsx
git commit -m "feat(setup): add admin account setup page"
```

---

### Task 7: Create Setup Wizard UI - Organization Page

**Files:**
- Create: `src/app/setup/organization/page.tsx`

**Step 1: Create organization setup page**

Create `src/app/setup/organization/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function SetupOrganizationPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [detectedTimezone, setDetectedTimezone] = useState('America/New_York');

  const [formData, setFormData] = useState({
    name: '',
    departmentName: 'General',
    timezone: 'America/New_York',
    fiscalYearStartMonth: 1,
  });

  useEffect(() => {
    // Detect browser timezone
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDetectedTimezone(tz);
      // Only set if it's in our list
      if (TIMEZONES.find((t) => t.value === tz)) {
        setFormData((prev) => ({ ...prev, timezone: tz }));
      }
    } catch (e) {
      console.error('Could not detect timezone:', e);
    }

    // Check if we have admin data
    const adminData = sessionStorage.getItem('setup_admin');
    if (!adminData) {
      router.push('/setup/admin');
    }
  }, [router]);

  const validate = () => {
    const newErrors: string[] = [];

    if (!formData.name.trim()) {
      newErrors.push('Organization name is required');
    }

    if (!formData.departmentName.trim()) {
      newErrors.push('Department name is required');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      sessionStorage.setItem('setup_organization', JSON.stringify(formData));
      router.push('/setup/integrations');
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-2 rounded-full transition-all ${
              step === 3
                ? 'w-8 bg-blue-500'
                : step < 3
                ? 'w-2 bg-blue-400'
                : 'w-2 bg-white/20'
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Organization Details
        </h1>
        <p className="text-slate-300">
          Tell us about your company and preferences.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <ul className="list-disc list-inside text-red-300 text-sm space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Organization Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Acme Corporation"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            First Department Name
          </label>
          <input
            type="text"
            value={formData.departmentName}
            onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="General"
          />
          <p className="text-xs text-slate-400 mt-1">
            You can add more departments later in the admin panel.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Timezone
          </label>
          <select
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-slate-800">
                {tz.label}
              </option>
            ))}
          </select>
          {detectedTimezone && detectedTimezone !== formData.timezone && (
            <p className="text-xs text-slate-400 mt-1">
              Detected: {detectedTimezone}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Fiscal Year Start Month
          </label>
          <select
            value={formData.fiscalYearStartMonth}
            onChange={(e) =>
              setFormData({ ...formData, fiscalYearStartMonth: parseInt(e.target.value) })
            }
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value} className="bg-slate-800">
                {month.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <button
          onClick={() => router.push('/setup/admin')}
          className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleNext}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          Next
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/setup/organization/page.tsx
git commit -m "feat(setup): add organization setup page"
```

---

### Task 8: Create Setup Wizard UI - Integrations Page

**Files:**
- Create: `src/app/setup/integrations/page.tsx`

**Step 1: Create integrations setup page**

Create `src/app/setup/integrations/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, ChevronUpIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function SetupIntegrationsPage() {
  const router = useRouter();
  const [anthropicExpanded, setAnthropicExpanded] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [anthropicStatus, setAnthropicStatus] = useState<'untested' | 'success' | 'error'>('untested');

  const [formData, setFormData] = useState({
    anthropicApiKey: '',
    emailProvider: 'none' as 'gmail' | 'office365' | 'smtp' | 'none',
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: false,
    smtpUsername: '',
    smtpPassword: '',
    smtpFromAddress: '',
  });

  useEffect(() => {
    // Check if we have previous data
    const adminData = sessionStorage.getItem('setup_admin');
    const orgData = sessionStorage.getItem('setup_organization');
    if (!adminData || !orgData) {
      router.push('/setup/admin');
    }
  }, [router]);

  const testAnthropicConnection = async () => {
    if (!formData.anthropicApiKey) return;

    setTestingAnthropic(true);
    try {
      const response = await fetch('/api/setup/test-anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: formData.anthropicApiKey }),
      });
      if (response.ok) {
        setAnthropicStatus('success');
      } else {
        setAnthropicStatus('error');
      }
    } catch {
      setAnthropicStatus('error');
    }
    setTestingAnthropic(false);
  };

  const handleNext = () => {
    sessionStorage.setItem('setup_integrations', JSON.stringify(formData));
    router.push('/setup/review');
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-2 rounded-full transition-all ${
              step === 4
                ? 'w-8 bg-blue-500'
                : step < 4
                ? 'w-2 bg-blue-400'
                : 'w-2 bg-white/20'
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Integrations (Optional)
        </h1>
        <p className="text-slate-300">
          Configure optional integrations. You can skip this and set them up later.
        </p>
      </div>

      <div className="space-y-4">
        {/* Anthropic AI Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setAnthropicExpanded(!anthropicExpanded)}
            className="w-full px-4 py-4 flex items-center justify-between text-left"
          >
            <div>
              <h3 className="font-medium text-white">AI Receipt Scanning</h3>
              <p className="text-sm text-slate-400">
                Use Claude AI to automatically extract data from receipts
              </p>
            </div>
            {anthropicExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {anthropicExpanded && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Anthropic API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={formData.anthropicApiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, anthropicApiKey: e.target.value })
                    }
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="sk-ant-..."
                  />
                  <button
                    onClick={testAnthropicConnection}
                    disabled={!formData.anthropicApiKey || testingAnthropic}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm rounded-lg transition-all"
                  >
                    {testingAnthropic ? 'Testing...' : 'Test'}
                  </button>
                </div>
                {anthropicStatus === 'success' && (
                  <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
                    <CheckCircleIcon className="h-4 w-4" />
                    Connection successful
                  </p>
                )}
                {anthropicStatus === 'error' && (
                  <p className="text-sm text-red-400 mt-2">
                    Connection failed. Check your API key.
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Get an API key from{' '}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Email Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setEmailExpanded(!emailExpanded)}
            className="w-full px-4 py-4 flex items-center justify-between text-left"
          >
            <div>
              <h3 className="font-medium text-white">Email Notifications</h3>
              <p className="text-sm text-slate-400">
                Send email notifications for approvals and alerts
              </p>
            </div>
            {emailExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {emailExpanded && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Provider
                </label>
                <select
                  value={formData.emailProvider}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emailProvider: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="none" className="bg-slate-800">
                    None (Configure Later)
                  </option>
                  <option value="smtp" className="bg-slate-800">
                    SMTP Server
                  </option>
                </select>
              </div>

              {formData.emailProvider === 'smtp' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={formData.smtpHost}
                        onChange={(e) =>
                          setFormData({ ...formData, smtpHost: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Port
                      </label>
                      <input
                        type="text"
                        value={formData.smtpPort}
                        onChange={(e) =>
                          setFormData({ ...formData, smtpPort: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        placeholder="587"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={formData.smtpUsername}
                        onChange={(e) =>
                          setFormData({ ...formData, smtpUsername: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={formData.smtpPassword}
                        onChange={(e) =>
                          setFormData({ ...formData, smtpPassword: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      From Address
                    </label>
                    <input
                      type="email"
                      value={formData.smtpFromAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, smtpFromAddress: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="noreply@company.com"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-sm text-slate-400 mt-6">
        All integrations can be configured or changed later in Settings.
      </p>

      <div className="flex gap-4 mt-6">
        <button
          onClick={() => router.push('/setup/organization')}
          className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleNext}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          Next
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/setup/integrations/page.tsx
git commit -m "feat(setup): add integrations setup page"
```

---

### Task 9: Create Setup Wizard UI - Review & Complete Page

**Files:**
- Create: `src/app/setup/review/page.tsx`

**Step 1: Create review page**

Create `src/app/setup/review/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SetupData {
  admin: {
    name: string;
    email: string;
    password: string;
  };
  organization: {
    name: string;
    departmentName: string;
    timezone: string;
    fiscalYearStartMonth: number;
  };
  integrations: {
    anthropicApiKey: string;
    emailProvider: string;
    smtpHost?: string;
    smtpPort?: string;
    smtpUsername?: string;
    smtpPassword?: string;
    smtpFromAddress?: string;
  };
}

export default function SetupReviewPage() {
  const router = useRouter();
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const adminData = sessionStorage.getItem('setup_admin');
    const orgData = sessionStorage.getItem('setup_organization');
    const integrationsData = sessionStorage.getItem('setup_integrations');

    if (!adminData || !orgData) {
      router.push('/setup/admin');
      return;
    }

    setSetupData({
      admin: JSON.parse(adminData),
      organization: JSON.parse(orgData),
      integrations: integrationsData ? JSON.parse(integrationsData) : {},
    });
  }, [router]);

  const handleSubmit = async () => {
    if (!setupData) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin: {
            email: setupData.admin.email,
            password: setupData.admin.password,
            name: setupData.admin.name,
          },
          organization: {
            name: setupData.organization.name,
            departmentName: setupData.organization.departmentName,
            timezone: setupData.organization.timezone,
            fiscalYearStartMonth: setupData.organization.fiscalYearStartMonth,
          },
          integrations: {
            anthropicApiKey: setupData.integrations.anthropicApiKey || undefined,
            emailProvider: setupData.integrations.emailProvider || 'none',
            emailConfig:
              setupData.integrations.emailProvider === 'smtp'
                ? {
                    host: setupData.integrations.smtpHost,
                    port: setupData.integrations.smtpPort,
                    username: setupData.integrations.smtpUsername,
                    password: setupData.integrations.smtpPassword,
                    fromAddress: setupData.integrations.smtpFromAddress,
                  }
                : undefined,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Setup failed');
      }

      // Clear session storage
      sessionStorage.removeItem('setup_admin');
      sessionStorage.removeItem('setup_organization');
      sessionStorage.removeItem('setup_integrations');

      // Redirect to success page
      router.push('/setup/complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!setupData) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
        <div className="text-center text-white">Loading...</div>
      </div>
    );
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-2 rounded-full transition-all ${
              step === 5
                ? 'w-8 bg-blue-500'
                : 'w-2 bg-blue-400'
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Review & Complete</h1>
        <p className="text-slate-300">
          Review your settings before completing setup.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Admin Account */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="font-medium text-white mb-3">Admin Account</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-400">Name:</div>
            <div className="text-white">{setupData.admin.name}</div>
            <div className="text-slate-400">Email:</div>
            <div className="text-white">{setupData.admin.email}</div>
            <div className="text-slate-400">Password:</div>
            <div className="text-white">••••••••</div>
          </div>
        </div>

        {/* Organization */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="font-medium text-white mb-3">Organization</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-400">Name:</div>
            <div className="text-white">{setupData.organization.name}</div>
            <div className="text-slate-400">Department:</div>
            <div className="text-white">{setupData.organization.departmentName}</div>
            <div className="text-slate-400">Timezone:</div>
            <div className="text-white">{setupData.organization.timezone}</div>
            <div className="text-slate-400">Fiscal Year Start:</div>
            <div className="text-white">
              {monthNames[setupData.organization.fiscalYearStartMonth - 1]}
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="font-medium text-white mb-3">Integrations</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-400">AI Receipt Scanning:</div>
            <div className="text-white flex items-center gap-1">
              {setupData.integrations.anthropicApiKey ? (
                <>
                  <CheckIcon className="h-4 w-4 text-emerald-400" />
                  Configured
                </>
              ) : (
                <>
                  <XMarkIcon className="h-4 w-4 text-slate-500" />
                  Not configured
                </>
              )}
            </div>
            <div className="text-slate-400">Email:</div>
            <div className="text-white flex items-center gap-1">
              {setupData.integrations.emailProvider &&
              setupData.integrations.emailProvider !== 'none' ? (
                <>
                  <CheckIcon className="h-4 w-4 text-emerald-400" />
                  {setupData.integrations.emailProvider.toUpperCase()}
                </>
              ) : (
                <>
                  <XMarkIcon className="h-4 w-4 text-slate-500" />
                  Not configured
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <button
          onClick={() => router.push('/setup/integrations')}
          disabled={isSubmitting}
          className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            'Setting up...'
          ) : (
            <>
              <CheckIcon className="h-4 w-4" />
              Complete Setup
            </>
          )}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/setup/review/page.tsx
git commit -m "feat(setup): add review and complete page"
```

---

### Task 10: Create Setup Complete Page

**Files:**
- Create: `src/app/setup/complete/page.tsx`

**Step 1: Create success page**

Create `src/app/setup/complete/page.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

export default function SetupCompletePage() {
  const router = useRouter();

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 text-center">
      <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircleIcon className="h-12 w-12 text-emerald-400" />
      </div>

      <h1 className="text-3xl font-bold text-white mb-4">Setup Complete!</h1>

      <p className="text-lg text-slate-300 mb-8">
        ITS Business Core is ready to use. You can now log in with your admin
        account.
      </p>

      <button
        onClick={() => router.push('/auth/signin')}
        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02]"
      >
        Go to Login
      </button>

      <p className="text-sm text-slate-400 mt-6">
        Need help? Check the documentation in the admin panel.
      </p>
    </div>
  );
}
```

**Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/setup/complete/page.tsx
git commit -m "feat(setup): add setup complete success page"
```

---

### Task 11: Update Docker Entrypoint for Wizard Flow

**Files:**
- Modify: `docker-entrypoint.sh`

**Step 1: Update entrypoint to skip seeding**

Replace contents of `docker-entrypoint.sh`:

```bash
#!/bin/sh
set -e

echo "🚀 Starting ITS Business Core..."

# Set database path to persistent volume
export DATABASE_URL="file:/app/data/database.db"

# Check if database exists
if [ ! -f /app/data/database.db ]; then
  echo "📦 Database not found. Initializing empty database..."

  # Push schema to create database (no seed - wizard will handle that)
  npx prisma db push --accept-data-loss

  echo "✅ Database schema created. Setup wizard will complete initialization."
else
  echo "✅ Database found. Running migrations if needed..."
  npx prisma db push --accept-data-loss
fi

echo "🎉 Starting application..."
exec "$@"
```

**Step 2: Commit**

```bash
git add docker-entrypoint.sh
git commit -m "feat(setup): update entrypoint to skip seeding for wizard flow"
```

---

### Task 12: Run All Tests and Verify Build

**Step 1: Run all tests**

Run: `npm run test`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit any fixes if needed**

---

## Phase 2: Backup & Restore

*(Tasks 13-20 will cover CLI scripts, web UI, and restore functionality)*

---

## Phase 3: CI/CD Pipeline

*(Tasks 21-24 will cover GitHub Actions workflow)*

---

## Phase 4: Documentation

*(Tasks 25-28 will cover README, deployment guide, and in-app help)*

---

## Summary

**Phase 1 delivers:**
- SystemConfig model for setup state
- Setup status detection library with tests
- Middleware that redirects to wizard when unconfigured
- Complete 5-step setup wizard UI
- API endpoint that creates roles, admin user, department, and settings
- Updated Docker entrypoint for wizard flow

**After Phase 1, users can:**
1. `docker run -d -p 3000:3000 -v its-data:/app/data ghcr.io/yourorg/its-business-core`
2. Open browser → See setup wizard
3. Complete wizard → Login → Use app

**Remaining phases** (backup, CI/CD, docs) can be planned after Phase 1 is validated.
