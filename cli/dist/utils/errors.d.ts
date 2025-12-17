export interface ErrorOutput {
    status: 'error';
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
export declare function formatError(code: string, message: string, details?: unknown): ErrorOutput;
export declare function printError(message: string, details?: string): void;
export declare function printSuccess(message: string, details?: string): void;
export declare function printInfo(message: string, details?: string): void;
export declare function printWarning(message: string, details?: string): void;
//# sourceMappingURL=errors.d.ts.map