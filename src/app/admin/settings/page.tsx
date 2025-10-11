'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { SystemSettings } from '@/lib/settings';

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'organization' | 'security' | 'purchaseOrders' | 'fiscal' | 'audit'>('organization');

  useEffect(() => {
    fetchSettings();
  }, []);

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
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (res.ok) {
        alert('Settings saved successfully!');
      } else {
        const data = await res.json();
        alert(`Failed to save settings: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">System Settings</h1>
            <p className="text-gray-600">Configure system-wide settings and preferences</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('organization')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'organization'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Organization
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'security'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Security
              </button>
              <button
                onClick={() => setActiveTab('purchaseOrders')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'purchaseOrders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Purchase Orders
              </button>
              <button
                onClick={() => setActiveTab('fiscal')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'fiscal'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Fiscal Year
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'audit'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Audit Log
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Organization Tab */}
            {activeTab === 'organization' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    This name will appear in the navigation bar and throughout the application
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization Logo
                  </label>
                  <p className="text-sm text-gray-500 mb-2">
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
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-8">
                {/* Password Policy */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Password Policy</h3>

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
                      <span className="text-sm font-medium text-gray-700">Enable Password Policy</span>
                    </label>

                    {settings.security.passwordPolicy.enabled && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
                          <span className="text-sm text-gray-700">Require uppercase letters</span>
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
                          <span className="text-sm text-gray-700">Require lowercase letters</span>
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
                          <span className="text-sm text-gray-700">Require numbers</span>
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
                          <span className="text-sm text-gray-700">Require symbols (!@#$%^&*)</span>
                        </label>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                          <p className="text-sm text-gray-500 mt-1">Set to 0 to disable</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Session Timeout */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Timeout</h3>

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
                      <span className="text-sm font-medium text-gray-700">Enable Session Timeout</span>
                    </label>

                    {settings.security.sessionTimeout.enabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                          className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                        <p className="text-sm text-gray-500 mt-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Example: "PO-" will generate numbers like PO-2025-001
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
                    <span className="text-sm font-medium text-gray-700">Reset counter yearly</span>
                  </label>
                  <p className="text-sm text-gray-500 mt-1 ml-6">
                    If enabled, PO numbers will reset to 001 each year. If disabled, numbers will continue incrementing.
                  </p>
                </div>
              </div>
            )}

            {/* Fiscal Year Tab */}
            {activeTab === 'fiscal' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
                  <p className="text-sm text-gray-500 mt-1">
                    Defines when your fiscal year begins for budgeting purposes
                  </p>
                </div>
              </div>
            )}

            {/* Audit Log Tab */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Set to 0 to keep audit logs forever. Otherwise, logs older than this period will be automatically purged.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
