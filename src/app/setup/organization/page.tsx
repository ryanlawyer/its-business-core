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
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

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
          Configure your organization settings and create your first department.
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
            Organization Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.organizationName}
            onChange={(e) =>
              setFormData({ ...formData, organizationName: e.target.value })
            }
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Acme Corporation"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            First Department Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.departmentName}
            onChange={(e) =>
              setFormData({ ...formData, departmentName: e.target.value })
            }
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="General"
          />
          <p className="mt-1 text-xs text-slate-400">
            You can add more departments later in the admin settings.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Timezone
          </label>
          <select
            value={formData.timezone}
            onChange={(e) =>
              setFormData({ ...formData, timezone: e.target.value })
            }
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-slate-800">
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
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
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
          >
            {MONTH_OPTIONS.map((month) => (
              <option
                key={month.value}
                value={month.value}
                className="bg-slate-800"
              >
                {month.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Used for fiscal year reporting. Most businesses use January.
          </p>
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
