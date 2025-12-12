#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { pushToConvex } from './providers/convex.js';
import { pushToVercel } from './providers/vercel.js';
import { validateCliArgs } from './schemas/index.js';
import {
  type CliArgs,
  ConfigError,
  isSupportedProvider,
  SUPPORTED_PROVIDERS,
} from './types/index.js';
import { loadEnvVars, parseEnvFromStdin } from './utils/env.js';

const KNOWN_VERCEL_TARGETS = ['production', 'preview', 'development'] as const;

function showHelp() {
  console.log(`
dotenv-push - Push environment variables to cloud providers

Usage:
  dotenv-push <provider> [options]
  command | dotenv-push <provider> [options]

Providers:
  vercel    Push to Vercel project
  convex    Push to Convex deployment

Options:
  -p, --project <id>     Project ID (optional for Vercel, uses .vercel/project.json)
  -d, --deployment <n>   Deployment name (for Convex, e.g., "production" or project slug)
  -t, --token <token>    Provider token (or use environment variables)
  -e, --env <file>       Environment file (defaults to .env.production)
  --target <name>        Vercel environment target ("production", "preview", "development", or custom)
  -s, --stdin            Read environment variables from stdin
  -y, --yes              Skip confirmation prompts
  -h, --help             Show this help message

Examples:
  dotenv-push vercel
  dotenv-push vercel --project abc123 --token xyz
  dotenv-push vercel --env .env.staging --yes
  cat .env | dotenv-push vercel --stdin
  dotenvx decrypt --stdout | dotenv-push vercel --stdin
  dotenv-push convex
  dotenv-push convex --deployment my-app-production

Environment Variables:
  VERCEL_TOKEN           Vercel API token
`);
}

/**
 * Read environment variables from stdin
 * @returns Promise resolving to stdin content
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', chunk => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', reject);
  });
}

/**
 * Normalize environment target for Vercel
 * - Lowercase for known defaults
 * - Preserve custom environment strings
 */
function normalizeTarget(env: string): string {
  const lower = env.toLowerCase();
  return KNOWN_VERCEL_TARGETS.includes(
    lower as (typeof KNOWN_VERCEL_TARGETS)[number]
  )
    ? lower
    : env;
}

/**
 * Parse and validate CLI arguments
 * @returns Validated CLI arguments
 * @throws {ConfigError} When arguments are invalid
 */
function parseCliArgs(): CliArgs & { stdin: boolean; deployment?: string } {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      project: { type: 'string', short: 'p' },
      deployment: { type: 'string', short: 'd' },
      token: { type: 'string', short: 't' },
      env: { type: 'string', short: 'e', default: '.env.production' },
      stdin: { type: 'boolean', short: 's', default: false },
      target: { type: 'string', default: 'production' },
      yes: { type: 'boolean', short: 'y', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  const providerInput = positionals[0];

  if (!providerInput) {
    throw new ConfigError('Provider is required');
  }

  if (!isSupportedProvider(providerInput)) {
    throw new ConfigError(
      `Unsupported provider "${providerInput}". Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`
    );
  }

  const rawArgs = {
    provider: providerInput,
    project: values.project,
    deployment: values.deployment,
    token: values.token,
    env: values.env ?? '.env.production',
    stdin: values.stdin ?? false,
    target: normalizeTarget(values.target ?? 'production'),
    yes: values.yes,
    help: values.help,
  };

  // Use Zod for additional runtime validation
  const validatedArgs = validateCliArgs(rawArgs);

  return {
    ...validatedArgs,
    stdin: rawArgs.stdin,
    deployment: rawArgs.deployment,
  };
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  try {
    const args = parseCliArgs();

    // Get environment variables either from stdin or file
    let envVars: Record<string, string>;

    if (args.stdin) {
      console.log('Reading environment variables from stdin...');
      const stdinContent = await readStdin();

      if (!stdinContent.trim()) {
        throw new ConfigError('No input received from stdin');
      }

      envVars = parseEnvFromStdin(stdinContent);
    } else {
      envVars = await loadEnvVars(args.env);
    }

    switch (args.provider) {
      case 'vercel':
        await pushToVercel({
          projectId: args.project,
          token: args.token,
          envVars,
          target: args.target,
          skipConfirmation: args.yes,
        });
        break;
      case 'convex':
        await pushToConvex({
          deploymentName: args.deployment,
          envVars,
          skipConfirmation: args.yes,
        });
        break;
      default:
        // TypeScript ensures this case is unreachable due to type guards above
        throw new ConfigError(
          `Provider "${args.provider}" is not implemented yet`
        );
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error('Error:', error.message);
      showHelp();
      process.exit(1);
    }

    console.error(
      'Error:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main().catch(console.error);
