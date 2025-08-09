/**
 * Core type definitions for dotenv-push CLI tool
 */

/** Supported providers for environment variable deployment */
export const SUPPORTED_PROVIDERS = ['vercel'] as const;
export type Provider = (typeof SUPPORTED_PROVIDERS)[number];

/** CLI command line arguments interface */
export interface CliArgs {
  provider: Provider;
  project?: string;
  token?: string;
  env: string;
  yes: boolean;
  help: boolean;
}

/** Options for pushing to Vercel */
export interface VercelPushOptions {
  projectId?: string;
  token?: string;
  envVars: EnvVars;
  skipConfirmation: boolean;
}

/** Vercel project configuration from .vercel/project.json */
export interface VercelProjectConfig {
  projectId: string;
  orgId?: string;
}

/** Environment variables as string key-value pairs */
export type EnvVars = Record<string, string>;

/** Custom error types for better error handling */
export class DotenvPushError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DotenvPushError';
  }
}

export class VercelApiError extends DotenvPushError {
  constructor(message: string, cause?: Error) {
    super(message, 'VERCEL_API_ERROR', cause);
    this.name = 'VercelApiError';
  }
}

export class EnvLoadError extends DotenvPushError {
  constructor(
    message: string,
    public readonly envFile: string,
    cause?: Error
  ) {
    super(message, 'ENV_LOAD_ERROR', cause);
    this.name = 'EnvLoadError';
  }
}

export class ConfigError extends DotenvPushError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', cause);
    this.name = 'ConfigError';
  }
}

/** Type guard for checking if value is a supported provider */
export function isSupportedProvider(value: unknown): value is Provider {
  return (
    typeof value === 'string' && SUPPORTED_PROVIDERS.includes(value as Provider)
  );
}

/** Type guard for checking if object has required Vercel project properties */
export function isVercelProjectConfig(
  obj: unknown
): obj is VercelProjectConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'projectId' in obj &&
    typeof (obj as { projectId?: unknown }).projectId === 'string'
  );
}
