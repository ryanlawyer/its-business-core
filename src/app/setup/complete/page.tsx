'use client';

import { useRouter } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

export default function SetupCompletePage() {
  const router = useRouter();

  return (
    <div className="card-glass">
      <div className="text-center">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <CheckCircleIcon className="h-24 w-24 text-[var(--success)]" />
        </div>

        {/* Heading */}
        <h1 className="page-title">
          Setup Complete!
        </h1>

        {/* Success Message */}
        <p className="text-[var(--text-secondary)] text-lg mb-8">
          ITS Business Core is ready to use. You can now log in with your admin account.
        </p>

        {/* Go to Login Button */}
        <button
          onClick={() => router.push('/auth/signin')}
          className="btn btn-success btn-lg w-full"
        >
          Go to Login
        </button>

        {/* Help Note */}
        <p className="text-[var(--text-muted)] text-sm mt-6">
          Need help? Check the documentation in the admin panel.
        </p>
      </div>
    </div>
  );
}
