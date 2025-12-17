/**
 * S3 Archive Backend for FABER Event Gateway
 *
 * Archives events to S3 for long-term storage and analysis.
 * Supports consolidation to JSONL format for efficient storage.
 */
export interface S3Config {
    bucket: string;
    prefix: string;
    region: string;
    consolidateOnComplete: boolean;
    cleanupLocalAfterArchive: boolean;
}
export interface ArchiveResult {
    status: "success" | "error";
    operation: "archive-to-s3";
    run_id: string;
    s3_path: string;
    files_archived: string[];
    size_bytes: number;
    error?: string;
}
export declare class S3ArchiveBackend {
    private config;
    private localBasePath;
    constructor(config: S3Config, localBasePath: string);
    /**
     * Execute AWS CLI command
     */
    private execAwsCli;
    /**
     * Get S3 path for a run
     */
    private getS3Path;
    /**
     * Get local run directory
     */
    private getLocalRunDir;
    /**
     * Archive a completed run to S3
     */
    archiveRun(runId: string): Promise<ArchiveResult>;
    /**
     * List archived runs in S3
     */
    listArchivedRuns(filters?: {
        org?: string;
        project?: string;
        limit?: number;
    }): Promise<{
        status: "success" | "error";
        runs: Array<{
            run_id: string;
            s3_path: string;
            size_bytes: number;
        }>;
        error?: string;
    }>;
    /**
     * Restore a run from S3 to local storage
     */
    restoreRun(runId: string): Promise<{
        status: "success" | "error";
        run_id: string;
        local_path: string;
        files_restored: string[];
        error?: string;
    }>;
    /**
     * Helper to list files recursively
     */
    private listFilesRecursive;
}
//# sourceMappingURL=s3-archive.d.ts.map