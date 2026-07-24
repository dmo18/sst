export type StatusColor = 'green' | 'amber' | 'red' | 'blue';
export type ServiceState = 'operational' | 'degraded' | 'major' | 'unknown';
export type SourceState = 'available' | 'limited' | 'unavailable' | 'disabled' | 'pending' | 'stale';
export type AttentionLevel = 'critical' | 'action' | 'watch' | 'informational';
export type Criticality = 'high' | 'medium' | 'low';
export interface ProviderDownloadLog {
    timestamp?: string;
    completed_at?: string;
    duration_ms?: number;
    attempt?: number;
    url?: string;
    source_type?: string;
    ok?: boolean;
    status?: string;
    message?: string;
    error?: string;
    content_type?: string;
}
export interface ProviderConfig {
    id: string;
    name: string;
    category: string;
    priority?: number;
    enabled?: boolean;
    sourceType?: string;
    url: string;
    message?: string;
    services?: string[];
    criticality?: Criticality;
    tags?: string[];
    client_impact?: string;
    technician_action?: string;
}
export interface ProviderStatus {
    id: string;
    name: string;
    category: string;
    status: string;
    color: StatusColor;
    service_state: ServiceState;
    source_state: SourceState;
    attention: AttentionLevel;
    message?: string;
    ok: boolean;
    source: string;
    priority: number;
    criticality?: Criticality;
    tags?: string[];
    services?: string[];
    client_impact?: string;
    technician_action?: string;
    checked_at?: string;
    source_type?: string;
    download_log?: ProviderDownloadLog[];
}
export interface Incident {
    id: string;
    providerId: string;
    provider: string;
    category: string;
    title: string;
    note: string;
    source: string;
    url: string;
    time: string;
    rawTime?: string;
    status?: string;
    color: StatusColor;
    service_state: Exclude<ServiceState, 'operational' | 'unknown'>;
    attention: AttentionLevel;
    priority: number;
    first_detected?: string;
    latest_update?: string;
    client_impact?: string;
    technician_action?: string;
    affected_service?: string;
}
export type ChangeType = 'incident_new' | 'severity_increased' | 'severity_decreased' | 'incident_resolved' | 'service_degraded' | 'service_recovered' | 'source_unavailable' | 'source_recovered' | 'source_limited' | 'source_available';
export interface StatusChange {
    id: string;
    type: ChangeType;
    provider_id: string;
    provider: string;
    detected_at: string;
    title: string;
    attention: AttentionLevel;
}
export interface StatusSummary {
    service_overall: ServiceState;
    source_overall: SourceState;
    active_incident_count: number;
    affected_provider_count: number;
    confirmed_operational_count: number;
    degraded_count: number;
    major_count: number;
    unknown_count: number;
    limited_count: number;
    unavailable_count: number;
    disabled_count: number;
    pending_count: number;
    stale_count: number;
    provider_total: number;
    enabled_provider_count: number;
    coverage_percent: number;
    confirmed_operational_percent: number;
}
export interface StatusPayload {
    schema_version: 2;
    generated_at: string;
    summary: StatusSummary;
    providers: ProviderStatus[];
    incidents: Incident[];
    changes: StatusChange[];
    history: StatusChange[];
}
export type DataLifecycle = {
    phase: 'loading';
    data: null;
    failure: null;
} | {
    phase: 'ready' | 'refreshing';
    data: StatusPayload;
    failure: null;
} | {
    phase: 'stale';
    data: StatusPayload;
    failure: string;
} | {
    phase: 'error';
    data: null;
    failure: string;
};
