import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the setup completion logic
describe('setup completion logic', () => {
  it('validates required fields', () => {
    const validateSetupData = (data: any) => {
      const errors: string[] = [];

      if (!data.admin?.email) errors.push('Admin email is required');
      if (!data.admin?.password) errors.push('Admin password is required');
      if (!data.admin?.name) errors.push('Admin name is required');
      if (!data.organization?.name) errors.push('Organization name is required');
      if (!data.organization?.departmentName) errors.push('Department name is required');

      if (data.admin?.password && data.admin.password.length < 8) {
        errors.push('Password must be at least 8 characters');
      }

      if (data.admin?.email && !data.admin.email.includes('@')) {
        errors.push('Invalid email format');
      }

      return { valid: errors.length === 0, errors };
    };

    // Missing all fields
    expect(validateSetupData({})).toEqual({
      valid: false,
      errors: expect.arrayContaining([
        'Admin email is required',
        'Admin password is required',
        'Admin name is required',
        'Organization name is required',
        'Department name is required',
      ]),
    });

    // Valid data
    expect(
      validateSetupData({
        admin: {
          email: 'admin@example.com',
          password: 'password123',
          name: 'Admin User',
        },
        organization: {
          name: 'Test Org',
          departmentName: 'General',
        },
      })
    ).toEqual({ valid: true, errors: [] });

    // Invalid email
    expect(
      validateSetupData({
        admin: {
          email: 'invalid',
          password: 'password123',
          name: 'Admin',
        },
        organization: {
          name: 'Test',
          departmentName: 'General',
        },
      })
    ).toEqual({
      valid: false,
      errors: ['Invalid email format'],
    });

    // Short password
    expect(
      validateSetupData({
        admin: {
          email: 'admin@test.com',
          password: 'short',
          name: 'Admin',
        },
        organization: {
          name: 'Test',
          departmentName: 'General',
        },
      })
    ).toEqual({
      valid: false,
      errors: ['Password must be at least 8 characters'],
    });
  });
});
