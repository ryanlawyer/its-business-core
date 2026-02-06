'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { permissions } from '@/lib/permissions';

export default function RolesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;

  // Only admins can view this page
  if (user && !permissions.canManageUsers(user.role as any)) {
    router.push('/');
    return null;
  }

  const roleDefinitions = [
    {
      role: 'USER',
      name: 'User',
      description: 'Basic employee access for day-to-day operations',
      color: 'badge badge-neutral',
      permissions: [
        { name: 'Clock In/Out', allowed: true, description: 'Can clock in and out for time tracking' },
        { name: 'View Own Time Entries', allowed: true, description: 'Can view their own timeclock history' },
        { name: 'Create Purchase Orders', allowed: true, description: 'Can create draft purchase orders' },
        { name: 'View Own Purchase Orders', allowed: true, description: 'Can view purchase orders they created' },
        { name: 'View Department Purchase Orders', allowed: false, description: 'Cannot view other users\' purchase orders' },
        { name: 'Edit Purchase Orders', allowed: false, description: 'Can only edit own DRAFT purchase orders' },
        { name: 'Approve Purchase Orders', allowed: false, description: 'Cannot approve purchase orders' },
        { name: 'View Budget Items', allowed: true, description: 'Can view budget items' },
        { name: 'Manage Budget Items', allowed: false, description: 'Cannot create or edit budget items' },
        { name: 'View Vendors', allowed: true, description: 'Can view vendor list' },
        { name: 'Manage Vendors', allowed: false, description: 'Cannot add or edit vendors' },
        { name: 'Manage Users', allowed: false, description: 'Cannot manage user accounts' },
      ],
    },
    {
      role: 'MANAGER',
      name: 'Manager',
      description: 'Department management with approval authority',
      color: 'badge badge-info',
      permissions: [
        { name: 'Clock In/Out', allowed: true, description: 'Can clock in and out for time tracking' },
        { name: 'View Own Time Entries', allowed: true, description: 'Can view their own timeclock history' },
        { name: 'Create Purchase Orders', allowed: true, description: 'Can create purchase orders' },
        { name: 'View Own Purchase Orders', allowed: true, description: 'Can view purchase orders they created' },
        { name: 'View Department Purchase Orders', allowed: true, description: 'Can view all purchase orders in their department' },
        { name: 'Edit Purchase Orders', allowed: true, description: 'Can edit purchase orders' },
        { name: 'Approve Purchase Orders', allowed: true, description: 'Can approve purchase orders' },
        { name: 'View Budget Items', allowed: true, description: 'Can view budget items' },
        { name: 'Manage Budget Items', allowed: true, description: 'Can create and edit budget items' },
        { name: 'View Vendors', allowed: true, description: 'Can view vendor list' },
        { name: 'Manage Vendors', allowed: true, description: 'Can add and edit vendors' },
        { name: 'Manage Users', allowed: false, description: 'Cannot manage user accounts' },
      ],
    },
    {
      role: 'ADMIN',
      name: 'Administrator',
      description: 'Full system access and configuration',
      color: 'badge badge-accent',
      permissions: [
        { name: 'Clock In/Out', allowed: true, description: 'Can clock in and out for time tracking' },
        { name: 'View Own Time Entries', allowed: true, description: 'Can view their own timeclock history' },
        { name: 'Create Purchase Orders', allowed: true, description: 'Can create purchase orders' },
        { name: 'View All Purchase Orders', allowed: true, description: 'Can view ALL purchase orders across all departments' },
        { name: 'Edit Purchase Orders', allowed: true, description: 'Can edit any purchase order' },
        { name: 'Approve Purchase Orders', allowed: true, description: 'Can approve purchase orders' },
        { name: 'Delete Purchase Orders', allowed: true, description: 'Can delete purchase orders' },
        { name: 'View Budget Items', allowed: true, description: 'Can view budget items' },
        { name: 'Manage Budget Items', allowed: true, description: 'Can create, edit, and delete budget items' },
        { name: 'View Vendors', allowed: true, description: 'Can view vendor list' },
        { name: 'Manage Vendors', allowed: true, description: 'Can add, edit, and delete vendors' },
        { name: 'Manage Users', allowed: true, description: 'Can create, edit, and deactivate user accounts' },
        { name: 'Manage Departments', allowed: true, description: 'Can create and edit departments' },
      ],
    },
  ];

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="page-title mb-2">Role Permissions</h1>
          <p className="text-[var(--text-secondary)]">
            View and understand what each role can do in the system
          </p>
        </div>

        {/* Info Banner */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--info-muted)] bg-[var(--info-subtle)] text-[var(--info)] px-4 py-3 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold mb-1">About Roles</h3>
              <p className="text-sm">
                The system uses three roles to control access to features. Assign users to the appropriate role in the User Management page based on their responsibilities.
              </p>
            </div>
          </div>
        </div>

        {/* Roles Grid */}
        <div className="space-y-6">
          {roleDefinitions.map((roleDef) => (
            <div key={roleDef.role} className="card overflow-hidden">
              {/* Role Header */}
              <div className={`border-l-4 p-6 ${roleDef.color} border`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">{roleDef.name}</h2>
                    <p className="text-sm opacity-80">{roleDef.description}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-lg font-semibold ${roleDef.color} border`}>
                    {roleDef.role}
                  </span>
                </div>
              </div>

              {/* Permissions List */}
              <div className="p-6">
                <h3 className="section-title mb-4">Permissions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {roleDef.permissions.map((perm, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        perm.allowed ? 'bg-[var(--success-subtle)]' : 'bg-[var(--bg-hover)]'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {perm.allowed ? (
                          <svg className="w-5 h-5 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm ${perm.allowed ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                          {perm.name}
                        </div>
                        <div className={`text-xs mt-0.5 ${perm.allowed ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                          {perm.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Usage Guide */}
        <div className="mt-8 card p-6">
          <h3 className="section-title mb-4">Assigning Roles</h3>
          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            <div className="flex items-start gap-3">
              <span className="font-semibold text-[var(--text-primary)] min-w-[120px]">USER:</span>
              <span>Assign to regular employees who need to track time and create purchase requests.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-[var(--text-primary)] min-w-[120px]">MANAGER:</span>
              <span>Assign to department managers who need to approve purchases, manage budgets, and oversee their team.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-[var(--text-primary)] min-w-[120px]">ADMIN:</span>
              <span>Assign to system administrators who need full access to configure the system and manage all data.</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
            <p className="text-sm text-[var(--text-secondary)]">
              To change a user's role, go to{' '}
              <a href="/users" className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium">
                User Management
              </a>{' '}
              and edit their account.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
