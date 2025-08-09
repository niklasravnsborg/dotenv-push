/**
 * Test utilities and helpers for consistent testing patterns
 */

import { vi } from 'bun:test';
import type {
  MockDotenvParse,
  MockStdin,
  MockVercelConstructor,
} from '../types/mocks.js';

/**
 * Create a properly typed mock for the Vercel SDK
 */
export function createMockVercel(): MockVercelConstructor {
  class VercelMock {
    projects = {
      filterProjectEnvs: vi.fn(async (_args?: unknown) => undefined),
      removeProjectEnv: vi.fn(async (_args?: unknown) => undefined),
      createProjectEnv: vi.fn(async (_args?: unknown) => undefined),
    };
    constructor(_config: { bearerToken: string }) {
      /* noop: constructor present to match SDK shape */
    }
  }
  return VercelMock as unknown as MockVercelConstructor;
}

/**
 * Create a mock for dotenv.parse with proper typing
 */
export function createMockDotenvParse(): MockDotenvParse {
  return vi.fn() as unknown as MockDotenvParse;
}

/**
 * Create a mock stdin for testing prompts
 */
export function createMockStdin(): MockStdin {
  return {
    resume: vi.fn(),
    setEncoding: vi.fn(),
    on: vi.fn(),
    pause: vi.fn(),
  };
}

/**
 * Mock process.stdout.write for testing output
 */
export function mockStdoutWrite() {
  return vi.fn() as unknown as typeof process.stdout.write;
}

/**
 * Set up environment variables for tests
 */
export function setupTestEnv(
  overrides: Record<string, string | undefined> = {}
): void {
  // Clear VERCEL_TOKEN
  delete process.env.VERCEL_TOKEN;

  // Apply overrides
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
}

/**
 * Create test data for environment variables with proper typing
 */
export function createTestEnvData() {
  return {
    encrypted: {
      API_KEY: 'encrypted:abc123',
      DB_URL: 'encrypted:def456',
    },
    decrypted: {
      API_KEY: 'decrypted-api-key',
      DB_URL: 'decrypted-db-url',
    },
    mixed: {
      STRING_VAL: 'string',
      NUMBER_VAL: '42',
      BOOLEAN_VAL: 'true',
      NULL_VAL: 'null',
    } as Record<string, string>,
  };
}

/**
 * Assert that a function throws with proper error typing
 */
export async function expectToThrow<T extends Error>(
  fn: () => Promise<void> | void,
  errorClass?: new (...args: unknown[]) => T,
  message?: string | RegExp
): Promise<T> {
  let error: Error | undefined;

  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  if (!error) {
    throw new Error('Expected function to throw but it did not');
  }

  if (errorClass && !(error instanceof errorClass)) {
    throw new Error(
      `Expected error to be instance of ${errorClass.name} but got ${error.constructor.name}`
    );
  }

  if (message) {
    if (typeof message === 'string') {
      if (!error.message.includes(message)) {
        throw new Error(
          `Expected error message to contain "${message}" but got "${error.message}"`
        );
      }
    } else {
      if (!message.test(error.message)) {
        throw new Error(
          `Expected error message to match ${message} but got "${error.message}"`
        );
      }
    }
  }

  return error as T;
}

/**
 * Common test fixtures with proper typing
 */
export const testFixtures = {
  vercelProjectConfig: {
    projectId: 'test-project-123',
    orgId: 'test-org-456',
  },
  envData: {
    production: {
      API_KEY: 'decrypted-api-key',
      DB_URL: 'decrypted-db-url',
    },
    staging: {
      API_KEY: 'staging-api-key',
      DB_URL: 'staging-db-url',
    },
  },
  encryptedContent: 'API_KEY=encrypted:abc123\nDB_URL=encrypted:def456',
} as const;
