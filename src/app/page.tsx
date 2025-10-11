'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

type TimeclockEntry = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  duration: number | null;
};

export default function TimeclockPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [activeEntry, setActiveEntry] = useState<TimeclockEntry | null>(null);
  const [entries, setEntries] = useState<TimeclockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (user) {
      fetchEntries();
    }
  }, [user]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchEntries = async () => {
    try {
      const res = await fetch('/api/timeclock');
      const data = await res.json();
      setEntries(data.entries || []);
      setActiveEntry(data.activeEntry || null);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    try {
      const res = await fetch('/api/timeclock/clock-in', {
        method: 'POST',
      });
      if (res.ok) {
        await fetchEntries();
      }
    } catch (error) {
      console.error('Error clocking in:', error);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    try {
      const res = await fetch('/api/timeclock/clock-out', {
        method: 'POST',
      });
      if (res.ok) {
        await fetchEntries();
      }
    } catch (error) {
      console.error('Error clocking out:', error);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getCurrentDuration = () => {
    if (!activeEntry) return 0;
    const start = new Date(activeEntry.clockIn);
    const diff = Math.floor((currentTime.getTime() - start.getTime()) / 1000);
    return diff;
  };

  const getTotalTime = () => {
    const completedEntries = entries.filter(e => e.clockOut && e.duration);
    const total = completedEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    return total;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  // Prevent hydration mismatch
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 pt-8">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Timeclock</h1>
            <p className="text-lg text-gray-600">Loading...</p>
          </header>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header with Current Date/Time */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Timeclock</h1>
          <p className="text-lg text-gray-600">{currentTime.toLocaleDateString()}</p>
          <p className="text-xl text-gray-700">{currentTime.toLocaleTimeString()}</p>
        </header>

        {/* Organizational Assignment Widget */}
        {user?.departmentName && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 rounded-full p-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 mb-2">Your Organizational Assignment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Department:</span>
                    <span className="font-medium text-gray-900">{user.departmentName}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  This is your default organizational context for filters and budget creation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Two Column Layout - Clock In/Out and Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Clock In/Out Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 text-center">
              {activeEntry ? 'Currently Clocked In' : 'Ready to Clock In'}
            </h2>

            {activeEntry && (
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600">Clocked in at:</p>
                <p className="text-lg font-medium">{formatTime(activeEntry.clockIn)}</p>
                <p className="text-sm text-gray-600 mt-2">Current duration:</p>
                <p className="text-xl font-bold text-blue-600">{formatDuration(getCurrentDuration())}</p>
              </div>
            )}

            <div className="text-center">
              {!activeEntry ? (
                <button
                  onClick={handleClockIn}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
                >
                  Clock In
                </button>
              ) : (
                <button
                  onClick={handleClockOut}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
                >
                  Clock Out
                </button>
              )}
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 text-center">Today&apos;s Summary</h2>
            <div className="text-center">
              <div className="mb-4">
                <p className="text-sm text-gray-600">Total Time Logged:</p>
                <p className="text-2xl font-bold text-green-600">{formatDuration(getTotalTime())}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Sessions Completed:</p>
                <p className="text-xl font-medium">{entries.filter(e => e.clockOut).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Time Entries Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">Time Entries</h2>
          {entries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No time entries yet. Clock in to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Clock In</th>
                    <th className="px-4 py-2 text-left">Clock Out</th>
                    <th className="px-4 py-2 text-left">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{formatDateTime(entry.clockIn)}</td>
                      <td className="px-4 py-2">
                        {entry.clockOut ? formatDateTime(entry.clockOut) : (
                          <span className="text-green-600 font-semibold">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {entry.clockOut ? formatDuration(entry.duration) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
