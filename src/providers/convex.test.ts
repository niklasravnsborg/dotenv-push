import { describe, expect, it } from 'bun:test';
import { spawn } from 'child_process';

const CLI_PATH = 'src/index.ts';

describe('Convex Provider Integration Tests', () => {
  describe('Help Command', () => {
    it('should display convex in help output', async () => {
      const result = await runCLI(['--help']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('convex');
      expect(result.stdout).toContain('Push to Convex deployment');
    });
  });

  describe('Error Cases', () => {
    it('should show error for unsupported provider', async () => {
      const result = await runCLI(['unsupported-provider']);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain(
        'Error: Unsupported provider "unsupported-provider"'
      );
      expect(result.stderr).toContain('Supported providers: vercel, convex');
    });
  });

  describe('Convex Provider', () => {
    it('should fail gracefully when not in a Convex project', async () => {
      const result = await runCLIWithStdin(
        ['convex', '--stdin', '--yes'],
        'TEST_VAR=value'
      );

      expect(result.code).toBe(1);
      // Should fail because there's no convex.json or not logged in
      expect(
        result.stderr.includes('convex.json') ||
          result.stderr.includes('logged in') ||
          result.stderr.includes('Failed')
      ).toBe(true);
    });

    it('should fail gracefully with missing environment file', async () => {
      const result = await runCLI([
        'convex',
        '--env',
        'nonexistent.env',
        '--yes',
      ]);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('ENOENT: no such file or directory');
    });
  });

  describe('Stdin Support for Convex', () => {
    it('should read environment variables from stdin', async () => {
      const stdinData = 'TEST_KEY=test-value\nANOTHER_KEY=another-value';
      const result = await runCLIWithStdin(
        ['convex', '--stdin', '--yes'],
        stdinData
      );

      expect(result.stdout).toContain(
        'Reading environment variables from stdin...'
      );
      expect(result.stdout).toContain('Found 2 environment variables');
    });

    it('should fail with empty stdin', async () => {
      const result = await runCLIWithStdin(['convex', '--stdin', '--yes'], '');

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('No input received from stdin');
    });

    it('should accept deployment flag', async () => {
      const stdinData = 'API_KEY=secret';
      const result = await runCLIWithStdin(
        ['convex', '--stdin', '--deployment', 'my-deployment', '--yes'],
        stdinData
      );

      expect(result.stdout).toContain('Found 1 environment variables');
    });
  });
});

interface CLIResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runCLI(args: string[]): Promise<CLIResult> {
  return new Promise(resolve => {
    const child = spawn('bun', [CLI_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    child.stdout?.on('data', data => {
      stdout += data.toString();
    });

    child.stderr?.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({
          code: code || 0,
          stdout,
          stderr,
        });
      }
    });

    // Set a timeout to prevent hanging tests
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill('SIGTERM');
        resolve({
          code: 1,
          stdout,
          stderr: stderr + '\nTest timeout - process killed',
        });
      }
    }, 10000);
  });
}

async function runCLIWithStdin(
  args: string[],
  stdinData: string
): Promise<CLIResult> {
  return new Promise(resolve => {
    const child = spawn('bun', [CLI_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    // Write stdin data
    if (stdinData) {
      child.stdin?.write(stdinData);
    }
    child.stdin?.end();

    child.stdout?.on('data', data => {
      stdout += data.toString();
    });

    child.stderr?.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({
          code: code || 0,
          stdout,
          stderr,
        });
      }
    });

    // Set a timeout to prevent hanging tests
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill('SIGTERM');
        resolve({
          code: 1,
          stdout,
          stderr: stderr + '\nTest timeout - process killed',
        });
      }
    }, 10000);
  });
}
