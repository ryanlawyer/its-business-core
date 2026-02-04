import { prisma } from '@/lib/prisma';

/**
 * Check if the system has completed initial setup
 */
export async function isSetupComplete(): Promise<boolean> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'setup_complete' },
    });
    return config?.value === 'true';
  } catch (error) {
    // If database doesn't exist yet, setup is not complete
    console.error('Error checking setup status:', error);
    return false;
  }
}

/**
 * Mark the system as having completed setup
 */
export async function markSetupComplete(): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: 'setup_complete' },
    update: { value: 'true' },
    create: { key: 'setup_complete', value: 'true' },
  });
}

/**
 * Get a system config value by key
 */
export async function getSystemConfig(key: string): Promise<string | null> {
  const config = await prisma.systemConfig.findUnique({
    where: { key },
  });
  return config?.value ?? null;
}

/**
 * Set a system config value
 */
export async function setSystemConfig(key: string, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
