'use client';

import { useState, useRef } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';

export default function BackupSettingsPage() {
  const [downloading, setDownloading] = useState<'data' | 'full' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadBackup = async (type: 'data' | 'full') => {
    setDownloading(type);
    try {
      const response = await fetch(`/api/admin/backup?type=${type}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Download failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `its-backup-${type}-${Date.now()}.tar.gz`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert(`Failed to download backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleRestore = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      alert('Please select a backup file first');
      return;
    }

    if (!confirm('Warning: This will replace all current data with the backup. This action cannot be undone. Continue?')) {
      return;
    }

    setUploading(true);
    setRestoreStatus({ type: null, message: '' });

    try {
      const formData = new FormData();
      formData.append('backup', file);

      const response = await fetch('/api/admin/restore', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Restore failed');
      }

      setRestoreStatus({
        type: 'success',
        message: `Restore completed successfully. Backup was from ${new Date(result.details.backupTimestamp).toLocaleString()}. Please refresh the page.`,
      });

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setRestoreStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="page-title mb-2">Backup & Restore</h1>
          <p className="text-[var(--text-secondary)]">
            Create backups of your system data or restore from a previous backup
          </p>
        </div>

        {/* Download Backups Section */}
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <CloudArrowDownIcon className="h-6 w-6 text-[var(--accent-primary)]" />
            <h2 className="section-title">Download Backup</h2>
          </div>

          <p className="text-[var(--text-secondary)] mb-6">
            Create a backup of your system data. Choose the backup type that fits your needs.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Data Backup */}
            <div className="border border-[var(--border-default)] rounded-lg p-4">
              <h3 className="font-medium text-[var(--text-primary)] mb-2">Data Backup</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Includes database and uploaded files. Best for routine daily backups.
              </p>
              <ul className="text-sm text-[var(--text-muted)] mb-4 space-y-1">
                <li>- SQLite database</li>
                <li>- Uploaded receipts & files</li>
                <li>- System settings</li>
              </ul>
              <button
                onClick={() => downloadBackup('data')}
                disabled={downloading !== null}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                {downloading === 'data' ? 'Downloading...' : 'Download Data Backup'}
              </button>
            </div>

            {/* Full Snapshot */}
            <div className="border border-[var(--border-default)] rounded-lg p-4">
              <h3 className="font-medium text-[var(--text-primary)] mb-2">Full Snapshot</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Complete system backup including secrets. Best for migration or disaster recovery.
              </p>
              <ul className="text-sm text-[var(--text-muted)] mb-4 space-y-1">
                <li>- Everything in Data Backup</li>
                <li>- Authentication secrets</li>
                <li>- System configuration</li>
              </ul>
              <button
                onClick={() => downloadBackup('full')}
                disabled={downloading !== null}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                {downloading === 'full' ? 'Downloading...' : 'Download Full Snapshot'}
              </button>
            </div>
          </div>
        </div>

        {/* Restore Section */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <CloudArrowUpIcon className="h-6 w-6 text-[var(--warning)]" />
            <h2 className="section-title">Restore from Backup</h2>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--warning-muted)] bg-[var(--warning-subtle)] text-[var(--warning)] px-4 py-3 mb-6">
            <div className="flex gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Warning: Restore will replace all current data</p>
                <p>This action cannot be undone. Make sure you have a current backup before proceeding.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label mb-2">
                Select Backup File (.tar.gz)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".tar.gz,.tgz"
                className="block w-full text-sm text-[var(--text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[var(--bg-hover)] file:text-[var(--text-secondary)] hover:file:bg-[var(--bg-active)] file:cursor-pointer cursor-pointer"
              />
            </div>

            <button
              onClick={handleRestore}
              disabled={uploading}
              className="btn btn-warning flex items-center justify-center gap-2"
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              {uploading ? 'Restoring...' : 'Restore from Backup'}
            </button>

            {/* Status Messages */}
            {restoreStatus.type === 'success' && (
              <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--success-muted)] bg-[var(--success-subtle)] text-[var(--success)] px-4 py-3">
                <CheckCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{restoreStatus.message}</p>
              </div>
            )}

            {restoreStatus.type === 'error' && (
              <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)] px-4 py-3">
                <XCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{restoreStatus.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* CLI Instructions */}
        <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--info-muted)] bg-[var(--info-subtle)] text-[var(--info)] px-4 py-3">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold mb-2">Command Line Usage</h3>
              <p className="text-sm mb-3">
                For automated backups or scripting, use these Docker commands:
              </p>
              <div className="bg-[var(--bg-void)] rounded-lg p-4 font-mono text-sm text-[var(--text-primary)] overflow-x-auto">
                <p className="text-[var(--text-muted)]"># Create data backup</p>
                <p>docker exec its-core /app/scripts/backup.sh data &gt; backup-data.tar.gz</p>
                <p className="mt-3 text-[var(--text-muted)]"># Create full backup</p>
                <p>docker exec its-core /app/scripts/backup.sh full &gt; backup-full.tar.gz</p>
                <p className="mt-3 text-[var(--text-muted)]"># Restore from backup</p>
                <p>docker exec -i its-core /app/scripts/restore.sh &lt; backup.tar.gz</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
