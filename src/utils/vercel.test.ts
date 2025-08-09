import { beforeEach, describe, expect, it, vi } from 'bun:test';
import { readFileSync } from 'node:fs';
import { prompt } from './input.js';
import { getProjectIdFromFile, getVercelToken } from './vercel.js';

await vi.module('node:fs', () => ({
  readFileSync: vi.fn(),
}));
await vi.module('./input.js', () => ({
  prompt: vi.fn(),
}));

const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>;
const mockPrompt = prompt as unknown as ReturnType<typeof vi.fn>;

describe('Vercel Utils', () => {
  beforeEach(() => {
    (mockReadFileSync as any).mock?.reset?.();
    (mockPrompt as any).mock?.reset?.();
    delete process.env.VERCEL_TOKEN;
  });

  describe('getProjectIdFromFile', () => {
    it('should return project ID from valid .vercel/project.json', () => {
      mockReadFileSync.mockReturnValue(
        '{"projectId":"test-123","orgId":"org-456"}'
      );

      const result = getProjectIdFromFile();

      expect(result).toBe('test-123');
      expect(mockReadFileSync).toHaveBeenCalledWith(
        '.vercel/project.json',
        'utf-8'
      );
    });

    it('should throw error if projectId is missing', () => {
      mockReadFileSync.mockReturnValue('{"orgId":"org-456"}');

      expect(() => getProjectIdFromFile()).toThrow(
        'Invalid .vercel/project.json: missing or invalid projectId'
      );
    });

    it('should throw error if file cannot be read', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => getProjectIdFromFile()).toThrow(
        'Failed to read project ID from .vercel/project.json'
      );
    });

    it('should throw error if file contains invalid JSON', () => {
      mockReadFileSync.mockReturnValue('invalid json');

      expect(() => getProjectIdFromFile()).toThrow(
        'Failed to read project ID from .vercel/project.json'
      );
    });
  });

  describe('getVercelToken', () => {
    it('should return token from argument if provided', async () => {
      const result = await getVercelToken('arg-token');

      expect(result).toBe('arg-token');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should return token from environment variable', async () => {
      process.env.VERCEL_TOKEN = 'env-token';

      const result = await getVercelToken();

      expect(result).toBe('env-token');
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should prompt for token if not provided', async () => {
      mockPrompt.mockResolvedValue('prompted-token');

      const result = await getVercelToken();

      expect(result).toBe('prompted-token');
      expect(mockPrompt).toHaveBeenCalledWith('Enter your Vercel token: ');
    });

    it('should prefer argument over environment variable', async () => {
      process.env.VERCEL_TOKEN = 'env-token';

      const result = await getVercelToken('arg-token');

      expect(result).toBe('arg-token');
    });
  });
});
