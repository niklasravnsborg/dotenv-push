/**
 * Runtime validation schemas using Zod (minimal surface)
 */

import { z } from 'zod';
import { ConfigError, SUPPORTED_PROVIDERS } from '../types/index.js';

/** Schema for CLI arguments */
export const CliArgsSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
  project: z.string().optional(),
  token: z.string().optional(),
  env: z.string().default('.env.production'),
  target: z.string().default('production'),
  yes: z.boolean().default(false),
  help: z.boolean().default(false),
});

/**
 * Validate CLI arguments with detailed error messages
 */
export function validateCliArgs(args: unknown): z.infer<typeof CliArgsSchema> {
  try {
    return CliArgsSchema.parse(args);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(
        e => `${e.path.join('.')}: ${e.message}`
      );
      throw new ConfigError(
        `Invalid CLI arguments:\n  ${messages.join('\n  ')}`
      );
    }
    throw error;
  }
}
