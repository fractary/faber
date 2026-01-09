/**
 * Mock implementation of chalk for testing
 */

const mockChalk = {
  green: (str: string) => str,
  red: (str: string) => str,
  yellow: (str: string) => str,
  blue: (str: string) => str,
  cyan: (str: string) => str,
  gray: (str: string) => str,
  grey: (str: string) => str,
  bold: (str: string) => str,
  dim: (str: string) => str,
};

export default mockChalk;
