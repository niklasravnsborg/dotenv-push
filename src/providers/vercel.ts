import { Vercel } from '@vercel/sdk';
import {
  CreateProjectEnv12,
  OneTarget,
} from '@vercel/sdk/models/createprojectenvop.js';
import { FilterProjectEnvsResponseBody3 } from '@vercel/sdk/models/filterprojectenvsop.js';
import {
  ConfigError,
  VercelApiError,
  type VercelPushOptions,
} from '../types/index.js';
import { prompt } from '../utils/input.js';
import { getProjectIdFromFile, getVercelToken } from '../utils/vercel.js';

/**
 * Deploy environment variables to Vercel production environment
 * @param options Configuration for the deployment
 * @throws {ConfigError} When configuration is invalid
 * @throws {VercelApiError} When Vercel API calls fail
 */
export async function pushToVercel(options: VercelPushOptions): Promise<void> {
  // Get project ID from command line or from .vercel/project.json
  let projectId = options.projectId;

  if (!projectId) {
    try {
      projectId = getProjectIdFromFile();
      console.log(`Using project ID from .vercel/project.json: ${projectId}`);
    } catch (error) {
      throw new ConfigError(
        'Project ID is required. Use --project/-p flag or ensure .vercel/project.json exists.',
        error instanceof Error ? error : undefined
      );
    }
  }

  // Get Vercel token (from args, env, or prompt)
  const token = await getVercelToken(options.token);
  if (!token) {
    throw new ConfigError('Vercel token is required.');
  }

  // Initialize Vercel client
  const vercel = new Vercel({ bearerToken: token });

  try {
    // Use environment variables passed in options
    const envVars = options.envVars;
    if (Object.keys(envVars).length === 0) {
      throw new ConfigError('No environment variables provided');
    }

    console.log(`Found ${Object.keys(envVars).length} environment variables`);

    // Get current environment variables from Vercel
    console.log(
      `Fetching current environment variables for project ${projectId}...`
    );
    const currentEnvs = (await vercel.projects.filterProjectEnvs({
      idOrName: projectId,
    })) as FilterProjectEnvsResponseBody3;

    const productionEnvs = (currentEnvs.envs || []).filter(env =>
      Array.isArray(env.target)
        ? env.target.includes('production' as OneTarget)
        : false
    );

    console.log(
      `Current production environment variables: ${productionEnvs.length}`
    );

    // Confirm before proceeding with reset
    if (!options.skipConfirmation) {
      console.log(
        '\nThis will reset ALL production environment variables for the project.'
      );
      console.log('The following variables will be deployed:');
      Object.keys(envVars).forEach(key => {
        console.log(`- ${key}`);
      });

      const confirmation = await prompt(
        '\nProceed with reset and deployment? (yes/no): '
      );
      if (confirmation.toLowerCase() !== 'yes') {
        console.log('Operation cancelled.');
        return;
      }
    }

    // Delete existing production environment variables if any
    if (productionEnvs.length > 0) {
      console.log('Deleting existing production environment variables...');
      for (const env of productionEnvs) {
        if (env.id) {
          await vercel.projects.removeProjectEnv({
            idOrName: projectId,
            id: env.id,
          });
          console.log(`Deleted ${env.key}`);
        }
      }
    }

    // Create new environment variables
    console.log('Deploying new environment variables...');
    const requestBody = Object.entries(envVars).map(([key, value]) => ({
      key,
      value: String(value),
      target: ['production'] as OneTarget[],
      type:
        key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN')
          ? 'encrypted'
          : 'plain',
    })) as CreateProjectEnv12[];

    const _addResponse = await vercel.projects.createProjectEnv({
      idOrName: projectId,
      upsert: 'true',
      requestBody,
    });

    console.log(
      'Environment variables successfully deployed to Vercel production environment!'
    );
    console.log(`Total variables deployed: ${Object.keys(envVars).length}`);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new VercelApiError(
      `Failed to deploy to Vercel: ${message}`,
      error instanceof Error ? error : undefined
    );
  }
}
