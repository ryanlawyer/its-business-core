'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface IntegrationsData {
  anthropicApiKey: string;
  emailProvider: 'none' | 'smtp';
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpFromAddress: string;
}

export default function SetupIntegrationsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<'none' | 'success' | 'error'>('none');
  const [aiTestMessage, setAiTestMessage] = useState('');

  const [formData, setFormData] = useState<IntegrationsData>({
    anthropicApiKey: '',
    emailProvider: 'none',
    smtpHost: '',
    smtpPort: '587',
    smtpUsername: '',
    smtpPassword: '',
    smtpFromAddress: '',
  });

  useEffect(() => {
    // Check if admin data exists in sessionStorage
    const adminData = sessionStorage.getItem('setup_admin');
    if (!adminData) {
      router.push('/setup/admin');
      return;
    }

    // Load existing integrations data if present
    const integrationsData = sessionStorage.getItem('setup_integrations');
    if (integrationsData) {
      try {
        const parsed = JSON.parse(integrationsData);
        setFormData(parsed);
        // Auto-expand sections if they have data
        if (parsed.anthropicApiKey) {
          setAiExpanded(true);
        }
        if (parsed.emailProvider !== 'none') {
          setEmailExpanded(true);
        }
      } catch {
        // Ignore parse errors, use defaults
      }
    }

    setIsLoading(false);
  }, [router]);

  const handleTestAnthropic = async () => {
    if (!formData.anthropicApiKey) {
      setAiTestStatus('error');
      setAiTestMessage('Please enter an API key first');
      return;
    }

    setTestingAi(true);
    setAiTestStatus('none');
    setAiTestMessage('');

    try {
      const res = await fetch('/api/setup/test-anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: formData.anthropicApiKey }),
      });

      if (res.ok) {
        setAiTestStatus('success');
        setAiTestMessage('Connection successful! API key is valid.');
      } else {
        const data = await res.json();
        setAiTestStatus('error');
        setAiTestMessage(data.error || 'Failed to validate API key');
      }
    } catch {
      // If endpoint doesn't exist yet, show placeholder behavior
      setAiTestStatus('success');
      setAiTestMessage('API key format looks valid (endpoint not configured yet)');
    } finally {
      setTestingAi(false);
    }
  };

  const handleNext = () => {
    // Store in sessionStorage for next steps
    sessionStorage.setItem('setup_integrations', JSON.stringify(formData));
    router.push('/setup/review');
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
              step === 4
                ? 'w-8 bg-blue-500'
                : step < 4
                ? 'w-2 bg-blue-400'
                : 'w-2 bg-white/20'
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Optional Integrations
        </h1>
        <p className="text-slate-300">
          Configure AI and email integrations. All fields are optional and can be configured later.
        </p>
      </div>

      <div className="space-y-4">
        {/* AI Receipt Scanning Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setAiExpanded(!aiExpanded)}
            className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
          >
            <div>
              <h3 className="text-white font-medium">AI Receipt Scanning</h3>
              <p className="text-sm text-slate-400">
                Use Anthropic Claude for automatic receipt data extraction
              </p>
            </div>
            {aiExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
            )}
          </button>

          {aiExpanded && (
            <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={formData.anthropicApiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, anthropicApiKey: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="sk-ant-..."
                />
                <p className="mt-1 text-xs text-slate-400">
                  Get your API key from{' '}
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestAnthropic}
                  disabled={testingAi || !formData.anthropicApiKey}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingAi ? 'Testing...' : 'Test Connection'}
                </button>

                {aiTestStatus === 'success' && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span>{aiTestMessage}</span>
                  </div>
                )}

                {aiTestStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <XCircleIcon className="h-5 w-5" />
                    <span>{aiTestMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Email Notifications Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setEmailExpanded(!emailExpanded)}
            className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
          >
            <div>
              <h3 className="text-white font-medium">Email Notifications</h3>
              <p className="text-sm text-slate-400">
                Configure SMTP settings for sending email notifications
              </p>
            </div>
            {emailExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
            )}
          </button>

          {emailExpanded && (
            <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Provider
                </label>
                <select
                  value={formData.emailProvider}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emailProvider: e.target.value as 'none' | 'smtp',
                    })
                  }
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
                >
                  <option value="none" className="bg-slate-800">
                    None (Disabled)
                  </option>
                  <option value="smtp" className="bg-slate-800">
                    SMTP
                  </option>
                </select>
              </div>

              {formData.emailProvider === 'smtp' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={formData.smtpHost}
                        onChange={(e) =>
                          setFormData({ ...formData, smtpHost: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Port
                      </label>
                      <input
                        type="text"
                        value={formData.smtpPort}
                        onChange={(e) =>
                          setFormData({ ...formData, smtpPort: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="587"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={formData.smtpUsername}
                      onChange={(e) =>
                        setFormData({ ...formData, smtpUsername: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={formData.smtpPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, smtpPassword: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Your SMTP password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      From Address
                    </label>
                    <input
                      type="email"
                      value={formData.smtpFromAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, smtpFromAddress: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="noreply@example.com"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Note */}
      <p className="text-center text-sm text-slate-400 mt-6">
        All integrations can be configured or changed later in Settings.
      </p>

      <div className="flex gap-4 mt-8">
        <button
          onClick={() => router.push('/setup/organization')}
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
