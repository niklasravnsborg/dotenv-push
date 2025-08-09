import { beforeEach, describe, expect, it } from 'bun:test';
import {
  createMockStdin,
  mockStdoutWrite,
} from '../test-utils/test-helpers.js';
import type { MockStdin } from '../types/mocks.js';
import { prompt } from './input.js';

describe('Input Utils', () => {
  let mockStdin: MockStdin;

  beforeEach(() => {
    mockStdin = createMockStdin();

    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      configurable: true,
    });

    process.stdout.write = mockStdoutWrite();
  });

  describe('prompt', () => {
    it('should display question and return user input', async () => {
      const question = 'Enter your name: ';
      const userInput = 'John Doe';

      // Mock stdin to simulate user input
      mockStdin.on.mockImplementation(
        (event: string, callback: (data: string) => void) => {
          if (event === 'data') {
            setTimeout(() => callback(userInput + '\n'), 0);
          }
        }
      );

      const result = await prompt(question);

      expect(process.stdout.write).toHaveBeenCalledWith(question);
      expect(mockStdin.resume).toHaveBeenCalled();
      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf-8');
      expect(result).toBe(userInput);
      expect(mockStdin.pause).toHaveBeenCalled();
    });

    it('should trim whitespace from input', async () => {
      const userInput = '  test input  ';

      mockStdin.on.mockImplementation(
        (event: string, callback: (data: string) => void) => {
          if (event === 'data') {
            setTimeout(() => callback(userInput + '\n'), 0);
          }
        }
      );

      const result = await prompt('Question: ');

      expect(result).toBe('test input');
    });

    it('should handle empty input', async () => {
      mockStdin.on.mockImplementation(
        (event: string, callback: (data: string) => void) => {
          if (event === 'data') {
            setTimeout(() => callback('\n'), 0);
          }
        }
      );

      const result = await prompt('Question: ');

      expect(result).toBe('');
    });
  });
});
