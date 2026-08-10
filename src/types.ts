import type {
  ATTENTION_LEVELS,
  EVIDENCE_TIERS,
  FRESHNESS_STATES,
  MAINTENANCE_STATES,
  SERVICE_STATES,
  SOURCE_CONFIDENCE_LEVELS,
  SOURCE_HEALTH_STATES,
  SOURCE_STATES,
  STATUS_COLORS,
  TRUTH_BASES
} from './statusContract';

export type StatusColor = typeof STATUS_COLORS[number];
export type ServiceState = typeof SERVICE_STATES[number];
export type SourceState = typeof SOURCE_STATES[number];
export type SourceHealth = typeof SOURCE_HEALTH_STATES[number];
export type TruthBasis = typeof TRUTH_BASES[number];
export type FreshnessState = typeof FRESHNESS_STATES[number];
export type AttentionLevel = typeof ATTENTION_LEVELS[number];
export type Criticality = 'high' | 'medium' | 'low';
export type EvidenceTier = typeof EVIDENCE_TIERS[number];
export type SourceConfidence = typeof SOURCE_CONFIDENCE_LEVELS[number];
export type MaintenanceState = typeof MAINTENANCE_STATES[number];
export type IncidentEvidenceBasis = 'current-page';

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

export interface ComponentStatus {
  name: string;
  status: string;
  group?: string;
}

export interface ProviderStatus {
  id: string;
  name: string;
  category: string;
  status: string;
  color: StatusColor;
  service_state: ServiceState;
  source_state: SourceState;
  source_health?: SourceHealth;
  truth_basis?: TruthBasis;
  attention: AttentionLevel;
  message?: string;
  ok: boolean;
  source: string;
  source_host?: string;
  priority: number;
  criticality?: Criticality;
  tags?: string[];
  services?: string[];
  client_impact?: string;
  technician_action?: string;
  checked_at?: string;
  source_type?: string;
  download_log?: ProviderDownloadLog[];
  status_data_valid?: boolean;
  status_data_basis?: 'live-official' | 'last-known-official' | 'limited-official' | 'limited-fallback';
  evidence_tier?: EvidenceTier;
  source_confidence?: SourceConfidence;
  parser_version?: string;
  schema_fingerprint?: string;
  schema_changed?: boolean;
  last_success_at?: string;
  consecutive_failures?: number;
  last_semantic_change_at?: string;
  component_status?: ComponentStatus[];
  data_quality_score?: number;
  source_latency_ms?: number;
  last_request_ms?: number;
  collection_elapsed_ms?: number;
  collection_attempt_count?: number;
  collection_success_count?: number;
  collection_failure_count?: number;
  freshness_seconds?: number;
  freshness_state?: FreshnessState;
  active_incident_count?: number;
  maintenance_count?: number;
  problem_component_count?: number;
  health_access?: 'public' | 'authenticated';
  health_observable?: boolean;
}

export interface IncidentUpdate {
  status?: string;
  note: string;
  at?: string;
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
  observed_at?: string;
  evidence_basis?: IncidentEvidenceBasis;
  client_impact?: string;
  technician_action?: string;
  affected_service?: string;
  updates?: IncidentUpdate[];
}

export interface Maintenance {
  id: string;
  providerId: string;
  provider: string;
  category: string;
  title: string;
  note: string;
  source: string;
  url: string;
  status: MaintenanceState;
  starts_at?: string;
  ends_at?: string;
  announced_at?: string;
  latest_update?: string;
  affected_service?: string;
  priority: number;
  attention: AttentionLevel;
  updates?: IncidentUpdate[];
}

export type ChangeType =
  | 'incident_new'
  | 'severity_increased'
  | 'severity_decreased'
  | 'incident_resolved'
  | 'service_degraded'
  | 'service_recovered'
  | 'source_unavailable'
  | 'source_recovered'
  | 'source_limited'
  | 'source_available'
  | 'source_schema_changed'
  | 'source_failure_streak'
  | 'maintenance_new'
  | 'maintenance_started'
  | 'maintenance_updated'
  | 'maintenance_ended';

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
  live_source_coverage_percent: number;
  valid_status_count: number;
  invalid_status_count: number;
  valid_status_percent: number;
  confirmed_operational_percent: number;
  maintenance_count?: number;
  ongoing_maintenance_count?: number;
  structured_source_count?: number;
  feed_source_count?: number;
  page_source_count?: number;
  high_confidence_source_count?: number;
  schema_change_count?: number;
  failure_streak_count?: number;
  component_issue_count?: number;
  actionable_provider_count?: number;
  healthy_source_count?: number;
  watch_source_count?: number;
  blind_spot_count?: number;
  auth_gated_provider_count?: number;
  public_health_source_count?: number;
  average_data_quality_score?: number;
  request_count?: number;
  successful_request_count?: number;
  failed_request_count?: number;
  request_success_percent?: number;
  origin_count?: number;
  median_request_ms?: number;
  p95_request_ms?: number;
}

export interface CollectionRun {
  pipeline_version: string;
  run_id: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  provider_count: number;
  origin_count: number;
  unique_source_count: number;
  shared_source_count: number;
  request_count: number;
  successful_request_count: number;
  failed_request_count: number;
  request_success_percent: number;
  median_request_ms: number;
  p95_request_ms: number;
  quality_score: number;
  healthy_source_count: number;
  watch_source_count: number;
  blind_spot_count: number;
  auth_gated_provider_count?: number;
  public_health_source_count?: number;
}

export interface StatusPayload {
  schema_version: 2;
  generated_at: string;
  summary: StatusSummary;
  collection?: CollectionRun;
  providers: ProviderStatus[];
  incidents: Incident[];
  maintenance?: Maintenance[];
  changes: StatusChange[];
  history: StatusChange[];
}

export type DataLifecycle =
  | { phase: 'loading'; data: null; failure: null }
  | { phase: 'ready' | 'refreshing'; data: StatusPayload; failure: null }
  | { phase: 'stale'; data: StatusPayload; failure: string }
  | { phase: 'error'; data: null; failure: string };