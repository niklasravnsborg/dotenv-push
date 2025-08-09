/**
 * Type definitions for test mocks
 */

import type { EnvVars } from './index.js';

/** Mock implementation of Vercel SDK project methods */
export interface MockVercelProjects {
  filterProjectEnvs: (args: unknown) => Promise<unknown>;
  removeProjectEnv: (args: unknown) => Promise<unknown>;
  createProjectEnv: (args: unknown) => Promise<unknown>;
}

/** Mock Vercel SDK constructor */
export interface MockVercelConstructor {
  new (config: {
    bearerToken: string;
  }): {
    projects: MockVercelProjects;
  };
}

/** Test data for environment variables */
export interface TestEnvData {
  encrypted: EnvVars;
  decrypted: EnvVars;
  mixed: {
    STRING_VAL: string;
    NUMBER_VAL: number;
    BOOLEAN_VAL: boolean;
    NULL_VAL: null;
  };
}

/** Mock dotenv parse function type */
export type MockDotenvParse = (content: string) => EnvVars;

/** Process mock types */
export interface MockProcess {
  exit: (code?: number) => never | void;
}

/** Console mock types */
export interface MockConsole {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** Standard input mock for testing prompts */
export interface MockStdin {
  resume: () => void;
  setEncoding: (encoding: string) => void;
  on: (event: string, callback: (data: string) => void) => void;
  pause: () => void;
}

/** Test fixtures and sample data */
export const TEST_FIXTURES = {
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
