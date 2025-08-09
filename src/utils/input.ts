/**
 * Prompt user for input via stdin
 * @param question The question to display to the user
 * @returns Promise resolving to user's trimmed input
 */
export async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  const result = await new Promise<string>(resolve => {
    const stdin = process.stdin;
    stdin.resume();
    stdin.setEncoding('utf-8');
    stdin.on('data', data => {
      resolve(data.toString().trim());
      stdin.pause();
    });
  });
  return result;
}
