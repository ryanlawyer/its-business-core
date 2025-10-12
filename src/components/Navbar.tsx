'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { getRoleDisplay, getRoleBadgeColor } from '@/lib/permissions';
import { parsePermissions, hasPermission } from '@/lib/client-permissions';

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState('ITS Business Core');

  // Fetch organization name on mount
  useEffect(() => {
    const fetchOrganizationName = async () => {
      try {
        const res = await fetch('/api/settings/public');
        if (res.ok) {
          const data = await res.json();
          setOrganizationName(data.organization.name);
        }
      } catch (error) {
        console.error('Error fetching organization name:', error);
      }
    };

    if (user) {
      fetchOrganizationName();
    }
  }, [user]);

  const isActive = useCallback(
    (path: string) => {
      return pathname === path ? 'bg-blue-700' : '';
    },
    [pathname]
  );

  // Memoize permission parsing to avoid recalculating on every render
  const permissions = useMemo(
    () => (user?.permissions ? parsePermissions(user.permissions) : null),
    [user?.permissions]
  );

  // Memoize all permission checks to avoid recomputing
  const userPermissions = useMemo(() => {
    if (!permissions) return null;

    return {
      canManageUsers: hasPermission(permissions, 'users', 'canManage'),
      canManageRoles: hasPermission(permissions, 'roles', 'canManage'),
      canViewAuditLog: hasPermission(permissions, 'auditLog', 'canView'),
      canManageDepartments: hasPermission(permissions, 'departments', 'canManage'),
      canManageSettings: hasPermission(permissions, 'settings', 'canManage'),
      canManageBudgetCategories: hasPermission(permissions, 'budgetItems', 'canManageCategories'),
      canCreateAmendments:
        hasPermission(permissions, 'budgetItems', 'canCreateAmendments') ||
        hasPermission(permissions, 'budgetItems', 'canTransferFunds'),
    };
  }, [permissions]);

  if (!user || !userPermissions) return null;

  const {
    canManageUsers,
    canManageRoles,
    canViewAuditLog,
    canManageDepartments,
    canManageSettings,
    canManageBudgetCategories,
    canCreateAmendments,
  } = userPermissions;

  const showAdminMenu =
    canManageUsers ||
    canManageRoles ||
    canViewAuditLog ||
    canManageDepartments ||
    canManageSettings ||
    canManageBudgetCategories;

  return (
    <nav className="bg-blue-600 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded flex items-center justify-center">
              <span className="text-blue-600 font-bold text-lg">ITS</span>
            </div>
            {/* Desktop/Tablet: Show full name */}
            <span className="text-lg sm:text-xl font-bold hidden sm:inline">
              {organizationName}
            </span>
            {/* Mobile: Show first word only to save space */}
            <span className="text-lg font-bold sm:hidden">
              {organizationName.split(' ')[0]}
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden lg:flex space-x-2">
            <Link
              href="/"
              className={`px-3 py-2 rounded hover:bg-blue-700 transition-colors ${isActive('/')}`}
            >
              Timeclock
            </Link>

            {/* Purchasing Dropdown */}
            <div className="relative group">
              <button className="px-3 py-2 rounded hover:bg-blue-700 transition-colors flex items-center">
                Purchasing
                <svg
                  className="w-4 h-4 ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div className="absolute left-0 mt-0 w-48 bg-blue-600 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <Link
                  href="/purchase-orders"
                  className={`block px-4 py-2 hover:bg-blue-700 rounded-t-md ${isActive('/purchase-orders')}`}
                >
                  Purchase Orders
                </Link>
                <Link
                  href="/vendors"
                  className={`block px-4 py-2 hover:bg-blue-700 rounded-b-md ${isActive('/vendors')}`}
                >
                  Vendors
                </Link>
              </div>
            </div>

            {/* Budget Dropdown */}
            <div className="relative group">
              <button className="px-3 py-2 rounded hover:bg-blue-700 transition-colors flex items-center">
                Budget
                <svg
                  className="w-4 h-4 ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div className="absolute left-0 mt-0 w-48 bg-blue-600 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <Link
                  href="/budget-items"
                  className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/budget-items')}`}
                >
                  Budget Items
                </Link>
                <Link
                  href="/admin/budget-dashboard"
                  className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/admin/budget-dashboard')}`}
                >
                  Dashboard
                </Link>
                {canCreateAmendments && (
                  <Link
                    href="/admin/budget-amendments"
                    className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/admin/budget-amendments')}`}
                  >
                    Amendments
                  </Link>
                )}
                {canManageBudgetCategories && (
                  <Link
                    href="/admin/budget-categories"
                    className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/admin/budget-categories')}`}
                  >
                    Categories
                  </Link>
                )}
                {canManageSettings && (
                  <Link
                    href="/admin/fiscal-years"
                    className={`block px-4 py-2 hover:bg-blue-700 rounded-b-md ${isActive('/admin/fiscal-years')}`}
                  >
                    Fiscal Years
                  </Link>
                )}
              </div>
            </div>

            {/* Administration Dropdown */}
            {showAdminMenu && (
              <div className="relative group">
                <button className="px-3 py-2 rounded hover:bg-blue-700 transition-colors flex items-center">
                  Administration
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div className="absolute left-0 mt-0 w-56 bg-blue-600 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  {canManageUsers && (
                    <Link
                      href="/users"
                      className={`block px-4 py-2 hover:bg-blue-700 rounded-t-md ${isActive('/users')}`}
                    >
                      User Management
                    </Link>
                  )}
                  {canManageRoles && (
                    <Link
                      href="/admin/roles/manage"
                      className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/admin/roles')}`}
                    >
                      Role Management
                    </Link>
                  )}
                  {canViewAuditLog && (
                    <Link
                      href="/admin/audit-log"
                      className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/admin/audit-log')}`}
                    >
                      Audit Log
                    </Link>
                  )}
                  {canManageDepartments && (
                    <Link
                      href="/admin/departments"
                      className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/admin/departments')}`}
                    >
                      Departments
                    </Link>
                  )}
                  {canManageBudgetCategories && (
                    <Link
                      href="/admin/budget-categories"
                      className={`block px-4 py-2 hover:bg-blue-700 ${!canManageSettings ? 'rounded-b-md' : ''} ${isActive('/admin/budget-categories')}`}
                    >
                      Budget Categories
                    </Link>
                  )}
                  {canManageSettings && (
                    <Link
                      href="/admin/settings"
                      className={`block px-4 py-2 hover:bg-blue-700 rounded-b-md ${isActive('/admin/settings')}`}
                    >
                      Settings
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-4">
            {/* User Info - Desktop */}
            <div className="text-right hidden lg:block">
              <div className="text-white text-sm font-medium">{user.name}</div>
              <div className="flex items-center justify-end space-x-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${getRoleBadgeColor(
                    user.role as any
                  )}`}
                >
                  {getRoleDisplay(user.role as any)}
                </span>
                {user.departmentName && (
                  <span className="text-xs text-blue-200">
                    {user.departmentName}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Sign Out
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-white p-2"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden pb-4 space-y-1">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/')}`}
            >
              Timeclock
            </Link>
            <div className="text-xs text-blue-200 px-3 py-1 font-semibold">
              PURCHASING
            </div>
            <Link
              href="/purchase-orders"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/purchase-orders')}`}
            >
              Purchase Orders
            </Link>
            <Link
              href="/vendors"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/vendors')}`}
            >
              Vendors
            </Link>
            <div className="text-xs text-blue-200 px-3 py-1 font-semibold">
              BUDGET
            </div>
            <Link
              href="/budget-items"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/budget-items')}`}
            >
              Budget Items
            </Link>
            {canCreateAmendments && (
              <Link
                href="/admin/budget-amendments"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/admin/budget-amendments')}`}
              >
                Amendments
              </Link>
            )}
            {canManageBudgetCategories && (
              <Link
                href="/admin/budget-categories"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/admin/budget-categories')}`}
              >
                Categories
              </Link>
            )}
            {showAdminMenu && (
              <>
                <div className="text-xs text-blue-200 px-3 py-1 font-semibold">
                  ADMINISTRATION
                </div>
                {canManageUsers && (
                  <Link
                    href="/users"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/users')}`}
                  >
                    User Management
                  </Link>
                )}
                {canManageRoles && (
                  <Link
                    href="/admin/roles/manage"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/admin/roles')}`}
                  >
                    Role Management
                  </Link>
                )}
                {canViewAuditLog && (
                  <Link
                    href="/admin/audit-log"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/admin/audit-log')}`}
                  >
                    Audit Log
                  </Link>
                )}
                {canManageDepartments && (
                  <Link
                    href="/admin/departments"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/admin/departments')}`}
                  >
                    Departments
                  </Link>
                )}
                {canManageBudgetCategories && (
                  <Link
                    href="/admin/budget-categories"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/admin/budget-categories')}`}
                  >
                    Budget Categories
                  </Link>
                )}
                {canManageSettings && (
                  <Link
                    href="/admin/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded hover:bg-blue-700 ${isActive('/admin/settings')}`}
                  >
                    Settings
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
