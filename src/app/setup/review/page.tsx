'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface AdminData {
  name: string;
  email: string;
  password: string;
}

interface OrganizationData {
  name: string;
  department: string;
  timezone: string;
  fiscalYearStartMonth: number;
}

interface IntegrationsData {
  ai?: {
    provider: string;
    apiKey: string;
  };
  email?: {
    provider: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function SetupReviewPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [organizationData, setOrganizationData] = useState<OrganizationData | null>(null);
  const [integrationsData, setIntegrationsData] = useState<IntegrationsData | null>(null);

  useEffect(() => {
    // Load data from sessionStorage
    const admin = sessionStorage.getItem('setup_admin');
    const organization = sessionStorage.getItem('setup_organization');
    const integrations = sessionStorage.getItem('setup_integrations');

    // Check for required data
    if (!admin || !organization) {
      router.push('/setup/admin');
      return;
    }

    setAdminData(JSON.parse(admin));
    setOrganizationData(JSON.parse(organization));
    setIntegrationsData(integrations ? JSON.parse(integrations) : null);
    setIsLoading(false);
  }, [router]);

  const handleCompleteSetup = async () => {
    if (!adminData || !organizationData) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin: adminData,
          organization: organizationData,
          integrations: integrationsData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete setup');
      }

      // Clear sessionStorage on success
      sessionStorage.removeItem('setup_admin');
      sessionStorage.removeItem('setup_organization');
      sessionStorage.removeItem('setup_integrations');

      router.push('/setup/complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card-glass">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--text-primary)]"></div>
        </div>
      </div>
    );
  }

  const isAIConfigured = integrationsData?.ai?.provider && integrationsData?.ai?.apiKey;
  const isEmailConfigured = integrationsData?.email?.provider;

  return (
    <div className="card-glass">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-2 rounded-full transition-all ${
              step === 5
                ? 'w-8 bg-[var(--accent-primary)]'
                : 'w-2 bg-[var(--accent-primary-hover)]'
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8">
        <h1 className="page-title">
          Review & Complete
        </h1>
        <p className="text-[var(--text-secondary)]">
          Please review your settings before completing the setup.
        </p>
      </div>

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] px-4 py-3 mb-6">
          <p className="text-[var(--error)] text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Admin Account Section */}
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-5">
          <h2 className="section-title mb-4">Admin Account</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Name</span>
              <span className="text-[var(--text-primary)]">{adminData?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Email</span>
              <span className="text-[var(--text-primary)]">{adminData?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Password</span>
              <span className="text-[var(--text-primary)]">{'••••••••'}</span>
            </div>
          </div>
        </div>

        {/* Organization Section */}
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-5">
          <h2 className="section-title mb-4">Organization</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Name</span>
              <span className="text-[var(--text-primary)]">{organizationData?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Department</span>
              <span className="text-[var(--text-primary)]">{organizationData?.department}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Timezone</span>
              <span className="text-[var(--text-primary)]">{organizationData?.timezone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Fiscal Year Start</span>
              <span className="text-[var(--text-primary)]">
                {organizationData?.fiscalYearStartMonth !== undefined
                  ? MONTH_NAMES[organizationData.fiscalYearStartMonth]
                  : 'January'}
              </span>
            </div>
          </div>
        </div>

        {/* Integrations Section */}
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-5">
          <h2 className="section-title mb-4">Integrations</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">AI</span>
              <div className="flex items-center gap-2">
                {isAIConfigured ? (
                  <>
                    <CheckIcon className="h-5 w-5 text-[var(--success)]" />
                    <span className="text-[var(--text-primary)]">Configured</span>
                  </>
                ) : (
                  <>
                    <XMarkIcon className="h-5 w-5 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-muted)]">Not configured</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Email</span>
              <div className="flex items-center gap-2">
                {isEmailConfigured ? (
                  <>
                    <CheckIcon className="h-5 w-5 text-[var(--success)]" />
                    <span className="text-[var(--text-primary)]">{integrationsData?.email?.provider}</span>
                  </>
                ) : (
                  <>
                    <XMarkIcon className="h-5 w-5 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-muted)]">Not configured</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <button
          onClick={() => router.push('/setup/integrations')}
          disabled={isSubmitting}
          className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleCompleteSetup}
          disabled={isSubmitting}
          className="btn btn-success flex-1 flex items-center justify-center gap-2"
        >
          {isSubmitting ? 'Setting up...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
}
