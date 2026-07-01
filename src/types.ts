export type StatusColor = 'green' | 'amber' | 'red' | 'blue';

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
