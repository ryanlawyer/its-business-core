'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    role: string;
    department: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Editable fields
  const [name, setName] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  // Auto-dismiss feedback after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  async function fetchProfile() {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setName(data.user.name);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error });
        return;
      }

      setFeedback({ type: 'success', message: 'Name updated successfully' });
      setProfile((prev) => prev ? { ...prev, name } : prev);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update name' });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'New passwords do not match' });
      return;
    }

    if (!currentPassword) {
      setFeedback({ type: 'error', message: 'Current password is required' });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error });
        return;
      }

      setFeedback({ type: 'success', message: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setFeedback({ type: 'error', message: 'Failed to change password' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--bg-secondary)] rounded w-48" />
          <div className="card p-6 space-y-4">
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-64" />
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-48" />
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-56" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-container">
        <p className="text-[var(--text-secondary)]">Unable to load profile.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">My Profile</h1>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            feedback.type === 'success'
              ? 'bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]'
              : 'bg-[var(--error)]/10 border-[var(--error)]/30 text-[var(--error)]'
          }`}
          role="alert"
        >
          {feedback.message}
        </div>
      )}

      {/* Profile Info Card */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Account Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
            <p className="text-[var(--text-primary)]">{profile.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Role</label>
            <p className="text-[var(--text-primary)]">{profile.role}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Department</label>
            <p className="text-[var(--text-primary)]">{profile.department}</p>
          </div>
        </div>
      </div>

      {/* Edit Name Card */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Edit Name</h2>
        <form onSubmit={handleSaveName} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Display Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input w-full max-w-md"
              required
              maxLength={200}
            />
          </div>
          <button
            type="submit"
            disabled={saving || name === profile.name}
            className="btn btn-primary"
          >
            {saving ? 'Saving...' : 'Save Name'}
          </button>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Current Password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="form-input w-full max-w-md"
              required
              aria-required="true"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="form-input w-full max-w-md"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input w-full max-w-md"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="btn btn-primary"
          >
            {saving ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
