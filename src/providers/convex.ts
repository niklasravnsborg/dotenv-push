import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { $ } from 'zx';
import {
  ConfigError,
  ConvexApiError,
  type ConvexPushOptions,
} from '../types/index.js';
import { prompt } from '../utils/input.js';

// Suppress zx default verbose output
$.verbose = false;

// Silence npm warnings (e.g. about pnpm-specific .npmrc keys) in npx output
const run = $({ env: { ...process.env, npm_config_loglevel: 'error' } });

/**
 * Read a variable the way the Convex CLI does: process env first,
 * then .env.local, then .env
 */
function readConvexEnvVar(name: string): string | undefined {
  if (process.env[name]) {
    return process.env[name];
  }
  for (const file of ['.env.local', '.env']) {
    const value = existsSync(file)
      ? parse(readFileSync(file, 'utf-8'))[name]
      : undefined;
    if (value) {
      return value;
    }
  }
  return undefined;
}

/**
 * Ask the Convex CLI which deployment it will target, so aliases like `prod`
 * and the CONVEX_DEPLOYMENT default resolve to the actual deployment name
 * @returns The deployment name, or undefined if it can't be resolved
 */
async function resolveDeploymentName(
  deploymentArgs: string[]
): Promise<string | undefined> {
  try {
    const { stdout } =
      await run`npx convex dashboard --no-open ${deploymentArgs}`;
    const name = stdout.match(/\/d\/([\w-]+)/)?.[1];
    if (name) {
      return name;
    }
    // Self-hosted deployments have no name and no cloud dashboard URL
    const selfHostedUrl = readConvexEnvVar('CONVEX_SELF_HOSTED_URL');
    return selfHostedUrl && `self-hosted (${selfHostedUrl})`;
  } catch {
    // The env list call below reports the actual error
    return undefined;
  }
}

/**
 * Deploy environment variables to Convex deployment
 * Uses the Convex CLI via zx shell to manage environment variables
 * @param options Configuration for the deployment
 * @throws {ConfigError} When configuration is invalid
 * @throws {ConvexApiError} When Convex CLI calls fail
 */
export async function pushToConvex(options: ConvexPushOptions): Promise<void> {
  const { envVars, skipConfirmation, deploymentName } = options;

  if (Object.keys(envVars).length === 0) {
    throw new ConfigError('No environment variables provided');
  }

  console.log(`Found ${Object.keys(envVars).length} environment variables`);

  // zx expands arrays into separate, individually quoted arguments
  const deploymentArgs = deploymentName ? ['--deployment', deploymentName] : [];

  const resolvedName = await resolveDeploymentName(deploymentArgs);
  console.log(
    `Target Convex deployment: ${resolvedName ?? deploymentName ?? 'unknown'}`
  );

  try {
    // Get current environment variables from Convex
    console.log('Fetching current environment variables from Convex...');

    let currentEnvOutput: string;
    try {
      const listResult = await run`npx convex env list ${deploymentArgs}`;
      currentEnvOutput = listResult.stdout;
    } catch (error: unknown) {
      const stderr = error instanceof Error ? error.message : String(error);
      // Check if it's an auth error or other configuration issue
      if (stderr.includes('not logged in') || stderr.includes('auth')) {
        throw new ConfigError(
          'Not logged in to Convex. Run `npx convex login` first.'
        );
      }
      if (stderr.includes('No convex.json')) {
        throw new ConfigError(
          'No convex.json found. Make sure you are in a Convex project directory.'
        );
      }
      throw new ConvexApiError(
        `Failed to list environment variables: ${stderr}`
      );
    }
    const currentEnvLines = currentEnvOutput
      .split('\n')
      .filter((line: string) => line.includes('='));
    const currentEnvKeys = new Set(
      currentEnvLines.map((line: string) => line.split('=')[0].trim())
    );
    const newEnvKeys = new Set(Object.keys(envVars));

    // Calculate which keys to remove (exist in current but not in new)
    const keysToRemove = [...currentEnvKeys].filter(
      key => key && !newEnvKeys.has(key)
    );

    // Calculate which keys will be added/updated
    const keysToSet = Object.keys(envVars);

    console.log(`Current environment variables: ${currentEnvKeys.size}`);
    console.log(`Variables to remove: ${keysToRemove.length}`);
    console.log(`Variables to set: ${keysToSet.length}`);

    // Confirm before proceeding
    if (!skipConfirmation) {
      console.log('\nThe following changes will be made:');

      if (keysToRemove.length > 0) {
        console.log('\nVariables to be REMOVED:');
        keysToRemove.forEach(key => {
          console.log(`  - ${key}`);
        });
      }

      console.log('\nVariables to be SET (created or updated):');
      keysToSet.forEach(key => {
        const action = currentEnvKeys.has(key) ? 'update' : 'create';
        console.log(`  - ${key} (${action})`);
      });

      const confirmation = await prompt(
        '\nProceed with deployment? (yes/no): '
      );
      if (confirmation.toLowerCase() !== 'yes') {
        console.log('Operation cancelled.');
        return;
      }
    }

    // First, set all new environment variables
    // This ensures required vars are updated before any removals
    console.log('Setting environment variables...');
    for (const [key, value] of Object.entries(envVars)) {
      try {
        await run`npx convex env set ${key} ${value} ${deploymentArgs}`;
        const action = currentEnvKeys.has(key) ? 'Updated' : 'Created';
        console.log(`${action} ${key}`);
      } catch (error: unknown) {
        const stderr = error instanceof Error ? error.message : String(error);
        throw new ConvexApiError(`Failed to set ${key}: ${stderr}`);
      }
    }

    // Then, remove variables that are no longer needed
    if (keysToRemove.length > 0) {
      console.log('Removing old environment variables...');
      for (const key of keysToRemove) {
        try {
          await run`npx convex env remove ${key} ${deploymentArgs}`;
          console.log(`Removed ${key}`);
        } catch (error: unknown) {
          const stderr = error instanceof Error ? error.message : String(error);
          // Check if this is a required env var error
          if (stderr.includes('is used in') || stderr.includes('config file')) {
            console.warn(
              `Warning: Cannot remove ${key} - it is required by Convex config`
            );
          } else {
            console.warn(`Warning: Failed to remove ${key}: ${stderr}`);
          }
        }
      }
    }

    console.log('Environment variables successfully deployed to Convex!');
    console.log(`Total variables set: ${keysToSet.length}`);
    if (keysToRemove.length > 0) {
      console.log(`Total variables removed: ${keysToRemove.length}`);
    }
  } catch (error) {
    if (error instanceof ConfigError || error instanceof ConvexApiError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new ConvexApiError(
      `Failed to deploy to Convex: ${message}`,
      error instanceof Error ? error : undefined
    );
  }
}
