import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { EnvLoadError, type EnvVars } from '../types/index.js';

/**
 * Load environment variables from a .env file
 * @param envFile Path to the environment file
 * @returns Promise resolving to environment variables
 * @throws {EnvLoadError} When file cannot be loaded or parsed
 */
export function loadEnvVars(envFile: string): Promise<EnvVars> {
  return Promise.resolve().then(() => {
    try {
      const envContent = readFileSync(envFile, 'utf-8');
      const parsed = parse(envContent);

      // Ensure all values are strings
      const typedEnvVars: EnvVars = {};
      for (const [key, value] of Object.entries(parsed)) {
        typedEnvVars[key] = String(value);
      }

      return typedEnvVars;
    } catch (error) {
      if (error instanceof EnvLoadError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new EnvLoadError(
        `Error loading environment variables: ${message}`,
        envFile,
        error instanceof Error ? error : undefined
      );
    }
  });
}

/**
 * Parse environment variables from stdin
 * @param input The stdin input string
 * @returns Parsed environment variables
 */
export function parseEnvFromStdin(input: string): EnvVars {
  const parsed = parse(input);

  // Ensure all values are strings
  const typedEnvVars: EnvVars = {};
  for (const [key, value] of Object.entries(parsed)) {
    typedEnvVars[key] = String(value);
  }

  return typedEnvVars;
}
