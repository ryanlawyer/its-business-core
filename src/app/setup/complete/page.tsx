'use client';

import { useRouter } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

export default function SetupCompletePage() {
  const router = useRouter();

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
      <div className="text-center">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <CheckCircleIcon className="h-24 w-24 text-emerald-400" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-white mb-4">
          Setup Complete!
        </h1>

        {/* Success Message */}
        <p className="text-slate-300 text-lg mb-8">
          ITS Business Core is ready to use. You can now log in with your admin account.
        </p>

        {/* Go to Login Button */}
        <button
          onClick={() => router.push('/auth/signin')}
          className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl transition-all"
        >
          Go to Login
        </button>

        {/* Help Note */}
        <p className="text-slate-400 text-sm mt-6">
          Need help? Check the documentation in the admin panel.
        </p>
      </div>
    </div>
  );
}
