/**
 * Overlay type definitions
 */
export interface Overlay {
    type: OverlayType;
    name: string;
    contexts?: string[];
    config?: Record<string, unknown>;
}
export declare enum OverlayType {
    ORGANIZATION = "organization",
    PLATFORM = "platform",
    ROLE = "role",
    TEAM = "team",
    WORKFLOW = "workflow"
}
export interface Overlays {
    organization?: Overlay;
    platform?: Overlay;
    role?: Overlay;
    team?: Overlay;
    workflow?: Overlay;
}
export interface OverlayConfig {
    enabled: boolean;
    paths?: string[];
}
//# sourceMappingURL=overlays.d.ts.map