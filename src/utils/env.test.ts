import { beforeEach, describe, expect, it, type Mock, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import * as dotenv from 'dotenv';
import { createTestEnvData, setupTestEnv } from '../test-utils/test-helpers.js';
import type { EnvVars } from '../types/index.js';
import { loadEnvVars, parseEnvFromStdin } from './env.js';

await mock.module('node:fs', () => ({
  readFileSync: mock(),
}));
await mock.module('dotenv', () => ({
  parse: mock(),
}));

const mockReadFileSync = readFileSync as unknown as Mock<typeof readFileSync>;
const mockParse = dotenv.parse as unknown as Mock<(content: string) => EnvVars>;

describe('Environment Utils', () => {
  beforeEach(() => {
    (mockReadFileSync as any).mock?.reset?.();
    (mockParse as any).mock?.reset?.();
    setupTestEnv();
  });

  describe('loadEnvVars', () => {
    it('should load .env.production successfully', async () => {
      const testData = createTestEnvData();
      const fileContent = 'API_KEY=test-api-key\nDB_URL=test-db-url';

      mockReadFileSync.mockReturnValue(fileContent);
      mockParse.mockReturnValue(testData.decrypted);

      const result = await loadEnvVars('.env.production');

      expect(result).toEqual(testData.decrypted);
      expect(mockReadFileSync).toHaveBeenCalledWith('.env.production', 'utf-8');
      expect(mockParse).toHaveBeenCalledWith(fileContent);
    });

    it('should handle custom environment file names', async () => {
      const fileContent = 'API_KEY=staging-value';
      mockReadFileSync.mockReturnValue(fileContent);
      mockParse.mockReturnValue({ API_KEY: 'staging-value' });

      const result = await loadEnvVars('.env.staging');

      expect(result).toEqual({ API_KEY: 'staging-value' });
      expect(mockReadFileSync).toHaveBeenCalledWith('.env.staging', 'utf-8');
    });

    it('should handle empty files', async () => {
      mockReadFileSync.mockReturnValue('');
      mockParse.mockReturnValue({});

      const result = await loadEnvVars('.env');

      expect(result).toEqual({});
    });

    it('should throw error if file cannot be read', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(loadEnvVars('.env.production')).rejects.toThrow(
        'Error loading environment variables: File not found'
      );
    });

    it('should convert all values to strings', async () => {
      const fileContent = 'STRING_VAL=string\nNUMBER_VAL=42';
      mockReadFileSync.mockReturnValue(fileContent);
      mockParse.mockReturnValue({
        STRING_VAL: 'string',
        NUMBER_VAL: '42',
      });

      const result = await loadEnvVars('.env.production');

      expect(result).toEqual({
        STRING_VAL: 'string',
        NUMBER_VAL: '42',
      });
    });
  });

  describe('parseEnvFromStdin', () => {
    it('should parse environment variables from stdin input', () => {
      const input = 'API_KEY=test-key\nDB_URL=test-url';
      const expectedOutput = {
        API_KEY: 'test-key',
        DB_URL: 'test-url',
      };

      mockParse.mockReturnValue(expectedOutput);

      const result = parseEnvFromStdin(input);

      expect(result).toEqual(expectedOutput);
      expect(mockParse).toHaveBeenCalledWith(input);
    });

    it('should handle empty input', () => {
      mockParse.mockReturnValue({});

      const result = parseEnvFromStdin('');

      expect(result).toEqual({});
    });

    it('should convert all values to strings', () => {
      const input = 'KEY1=value1\nKEY2=value2';
      mockParse.mockReturnValue({
        KEY1: 'value1',
        KEY2: 'value2',
      });

      const result = parseEnvFromStdin(input);

      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
      });
    });
  });
});
