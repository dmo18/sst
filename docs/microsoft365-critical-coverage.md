# Microsoft 365 workload truth

Status: workload-truth v2 implementation in progress
Started: 2026-08-11
Revised: 2026-08-12

Microsoft 365 is a critical dependency for the ServiceOps MSP operating model. It must not be represented as one generic cloud health card, and an unauthenticated Microsoft public status signal must never be used as current health for every Microsoft 365 workload.

## Covered workload estate

ServiceOps tracks these Microsoft workload facets explicitly:

- Microsoft 365 suite
- Exchange Online
- Microsoft Teams
- SharePoint Online
- OneDrive for Business
- Microsoft Entra ID
- Microsoft Intune
- Microsoft 365 Apps
- Microsoft Defender for Microsoft 365
- Microsoft Power Platform

All ten facets are tenant-authoritative for current tenant health. Microsoft Entra ID additionally has a dedicated Azure public signal because broad identity outages can be independently visible on Azure public status.

## Evidence classes

### Microsoft 365 public incident fallback

The token-free public pipeline reads Microsoft's unauthenticated public incident feed. That source is useful for incidents Microsoft chooses to publish publicly and for fallback communications when tenant portals are unavailable.

It is not a workload health API.

A clear public incident feed means only that ServiceOps did not find a currently published public incident. It does not certify current health for Exchange Online, Teams, SharePoint Online, OneDrive for Business, Intune, Microsoft 365 Apps, Defender for Microsoft 365, Power Platform, or any tenant.

The canonical `microsoft365` public source is therefore named `Microsoft 365 public status` and exposes only `Microsoft 365 public incident status` as its configured service. It no longer aliases the individual workload names in the provider catalog or universal search.

### Scoped public incidents

A Microsoft public incident can contribute warning or critical state to an individual workload only when the incident's published title, notes, or affected-service text explicitly map to that workload.

Examples include:

- Exchange or Outlook language mapping to Exchange Online;
- Teams language mapping to Microsoft Teams;
- SharePoint language mapping to SharePoint Online;
- OneDrive language mapping to OneDrive for Business;
- Intune or Endpoint Manager language mapping to Microsoft Intune;
- Office activation or Microsoft 365 Apps language mapping to Microsoft 365 Apps;
- Defender, Safe Links, Safe Attachments, or quarantine language mapping to Defender for Microsoft 365;
- Power Platform, Power Apps, Power Automate, or Dataverse language mapping to Microsoft Power Platform.

A generic public Microsoft 365 incident still affects the Microsoft 365 suite umbrella, but it does not automatically mark every individual workload degraded.

### Microsoft Entra public signal

The Entra collector observes the official Azure public status surface for Microsoft Entra ID. A reported Entra degradation is valid broad public incident evidence for the Entra facet.

A clear Azure public Entra signal still does not certify tenant-specific sign-in, MFA, Conditional Access, application, or policy health. Tenant Service Health remains authoritative for tenant impact.

### Tenant Microsoft 365 Service Health

Detailed Microsoft 365 service health is tenant-scoped. Microsoft Graph service communications exposes the tenant health contract through:

- `GET /admin/serviceAnnouncement/healthOverviews`
- `GET /admin/serviceAnnouncement/issues`
- least-privilege permission `ServiceHealth.Read.All`

These APIs return service health for the tenant's subscribed services. A future tenant-health bridge must run in an authenticated private backend. Tokens, tenant identifiers, tenant-only incident detail, customer identity, and private service communications must never be exposed in the public browser bundle or public `status.json`.

The public GitHub Pages pipeline remains token-free.

## Operator experience

The Microsoft workspace is organized around three separate evidence roles:

1. `Public incident fallback`: broad unauthenticated Microsoft public incident evidence. Clear is informational, not positive workload health.
2. `Azure public Entra signal`: dedicated broad Entra evidence. Clear is informational for tenant health.
3. `Tenant workload authority`: Microsoft 365 Service Health and Graph service communications for current workload health.

Each of the ten workload cards is marked `tenant-service-health` as its health authority. Public incident counts are shown separately and only mapped to workloads whose published incident scope matches.

The operator contract is: scope the public incident first, then use tenant Service Health before declaring an individual workload healthy, affected, or recovered, and before changing DNS, identity, mail, endpoint, or collaboration configuration.

## Regression invariants

1. A clear Microsoft public incident source cannot render as positive workload health in the Microsoft workspace.
2. The generic Microsoft public source cannot list individual Microsoft workloads as its configured services.
3. Public Microsoft incidents cannot degrade every workload by default.
4. Individual workload warnings require explicit public incident scope or tenant health evidence.
5. All ten workload facets remain tenant-authoritative for current tenant health.
6. The public pipeline remains token-free and contains no tenant credentials.
7. Microsoft public source health and parser confidence remain evidence-quality signals, not service outages.

## Completion gate

This phase is complete only when:

1. deterministic regression tests, strict TypeScript, production build, audit, and CodeQL pass;
2. the change is merged and a fresh production collection succeeds;
3. current Chrome, pinned pre-Cascade-Layers Chromium, and exact 458x291 Yodeck remain green;
4. deployed product-experience verification passes Dependency Universe, universal search, live Incident Focus when available, Microsoft workload truth, provider identity, desktop, and mobile;
5. the production Microsoft screenshot is visually inspected and contains no green umbrella claim caused solely by a clear public incident feed;
6. the deployed payload confirms the generic Microsoft public provider no longer aliases Exchange, Teams, SharePoint, OneDrive, Entra, Intune, Apps, Defender, or Power Platform through `services`;
7. final continuation documentation records the PR, merge, release, evidence artifact, production payload, and visual acceptance.
