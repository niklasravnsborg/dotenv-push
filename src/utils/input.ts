import * as fs from 'node:fs';

/**
 * Prompt user for input via TTY
 * This works even when stdin has been consumed by piped input,
 * by reading directly from /dev/tty (the terminal)
 * @param question The question to display to the user
 * @returns Promise resolving to user's trimmed input
 */
export async function prompt(question: string): Promise<string> {
  process.stdout.write(question);

  // Try to read from /dev/tty for interactive input
  // This allows prompting even after stdin has been consumed by piped data
  let fd: number | undefined;

  try {
    // Open /dev/tty for reading
    fd = fs.openSync('/dev/tty', 'r');
  } catch {
    // Fall back to stdin fd if /dev/tty is not available
    fd = 0; // stdin fd
  }

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const buffer = Buffer.alloc(1);

    try {
      // Read character by character until newline
      while (true) {
        const bytesRead = fs.readSync(fd as number, buffer, 0, 1, null);
        if (bytesRead === 0) {
          // EOF
          break;
        }
        const char = buffer.toString('utf8', 0, 1);
        if (char === '\n') {
          break;
        }
        chunks.push(Buffer.from(char));
      }

      const result = Buffer.concat(chunks).toString('utf8').trim();

      // Close the fd if we opened /dev/tty (not stdin)
      if (fd !== 0) {
        fs.closeSync(fd);
      }

      resolve(result);
    } catch (error) {
      // Make sure to close fd on error
      if (fd !== undefined && fd !== 0) {
        try {
          fs.closeSync(fd);
        } catch {
          // Ignore close errors
        }
      }
      reject(error);
    }
  });
}
