'use client';

import { useRouter } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

export default function SetupWelcomePage() {
  const router = useRouter();

  const features = [
    'Create your administrator account',
    'Configure your organization details',
    'Set up optional integrations (AI, Email)',
    'Start using ITS Business Core',
  ];

  return (
    <div className="card-glass">
      <div className="text-center mb-8">
        <h1 className="page-title">
          Welcome to ITS Business Core
        </h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Let&apos;s get your system set up in just a few minutes.
        </p>
      </div>

      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] p-6 mb-8">
        <h2 className="section-title mb-4">
          What we&apos;ll configure:
        </h2>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-3 text-[var(--text-secondary)]">
              <CheckCircleIcon className="h-5 w-5 text-[var(--success)] flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => router.push('/setup/admin')}
        className="btn btn-primary w-full py-4"
      >
        Get Started
      </button>

      <p className="text-center text-sm text-[var(--text-muted)] mt-6">
        This wizard will only appear once. Your settings can be changed later in the admin panel.
      </p>
    </div>
  );
}
