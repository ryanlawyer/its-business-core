'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { permissions } from '@/lib/permissions';
import { useDebounce } from '@/hooks/useDebounce';

type Vendor = {
  id: string;
  vendorNumber: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

export default function VendorsPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const [formData, setFormData] = useState({
    vendorNumber: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const canManage = user && permissions.canManageVendors(user.role as any);

  useEffect(() => {
    fetchVendors();
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
      });

      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await fetch(`/api/vendors?${params}`);
      const data = await res.json();

      setVendors(data.vendors || []);
      setPagination(data.pagination || {});
    } catch (err) {
      setError('Failed to load vendors. Please refresh the page.');
      console.error('Error fetching vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchVendors();
  };

  const openForm = (vendor?: Vendor) => {
    if (vendor) {
      setEditingVendor(vendor);
      fetch(`/api/vendors/${vendor.id}`)
        .then((res) => res.json())
        .then((data) => {
          setFormData({
            vendorNumber: data.vendor.vendorNumber || '',
            name: data.vendor.name || '',
            phone: data.vendor.phone || '',
            email: data.vendor.email || '',
            address: data.vendor.address || '',
            city: data.vendor.city || '',
            state: data.vendor.state || '',
            zipCode: data.vendor.zipCode || '',
          });
        });
    } else {
      setEditingVendor(null);
      setFormData({
        vendorNumber: '',
        name: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
      });
    }
    setIsFormOpen(true);
    setError(null);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingVendor(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const url = editingVendor
      ? `/api/vendors/${editingVendor.id}`
      : '/api/vendors';
    const method = editingVendor ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        closeForm();
        fetchVendors();
      } else {
        setError('Failed to save vendor. Please try again.');
      }
    } catch (err) {
      setError('Failed to save vendor. Please try again.');
      console.error('Error saving vendor:', err);
    }
  };

  const deleteVendor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;

    try {
      setError(null);
      const res = await fetch(`/api/vendors/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchVendors();
      } else {
        setError('Failed to delete vendor. Please try again.');
      }
    } catch (err) {
      setError('Failed to delete vendor. Please try again.');
      console.error('Error deleting vendor:', err);
    }
  };


  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
          <h1 className="page-title">Vendor Management</h1>
          {canManage && (
            <button
              onClick={() => openForm()}
              className="btn btn-primary"
            >
              + Add Vendor
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--error-muted)] bg-[var(--error-subtle)] text-[var(--error)] px-4 py-3 mb-4">
            <p>{error}</p>
          </div>
        )}

        {/* Search and Summary */}
        <div className="mb-4 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search vendors by name, number, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="form-input flex-1"
            />
            <button
              onClick={handleSearch}
              className="btn btn-primary"
            >
              Search
            </button>
          </div>
          {!loading && pagination.total > 0 && (
            <p className="text-sm text-[var(--text-secondary)]">
              Showing {vendors.length} of {pagination.total} vendors
            </p>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="card text-center">
            <p className="text-[var(--text-muted)]">Loading vendors...</p>
          </div>
        ) : vendors.length === 0 ? (
          <div className="card empty-state">
            <p className="empty-state-title">No vendors found.</p>
            <p className="empty-state-description">Add one to get started!</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {vendors.map((vendor) => (
                <div key={vendor.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">{vendor.name}</h3>
                      <p className="text-sm text-[var(--text-secondary)]">#{vendor.vendorNumber}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Phone:</span>
                      <span className="text-[var(--text-primary)]">{vendor.phone || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Email:</span>
                      <span className="text-[var(--text-primary)]">{vendor.email || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Location:</span>
                      <span className="text-[var(--text-primary)]">
                        {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : '-'}
                      </span>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex gap-2 border-t border-[var(--border-default)] pt-3">
                      <button
                        onClick={() => openForm(vendor)}
                        className="btn btn-primary flex-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteVendor(vendor.id)}
                        className="btn btn-danger flex-1"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Vendor #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      City, State
                    </th>
                    {canManage && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {vendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td className="px-6 py-4 text-sm">{vendor.vendorNumber}</td>
                      <td className="px-6 py-4 text-sm font-medium">{vendor.name}</td>
                      <td className="px-6 py-4 text-sm">{vendor.phone || '-'}</td>
                      <td className="px-6 py-4 text-sm">{vendor.email || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : '-'}
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-sm space-x-3">
                          <button
                            onClick={() => openForm(vendor)}
                            className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteVendor(vendor.id)}
                            className="text-[var(--error)] hover:text-[var(--error)] font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex justify-center items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-[var(--text-secondary)]">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))
                  }
                  disabled={currentPage === pagination.totalPages}
                  className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && canManage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
              {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    Vendor Number *
                  </label>
                  <input
                    type="text"
                    value={formData.vendorNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, vendorNumber: e.target.value })
                    }
                    required
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="form-input"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Zip Code
                  </label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) =>
                      setFormData({ ...formData, zipCode: e.target.value })
                    }
                    className="form-input"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={closeForm}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  {editingVendor ? 'Update Vendor' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
