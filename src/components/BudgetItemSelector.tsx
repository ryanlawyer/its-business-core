'use client';

import { useState, Fragment } from 'react';
import { Combobox, Dialog, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';

type BudgetItem = {
  id: string;
  code: string;
  name: string;
  allocated?: number;
  encumbered?: number;
  actualSpent?: number;
  remaining?: number;
  department?: {
    id: string;
    name: string;
  };
  category?: {
    id: string;
    code: string;
    name: string;
  };
};

type Department = {
  id: string;
  name: string;
};

type BudgetItemSelectorProps = {
  budgetItems: BudgetItem[];
  departments: Department[];
  selectedBudgetItemId: string;
  onChange: (budgetItemId: string | null) => void;
  userDepartmentId?: string | null;
  userDepartmentName?: string | null;
  required?: boolean;
};

export default function BudgetItemSelector({
  budgetItems,
  departments,
  selectedBudgetItemId,
  onChange,
  userDepartmentId,
  userDepartmentName,
  required = false,
}: BudgetItemSelectorProps) {
  const [query, setQuery] = useState('');
  const [showBrowserModal, setShowBrowserModal] = useState(false);

  // Modal state
  const [modalSearch, setModalSearch] = useState('');
  const [modalDepartmentFilter, setModalDepartmentFilter] = useState(userDepartmentId || '');
  const [sortColumn, setSortColumn] = useState<'code' | 'name' | 'remaining'>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Get color class based on budget remaining percentage
  const getBudgetColor = (item: BudgetItem): string => {
    if (!item.allocated || item.remaining === undefined) return 'text-[var(--text-secondary)]';
    const percentage = (item.remaining / item.allocated) * 100;
    if (percentage > 20) return 'text-[var(--success)]';
    if (percentage > 5) return 'text-[var(--warning)]';
    return 'text-[var(--error)]';
  };

  // Filter budget items by user's department by default
  const getFilteredBudgetItems = (searchQuery: string, departmentFilter?: string) => {
    let filtered = budgetItems;

    // Apply department filter
    const deptFilter = departmentFilter !== undefined ? departmentFilter : userDepartmentId;
    if (deptFilter) {
      filtered = filtered.filter(item => item.department?.id === deptFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.code.toLowerCase().includes(lowerQuery) ||
          item.name.toLowerCase().includes(lowerQuery) ||
          item.department?.name.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  };

  // Combobox filtered items (default to user's department)
  const filteredItems = getFilteredBudgetItems(query);

  // Modal filtered and sorted items
  const getModalItems = () => {
    let filtered = getFilteredBudgetItems(modalSearch, modalDepartmentFilter);

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];

      if (sortColumn === 'remaining') {
        aVal = a.remaining ?? 0;
        bVal = b.remaining ?? 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  };

  const modalItems = getModalItems();

  const selectedItem = budgetItems.find(item => item.id === selectedBudgetItemId);

  const handleSort = (column: 'code' | 'name' | 'remaining') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleModalSelect = (budgetItemId: string) => {
    onChange(budgetItemId);
    setShowBrowserModal(false);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        {/* Searchable Combobox */}
        <div className="flex-1">
          <Combobox value={selectedBudgetItemId} onChange={onChange}>
            <div className="relative">
              <Combobox.Input
                className="form-input pr-10"
                displayValue={(id: string) => {
                  const item = budgetItems.find(b => b.id === id);
                  if (!item) return '';
                  return `${item.code} - ${item.name}`;
                }}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type to search budget codes..."
                required={required}
              />
              <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />
              </Combobox.Button>

              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
                afterLeave={() => setQuery('')}
              >
                <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-[var(--radius-lg)] bg-[var(--bg-elevated)] py-1 text-sm shadow-lg ring-1 ring-[var(--border-default)]">
                  {filteredItems.length === 0 ? (
                    <div className="relative cursor-default select-none py-2 px-4 text-[var(--text-secondary)]">
                      No budget items found.
                    </div>
                  ) : (
                    filteredItems.map((item) => (
                      <Combobox.Option
                        key={item.id}
                        value={item.id}
                        className={({ active }) =>
                          `relative cursor-pointer select-none py-2 px-4 ${
                            active ? 'bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                          }`
                        }
                      >
                        {({ selected }) => (
                          <div className="flex justify-between items-center">
                            <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                              {item.code} - {item.name}
                            </span>
                            {item.remaining !== undefined && (
                              <span className={`ml-2 text-xs font-semibold ${getBudgetColor(item)}`}>
                                ${item.remaining.toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </Combobox.Option>
                    ))
                  )}
                </Combobox.Options>
              </Transition>
            </div>
          </Combobox>

          {/* Hint text */}
          {userDepartmentName && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Searching in {userDepartmentName} -
              <button
                type="button"
                onClick={() => setShowBrowserModal(true)}
                className="ml-1 text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] underline"
              >
                Browse All
              </button>
            </p>
          )}
        </div>

        {/* Browse All Button */}
        <button
          type="button"
          onClick={() => setShowBrowserModal(true)}
          className="btn btn-secondary"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
          Browse
        </button>
      </div>

      {/* Browser Modal */}
      <Transition appear show={showBrowserModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowBrowserModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-[var(--radius-xl)] bg-[var(--bg-elevated)] shadow-xl transition-all md:max-h-[85vh]">
                  {/* Modal Header */}
                  <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-4">
                    <Dialog.Title className="text-xl font-bold text-[var(--text-primary)]">
                      Select Budget Item
                    </Dialog.Title>
                  </div>

                  {/* Filters */}
                  <div className="border-b border-[var(--border-subtle)] px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">
                          Search
                        </label>
                        <input
                          type="text"
                          value={modalSearch}
                          onChange={(e) => setModalSearch(e.target.value)}
                          placeholder="Search by code or description..."
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">
                          Department
                        </label>
                        <select
                          value={modalDepartmentFilter}
                          onChange={(e) => setModalDepartmentFilter(e.target.value)}
                          className="form-input form-select"
                        >
                          <option value="">All Departments</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-auto max-h-96 px-6 py-4">
                    <table className="min-w-full divide-y divide-[var(--border-subtle)]">
                      <thead className="bg-[var(--bg-surface)] sticky top-0">
                        <tr>
                          <th
                            className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-hover)]"
                            onClick={() => handleSort('code')}
                          >
                            Code {sortColumn === 'code' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-hover)]"
                            onClick={() => handleSort('name')}
                          >
                            Description {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                            Department
                          </th>
                          <th
                            className="px-3 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-hover)]"
                            onClick={() => handleSort('remaining')}
                          >
                            Available {sortColumn === 'remaining' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {modalItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-8 text-center text-[var(--text-muted)]">
                              No budget items found
                            </td>
                          </tr>
                        ) : (
                          modalItems.map((item) => (
                            <tr
                              key={item.id}
                              className={`hover:bg-[var(--bg-hover)] ${
                                selectedBudgetItemId === item.id ? 'bg-[var(--accent-primary-subtle)]' : ''
                              }`}
                            >
                              <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-[var(--text-primary)]">
                                {item.code}
                              </td>
                              <td className="px-3 py-3 text-sm text-[var(--text-secondary)]">
                                {item.name}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-[var(--text-muted)]">
                                {item.department?.name || '-'}
                              </td>
                              <td className={`px-3 py-3 whitespace-nowrap text-sm text-right font-semibold ${getBudgetColor(item)}`}>
                                {item.remaining !== undefined ? `$${item.remaining.toFixed(2)}` : '-'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-center">
                                <button
                                  type="button"
                                  onClick={() => handleModalSelect(item.id)}
                                  className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium"
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Modal Footer */}
                  <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowBrowserModal(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
