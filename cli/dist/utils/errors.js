import chalk from 'chalk';
export function formatError(code, message, details) {
    const errorObj = {
        status: 'error',
        error: {
            code,
            message,
        },
    };
    if (details) {
        errorObj.error.details = details;
    }
    return errorObj;
}
export function printError(message, details) {
    console.error(chalk.red('✖'), message);
    if (details) {
        console.error(chalk.gray(details));
    }
}
export function printSuccess(message, details) {
    console.log(chalk.green('✓'), message);
    if (details) {
        console.log(chalk.gray(details));
    }
}
export function printInfo(message, details) {
    console.log(chalk.blue('ℹ'), message);
    if (details) {
        console.log(chalk.gray(details));
    }
}
export function printWarning(message, details) {
    console.log(chalk.yellow('⚠'), message);
    if (details) {
        console.log(chalk.gray(details));
    }
}
