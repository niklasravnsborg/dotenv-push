import { readFileSync } from 'node:fs';
import { ConfigError, isVercelProjectConfig } from '../types/index.js';
import { prompt } from './input.js';

/**
 * Get Vercel token from arguments, environment, or user prompt
 * @param tokenArg Optional token from command line
 * @returns Promise resolving to Vercel token
 */
export async function getVercelToken(tokenArg?: string): Promise<string> {
  // Use token from arguments if provided
  if (tokenArg) return tokenArg;

  // Try to get token from environment
  const envToken = process.env.VERCEL_TOKEN;
  if (envToken) return envToken;

  // Prompt for token if not found
  return prompt('Enter your Vercel token: ');
}

/**
 * Get Vercel project ID from .vercel/project.json file
 * @returns Project ID string
 * @throws {ConfigError} When file cannot be read or is invalid
 */
export function getProjectIdFromFile(): string {
  try {
    const fileContent = readFileSync('.vercel/project.json', 'utf-8');
    const projectConfig: unknown = JSON.parse(fileContent);

    if (!isVercelProjectConfig(projectConfig)) {
      throw new ConfigError(
        'Invalid .vercel/project.json: missing or invalid projectId'
      );
    }

    return projectConfig.projectId;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(
      `Failed to read project ID from .vercel/project.json: ${message}`,
      error instanceof Error ? error : undefined
    );
  }
}
