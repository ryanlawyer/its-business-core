'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type PayPeriodConfig = {
  id: string;
  type: string;
  startDayOfWeek: number | null;
  startDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type OvertimeConfig = {
  id: string;
  dailyThreshold: number | null;
  weeklyThreshold: number | null;
  alertBeforeDaily: number | null;
  alertBeforeWeekly: number | null;
  notifyEmployee: boolean;
  notifyManager: boolean;
  createdAt: string;
  updatedAt: string;
};

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const PAY_PERIOD_TYPES = [
  { value: 'weekly', label: 'Weekly', description: 'Every week' },
  { value: 'biweekly', label: 'Bi-Weekly', description: 'Every two weeks' },
  { value: 'semimonthly', label: 'Semi-Monthly', description: '1st and 15th of each month' },
  { value: 'monthly', label: 'Monthly', description: 'Once per month' },
];

// Helper function to convert minutes to hours and minutes display
function formatMinutesToHours(minutes: number | null): string {
  if (minutes === null) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Helper function to parse hours input to minutes
function parseHoursToMinutes(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 60);
}

export default function TimeclockConfigPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [payPeriodConfig, setPayPeriodConfig] = useState<PayPeriodConfig | null>(null);
  const [overtimeConfig, setOvertimeConfig] = useState<OvertimeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'payperiod' | 'overtime'>('payperiod');

  // Pay period form state
  const [formType, setFormType] = useState('biweekly');
  const [formStartDayOfWeek, setFormStartDayOfWeek] = useState(0);
  const [formStartDate, setFormStartDate] = useState('');

  // Overtime form state (stored as hours for UI, converted to minutes for API)
  const [formDailyThreshold, setFormDailyThreshold] = useState('');
  const [formWeeklyThreshold, setFormWeeklyThreshold] = useState('');
  const [formAlertBeforeDaily, setFormAlertBeforeDaily] = useState('');
  const [formAlertBeforeWeekly, setFormAlertBeforeWeekly] = useState('');
  const [formNotifyEmployee, setFormNotifyEmployee] = useState(true);
  const [formNotifyManager, setFormNotifyManager] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchConfig();
    }
  }, [status]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/timeclock/config');
      const data = await res.json();

      if (res.ok) {
        // Pay period config
        setPayPeriodConfig(data.payPeriodConfig);
        setFormType(data.payPeriodConfig.type);
        setFormStartDayOfWeek(data.payPeriodConfig.startDayOfWeek ?? 0);
        setFormStartDate(
          data.payPeriodConfig.startDate
            ? new Date(data.payPeriodConfig.startDate).toISOString().split('T')[0]
            : ''
        );

        // Overtime config
        setOvertimeConfig(data.overtimeConfig);
        setFormDailyThreshold(
          data.overtimeConfig.dailyThreshold !== null
            ? String(data.overtimeConfig.dailyThreshold / 60)
            : ''
        );
        setFormWeeklyThreshold(
          data.overtimeConfig.weeklyThreshold !== null
            ? String(data.overtimeConfig.weeklyThreshold / 60)
            : ''
        );
        setFormAlertBeforeDaily(
          data.overtimeConfig.alertBeforeDaily !== null
            ? String(data.overtimeConfig.alertBeforeDaily)
            : ''
        );
        setFormAlertBeforeWeekly(
          data.overtimeConfig.alertBeforeWeekly !== null
            ? String(data.overtimeConfig.alertBeforeWeekly)
            : ''
        );
        setFormNotifyEmployee(data.overtimeConfig.notifyEmployee);
        setFormNotifyManager(data.overtimeConfig.notifyManager);
      } else {
        if (res.status === 403) {
          router.push('/');
          return;
        }
        setError(data.error || 'Failed to fetch configuration');
      }
    } catch (err) {
      console.error('Error fetching config:', err);
      setError('Failed to fetch configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePayPeriod = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/timeclock/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          startDayOfWeek: formStartDayOfWeek,
          startDate: formStartDate || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPayPeriodConfig(data.payPeriodConfig);
        setSuccess('Pay period configuration saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOvertime = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/timeclock/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyThreshold: parseHoursToMinutes(formDailyThreshold),
          weeklyThreshold: parseHoursToMinutes(formWeeklyThreshold),
          alertBeforeDaily: formAlertBeforeDaily ? parseInt(formAlertBeforeDaily) : null,
          alertBeforeWeekly: formAlertBeforeWeekly ? parseInt(formAlertBeforeWeekly) : null,
          notifyEmployee: formNotifyEmployee,
          notifyManager: formNotifyManager,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setOvertimeConfig(data.overtimeConfig);
        setSuccess('Overtime configuration saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!session?.user) {
    return null;
  }

  const showStartDayOfWeek = formType === 'weekly' || formType === 'biweekly';
  const showStartDate = formType === 'biweekly';

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Timeclock Configuration</h1>
          <p className="text-gray-600">
            Configure pay periods and overtime rules for time tracking
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-green-600 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div>
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('payperiod')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'payperiod'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pay Periods
              </button>
              <button
                onClick={() => setActiveTab('overtime')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overtime'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overtime Rules
              </button>
            </nav>
          </div>

          {/* Pay Period Tab */}
          {activeTab === 'payperiod' && (
            <>
              <div className="p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Pay Period Settings</h2>
                  <p className="text-sm text-gray-600">
                    Configure how pay periods are calculated for time tracking
                  </p>
                </div>

                {/* Pay Period Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pay Period Type
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PAY_PERIOD_TYPES.map((type) => (
                      <label
                        key={type.value}
                        className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors ${
                          formType === type.value
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payPeriodType"
                          value={type.value}
                          checked={formType === type.value}
                          onChange={(e) => setFormType(e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex-1">
                          <span
                            className={`block font-medium ${
                              formType === type.value ? 'text-blue-900' : 'text-gray-900'
                            }`}
                          >
                            {type.label}
                          </span>
                          <span
                            className={`mt-1 block text-sm ${
                              formType === type.value ? 'text-blue-700' : 'text-gray-500'
                            }`}
                          >
                            {type.description}
                          </span>
                        </div>
                        {formType === type.value && (
                          <svg
                            className="h-5 w-5 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Start Day of Week (for weekly/biweekly) */}
                {showStartDayOfWeek && (
                  <div>
                    <label
                      htmlFor="startDayOfWeek"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Pay Period Start Day
                    </label>
                    <select
                      id="startDayOfWeek"
                      value={formStartDayOfWeek}
                      onChange={(e) => setFormStartDayOfWeek(parseInt(e.target.value))}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      {DAY_NAMES.map((day, index) => (
                        <option key={index} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-500 mt-1">
                      The day of the week when each pay period starts
                    </p>
                  </div>
                )}

                {/* Reference Start Date (for biweekly) */}
                {showStartDate && (
                  <div>
                    <label
                      htmlFor="startDate"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Reference Start Date
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      A known start date for a pay period (used to calculate bi-weekly boundaries)
                    </p>
                  </div>
                )}
              </div>

              {/* Footer with Save Button */}
              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
                <button
                  onClick={handleSavePayPeriod}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Pay Period Settings'}
                </button>
              </div>
            </>
          )}

          {/* Overtime Tab */}
          {activeTab === 'overtime' && (
            <>
              <div className="p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Overtime Rules</h2>
                  <p className="text-sm text-gray-600">
                    Configure overtime thresholds and notification settings
                  </p>
                </div>

                {/* Daily Threshold */}
                <div>
                  <label
                    htmlFor="dailyThreshold"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Daily Overtime Threshold (hours)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      id="dailyThreshold"
                      value={formDailyThreshold}
                      onChange={(e) => setFormDailyThreshold(e.target.value)}
                      placeholder="8"
                      step="0.5"
                      min="0"
                      max="24"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <span className="text-sm text-gray-500">hours per day</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Hours worked beyond this threshold in a single day count as overtime. Leave empty
                    to disable.
                  </p>
                </div>

                {/* Weekly Threshold */}
                <div>
                  <label
                    htmlFor="weeklyThreshold"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Weekly Overtime Threshold (hours)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      id="weeklyThreshold"
                      value={formWeeklyThreshold}
                      onChange={(e) => setFormWeeklyThreshold(e.target.value)}
                      placeholder="40"
                      step="0.5"
                      min="0"
                      max="168"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <span className="text-sm text-gray-500">hours per week</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Hours worked beyond this threshold in a week count as overtime. Leave empty to
                    disable.
                  </p>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-md font-semibold text-gray-900 mb-4">Alert Settings</h3>

                  {/* Alert Before Daily */}
                  <div className="mb-4">
                    <label
                      htmlFor="alertBeforeDaily"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Alert Before Daily Threshold (minutes)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        id="alertBeforeDaily"
                        value={formAlertBeforeDaily}
                        onChange={(e) => setFormAlertBeforeDaily(e.target.value)}
                        placeholder="30"
                        min="0"
                        max="120"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                      <span className="text-sm text-gray-500">minutes before</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Show warning when approaching daily overtime threshold
                    </p>
                  </div>

                  {/* Alert Before Weekly */}
                  <div>
                    <label
                      htmlFor="alertBeforeWeekly"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Alert Before Weekly Threshold (minutes)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        id="alertBeforeWeekly"
                        value={formAlertBeforeWeekly}
                        onChange={(e) => setFormAlertBeforeWeekly(e.target.value)}
                        placeholder="120"
                        min="0"
                        max="480"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                      <span className="text-sm text-gray-500">minutes before</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Show warning when approaching weekly overtime threshold
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-md font-semibold text-gray-900 mb-4">Notification Settings</h3>

                  {/* Notify Employee */}
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="notifyEmployee"
                      checked={formNotifyEmployee}
                      onChange={(e) => setFormNotifyEmployee(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="notifyEmployee" className="text-sm text-gray-700">
                      Notify employees when approaching or exceeding overtime thresholds
                    </label>
                  </div>

                  {/* Notify Manager */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="notifyManager"
                      checked={formNotifyManager}
                      onChange={(e) => setFormNotifyManager(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="notifyManager" className="text-sm text-gray-700">
                      Notify managers when team members approach or exceed overtime thresholds
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer with Save Button */}
              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
                <button
                  onClick={handleSaveOvertime}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Overtime Settings'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-blue-600 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                {activeTab === 'payperiod' ? 'About Pay Periods' : 'About Overtime Rules'}
              </h3>
              {activeTab === 'payperiod' ? (
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>
                    <strong>Weekly:</strong> Pay period starts on the selected day each week
                  </li>
                  <li>
                    <strong>Bi-Weekly:</strong> Pay period starts every two weeks from the reference
                    date
                  </li>
                  <li>
                    <strong>Semi-Monthly:</strong> Pay periods are 1st-15th and 16th-end of month
                  </li>
                  <li>
                    <strong>Monthly:</strong> Pay period is the entire calendar month
                  </li>
                </ul>
              ) : (
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>
                    <strong>Daily OT:</strong> Hours exceeding the daily threshold on any single day
                  </li>
                  <li>
                    <strong>Weekly OT:</strong> Hours exceeding the weekly threshold (after daily OT
                    is removed)
                  </li>
                  <li>
                    <strong>Alerts:</strong> Warnings appear when employees approach thresholds
                  </li>
                  <li>
                    <strong>Notifications:</strong> Choose who gets notified about overtime events
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
