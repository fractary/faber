/**
 * Output formatting utilities for CLI commands
 */
export interface JSONOutput<T = unknown> {
    status: 'success' | 'error';
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}
export declare function formatJSON<T>(data: T, error?: {
    code: string;
    message: string;
}): JSONOutput<T>;
export declare function outputJSON<T>(data: JSONOutput<T>): void;
export declare function formatTable<T extends Record<string, unknown>>(rows: T[]): string;
//# sourceMappingURL=output.d.ts.map