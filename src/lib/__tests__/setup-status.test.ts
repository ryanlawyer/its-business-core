import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { isSetupComplete, markSetupComplete } from '../setup-status';
import { prisma } from '@/lib/prisma';

describe('setup-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isSetupComplete', () => {
    it('returns false when setup_complete record does not exist', async () => {
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue(null);

      const result = await isSetupComplete();

      expect(result).toBe(false);
      expect(prisma.systemConfig.findUnique).toHaveBeenCalledWith({
        where: { key: 'setup_complete' },
      });
    });

    it('returns true when setup_complete record exists with value "true"', async () => {
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue({
        id: '1',
        key: 'setup_complete',
        value: 'true',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await isSetupComplete();

      expect(result).toBe(true);
    });

    it('returns false when setup_complete record exists with value "false"', async () => {
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue({
        id: '1',
        key: 'setup_complete',
        value: 'false',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await isSetupComplete();

      expect(result).toBe(false);
    });
  });

  describe('markSetupComplete', () => {
    it('upserts setup_complete record with value "true"', async () => {
      vi.mocked(prisma.systemConfig.upsert).mockResolvedValue({
        id: '1',
        key: 'setup_complete',
        value: 'true',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await markSetupComplete();

      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'setup_complete' },
        update: { value: 'true' },
        create: { key: 'setup_complete', value: 'true' },
      });
    });
  });
});
