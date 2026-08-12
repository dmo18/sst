import type { DiagnosticSource, IssueBrief, IssueConsoleModel } from './statusViewModel';

export type Microsoft365CoverageMode = 'tenant-health-with-public-incidents' | 'dedicated-public-with-tenant-health';
export type Microsoft365ServiceTone = 'critical' | 'warning' | 'positive' | 'informational' | 'unknown';
export type Microsoft365EvidenceTone = 'healthy' | 'watch' | 'blind' | 'unknown';

export interface Microsoft365ServiceFacet {
  id: string;
  label: string;
  providerId: 'microsoft365' | 'entra';
  coverageMode: Microsoft365CoverageMode;
  operatorImpact: string;
}

export interface Microsoft365FacetAssessment {
  serviceTone: Microsoft365ServiceTone;
  serviceLabel: string;
  evidenceTone: Microsoft365EvidenceTone;
  evidenceLabel: string;
  publicIncidentCount: number;
}

export const MICROSOFT_365_CRITICAL_SERVICES: readonly Microsoft365ServiceFacet[] = [
  {
    id: 'microsoft-365-suite',
    label: 'Microsoft 365 suite',
    providerId: 'microsoft365',
    coverageMode: 'tenant-health-with-public-incidents',
    operatorImpact: 'Cross-suite service health, administration, and broad Microsoft 365 availability.'
  },
  {
    id: 'exchange-online',
    label: 'Exchange Online',
    providerId: 'microsoft365',
    coverageMode: 'tenant-health-with-public-incidents',
    operatorImpact: 'Mail flow, Outlook access, transport, calendaring, and shared mailbox operations.'
  },
  {
    id: 'microsoft-teams',
    label: 'Microsoft Teams',
    providerId: 'microsoft365',
    coverageMode: 'tenant-health-with-public-incidents',
    operatorImpact: 'Chat, meetings, calling, presence, and collaboration workflows.'
  },
  {
    id: 'sharepoint-online',
    label: 'SharePoint Online',
    providerId: 'microsoft365',
    coverageMode: 'tenant-health-with-public-incidents',
    operatorImpact: 'Sites, document libraries, intranet content, and collaboration storage.'
  },
  {
    id: 'onedrive-business',
    label: 'OneDrive for Business',
    providerId: 'microsoft365',
    coverageMode: 'tenant-health-with-public-incidents',
    operatorImpact: 'File sync, personal cloud storage, sharing, and Files On-Demand workflows.'
  },
  {
    id: 'entra-id',
    label: 'Microsoft Entra ID',
    providerId: 'entra',
    coverageMode: 'dedicated-public-with-tenant-health',
    operatorImpact: 'Sign-in, MFA, token issuance, conditional access, SSO, and administrative access.'
  },
  {
    id: 'microsoft-intune',
    label: 'Microsoft Intune',
    providerId: 'microsoft365',
    coverageMode: 'tenant-health-with-public-incidents',
    operatorImpact: 'Device enrollment, policy, compliance, application deployment, and endpoint administration.'
  },
  {
    id: 'microsoft-365-apps',
    label: 'Microsoft 365 Apps',
    providerId: 'microsoft365',
    coverageMode: 'tenant-health-with-public-incidents',
    operatorImpact: 'Office activation, connected experiences, update channels, and cloud-backed desktop workflows.'
  },
  {
    id: 'defender-m365',
    label: 'Microsoft Defender for Microsoft 365',
    providerId: 'microsoft365',
    coverageMode: 'tenant-health-with-public-incidents',
    operatorImpact: 'Mail protection, investigation, alerting, quarantine, and security operations.'
  },
  {
    id: 'power-platform',
    label: 'Microsoft Power Platform',
    providerId: 'microsoft365',
    coverageMode: 'tenant-health-with-public-incidents',
    operatorImpact: 'Power Apps, Power Automate, Dataverse, and related business automation.'
  }
] as const;

export const MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION = 'ServiceHealth.Read.All';
export const MICROSOFT_GRAPH_HEALTH_OVERVIEWS_PATH = '/admin/serviceAnnouncement/healthOverviews';
export const MICROSOFT_GRAPH_ISSUES_PATH = '/admin/serviceAnnouncement/issues';

const FACET_MATCHERS: Readonly<Record<string, readonly RegExp[]>> = {
  'exchange-online': [
    /\bexchange(?: online)?\b/i,
    /\boutlook\b/i,
    /\bmail flow\b/i,
    /\bmailbox(?:es)?\b/i,
    /\bemail delivery\b/i,
    /\bmessage transport\b/i
  ],
  'microsoft-teams': [
    /\bmicrosoft teams\b/i,
    /\bteams\b/i,
    /\bmeetings?\b/i,
    /\bteams calling\b/i
  ],
  'sharepoint-online': [
    /\bsharepoint(?: online)?\b/i,
    /\bsharepoint sites?\b/i
  ],
  'onedrive-business': [
    /\bonedrive(?: for business)?\b/i,
    /\bfile sync\b/i
  ],
  'entra-id': [
    /\bmicrosoft entra(?: id)?\b/i,
    /\bazure active directory\b/i,
    /\bazure ad\b/i,
    /\bconditional access\b/i,
    /\btoken issuance\b/i,
    /\bmfa\b/i,
    /\bsign-?in\b/i,
    /\bauthentication\b/i
  ],
  'microsoft-intune': [
    /\bmicrosoft intune\b/i,
    /\bintune\b/i,
    /\bendpoint manager\b/i,
    /\bdevice enrollment\b/i,
    /\bdevice compliance\b/i
  ],
  'microsoft-365-apps': [
    /\bmicrosoft 365 apps\b/i,
    /\boffice activation\b/i,
    /\boffice for the web\b/i,
    /\bword for the web\b/i,
    /\bexcel for the web\b/i,
    /\bpowerpoint for the web\b/i
  ],
  'defender-m365': [
    /\bdefender for (?:office|microsoft) 365\b/i,
    /\bmicrosoft defender\b/i,
    /\bsafe links\b/i,
    /\bsafe attachments\b/i,
    /\bquarantine\b/i
  ],
  'power-platform': [
    /\bpower platform\b/i,
    /\bpower apps\b/i,
    /\bpower automate\b/i,
    /\bdataverse\b/i
  ]
};

export interface Microsoft365CoverageSnapshot {
  microsoft365: DiagnosticSource | null;
  entra: DiagnosticSource | null;
  microsoft365Incidents: IssueBrief[];
  entraIncidents: IssueBrief[];
  publicSignalsPresent: number;
  publicSignalsExpected: number;
  serviceFacetCount: number;
  tenantGranularFacetCount: number;
}

export function microsoft365IncidentFacetIds(incident: IssueBrief): string[] {
  if (incident.providerId === 'entra') return ['entra-id'];
  if (incident.providerId !== 'microsoft365') return [];

  const text = [
    incident.title,
    incident.note,
    incident.affected_service,
    incident.affectedServiceLabel
  ].filter(Boolean).join(' ');
  const matches = ['microsoft-365-suite'];
  for (const [facetId, patterns] of Object.entries(FACET_MATCHERS)) {
    if (patterns.some(pattern => pattern.test(text))) matches.push(facetId);
  }
  return [...new Set(matches)];
}

export function microsoft365CoverageSnapshot(model: IssueConsoleModel | null): Microsoft365CoverageSnapshot {
  const microsoft365 = model?.diagnostics.find(item => item.id === 'microsoft365') || null;
  const entra = model?.diagnostics.find(item => item.id === 'entra') || null;
  const microsoft365Incidents = (model?.briefs || []).filter(item => item.providerId === 'microsoft365');
  const entraIncidents = (model?.briefs || []).filter(item => item.providerId === 'entra');
  return {
    microsoft365,
    entra,
    microsoft365Incidents,
    entraIncidents,
    publicSignalsPresent: Number(Boolean(microsoft365)) + Number(Boolean(entra)),
    publicSignalsExpected: 2,
    serviceFacetCount: MICROSOFT_365_CRITICAL_SERVICES.length,
    tenantGranularFacetCount: MICROSOFT_365_CRITICAL_SERVICES.length
  };
}

export function microsoft365ServiceTone(source: DiagnosticSource | null): Microsoft365ServiceTone {
  if (!source) return 'unknown';
  if (source.serviceState === 'major') return 'critical';
  if (source.serviceState === 'degraded') return 'warning';
  if (source.serviceState === 'operational') return 'positive';
  return 'unknown';
}

export function microsoft365PublicSignalTone(source: DiagnosticSource | null): Microsoft365ServiceTone {
  if (!source) return 'unknown';
  if (source.serviceState === 'major') return 'critical';
  if (source.serviceState === 'degraded') return 'warning';
  if (source.sourceState === 'available') return 'informational';
  return 'unknown';
}

export function microsoft365EvidenceTone(source: DiagnosticSource | null): Microsoft365EvidenceTone {
  if (!source) return 'unknown';
  if (source.sourceHealth === 'blind' || source.sourceState === 'unavailable') return 'blind';
  if (source.sourceHealth === 'watch' || source.sourceState !== 'available') return 'watch';
  if (source.sourceHealth === 'healthy' && source.sourceState === 'available') return 'healthy';
  return 'unknown';
}

export function microsoft365EvidenceLabel(source: DiagnosticSource | null): string {
  const tone = microsoft365EvidenceTone(source);
  if (tone === 'healthy') return 'public incident source reachable';
  if (tone === 'watch') return 'public incident source reachable with limited confidence';
  if (tone === 'blind') return 'public incident source unavailable';
  return 'public incident evidence state unknown';
}

function incidentTone(incidents: IssueBrief[]): Microsoft365ServiceTone {
  return incidents.some(item => item.service_state === 'major') ? 'critical' : 'warning';
}

function facetIncidents(service: Microsoft365ServiceFacet, snapshot: Microsoft365CoverageSnapshot): IssueBrief[] {
  return [...snapshot.microsoft365Incidents, ...snapshot.entraIncidents]
    .filter(item => microsoft365IncidentFacetIds(item).includes(service.id));
}

function evidenceSourceForIncidents(incidents: IssueBrief[], snapshot: Microsoft365CoverageSnapshot): DiagnosticSource | null {
  if (incidents.some(item => item.providerId === 'entra')) return snapshot.entra;
  if (incidents.some(item => item.providerId === 'microsoft365')) return snapshot.microsoft365;
  return null;
}

export function microsoft365FacetAssessment(
  service: Microsoft365ServiceFacet,
  snapshot: Microsoft365CoverageSnapshot
): Microsoft365FacetAssessment {
  const source = service.providerId === 'entra' ? snapshot.entra : snapshot.microsoft365;
  const incidents = facetIncidents(service, snapshot);

  if (incidents.length) {
    const evidenceSource = evidenceSourceForIncidents(incidents, snapshot) || source;
    return {
      serviceTone: incidentTone(incidents),
      serviceLabel: `${incidents.length} active public incident${incidents.length === 1 ? '' : 's'} explicitly map${incidents.length === 1 ? 's' : ''} to this facet`,
      evidenceTone: microsoft365EvidenceTone(evidenceSource),
      evidenceLabel: `${microsoft365EvidenceLabel(evidenceSource)}; published incident scope matches this facet`,
      publicIncidentCount: incidents.length
    };
  }

  const evidenceTone = microsoft365EvidenceTone(source);
  const evidenceLabel = microsoft365EvidenceLabel(source);

  if (service.providerId === 'entra') {
    if (!source) {
      return {
        serviceTone: 'unknown',
        serviceLabel: 'Entra public signal unavailable; tenant service health remains authoritative',
        evidenceTone,
        evidenceLabel,
        publicIncidentCount: 0
      };
    }
    if (source.serviceState === 'major' || source.serviceState === 'degraded') {
      return {
        serviceTone: microsoft365ServiceTone(source),
        serviceLabel: 'Azure public status reports current Entra impact without a separate incident record',
        evidenceTone,
        evidenceLabel,
        publicIncidentCount: 0
      };
    }
    return {
      serviceTone: 'informational',
      serviceLabel: 'No broad Entra issue is currently reported on Azure public status; tenant-specific health is not verified',
      evidenceTone,
      evidenceLabel: `${evidenceLabel}; tenant-specific health requires tenant Service Health`,
      publicIncidentCount: 0
    };
  }

  if (service.id === 'microsoft-365-suite') {
    if (!source) {
      return {
        serviceTone: 'unknown',
        serviceLabel: 'Microsoft public incident signal unavailable; tenant service health remains authoritative',
        evidenceTone,
        evidenceLabel,
        publicIncidentCount: 0
      };
    }
    if (source.serviceState === 'major' || source.serviceState === 'degraded') {
      return {
        serviceTone: microsoft365ServiceTone(source),
        serviceLabel: 'Microsoft public status reports current impact without workload-specific public scope',
        evidenceTone,
        evidenceLabel,
        publicIncidentCount: 0
      };
    }
    return {
      serviceTone: 'informational',
      serviceLabel: 'No active public Microsoft 365 incident is currently published; this is not a workload-health assertion',
      evidenceTone,
      evidenceLabel: `${evidenceLabel}; tenant service health is the workload authority`,
      publicIncidentCount: 0
    };
  }

  const broadIncidentActive = snapshot.microsoft365Incidents.length > 0 || source?.serviceState === 'major' || source?.serviceState === 'degraded';
  return {
    serviceTone: 'informational',
    serviceLabel: broadIncidentActive
      ? 'A Microsoft public incident is active, but its published scope does not map to this workload; check tenant Service Health'
      : 'No public incident currently maps to this workload; current health requires tenant Microsoft 365 Service Health',
    evidenceTone,
    evidenceLabel: `${evidenceLabel}; public incident evidence is supplemental, not workload health`,
    publicIncidentCount: 0
  };
}

// Compatibility alias retained for existing callers. Public Microsoft signals should use microsoft365PublicSignalTone instead.
export const microsoft365PublicTone = microsoft365ServiceTone;
