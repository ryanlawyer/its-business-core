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
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Welcome to ITS Business Core
        </h1>
        <p className="text-lg text-slate-300">
          Let&apos;s get your system set up in just a few minutes.
        </p>
      </div>

      <div className="bg-white/5 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          What we&apos;ll configure:
        </h2>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-3 text-slate-300">
              <CheckCircleIcon className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => router.push('/setup/admin')}
        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02]"
      >
        Get Started
      </button>

      <p className="text-center text-sm text-slate-400 mt-6">
        This wizard will only appear once. Your settings can be changed later in the admin panel.
      </p>
    </div>
  );
}
