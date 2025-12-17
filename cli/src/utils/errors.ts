import chalk from 'chalk';

export interface ErrorOutput {
  status: 'error';
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function formatError(
  code: string,
  message: string,
  details?: unknown,
): ErrorOutput {
  if (details !== undefined) {
    return {
      status: 'error',
      error: {
        code,
        message,
        details,
      },
    };
  }

  return {
    status: 'error',
    error: {
      code,
      message,
    },
  };
}

export function printError(message: string, details?: string): void {
  console.error(chalk.red('✖'), message);
  if (details) {
    console.error(chalk.gray(details));
  }
}

export function printSuccess(message: string, details?: string): void {
  console.log(chalk.green('✓'), message);
  if (details) {
    console.log(chalk.gray(details));
  }
}

export function printInfo(message: string, details?: string): void {
  console.log(chalk.blue('ℹ'), message);
  if (details) {
    console.log(chalk.gray(details));
  }
}

export function printWarning(message: string, details?: string): void {
  console.log(chalk.yellow('⚠'), message);
  if (details) {
    console.log(chalk.gray(details));
  }
}
