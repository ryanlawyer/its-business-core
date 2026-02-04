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
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  const isAIConfigured = integrationsData?.ai?.provider && integrationsData?.ai?.apiKey;
  const isEmailConfigured = integrationsData?.email?.provider;

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
        <h1 className="text-2xl font-bold text-white mb-2">
          Review & Complete
        </h1>
        <p className="text-slate-300">
          Please review your settings before completing the setup.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Admin Account Section */}
        <div className="bg-white/5 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Admin Account</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Name</span>
              <span className="text-white">{adminData?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Email</span>
              <span className="text-white">{adminData?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Password</span>
              <span className="text-white">{'••••••••'}</span>
            </div>
          </div>
        </div>

        {/* Organization Section */}
        <div className="bg-white/5 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Organization</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Name</span>
              <span className="text-white">{organizationData?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Department</span>
              <span className="text-white">{organizationData?.department}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Timezone</span>
              <span className="text-white">{organizationData?.timezone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fiscal Year Start</span>
              <span className="text-white">
                {organizationData?.fiscalYearStartMonth !== undefined
                  ? MONTH_NAMES[organizationData.fiscalYearStartMonth]
                  : 'January'}
              </span>
            </div>
          </div>
        </div>

        {/* Integrations Section */}
        <div className="bg-white/5 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Integrations</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">AI</span>
              <div className="flex items-center gap-2">
                {isAIConfigured ? (
                  <>
                    <CheckIcon className="h-5 w-5 text-emerald-400" />
                    <span className="text-white">Configured</span>
                  </>
                ) : (
                  <>
                    <XMarkIcon className="h-5 w-5 text-slate-400" />
                    <span className="text-slate-400">Not configured</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Email</span>
              <div className="flex items-center gap-2">
                {isEmailConfigured ? (
                  <>
                    <CheckIcon className="h-5 w-5 text-emerald-400" />
                    <span className="text-white">{integrationsData?.email?.provider}</span>
                  </>
                ) : (
                  <>
                    <XMarkIcon className="h-5 w-5 text-slate-400" />
                    <span className="text-slate-400">Not configured</span>
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
          className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleCompleteSetup}
          disabled={isSubmitting}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Setting up...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
}
