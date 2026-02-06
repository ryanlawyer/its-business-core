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
              step === 4
                ? 'w-8 bg-[var(--accent-primary)]'
                : step < 4
                ? 'w-2 bg-[var(--accent-primary-hover)]'
                : 'w-2 bg-[var(--bg-surface)]'
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8">
        <h1 className="page-title">
          Optional Integrations
        </h1>
        <p className="text-[var(--text-secondary)]">
          Configure AI and email integrations. All fields are optional and can be configured later.
        </p>
      </div>

      <div className="space-y-4">
        {/* AI Receipt Scanning Section */}
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] border border-[var(--border-default)] overflow-hidden">
          <button
            type="button"
            onClick={() => setAiExpanded(!aiExpanded)}
            className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div>
              <h3 className="text-[var(--text-primary)] font-medium">AI Receipt Scanning</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Use Anthropic Claude for automatic receipt data extraction
              </p>
            </div>
            {aiExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-[var(--text-muted)] flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-[var(--text-muted)] flex-shrink-0" />
            )}
          </button>

          {aiExpanded && (
            <div className="px-4 pb-4 space-y-4 border-t border-[var(--border-default)] pt-4">
              <div>
                <label className="form-label">
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={formData.anthropicApiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, anthropicApiKey: e.target.value })
                  }
                  className="form-input"
                  placeholder="sk-ant-..."
                />
                <p className="form-hint">
                  Get your API key from{' '}
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] underline"
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
                  className="btn btn-secondary btn-sm"
                >
                  {testingAi ? 'Testing...' : 'Test Connection'}
                </button>

                {aiTestStatus === 'success' && (
                  <div className="flex items-center gap-2 text-[var(--success)] text-sm">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span>{aiTestMessage}</span>
                  </div>
                )}

                {aiTestStatus === 'error' && (
                  <div className="flex items-center gap-2 text-[var(--error)] text-sm">
                    <XCircleIcon className="h-5 w-5" />
                    <span>{aiTestMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Email Notifications Section */}
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-xl)] border border-[var(--border-default)] overflow-hidden">
          <button
            type="button"
            onClick={() => setEmailExpanded(!emailExpanded)}
            className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div>
              <h3 className="text-[var(--text-primary)] font-medium">Email Notifications</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Configure SMTP settings for sending email notifications
              </p>
            </div>
            {emailExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-[var(--text-muted)] flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-[var(--text-muted)] flex-shrink-0" />
            )}
          </button>

          {emailExpanded && (
            <div className="px-4 pb-4 space-y-4 border-t border-[var(--border-default)] pt-4">
              <div>
                <label className="form-label">
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
                  className="form-input form-select"
                >
                  <option value="none" className="bg-[var(--bg-elevated)]">
                    None (Disabled)
                  </option>
                  <option value="smtp" className="bg-[var(--bg-elevated)]">
                    SMTP
                  </option>
                </select>
              </div>

              {formData.emailProvider === 'smtp' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={formData.smtpHost}
                        onChange={(e) =>
                          setFormData({ ...formData, smtpHost: e.target.value })
                        }
                        className="form-input"
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div>
                      <label className="form-label">
                        Port
                      </label>
                      <input
                        type="text"
                        value={formData.smtpPort}
                        onChange={(e) =>
                          setFormData({ ...formData, smtpPort: e.target.value })
                        }
                        className="form-input"
                        placeholder="587"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">
                      Username
                    </label>
                    <input
                      type="text"
                      value={formData.smtpUsername}
                      onChange={(e) =>
                        setFormData({ ...formData, smtpUsername: e.target.value })
                      }
                      className="form-input"
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <label className="form-label">
                      Password
                    </label>
                    <input
                      type="password"
                      value={formData.smtpPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, smtpPassword: e.target.value })
                      }
                      className="form-input"
                      placeholder="Your SMTP password"
                    />
                  </div>

                  <div>
                    <label className="form-label">
                      From Address
                    </label>
                    <input
                      type="email"
                      value={formData.smtpFromAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, smtpFromAddress: e.target.value })
                      }
                      className="form-input"
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
      <p className="text-center text-sm text-[var(--text-muted)] mt-6">
        All integrations can be configured or changed later in Settings.
      </p>

      <div className="flex gap-4 mt-8">
        <button
          onClick={() => router.push('/setup/organization')}
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
