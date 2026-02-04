import fs from 'fs';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'config', 'system-settings.json');

export interface SystemSettings {
  organization: {
    name: string;
    logo: string | null;
  };
  security: {
    passwordPolicy: {
      enabled: boolean;
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
      preventReuse: number;
    };
    sessionTimeout: {
      enabled: boolean;
      inactivityMinutes: number;
    };
  };
  purchaseOrders: {
    numberPrefix: string;
    resetCounterYearly: boolean;
  };
  fiscalYear: {
    startMonth: number; // 1-12
  };
  auditLog: {
    retentionMonths: number; // 0 = keep forever
  };
  ai: {
    provider: 'anthropic' | 'openai' | 'none';
    anthropic: {
      apiKey: string;
      model: string;
    };
    openai: {
      apiKey: string;
      model: string;
    };
  };
  email: {
    provider: 'gmail' | 'office365' | 'smtp' | 'none';
    gmail: {
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    };
    office365: {
      clientId: string;
      clientSecret: string;
      tenantId: string;
      refreshToken: string;
    };
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
      fromAddress: string;
    };
    receiptForwarding: {
      enabled: boolean;
      forwardingAddress: string;
    };
  };
}

/**
 * Get current system settings
 */
export function getSettings(): SystemSettings {
  try {
    const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading settings file:', error);
    // Return default settings if file doesn't exist
    return getDefaultSettings();
  }
}

/**
 * Update system settings
 */
export function updateSettings(settings: SystemSettings): void {
  try {
    // Ensure config directory exists
    const configDir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Write settings to file
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing settings file:', error);
    throw new Error('Failed to update settings');
  }
}

/**
 * Get default settings
 */
export function getDefaultSettings(): SystemSettings {
  return {
    organization: {
      name: 'ITS Business Core',
      logo: null,
    },
    security: {
      passwordPolicy: {
        enabled: true,
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: false,
        preventReuse: 0,
      },
      sessionTimeout: {
        enabled: false,
        inactivityMinutes: 30,
      },
    },
    purchaseOrders: {
      numberPrefix: 'PO-',
      resetCounterYearly: true,
    },
    fiscalYear: {
      startMonth: 1,
    },
    auditLog: {
      retentionMonths: 0,
    },
    ai: {
      provider: 'none',
      anthropic: {
        apiKey: '',
        model: 'claude-sonnet-4-20250514',
      },
      openai: {
        apiKey: '',
        model: 'gpt-4o',
      },
    },
    email: {
      provider: 'none',
      gmail: {
        clientId: '',
        clientSecret: '',
        refreshToken: '',
      },
      office365: {
        clientId: '',
        clientSecret: '',
        tenantId: '',
        refreshToken: '',
      },
      smtp: {
        host: '',
        port: 587,
        secure: false,
        username: '',
        password: '',
        fromAddress: '',
      },
      receiptForwarding: {
        enabled: false,
        forwardingAddress: '',
      },
    },
  };
}

/**
 * Validate password against current policy
 */
export function validatePassword(
  password: string
): { valid: boolean; errors: string[] } {
  const settings = getSettings();
  const policy = settings.security.passwordPolicy;

  if (!policy.enabled) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (policy.requireSymbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one symbol');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get password policy requirements as human-readable string
 */
export function getPasswordRequirements(): string[] {
  const settings = getSettings();
  const policy = settings.security.passwordPolicy;

  if (!policy.enabled) {
    return ['No password policy requirements'];
  }

  const requirements: string[] = [];

  requirements.push(`At least ${policy.minLength} characters`);
  if (policy.requireUppercase) requirements.push('At least one uppercase letter');
  if (policy.requireLowercase) requirements.push('At least one lowercase letter');
  if (policy.requireNumbers) requirements.push('At least one number');
  if (policy.requireSymbols) requirements.push('At least one symbol');
  if (policy.preventReuse > 0) {
    requirements.push(`Cannot reuse last ${policy.preventReuse} passwords`);
  }

  return requirements;
}
