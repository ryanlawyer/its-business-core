'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (America/New_York)' },
  { value: 'America/Chicago', label: 'Central Time (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Pacific/Honolulu)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (Europe/London)' },
  { value: 'Europe/Paris', label: 'Paris (Europe/Paris)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (Asia/Tokyo)' },
  { value: 'Australia/Sydney', label: 'Sydney (Australia/Sydney)' },
];

const MONTH_OPTIONS = [
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

function detectTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Check if detected timezone is in our list
    if (TIMEZONE_OPTIONS.some((tz) => tz.value === detected)) {
      return detected;
    }
  } catch {
    // Ignore detection errors
  }
  return 'America/New_York'; // Default fallback
}

export default function SetupOrganizationPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    organizationName: '',
    departmentName: 'General',
    timezone: 'America/New_York',
    fiscalYearStartMonth: 1,
  });

  useEffect(() => {
    // Check if admin data exists in sessionStorage
    const adminData = sessionStorage.getItem('setup_admin');
    if (!adminData) {
      router.push('/setup/admin');
      return;
    }

    // Load existing organization data if present
    const orgData = sessionStorage.getItem('setup_organization');
    if (orgData) {
      try {
        const parsed = JSON.parse(orgData);
        setFormData(parsed);
      } catch {
        // Ignore parse errors, use defaults
      }
    } else {
      // Auto-detect timezone on first visit
      setFormData((prev) => ({
        ...prev,
        timezone: detectTimezone(),
      }));
    }

    setIsLoading(false);
  }, [router]);

  const validate = () => {
    const newErrors: string[] = [];

    if (!formData.organizationName.trim()) {
      newErrors.push('Organization name is required');
    }

    if (!formData.departmentName.trim()) {
      newErrors.push('First department name is required');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      // Store in sessionStorage for next steps
      sessionStorage.setItem('setup_organization', JSON.stringify(formData));
      router.push('/setup/integrations');
    }
  };

  if (isLoading) {
    return (
      <div className="card-glass">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--text-primary)]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-glass">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-2 rounded-full transition-all ${
              step === 3
                ? 'w-8 bg-[var(--accent-primary)]'
                : step < 3
                ? 'w-2 bg-[var(--accent-primary-hover)]'
                : 'w-2 bg-[var(--bg-surface)]'
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8">
        <h1 className="page-title">
          Organization Details
        </h1>
        <p className="text-[var(--text-secondary)]">
          Configure your organization settings and create your first department.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] px-4 py-3 mb-6">
          <ul className="list-disc list-inside text-[var(--error)] text-sm space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="form-label">
            Organization Name <span className="text-[var(--error)]">*</span>
          </label>
          <input
            type="text"
            value={formData.organizationName}
            onChange={(e) =>
              setFormData({ ...formData, organizationName: e.target.value })
            }
            className="form-input"
            placeholder="Acme Corporation"
          />
        </div>

        <div>
          <label className="form-label">
            First Department Name <span className="text-[var(--error)]">*</span>
          </label>
          <input
            type="text"
            value={formData.departmentName}
            onChange={(e) =>
              setFormData({ ...formData, departmentName: e.target.value })
            }
            className="form-input"
            placeholder="General"
          />
          <p className="form-hint">
            You can add more departments later in the admin settings.
          </p>
        </div>

        <div>
          <label className="form-label">
            Timezone
          </label>
          <select
            value={formData.timezone}
            onChange={(e) =>
              setFormData({ ...formData, timezone: e.target.value })
            }
            className="form-input form-select"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-[var(--bg-elevated)]">
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">
            Fiscal Year Start Month
          </label>
          <select
            value={formData.fiscalYearStartMonth}
            onChange={(e) =>
              setFormData({
                ...formData,
                fiscalYearStartMonth: parseInt(e.target.value, 10),
              })
            }
            className="form-input form-select"
          >
            {MONTH_OPTIONS.map((month) => (
              <option
                key={month.value}
                value={month.value}
                className="bg-[var(--bg-elevated)]"
              >
                {month.label}
              </option>
            ))}
          </select>
          <p className="form-hint">
            Used for fiscal year reporting. Most businesses use January.
          </p>
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <button
          onClick={() => router.push('/setup/admin')}
          className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleNext}
          className="btn btn-primary flex-1 flex items-center justify-center gap-2"
        >
          Next
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
