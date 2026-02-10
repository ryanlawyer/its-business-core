import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SETTINGS_PATH = path.join(process.cwd(), 'config', 'system-settings.json');

// Encryption helpers for secrets at rest
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc:';

function getEncryptionKey(): Buffer | null {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) return null;
  return crypto.scryptSync(secret, 'settings-encryption-salt', 32);
}

function encryptValue(value: string): string {
  const key = getEncryptionKey();
  if (!key || !value) return value;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return ENCRYPTED_PREFIX + iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

function decryptValue(value: string): string {
  if (!value || !value.startsWith(ENCRYPTED_PREFIX)) return value;

  const key = getEncryptionKey();
  if (!key) return value;

  try {
    const payload = value.slice(ENCRYPTED_PREFIX.length);
    const [ivHex, tagHex, encrypted] = payload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // If decryption fails (e.g., key changed), return empty string
    return '';
  }
}

// Fields that should be encrypted at rest
const SENSITIVE_PATHS = [
  'ai.anthropic.apiKey',
  'ai.openai.apiKey',
  'ai.openrouter.apiKey',
  'ai.custom.apiKey',
  'email.gmail.clientSecret',
  'email.gmail.refreshToken',
  'email.office365.clientSecret',
  'email.office365.refreshToken',
  'email.smtp.password',
];

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((o, k) => o?.[k], obj) ?? '';
}

function setNestedValue(obj: any, path: string, value: string): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce((o, k) => o?.[k], obj);
  if (target) target[last] = value;
}

function encryptSensitiveFields(settings: SystemSettings): SystemSettings {
  const copy = JSON.parse(JSON.stringify(settings));
  for (const fieldPath of SENSITIVE_PATHS) {
    const val = getNestedValue(copy, fieldPath);
    if (val && !val.startsWith(ENCRYPTED_PREFIX)) {
      setNestedValue(copy, fieldPath, encryptValue(val));
    }
  }
  return copy;
}

function decryptSensitiveFields(settings: SystemSettings): SystemSettings {
  const copy = JSON.parse(JSON.stringify(settings));
  for (const fieldPath of SENSITIVE_PATHS) {
    const val = getNestedValue(copy, fieldPath);
    if (val && val.startsWith(ENCRYPTED_PREFIX)) {
      setNestedValue(copy, fieldPath, decryptValue(val));
    }
  }
  return copy;
}

/**
 * Redact sensitive fields for API responses (show only last 4 chars)
 */
export function redactSensitiveSettings(settings: SystemSettings): SystemSettings {
  const copy = JSON.parse(JSON.stringify(settings));
  for (const fieldPath of SENSITIVE_PATHS) {
    const val = getNestedValue(copy, fieldPath);
    if (val && typeof val === 'string' && val.length > 0) {
      const visible = val.slice(-4);
      setNestedValue(copy, fieldPath, `****${visible}`);
    }
  }
  return copy;
}

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
    provider: 'anthropic' | 'openai' | 'openrouter' | 'ollama' | 'custom' | 'none';
    anthropic: {
      apiKey: string;
      model: string;
    };
    openai: {
      apiKey: string;
      model: string;
    };
    openrouter: {
      apiKey: string;
      model: string;
    };
    ollama: {
      baseUrl: string;
      model: string;
    };
    custom: {
      apiKey: string;
      baseUrl: string;
      model: string;
    };
    features: {
      ocrEnabled: boolean;
      aiCategorizationEnabled: boolean;
      aiSummariesEnabled: boolean;
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
 * Get current system settings (decrypted)
 */
export function getSettings(): SystemSettings {
  try {
    const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(data);
    return decryptSensitiveFields(settings);
  } catch (error) {
    console.error('Error reading settings file:', error);
    // Return default settings if file doesn't exist
    return getDefaultSettings();
  }
}

/**
 * Preserve existing secrets when incoming values are redacted placeholders.
 * The UI receives redacted values like "****xQAA" and may send them back on save.
 */
function preserveRedactedSecrets(incoming: SystemSettings, existing: SystemSettings): SystemSettings {
  const merged = JSON.parse(JSON.stringify(incoming));
  for (const fieldPath of SENSITIVE_PATHS) {
    const val = getNestedValue(merged, fieldPath);
    if (typeof val === 'string' && val.startsWith('****')) {
      // Replace redacted placeholder with the real value from existing settings
      const existingVal = getNestedValue(existing, fieldPath);
      if (existingVal) {
        setNestedValue(merged, fieldPath, existingVal);
      }
    }
  }
  return merged;
}

/**
 * Update system settings (encrypts sensitive fields before writing)
 */
export function updateSettings(settings: SystemSettings): void {
  try {
    // Ensure config directory exists
    const configDir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Preserve secrets that were redacted in the UI round-trip
    const existing = getSettings();
    const merged = preserveRedactedSecrets(settings, existing);

    // Encrypt sensitive fields before writing to disk
    const encrypted = encryptSensitiveFields(merged);
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(encrypted, null, 2), 'utf-8');
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
        model: 'claude-sonnet-4-5-20250929',
      },
      openai: {
        apiKey: '',
        model: 'gpt-4o',
      },
      openrouter: {
        apiKey: '',
        model: 'anthropic/claude-sonnet-4-5',
      },
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2-vision',
      },
      custom: {
        apiKey: '',
        baseUrl: '',
        model: '',
      },
      features: {
        ocrEnabled: true,
        aiCategorizationEnabled: false,
        aiSummariesEnabled: false,
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
