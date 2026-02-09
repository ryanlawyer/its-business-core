'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { SystemSettings } from '@/lib/settings';
import {
  BuildingOffice2Icon,
  ShieldCheckIcon,
  DocumentTextIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  CpuChipIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

type TabKey = 'organization' | 'security' | 'purchaseOrders' | 'fiscal' | 'audit' | 'ai' | 'email';

const TABS: { key: TabKey; label: string; icon: typeof BuildingOffice2Icon }[] = [
  { key: 'organization', label: 'Organization', icon: BuildingOffice2Icon },
  { key: 'security', label: 'Security', icon: ShieldCheckIcon },
  { key: 'purchaseOrders', label: 'Purchase Orders', icon: DocumentTextIcon },
  { key: 'fiscal', label: 'Fiscal Year', icon: CalendarIcon },
  { key: 'audit', label: 'Audit Log', icon: ClipboardDocumentListIcon },
  { key: 'ai', label: 'AI / OCR', icon: CpuChipIcon },
  { key: 'email', label: 'Email', icon: EnvelopeIcon },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('organization');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  // Auto-dismiss feedback after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
      } else {
        console.error('Failed to fetch settings:', data.error);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: 'Settings saved successfully.' });
      } else {
        const data = await res.json();
        setFeedback({ type: 'error', message: data.error || 'Failed to save settings.' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setFeedback({ type: 'error', message: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <main className="min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[var(--bg-hover)] rounded w-48"></div>
            <div className="h-4 bg-[var(--bg-hover)] rounded w-80"></div>
            <div className="h-12 bg-[var(--bg-hover)] rounded mt-6"></div>
            <div className="h-64 bg-[var(--bg-hover)] rounded"></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title mb-1">System Settings</h1>
            <p className="text-[var(--text-secondary)] text-sm">Configure system-wide settings and preferences</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary whitespace-nowrap"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`mb-4 flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-sm transition-all ${
              feedback.type === 'success'
                ? 'border border-[var(--success-muted)] bg-[var(--success-subtle)] text-[var(--success)]'
                : 'border border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)]'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
            ) : (
              <XCircleIcon className="h-5 w-5 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="ml-auto text-current opacity-60 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        )}

        <div className="card overflow-hidden">
          {/* Tab Navigation — scrollable on mobile */}
          <div className="border-b border-[var(--border-default)] overflow-x-auto scrollbar-hide">
            <nav className="flex min-w-max px-2 sm:px-4" aria-label="Settings tabs">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === key
                      ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                  }`}
                >
                  <Icon className="h-4 w-4 hidden sm:block" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-4 sm:p-6">
            {/* Organization Tab */}
            {activeTab === 'organization' && (
              <div className="space-y-6">
                <div>
                  <label className="form-label mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={settings.organization.name}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        organization: { ...settings.organization, name: e.target.value },
                      })
                    }
                    className="form-input w-full max-w-md"
                  />
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    This name will appear in the navigation bar and throughout the application
                  </p>
                </div>

                <div>
                  <label className="form-label mb-2">
                    Organization Logo
                  </label>
                  <p className="text-sm text-[var(--text-muted)] mb-2">
                    Logo upload functionality coming soon. Currently using default ITS logo.
                  </p>
                  <input
                    type="text"
                    value={settings.organization.logo || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        organization: { ...settings.organization, logo: e.target.value || null },
                      })
                    }
                    placeholder="Logo URL or path"
                    className="form-input w-full max-w-md"
                  />
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-8">
                {/* Password Policy */}
                <div>
                  <h3 className="section-title mb-4">Password Policy</h3>

                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordPolicy.enabled}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            security: {
                              ...settings.security,
                              passwordPolicy: {
                                ...settings.security.passwordPolicy,
                                enabled: e.target.checked,
                              },
                            },
                          })
                        }
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-[var(--text-secondary)]">Enable Password Policy</span>
                    </label>

                    {settings.security.passwordPolicy.enabled && (
                      <div className="ml-6 space-y-4 border-l-2 border-[var(--border-default)] pl-4">
                        <div>
                          <label className="form-label mb-2">
                            Minimum Length
                          </label>
                          <input
                            type="number"
                            min="4"
                            max="32"
                            value={settings.security.passwordPolicy.minLength}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                security: {
                                  ...settings.security,
                                  passwordPolicy: {
                                    ...settings.security.passwordPolicy,
                                    minLength: parseInt(e.target.value),
                                  },
                                },
                              })
                            }
                            className="form-input w-32"
                          />
                        </div>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.security.passwordPolicy.requireUppercase}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                security: {
                                  ...settings.security,
                                  passwordPolicy: {
                                    ...settings.security.passwordPolicy,
                                    requireUppercase: e.target.checked,
                                  },
                                },
                              })
                            }
                            className="mr-2"
                          />
                          <span className="text-sm text-[var(--text-secondary)]">Require uppercase letters</span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.security.passwordPolicy.requireLowercase}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                security: {
                                  ...settings.security,
                                  passwordPolicy: {
                                    ...settings.security.passwordPolicy,
                                    requireLowercase: e.target.checked,
                                  },
                                },
                              })
                            }
                            className="mr-2"
                          />
                          <span className="text-sm text-[var(--text-secondary)]">Require lowercase letters</span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.security.passwordPolicy.requireNumbers}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                security: {
                                  ...settings.security,
                                  passwordPolicy: {
                                    ...settings.security.passwordPolicy,
                                    requireNumbers: e.target.checked,
                                  },
                                },
                              })
                            }
                            className="mr-2"
                          />
                          <span className="text-sm text-[var(--text-secondary)]">Require numbers</span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.security.passwordPolicy.requireSymbols}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                security: {
                                  ...settings.security,
                                  passwordPolicy: {
                                    ...settings.security.passwordPolicy,
                                    requireSymbols: e.target.checked,
                                  },
                                },
                              })
                            }
                            className="mr-2"
                          />
                          <span className="text-sm text-[var(--text-secondary)]">Require symbols (!@#$%^&*)</span>
                        </label>

                        <div>
                          <label className="form-label mb-2">
                            Prevent Password Reuse (last N passwords)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={settings.security.passwordPolicy.preventReuse}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                security: {
                                  ...settings.security,
                                  passwordPolicy: {
                                    ...settings.security.passwordPolicy,
                                    preventReuse: parseInt(e.target.value),
                                  },
                                },
                              })
                            }
                            className="form-input w-32"
                          />
                          <p className="text-sm text-[var(--text-muted)] mt-1">Set to 0 to disable</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Session Timeout */}
                <div className="border-t border-[var(--border-default)] pt-6">
                  <h3 className="section-title mb-4">Session Timeout</h3>

                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.security.sessionTimeout.enabled}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            security: {
                              ...settings.security,
                              sessionTimeout: {
                                ...settings.security.sessionTimeout,
                                enabled: e.target.checked,
                              },
                            },
                          })
                        }
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-[var(--text-secondary)]">Enable Session Timeout</span>
                    </label>

                    {settings.security.sessionTimeout.enabled && (
                      <div className="ml-6 border-l-2 border-[var(--border-default)] pl-4">
                        <label className="form-label mb-2">
                          Inactivity Timeout (minutes)
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="1440"
                          value={settings.security.sessionTimeout.inactivityMinutes}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              security: {
                                ...settings.security,
                                sessionTimeout: {
                                  ...settings.security.sessionTimeout,
                                  inactivityMinutes: parseInt(e.target.value),
                                },
                              },
                            })
                          }
                          className="form-input w-32"
                        />
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                          Users will be logged out after this period of inactivity
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Purchase Orders Tab */}
            {activeTab === 'purchaseOrders' && (
              <div className="space-y-6">
                <div>
                  <label className="form-label mb-2">
                    PO Number Prefix
                  </label>
                  <input
                    type="text"
                    value={settings.purchaseOrders.numberPrefix}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        purchaseOrders: { ...settings.purchaseOrders, numberPrefix: e.target.value },
                      })
                    }
                    placeholder="PO-"
                    className="form-input w-48"
                  />
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Example: &quot;PO-&quot; will generate numbers like PO-2025-001
                  </p>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.purchaseOrders.resetCounterYearly}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          purchaseOrders: {
                            ...settings.purchaseOrders,
                            resetCounterYearly: e.target.checked,
                          },
                        })
                      }
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-[var(--text-secondary)]">Reset counter yearly</span>
                  </label>
                  <p className="text-sm text-[var(--text-muted)] mt-1 ml-6">
                    If enabled, PO numbers will reset to 001 each year. If disabled, numbers will continue incrementing.
                  </p>
                </div>
              </div>
            )}

            {/* Fiscal Year Tab */}
            {activeTab === 'fiscal' && (
              <div className="space-y-6">
                <div>
                  <label className="form-label mb-2">
                    Fiscal Year Start Month
                  </label>
                  <select
                    value={settings.fiscalYear.startMonth}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        fiscalYear: { startMonth: parseInt(e.target.value) },
                      })
                    }
                    className="form-input form-select w-64"
                  >
                    <option value={1}>January</option>
                    <option value={2}>February</option>
                    <option value={3}>March</option>
                    <option value={4}>April</option>
                    <option value={5}>May</option>
                    <option value={6}>June</option>
                    <option value={7}>July</option>
                    <option value={8}>August</option>
                    <option value={9}>September</option>
                    <option value={10}>October</option>
                    <option value={11}>November</option>
                    <option value={12}>December</option>
                  </select>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Defines when your fiscal year begins for budgeting purposes
                  </p>
                </div>
              </div>
            )}

            {/* Audit Log Tab */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div>
                  <label className="form-label mb-2">
                    Retention Period (months)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={settings.auditLog.retentionMonths}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        auditLog: { retentionMonths: parseInt(e.target.value) },
                      })
                    }
                    className="form-input w-32"
                  />
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Set to 0 to keep audit logs forever. Otherwise, logs older than this period will be automatically purged.
                  </p>
                </div>
              </div>
            )}

            {/* AI / OCR Tab */}
            {activeTab === 'ai' && (
              <div className="space-y-8">
                <div>
                  <h3 className="section-title mb-2">AI Provider for OCR & Receipt Processing</h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Configure the AI provider used for optical character recognition (OCR) to extract data from receipts and documents.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="form-label mb-2">
                        AI Provider
                      </label>
                      <select
                        value={settings.ai?.provider || 'none'}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            ai: {
                              ...settings.ai,
                              provider: e.target.value as 'anthropic' | 'openai' | 'none',
                            },
                          })
                        }
                        className="form-input form-select w-64"
                      >
                        <option value="none">None (Disabled)</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="openai">OpenAI (GPT-4)</option>
                      </select>
                    </div>

                    {settings.ai?.provider === 'anthropic' && (
                      <div className="ml-4 border-l-2 border-[var(--accent-primary-muted)] pl-4 space-y-4">
                        <h4 className="font-medium text-[var(--text-primary)]">Anthropic Configuration</h4>

                        <div>
                          <label className="form-label mb-2">
                            API Key
                          </label>
                          <div className="flex items-center gap-2 max-w-md">
                            <input
                              type={showApiKey ? 'text' : 'password'}
                              value={settings.ai.anthropic?.apiKey || ''}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  ai: {
                                    ...settings.ai,
                                    anthropic: {
                                      ...settings.ai.anthropic,
                                      apiKey: e.target.value,
                                    },
                                  },
                                })
                              }
                              placeholder="sk-ant-..."
                              className="form-input w-full"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                              title={showApiKey ? 'Hide API key' : 'Show API key'}
                            >
                              {showApiKey ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                          </div>
                          <p className="text-sm text-[var(--text-muted)] mt-1">
                            Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">console.anthropic.com</a>
                          </p>
                        </div>

                        <div>
                          <label className="form-label mb-2">
                            Model
                          </label>
                          <select
                            value={settings.ai.anthropic?.model || 'claude-sonnet-4-5-20250929'}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                ai: {
                                  ...settings.ai,
                                  anthropic: {
                                    ...settings.ai.anthropic,
                                    model: e.target.value,
                                  },
                                },
                              })
                            }
                            className="form-input form-select w-64"
                          >
                            <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Recommended)</option>
                            <option value="claude-opus-4-20250514">Claude Opus 4 (Most Capable)</option>
                            <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fastest)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {settings.ai?.provider === 'openai' && (
                      <div className="ml-4 border-l-2 border-[var(--success-muted)] pl-4 space-y-4">
                        <h4 className="font-medium text-[var(--text-primary)]">OpenAI Configuration</h4>

                        <div>
                          <label className="form-label mb-2">
                            API Key
                          </label>
                          <div className="flex items-center gap-2 max-w-md">
                            <input
                              type={showApiKey ? 'text' : 'password'}
                              value={settings.ai.openai?.apiKey || ''}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  ai: {
                                    ...settings.ai,
                                    openai: {
                                      ...settings.ai.openai,
                                      apiKey: e.target.value,
                                    },
                                  },
                                })
                              }
                              placeholder="sk-..."
                              className="form-input w-full"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                              title={showApiKey ? 'Hide API key' : 'Show API key'}
                            >
                              {showApiKey ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                          </div>
                          <p className="text-sm text-[var(--text-muted)] mt-1">
                            Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">platform.openai.com</a>
                          </p>
                        </div>

                        <div>
                          <label className="form-label mb-2">
                            Model
                          </label>
                          <select
                            value={settings.ai.openai?.model || 'gpt-4o'}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                ai: {
                                  ...settings.ai,
                                  openai: {
                                    ...settings.ai.openai,
                                    model: e.target.value,
                                  },
                                },
                              })
                            }
                            className="form-input form-select w-64"
                          >
                            <option value="gpt-4o">GPT-4o (Recommended)</option>
                            <option value="gpt-4o-mini">GPT-4o Mini (Faster)</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Email Tab */}
            {activeTab === 'email' && (
              <div className="space-y-8">
                <div>
                  <h3 className="section-title mb-2">Email Configuration</h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Configure email settings for sending notifications and receiving forwarded receipts via email.
                  </p>

                  <div className="space-y-6">
                    <div>
                      <label className="form-label mb-2">
                        Email Provider
                      </label>
                      <select
                        value={settings.email?.provider || 'none'}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            email: {
                              ...settings.email,
                              provider: e.target.value as 'gmail' | 'office365' | 'smtp' | 'none',
                            },
                          })
                        }
                        className="form-input form-select w-64"
                      >
                        <option value="none">None (Disabled)</option>
                        <option value="gmail">Gmail / Google Workspace</option>
                        <option value="office365">Microsoft 365 / Outlook</option>
                        <option value="smtp">Custom SMTP</option>
                      </select>
                    </div>

                    {settings.email?.provider === 'gmail' && (
                      <div className="ml-4 border-l-2 border-[var(--error-muted)] pl-4 space-y-4">
                        <h4 className="font-medium text-[var(--text-primary)]">Gmail / Google Workspace OAuth</h4>
                        <p className="text-sm text-[var(--text-secondary)]">
                          Configure OAuth credentials from the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">Google Cloud Console</a>
                        </p>

                        <div>
                          <label className="form-label mb-2">Client ID</label>
                          <input
                            type="text"
                            value={settings.email.gmail?.clientId || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  gmail: {
                                    ...settings.email.gmail,
                                    clientId: e.target.value,
                                  },
                                },
                              })
                            }
                            placeholder="xxxxx.apps.googleusercontent.com"
                            className="form-input w-full max-w-lg"
                          />
                        </div>

                        <div>
                          <label className="form-label mb-2">Client Secret</label>
                          <input
                            type="password"
                            value={settings.email.gmail?.clientSecret || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  gmail: {
                                    ...settings.email.gmail,
                                    clientSecret: e.target.value,
                                  },
                                },
                              })
                            }
                            placeholder="GOCSPX-..."
                            className="form-input w-full max-w-lg"
                          />
                        </div>

                        <div>
                          <label className="form-label mb-2">Refresh Token</label>
                          <input
                            type="password"
                            value={settings.email.gmail?.refreshToken || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  gmail: {
                                    ...settings.email.gmail,
                                    refreshToken: e.target.value,
                                  },
                                },
                              })
                            }
                            placeholder="1//..."
                            className="form-input w-full max-w-lg"
                          />
                          <p className="text-sm text-[var(--text-muted)] mt-1">
                            Obtain by completing OAuth flow with Gmail API
                          </p>
                        </div>
                      </div>
                    )}

                    {settings.email?.provider === 'office365' && (
                      <div className="ml-4 border-l-2 border-[var(--info-muted)] pl-4 space-y-4">
                        <h4 className="font-medium text-[var(--text-primary)]">Microsoft 365 / Outlook OAuth</h4>
                        <p className="text-sm text-[var(--text-secondary)]">
                          Configure OAuth credentials from the <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">Azure Portal</a>
                        </p>

                        <div>
                          <label className="form-label mb-2">Client ID (Application ID)</label>
                          <input
                            type="text"
                            value={settings.email.office365?.clientId || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  office365: {
                                    ...settings.email.office365,
                                    clientId: e.target.value,
                                  },
                                },
                              })
                            }
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            className="form-input w-full max-w-lg"
                          />
                        </div>

                        <div>
                          <label className="form-label mb-2">Tenant ID</label>
                          <input
                            type="text"
                            value={settings.email.office365?.tenantId || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  office365: {
                                    ...settings.email.office365,
                                    tenantId: e.target.value,
                                  },
                                },
                              })
                            }
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            className="form-input w-full max-w-lg"
                          />
                        </div>

                        <div>
                          <label className="form-label mb-2">Client Secret</label>
                          <input
                            type="password"
                            value={settings.email.office365?.clientSecret || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  office365: {
                                    ...settings.email.office365,
                                    clientSecret: e.target.value,
                                  },
                                },
                              })
                            }
                            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="form-input w-full max-w-lg"
                          />
                        </div>

                        <div>
                          <label className="form-label mb-2">Refresh Token</label>
                          <input
                            type="password"
                            value={settings.email.office365?.refreshToken || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  office365: {
                                    ...settings.email.office365,
                                    refreshToken: e.target.value,
                                  },
                                },
                              })
                            }
                            placeholder="0.xxxxx..."
                            className="form-input w-full max-w-lg"
                          />
                          <p className="text-sm text-[var(--text-muted)] mt-1">
                            Obtain by completing OAuth flow with Microsoft Graph API
                          </p>
                        </div>
                      </div>
                    )}

                    {settings.email?.provider === 'smtp' && (
                      <div className="ml-4 border-l-2 border-[var(--border-strong)] pl-4 space-y-4">
                        <h4 className="font-medium text-[var(--text-primary)]">Custom SMTP Configuration</h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                          <div>
                            <label className="form-label mb-2">SMTP Host</label>
                            <input
                              type="text"
                              value={settings.email.smtp?.host || ''}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  email: {
                                    ...settings.email,
                                    smtp: {
                                      ...settings.email.smtp,
                                      host: e.target.value,
                                    },
                                  },
                                })
                              }
                              placeholder="smtp.example.com"
                              className="form-input w-full"
                            />
                          </div>

                          <div>
                            <label className="form-label mb-2">Port</label>
                            <input
                              type="number"
                              value={settings.email.smtp?.port || 587}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  email: {
                                    ...settings.email,
                                    smtp: {
                                      ...settings.email.smtp,
                                      port: parseInt(e.target.value),
                                    },
                                  },
                                })
                              }
                              className="form-input w-full"
                            />
                          </div>
                        </div>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.email.smtp?.secure || false}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  smtp: {
                                    ...settings.email.smtp,
                                    secure: e.target.checked,
                                  },
                                },
                              })
                            }
                            className="mr-2"
                          />
                          <span className="text-sm text-[var(--text-secondary)]">Use SSL/TLS (recommended for port 465)</span>
                        </label>

                        <div>
                          <label className="form-label mb-2">Username</label>
                          <input
                            type="text"
                            value={settings.email.smtp?.username || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  smtp: {
                                    ...settings.email.smtp,
                                    username: e.target.value,
                                  },
                                },
                              })
                            }
                            placeholder="user@example.com"
                            className="form-input w-full max-w-lg"
                          />
                        </div>

                        <div>
                          <label className="form-label mb-2">Password</label>
                          <input
                            type="password"
                            value={settings.email.smtp?.password || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  smtp: {
                                    ...settings.email.smtp,
                                    password: e.target.value,
                                  },
                                },
                              })
                            }
                            className="form-input w-full max-w-lg"
                          />
                        </div>

                        <div>
                          <label className="form-label mb-2">From Address</label>
                          <input
                            type="email"
                            value={settings.email.smtp?.fromAddress || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                email: {
                                  ...settings.email,
                                  smtp: {
                                    ...settings.email.smtp,
                                    fromAddress: e.target.value,
                                  },
                                },
                              })
                            }
                            placeholder="noreply@example.com"
                            className="form-input w-full max-w-lg"
                          />
                        </div>
                      </div>
                    )}

                    {/* Receipt Forwarding Section */}
                    {settings.email?.provider && settings.email.provider !== 'none' && (
                      <div className="border-t border-[var(--border-default)] pt-6 mt-6">
                        <h4 className="section-title mb-2">Receipt Email Forwarding</h4>
                        <p className="text-sm text-[var(--text-secondary)] mb-4">
                          Forward receipts to a dedicated email address to automatically import them into the system.
                        </p>

                        <div className="space-y-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={settings.email.receiptForwarding?.enabled || false}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  email: {
                                    ...settings.email,
                                    receiptForwarding: {
                                      ...settings.email.receiptForwarding,
                                      enabled: e.target.checked,
                                    },
                                  },
                                })
                              }
                              className="mr-2"
                            />
                            <span className="text-sm font-medium text-[var(--text-secondary)]">Enable Receipt Email Forwarding</span>
                          </label>

                          {settings.email.receiptForwarding?.enabled && (
                            <div className="ml-6 border-l-2 border-[var(--border-default)] pl-4">
                              <label className="form-label mb-2">
                                Forwarding Email Address
                              </label>
                              <input
                                type="email"
                                value={settings.email.receiptForwarding?.forwardingAddress || ''}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    email: {
                                      ...settings.email,
                                      receiptForwarding: {
                                        ...settings.email.receiptForwarding,
                                        forwardingAddress: e.target.value,
                                      },
                                    },
                                  })
                                }
                                placeholder="receipts@yourcompany.com"
                                className="form-input w-full max-w-lg"
                              />
                              <p className="text-sm text-[var(--text-muted)] mt-1">
                                Forward digital receipts to this address to automatically create expense entries
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Test Email Button */}
                    {settings.email?.provider && settings.email.provider !== 'none' && (
                      <div className="border-t border-[var(--border-default)] pt-6">
                        <button
                          type="button"
                          onClick={async () => {
                            setTestingEmail(true);
                            try {
                              const res = await fetch('/api/settings/test-email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ settings: settings.email }),
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setFeedback({ type: 'success', message: 'Test email sent successfully!' });
                              } else {
                                setFeedback({ type: 'error', message: `Failed to send test email: ${data.error}` });
                              }
                            } catch (error) {
                              setFeedback({ type: 'error', message: 'Failed to send test email.' });
                            } finally {
                              setTestingEmail(false);
                            }
                          }}
                          disabled={testingEmail}
                          className="btn btn-secondary"
                        >
                          {testingEmail ? 'Sending...' : 'Send Test Email'}
                        </button>
                        <p className="text-sm text-[var(--text-muted)] mt-2">
                          Save your settings first, then click to send a test email to verify the configuration.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
