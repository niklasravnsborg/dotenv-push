import { Vercel } from '@vercel/sdk';
import {
  CreateProjectEnv11,
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

const KNOWN_VERCEL_TARGETS = ['production', 'preview', 'development'] as const;

/**
 * Deploy environment variables to a Vercel environment
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
    const environmentTarget = options.target;
    const normalizedTarget = environmentTarget.toLowerCase();
    const isKnownTarget = KNOWN_VERCEL_TARGETS.includes(
      normalizedTarget as (typeof KNOWN_VERCEL_TARGETS)[number]
    );
    if (Object.keys(envVars).length === 0) {
      throw new ConfigError('No environment variables provided');
    }

    console.log(`Found ${Object.keys(envVars).length} environment variables`);

    let customEnvironmentId: string | undefined;
    if (!isKnownTarget) {
      console.log(
        `Fetching custom environments for project ${projectId} matching target "${environmentTarget}"...`
      );
      const customEnvironments =
        await vercel.environment.getV9ProjectsIdOrNameCustomEnvironments({
          idOrName: projectId,
        });

      const match = (customEnvironments.environments || []).find(
        env => env.slug?.toLowerCase() === normalizedTarget
      );
      customEnvironmentId = match?.id;

      if (!customEnvironmentId) {
        throw new ConfigError(
          `Custom environment "${environmentTarget}" not found for project ${projectId}`
        );
      }

      console.log(
        `Using custom environment "${environmentTarget}" with id ${customEnvironmentId}`
      );
    }

    // Get current environment variables from Vercel
    console.log(
      `Fetching current ${environmentTarget} environment variables for project ${projectId}...`
    );
    const currentEnvs = (await vercel.projects.filterProjectEnvs({
      idOrName: projectId,
    })) as FilterProjectEnvsResponseBody3;

    const targetEnvs = (currentEnvs.envs || []).filter(env => {
      if (isKnownTarget) {
        if (!Array.isArray(env.target)) {
          return false;
        }

        return env.target
          .map(t => String(t).toLowerCase())
          .includes(normalizedTarget);
      }

      if (
        customEnvironmentId &&
        Array.isArray(env.customEnvironmentIds) &&
        env.customEnvironmentIds.includes(customEnvironmentId)
      ) {
        return true;
      }

      return false;
    });

    console.log(
      `Current ${environmentTarget} environment variables: ${targetEnvs.length}`
    );

    // Confirm before proceeding with reset
    if (!options.skipConfirmation) {
      console.log(
        `\nThis will reset ALL ${environmentTarget} environment variables for the project.`
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

    // Delete existing environment variables if any
    if (targetEnvs.length > 0) {
      console.log(
        `Deleting existing ${environmentTarget} environment variables...`
      );
      for (const env of targetEnvs) {
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
    const requestBody = Object.entries(envVars).map<
      CreateProjectEnv11 | CreateProjectEnv12
    >(([key, value]) => {
      const isSecret =
        key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN');

      if (isKnownTarget) {
        return {
          key,
          value: String(value),
          target: [normalizedTarget] as unknown as OneTarget[],
          type: isSecret ? 'encrypted' : 'plain',
        } satisfies CreateProjectEnv11;
      }

      if (!customEnvironmentId) {
        throw new ConfigError(
          `Custom environment "${environmentTarget}" not found for project ${projectId}`
        );
      }

      return {
        key,
        value: String(value),
        type: isSecret ? 'encrypted' : 'plain',
        customEnvironmentIds: [customEnvironmentId],
      } satisfies CreateProjectEnv12;
    });

    const _addResponse = await vercel.projects.createProjectEnv({
      idOrName: projectId,
      upsert: 'true',
      requestBody,
    });

    console.log(
      `Environment variables successfully deployed to Vercel ${environmentTarget} environment!`
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
