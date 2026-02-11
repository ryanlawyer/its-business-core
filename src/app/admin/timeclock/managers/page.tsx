'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type User = {
  id: string;
  name: string;
  email: string;
};

type Department = {
  id: string;
  name: string;
};

type ManagerAssignment = {
  id: string;
  userId: string;
  departmentId: string;
  user: User;
  department: Department;
  createdAt: string;
};

export default function ManagerAssignmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [assignments, setAssignments] = useState<ManagerAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [assignmentsRes, usersRes, departmentsRes] = await Promise.all([
        fetch('/api/timeclock/manager-assignments'),
        fetch('/api/users'),
        fetch('/api/departments'),
      ]);

      if (!assignmentsRes.ok) {
        if (assignmentsRes.status === 403) {
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch assignments');
      }

      const assignmentsData = await assignmentsRes.json();
      const usersData = await usersRes.json();
      const departmentsData = await departmentsRes.json();

      setAssignments(assignmentsData.assignments || []);
      setUsers(usersData.users || []);
      setDepartments(departmentsData.departments || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedDepartmentId) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/timeclock/manager-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          departmentId: selectedDepartmentId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create assignment');
      }

      // Add to the list
      setAssignments((prev) => [...prev, data.assignment]);
      setSelectedUserId('');
      setSelectedDepartmentId('');
      setSuccess('Manager assignment created successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (userId: string, departmentId: string) => {
    if (!confirm('Are you sure you want to remove this manager assignment?')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch(
        `/api/timeclock/manager-assignments?userId=${userId}&departmentId=${departmentId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove assignment');
      }

      // Remove from the list
      setAssignments((prev) =>
        prev.filter(
          (a) => !(a.userId === userId && a.departmentId === departmentId)
        )
      );
      setSuccess('Manager assignment removed successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Group assignments by user for the grid display
  const assignmentsByUser = assignments.reduce((acc, assignment) => {
    const userId = assignment.userId;
    if (!acc[userId]) {
      acc[userId] = {
        user: assignment.user,
        departments: [],
      };
    }
    acc[userId].departments.push(assignment.department);
    return acc;
  }, {} as Record<string, { user: User; departments: Department[] }>);

  if (status === 'loading' || loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-[var(--bg-hover)] rounded w-64 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[var(--bg-hover)] rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm">
        <ol className="flex items-center space-x-2">
          <li>
            <Link href="/admin/settings" className="text-[var(--accent-primary)] hover:underline">
              Admin
            </Link>
          </li>
          <li className="text-[var(--text-muted)]">/</li>
          <li>
            <Link href="/admin/timeclock" className="text-[var(--accent-primary)] hover:underline">
              Timeclock
            </Link>
          </li>
          <li className="text-[var(--text-muted)]">/</li>
          <li className="text-[var(--text-secondary)]">Manager Assignments</li>
        </ol>
      </nav>

      <h1 className="page-title mb-2">Manager Assignments</h1>
      <p className="text-[var(--text-secondary)] mb-6">
        Assign managers to departments they can oversee for timeclock approvals.
        Managers can be assigned to multiple departments.
      </p>

      {/* Alerts */}
      {error && (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)] px-4 py-3">
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--success-muted)] bg-[var(--success-subtle)] text-[var(--success)] px-4 py-3">
          <p>{success}</p>
        </div>
      )}

      {/* Add Assignment Form */}
      <div className="card p-6 mb-6">
        <h2 className="section-title mb-4">Add New Assignment</h2>
        <form onSubmit={handleAddAssignment} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="user" className="form-label">
              Manager
            </label>
            <select
              id="user"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="form-input form-select"
              required
            >
              <option value="">Select a user...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="department" className="form-label">
              Department
            </label>
            <select
              id="department"
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="form-input form-select"
              required
            >
              <option value="">Select a department...</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || !selectedUserId || !selectedDepartmentId}
              className="btn btn-primary"
            >
              {saving ? 'Adding...' : 'Add Assignment'}
            </button>
          </div>
        </form>
      </div>

      {/* Assignments Grid */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)]">
          <h2 className="section-title">Current Assignments</h2>
        </div>

        {Object.keys(assignmentsByUser).length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            <svg
              className="mx-auto h-12 w-12 text-[var(--text-muted)] mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p>No manager assignments yet.</p>
            <p className="text-sm mt-1">Use the form above to assign managers to departments.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {Object.entries(assignmentsByUser).map(([userId, { user, departments: depts }]) => (
              <div key={userId} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">{user.name}</h3>
                    <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {depts.map((dept) => (
                    <span
                      key={dept.id}
                      className="badge badge-info inline-flex items-center gap-1"
                    >
                      {dept.name}
                      <button
                        onClick={() => handleRemoveAssignment(userId, dept.id)}
                        className="ml-1 hover:text-[var(--accent-primary)]"
                        title="Remove assignment"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Table */}
      {departments.length > 0 && (
        <div className="mt-6 card overflow-hidden">
          <div className="p-4 border-b border-[var(--border-default)]">
            <h2 className="section-title">Department Overview</h2>
          </div>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4 p-4">
            {departments.map((dept) => {
              const managers = assignments
                .filter((a) => a.departmentId === dept.id)
                .map((a) => a.user);
              return (
                <div key={dept.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{dept.name}</h3>
                    <span className="badge badge-info">{managers.length} manager{managers.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[var(--text-secondary)]">Assigned Managers:</span>
                      <p className="text-[var(--text-primary)] mt-1">
                        {managers.length === 0 ? (
                          <span className="text-[var(--text-muted)] italic">No managers assigned</span>
                        ) : (
                          managers.map((m) => m.name).join(', ')
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block table-container">
            <table className="table" aria-label="Department manager assignments">
              <thead>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Department
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Assigned Managers
                  </th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => {
                  const managers = assignments
                    .filter((a) => a.departmentId === dept.id)
                    .map((a) => a.user);
                  return (
                    <tr key={dept.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text-primary)]">
                        {dept.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-muted)]">
                        {managers.length === 0 ? (
                          <span className="text-[var(--text-muted)] italic">No managers assigned</span>
                        ) : (
                          managers.map((m) => m.name).join(', ')
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
