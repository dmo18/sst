export type StatusColor = 'green' | 'amber' | 'red' | 'blue';

export interface ProviderDownloadLog {
  timestamp?: string;
  completed_at?: string;
  duration_ms?: number;
  url?: string;
  source_type?: string;
  ok?: boolean;
  status?: string;
  message?: string;
  error?: string;
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
}

export interface ProviderStatus {
  id: string;
  name: string;
  category: string;
  status: string;
  color: StatusColor;
  message?: string;
  ok: boolean;
  source: string;
  priority?: number;
  checked_at?: string;
  source_type?: string;
  download_log?: ProviderDownloadLog[];
}

export interface Incident {
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
  priority: number;
}

export interface StatusPayload {
  schema_version: 1;
  generated_at: string;
  summary: {
    overall: StatusColor;
    active_incident_count: number;
    providers_ok: number;
    providers_total: number;
  };
  providers: ProviderStatus[];
  incidents: Incident[];
  history: string[];
}

export type DataLifecycle =
  | { phase: 'loading'; data: null; failure: null }
  | { phase: 'ready' | 'refreshing'; data: StatusPayload; failure: null }
  | { phase: 'stale'; data: StatusPayload; failure: string }
  | { phase: 'error'; data: null; failure: string };
