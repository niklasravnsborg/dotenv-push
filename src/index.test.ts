import { beforeEach, describe, expect, it, mock, vi } from 'bun:test';
import { parseArgs } from 'node:util';
import { isSupportedProvider, SUPPORTED_PROVIDERS } from './types/index.js';

// Mock the dependencies
const mockPushToVercel = mock();
await mock.module('./providers/vercel.js', () => ({
  pushToVercel: mockPushToVercel,
}));

describe('CLI Argument Parsing', () => {
  beforeEach(() => {
    mockPushToVercel.mockReset();
  });

  describe('parseArgs functionality', () => {
    it('should parse help flag correctly', () => {
      const { values } = parseArgs({
        args: ['--help'],
        options: {
          help: { type: 'boolean', short: 'h', default: false },
        },
        allowPositionals: true,
      });

      expect(values.help).toBe(true);
    });

    it('should parse vercel with all options', () => {
      const { values, positionals } = parseArgs({
        args: [
          'vercel',
          '--project',
          'test-proj',
          '--token',
          'test-token',
          '--env',
          '.env.staging',
          '--yes',
        ],
        options: {
          project: { type: 'string', short: 'p' },
          token: { type: 'string', short: 't' },
          env: { type: 'string', short: 'e', default: '.env.production' },
          yes: { type: 'boolean', short: 'y', default: false },
        },
        allowPositionals: true,
      });

      expect(positionals[0]).toBe('vercel');
      expect(values.project).toBe('test-proj');
      expect(values.token).toBe('test-token');
      expect(values.env).toBe('.env.staging');
      expect(values.yes).toBe(true);
    });

    it('should use default values when not provided', () => {
      const { values } = parseArgs({
        args: ['vercel'],
        options: {
          env: { type: 'string', short: 'e', default: '.env.production' },
          yes: { type: 'boolean', short: 'y', default: false },
        },
        allowPositionals: true,
      });

      expect(values.env).toBe('.env.production');
      expect(values.yes).toBe(false);
    });

    it('should handle short flags', () => {
      const { values } = parseArgs({
        args: ['-p', 'proj', '-t', 'token', '-e', '.env.test', '-y'],
        options: {
          project: { type: 'string', short: 'p' },
          token: { type: 'string', short: 't' },
          env: { type: 'string', short: 'e' },
          yes: { type: 'boolean', short: 'y' },
        },
        allowPositionals: true,
      });

      expect(values.project).toBe('proj');
      expect(values.token).toBe('token');
      expect(values.env).toBe('.env.test');
      expect(values.yes).toBe(true);
    });
  });

  describe('Provider validation logic', () => {
    it('should accept vercel as valid provider', () => {
      const provider = 'vercel';
      expect(isSupportedProvider(provider)).toBe(true);
      expect(SUPPORTED_PROVIDERS.includes('vercel')).toBe(true);
    });

    it('should reject unsupported providers', () => {
      const provider = 'unsupported';
      expect(isSupportedProvider(provider)).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(isSupportedProvider(null)).toBe(false);
      expect(isSupportedProvider(undefined)).toBe(false);
      expect(isSupportedProvider(42)).toBe(false);
      expect(isSupportedProvider({})).toBe(false);
    });
  });
});
