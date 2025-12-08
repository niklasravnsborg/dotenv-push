import { $ } from 'zx';
import {
  ConfigError,
  ConvexApiError,
  type ConvexPushOptions,
} from '../types/index.js';
import { prompt } from '../utils/input.js';

// Suppress zx default verbose output
$.verbose = false;

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

  // Build deployment flag if specified
  const deploymentFlag = deploymentName ? `--deployment ${deploymentName}` : '';

  try {
    // Get current environment variables from Convex
    console.log('Fetching current environment variables from Convex...');

    let currentEnvOutput: string;
    try {
      const listResult = deploymentFlag
        ? await $`npx convex env list ${deploymentFlag}`
        : await $`npx convex env list`;
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
        if (deploymentFlag) {
          await $`npx convex env set ${key} ${value} ${deploymentFlag}`;
        } else {
          await $`npx convex env set ${key} ${value}`;
        }
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
          if (deploymentFlag) {
            await $`npx convex env remove ${key} ${deploymentFlag}`;
          } else {
            await $`npx convex env remove ${key}`;
          }
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
