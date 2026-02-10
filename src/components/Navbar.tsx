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
  const [pendingCount, setPendingCount] = useState(0);

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
    (path: string) => pathname === path,
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
      // Timeclock permissions
      canViewTeamEntries: hasPermission(permissions, 'timeclock', 'canViewTeamEntries'),
      canApproveEntries: hasPermission(permissions, 'timeclock', 'canApproveEntries'),
      canExportPayroll: hasPermission(permissions, 'timeclock', 'canExportPayroll'),
      // Timeclock admin permissions
      canManageTimeclockConfig: hasPermission(permissions, 'timeclock', 'canManageConfig'),
      canAssignManagers: hasPermission(permissions, 'timeclock', 'canAssignManagers'),
      canManageExportTemplates: hasPermission(permissions, 'timeclock', 'canManageExportTemplates'),
    };
  }, [permissions]);

  // Fetch pending approval count for managers
  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!userPermissions?.canApproveEntries) return;

      try {
        const res = await fetch('/api/timeclock/pending');
        if (res.ok) {
          const data = await res.json();
          setPendingCount(data.totalCount || 0);
        }
      } catch (error) {
        console.error('Error fetching pending count:', error);
      }
    };

    fetchPendingCount();
    // Refresh every 60 seconds
    const interval = setInterval(fetchPendingCount, 60000);
    return () => clearInterval(interval);
  }, [userPermissions?.canApproveEntries]);

  if (!user || !userPermissions) return null;

  const {
    canManageUsers,
    canManageRoles,
    canViewAuditLog,
    canManageDepartments,
    canManageSettings,
    canManageBudgetCategories,
    canCreateAmendments,
    canViewTeamEntries,
    canApproveEntries,
    canExportPayroll,
    canManageTimeclockConfig,
    canAssignManagers,
    canManageExportTemplates,
  } = userPermissions;

  const showTimeclockManager = canViewTeamEntries || canApproveEntries || canExportPayroll;
  const showTimeclockAdmin = canManageTimeclockConfig || canAssignManagers || canManageExportTemplates;

  const showAdminMenu =
    canManageUsers ||
    canManageRoles ||
    canViewAuditLog ||
    canManageDepartments ||
    canManageSettings ||
    canManageBudgetCategories;

  return (
    <>
      <nav className="nav-bar">
        <div className="nav-container">
          {/* Logo and Brand */}
          <Link href="/" className="nav-brand group">
            <div className="nav-brand-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="nav-brand-text hidden sm:block">
              {organizationName}
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="nav-menu">
            {/* Timeclock Dropdown */}
            <div className="nav-item">
              <button className="nav-link">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Timeclock
                <svg className="w-3 h-3 ml-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="nav-dropdown">
                <Link
                  href="/"
                  className={`nav-dropdown-link ${isActive('/') ? 'nav-dropdown-link-active' : ''}`}
                >
                  My Time
                </Link>
                <Link
                  href="/timeclock/history"
                  className={`nav-dropdown-link ${isActive('/timeclock/history') ? 'nav-dropdown-link-active' : ''}`}
                >
                  My History
                </Link>
                {showTimeclockManager && (
                  <>
                    <div className="nav-dropdown-divider" />
                    {canViewTeamEntries && (
                      <Link
                        href="/timeclock/team"
                        className={`nav-dropdown-link ${isActive('/timeclock/team') ? 'nav-dropdown-link-active' : ''}`}
                      >
                        Team Overview
                      </Link>
                    )}
                    {canApproveEntries && (
                      <Link
                        href="/timeclock/approvals"
                        className={`nav-dropdown-link ${isActive('/timeclock/approvals') ? 'nav-dropdown-link-active' : ''}`}
                      >
                        <span className="flex items-center gap-2">
                          Approvals
                          {pendingCount > 0 && (
                            <span
                              className="px-1.5 py-0.5 text-xs rounded-full"
                              style={{ background: 'var(--warning)', color: 'white' }}
                            >
                              {pendingCount}
                            </span>
                          )}
                        </span>
                      </Link>
                    )}
                    {canExportPayroll && (
                      <Link
                        href="/timeclock/export"
                        className={`nav-dropdown-link ${isActive('/timeclock/export') ? 'nav-dropdown-link-active' : ''}`}
                      >
                        Export
                      </Link>
                    )}
                  </>
                )}
                {showTimeclockAdmin && (
                  <>
                    <div className="nav-dropdown-divider" />
                    {canManageTimeclockConfig && (
                      <Link
                        href="/admin/timeclock"
                        className={`nav-dropdown-link ${isActive('/admin/timeclock') ? 'nav-dropdown-link-active' : ''}`}
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                          </svg>
                          Configuration
                        </span>
                      </Link>
                    )}
                    {canAssignManagers && (
                      <Link
                        href="/admin/timeclock/managers"
                        className={`nav-dropdown-link ${isActive('/admin/timeclock/managers') ? 'nav-dropdown-link-active' : ''}`}
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          Manager Assignments
                        </span>
                      </Link>
                    )}
                    {canManageExportTemplates && (
                      <Link
                        href="/admin/timeclock/templates"
                        className={`nav-dropdown-link ${isActive('/admin/timeclock/templates') ? 'nav-dropdown-link-active' : ''}`}
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                          </svg>
                          Export Templates
                        </span>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Purchasing Dropdown */}
            <div className="nav-item">
              <button className="nav-link">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
                Purchasing
                <svg className="w-3 h-3 ml-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="nav-dropdown">
                <Link
                  href="/purchase-orders"
                  className={`nav-dropdown-link ${isActive('/purchase-orders') ? 'nav-dropdown-link-active' : ''}`}
                >
                  Purchase Orders
                </Link>
                <Link
                  href="/receipts"
                  className={`nav-dropdown-link ${isActive('/receipts') ? 'nav-dropdown-link-active' : ''}`}
                >
                  Receipts
                </Link>
                <Link
                  href="/statements"
                  className={`nav-dropdown-link ${isActive('/statements') ? 'nav-dropdown-link-active' : ''}`}
                >
                  Bank Statements
                </Link>
                <Link
                  href="/vendors"
                  className={`nav-dropdown-link ${isActive('/vendors') ? 'nav-dropdown-link-active' : ''}`}
                >
                  Vendors
                </Link>
                <Link
                  href="/reports"
                  className={`nav-dropdown-link ${isActive('/reports') ? 'nav-dropdown-link-active' : ''}`}
                >
                  Expense Reports
                </Link>
              </div>
            </div>

            {/* Budget Dropdown */}
            <div className="nav-item">
              <button className="nav-link">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
                Budget
                <svg className="w-3 h-3 ml-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="nav-dropdown">
                <Link
                  href="/budget-items"
                  className={`nav-dropdown-link ${isActive('/budget-items') ? 'nav-dropdown-link-active' : ''}`}
                >
                  Budget Items
                </Link>
                <Link
                  href="/admin/budget-dashboard"
                  className={`nav-dropdown-link ${isActive('/admin/budget-dashboard') ? 'nav-dropdown-link-active' : ''}`}
                >
                  Dashboard
                </Link>
                {canCreateAmendments && (
                  <Link
                    href="/admin/budget-amendments"
                    className={`nav-dropdown-link ${isActive('/admin/budget-amendments') ? 'nav-dropdown-link-active' : ''}`}
                  >
                    Amendments
                  </Link>
                )}
                {canManageBudgetCategories && (
                  <Link
                    href="/admin/budget-categories"
                    className={`nav-dropdown-link ${isActive('/admin/budget-categories') ? 'nav-dropdown-link-active' : ''}`}
                  >
                    Categories
                  </Link>
                )}
                {canManageSettings && (
                  <Link
                    href="/admin/fiscal-years"
                    className={`nav-dropdown-link ${isActive('/admin/fiscal-years') ? 'nav-dropdown-link-active' : ''}`}
                  >
                    Fiscal Years
                  </Link>
                )}
              </div>
            </div>

            {/* Administration Dropdown */}
            {showAdminMenu && (
              <div className="nav-item">
                <button className="nav-link">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                  Admin
                  <svg className="w-3 h-3 ml-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="nav-dropdown" style={{ minWidth: '220px' }}>
                  {canManageUsers && (
                    <Link
                      href="/users"
                      className={`nav-dropdown-link ${isActive('/users') ? 'nav-dropdown-link-active' : ''}`}
                    >
                      User Management
                    </Link>
                  )}
                  {canManageRoles && (
                    <Link
                      href="/admin/roles/manage"
                      className={`nav-dropdown-link ${isActive('/admin/roles') ? 'nav-dropdown-link-active' : ''}`}
                    >
                      Role Management
                    </Link>
                  )}
                  {canViewAuditLog && (
                    <Link
                      href="/admin/audit-log"
                      className={`nav-dropdown-link ${isActive('/admin/audit-log') ? 'nav-dropdown-link-active' : ''}`}
                    >
                      Audit Log
                    </Link>
                  )}
                  {canManageDepartments && (
                    <Link
                      href="/admin/departments"
                      className={`nav-dropdown-link ${isActive('/admin/departments') ? 'nav-dropdown-link-active' : ''}`}
                    >
                      Departments
                    </Link>
                  )}
                  {canManageSettings && (
                    <Link
                      href="/admin/ai-usage"
                      className={`nav-dropdown-link ${isActive('/admin/ai-usage') ? 'nav-dropdown-link-active' : ''}`}
                    >
                      AI Usage
                    </Link>
                  )}
                  {canManageSettings && (
                    <Link
                      href="/admin/settings"
                      className={`nav-dropdown-link ${isActive('/admin/settings') ? 'nav-dropdown-link-active' : ''}`}
                    >
                      Settings
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Info & Actions */}
          <div className="nav-user">
            {/* User Info - Desktop */}
            <div className="nav-user-info">
              <div className="nav-user-name">{user.name}</div>
              <div className="flex items-center justify-end gap-2">
                <span className={`badge ${
                  user.role === 'ADMIN' ? 'badge-accent' :
                  user.role === 'MANAGER' ? 'badge-info' : 'badge-neutral'
                }`}>
                  {getRoleDisplay(user.role as any)}
                </span>
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="btn btn-secondary btn-sm hidden lg:flex"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="nav-mobile-toggle"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="nav-mobile animate-fade-in-down lg:hidden pb-20">
          <div className="nav-mobile-section">
            <div className="nav-mobile-section-title">Timeclock</div>
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`nav-mobile-link ${isActive('/') ? 'nav-mobile-link-active' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              My Time
            </Link>
            <Link
              href="/timeclock/history"
              onClick={() => setMobileMenuOpen(false)}
              className={`nav-mobile-link ${isActive('/timeclock/history') ? 'nav-mobile-link-active' : ''}`}
            >
              My History
            </Link>
            {canViewTeamEntries && (
              <Link
                href="/timeclock/team"
                onClick={() => setMobileMenuOpen(false)}
                className={`nav-mobile-link ${isActive('/timeclock/team') ? 'nav-mobile-link-active' : ''}`}
              >
                Team Overview
              </Link>
            )}
            {canApproveEntries && (
              <Link
                href="/timeclock/approvals"
                onClick={() => setMobileMenuOpen(false)}
                className={`nav-mobile-link ${isActive('/timeclock/approvals') ? 'nav-mobile-link-active' : ''}`}
              >
                <span className="flex items-center gap-2">
                  Approvals
                  {pendingCount > 0 && (
                    <span
                      className="px-1.5 py-0.5 text-xs rounded-full"
                      style={{ background: 'var(--warning)', color: 'white' }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </span>
              </Link>
            )}
            {canExportPayroll && (
              <Link
                href="/timeclock/export"
                onClick={() => setMobileMenuOpen(false)}
                className={`nav-mobile-link ${isActive('/timeclock/export') ? 'nav-mobile-link-active' : ''}`}
              >
                Export
              </Link>
            )}
            {showTimeclockAdmin && (
              <>
                <div className="nav-mobile-divider" />
                {canManageTimeclockConfig && (
                  <Link
                    href="/admin/timeclock"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`nav-mobile-link ${isActive('/admin/timeclock') ? 'nav-mobile-link-active' : ''}`}
                  >
                    <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    Configuration
                  </Link>
                )}
                {canAssignManagers && (
                  <Link
                    href="/admin/timeclock/managers"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`nav-mobile-link ${isActive('/admin/timeclock/managers') ? 'nav-mobile-link-active' : ''}`}
                  >
                    <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Manager Assignments
                  </Link>
                )}
                {canManageExportTemplates && (
                  <Link
                    href="/admin/timeclock/templates"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`nav-mobile-link ${isActive('/admin/timeclock/templates') ? 'nav-mobile-link-active' : ''}`}
                  >
                    <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Export Templates
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="nav-mobile-section">
            <div className="nav-mobile-section-title">Purchasing</div>
            <Link
              href="/purchase-orders"
              onClick={() => setMobileMenuOpen(false)}
              className={`nav-mobile-link ${isActive('/purchase-orders') ? 'nav-mobile-link-active' : ''}`}
            >
              Purchase Orders
            </Link>
            <Link
              href="/receipts"
              onClick={() => setMobileMenuOpen(false)}
              className={`nav-mobile-link ${isActive('/receipts') ? 'nav-mobile-link-active' : ''}`}
            >
              Receipts
            </Link>
            <Link
              href="/statements"
              onClick={() => setMobileMenuOpen(false)}
              className={`nav-mobile-link ${isActive('/statements') ? 'nav-mobile-link-active' : ''}`}
            >
              Bank Statements
            </Link>
            <Link
              href="/vendors"
              onClick={() => setMobileMenuOpen(false)}
              className={`nav-mobile-link ${isActive('/vendors') ? 'nav-mobile-link-active' : ''}`}
            >
              Vendors
            </Link>
            <Link
              href="/reports"
              onClick={() => setMobileMenuOpen(false)}
              className={`nav-mobile-link ${isActive('/reports') ? 'nav-mobile-link-active' : ''}`}
            >
              Expense Reports
            </Link>
          </div>

          <div className="nav-mobile-section">
            <div className="nav-mobile-section-title">Budget</div>
            <Link
              href="/budget-items"
              onClick={() => setMobileMenuOpen(false)}
              className={`nav-mobile-link ${isActive('/budget-items') ? 'nav-mobile-link-active' : ''}`}
            >
              Budget Items
            </Link>
            <Link
              href="/admin/budget-dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`nav-mobile-link ${isActive('/admin/budget-dashboard') ? 'nav-mobile-link-active' : ''}`}
            >
              Dashboard
            </Link>
            {canCreateAmendments && (
              <Link
                href="/admin/budget-amendments"
                onClick={() => setMobileMenuOpen(false)}
                className={`nav-mobile-link ${isActive('/admin/budget-amendments') ? 'nav-mobile-link-active' : ''}`}
              >
                Amendments
              </Link>
            )}
            {canManageBudgetCategories && (
              <Link
                href="/admin/budget-categories"
                onClick={() => setMobileMenuOpen(false)}
                className={`nav-mobile-link ${isActive('/admin/budget-categories') ? 'nav-mobile-link-active' : ''}`}
              >
                Categories
              </Link>
            )}
          </div>

          {showAdminMenu && (
            <div className="nav-mobile-section">
              <div className="nav-mobile-section-title">Administration</div>
              {canManageUsers && (
                <Link
                  href="/users"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-mobile-link ${isActive('/users') ? 'nav-mobile-link-active' : ''}`}
                >
                  User Management
                </Link>
              )}
              {canManageRoles && (
                <Link
                  href="/admin/roles/manage"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-mobile-link ${isActive('/admin/roles') ? 'nav-mobile-link-active' : ''}`}
                >
                  Role Management
                </Link>
              )}
              {canViewAuditLog && (
                <Link
                  href="/admin/audit-log"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-mobile-link ${isActive('/admin/audit-log') ? 'nav-mobile-link-active' : ''}`}
                >
                  Audit Log
                </Link>
              )}
              {canManageDepartments && (
                <Link
                  href="/admin/departments"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-mobile-link ${isActive('/admin/departments') ? 'nav-mobile-link-active' : ''}`}
                >
                  Departments
                </Link>
              )}
              {canManageSettings && (
                <Link
                  href="/admin/ai-usage"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-mobile-link ${isActive('/admin/ai-usage') ? 'nav-mobile-link-active' : ''}`}
                >
                  AI Usage
                </Link>
              )}
              {canManageSettings && (
                <Link
                  href="/admin/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-mobile-link ${isActive('/admin/settings') ? 'nav-mobile-link-active' : ''}`}
                >
                  Settings
                </Link>
              )}
            </div>
          )}

          <div className="nav-mobile-section">
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="nav-mobile-link text-[var(--error)] w-full text-left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      {user && (
        <div className="bottom-nav lg:hidden">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`bottom-nav-item ${isActive('/') ? 'bottom-nav-item-active' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Clock</span>
          </Link>
          <Link
            href="/purchase-orders"
            onClick={() => setMobileMenuOpen(false)}
            className={`bottom-nav-item ${isActive('/purchase-orders') || pathname.startsWith('/purchase-orders') ? 'bottom-nav-item-active' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            <span>POs</span>
          </Link>
          <Link
            href="/receipts"
            onClick={() => setMobileMenuOpen(false)}
            className={`bottom-nav-item ${isActive('/receipts') || pathname.startsWith('/receipts') ? 'bottom-nav-item-active' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            <span>Receipts</span>
          </Link>
          {canApproveEntries ? (
            <Link
              href="/timeclock/approvals"
              onClick={() => setMobileMenuOpen(false)}
              className={`bottom-nav-item ${isActive('/timeclock/approvals') ? 'bottom-nav-item-active' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {pendingCount > 0 && <span className="bottom-nav-badge" />}
              <span>Approvals</span>
            </Link>
          ) : (
            <Link
              href="/budget-items"
              onClick={() => setMobileMenuOpen(false)}
              className={`bottom-nav-item ${isActive('/budget-items') ? 'bottom-nav-item-active' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
              <span>Budget</span>
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`bottom-nav-item ${mobileMenuOpen ? 'bottom-nav-item-active' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
            <span>Menu</span>
          </button>
        </div>
      )}
    </>
  );
}
