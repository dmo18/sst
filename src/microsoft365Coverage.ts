import type { DiagnosticSource, IssueConsoleModel } from './statusViewModel';

export type Microsoft365CoverageMode = 'dedicated-public' | 'public-umbrella-plus-tenant';

export interface Microsoft365ServiceFacet {
  id: string;
  label: string;
  providerId: 'microsoft365' | 'entra';
  coverageMode: Microsoft365CoverageMode;
  operatorImpact: string;
}

export const MICROSOFT_365_CRITICAL_SERVICES: readonly Microsoft365ServiceFacet[] = [
  {
    id: 'microsoft-365-suite',
    label: 'Microsoft 365 suite',
    providerId: 'microsoft365',
    coverageMode: 'public-umbrella-plus-tenant',
    operatorImpact: 'Cross-suite service health, administration, and broad Microsoft 365 availability.'
  },
  {
    id: 'exchange-online',
    label: 'Exchange Online',
    providerId: 'microsoft365',
    coverageMode: 'public-umbrella-plus-tenant',
    operatorImpact: 'Mail flow, Outlook access, transport, calendaring, and shared mailbox operations.'
  },
  {
    id: 'microsoft-teams',
    label: 'Microsoft Teams',
    providerId: 'microsoft365',
    coverageMode: 'public-umbrella-plus-tenant',
    operatorImpact: 'Chat, meetings, calling, presence, and collaboration workflows.'
  },
  {
    id: 'sharepoint-online',
    label: 'SharePoint Online',
    providerId: 'microsoft365',
    coverageMode: 'public-umbrella-plus-tenant',
    operatorImpact: 'Sites, document libraries, intranet content, and collaboration storage.'
  },
  {
    id: 'onedrive-business',
    label: 'OneDrive for Business',
    providerId: 'microsoft365',
    coverageMode: 'public-umbrella-plus-tenant',
    operatorImpact: 'File sync, personal cloud storage, sharing, and Files On-Demand workflows.'
  },
  {
    id: 'entra-id',
    label: 'Microsoft Entra ID',
    providerId: 'entra',
    coverageMode: 'dedicated-public',
    operatorImpact: 'Sign-in, MFA, token issuance, conditional access, SSO, and administrative access.'
  },
  {
    id: 'microsoft-intune',
    label: 'Microsoft Intune',
    providerId: 'microsoft365',
    coverageMode: 'public-umbrella-plus-tenant',
    operatorImpact: 'Device enrollment, policy, compliance, application deployment, and endpoint administration.'
  },
  {
    id: 'microsoft-365-apps',
    label: 'Microsoft 365 Apps',
    providerId: 'microsoft365',
    coverageMode: 'public-umbrella-plus-tenant',
    operatorImpact: 'Office activation, connected experiences, update channels, and cloud-backed desktop workflows.'
  },
  {
    id: 'defender-m365',
    label: 'Microsoft Defender for Microsoft 365',
    providerId: 'microsoft365',
    coverageMode: 'public-umbrella-plus-tenant',
    operatorImpact: 'Mail protection, investigation, alerting, quarantine, and security operations.'
  },
  {
    id: 'power-platform',
    label: 'Microsoft Power Platform',
    providerId: 'microsoft365',
    coverageMode: 'public-umbrella-plus-tenant',
    operatorImpact: 'Power Apps, Power Automate, Dataverse, and related business automation.'
  }
] as const;

export const MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION = 'ServiceHealth.Read.All';
export const MICROSOFT_GRAPH_HEALTH_OVERVIEWS_PATH = '/admin/serviceAnnouncement/healthOverviews';
export const MICROSOFT_GRAPH_ISSUES_PATH = '/admin/serviceAnnouncement/issues';

export interface Microsoft365CoverageSnapshot {
  microsoft365: DiagnosticSource | null;
  entra: DiagnosticSource | null;
  publicSignalsPresent: number;
  publicSignalsExpected: number;
  serviceFacetCount: number;
  tenantGranularFacetCount: number;
}

export function microsoft365CoverageSnapshot(model: IssueConsoleModel | null): Microsoft365CoverageSnapshot {
  const microsoft365 = model?.diagnostics.find(item => item.id === 'microsoft365') || null;
  const entra = model?.diagnostics.find(item => item.id === 'entra') || null;
  return {
    microsoft365,
    entra,
    publicSignalsPresent: Number(Boolean(microsoft365)) + Number(Boolean(entra)),
    publicSignalsExpected: 2,
    serviceFacetCount: MICROSOFT_365_CRITICAL_SERVICES.length,
    tenantGranularFacetCount: MICROSOFT_365_CRITICAL_SERVICES.filter(item => item.coverageMode === 'public-umbrella-plus-tenant').length
  };
}

export function microsoft365PublicTone(source: DiagnosticSource | null): 'critical' | 'warning' | 'positive' | 'unknown' {
  if (!source) return 'unknown';
  if (source.serviceState === 'major' || source.sourceHealth === 'blind') return 'critical';
  if (source.serviceState === 'degraded' || source.sourceHealth === 'watch' || source.sourceState !== 'available') return 'warning';
  if (source.serviceState === 'operational' && source.sourceHealth === 'healthy') return 'positive';
  return 'unknown';
}
