# Microsoft 365 workload truth

Status: production accepted
Started: 2026-08-11
Accepted: 2026-08-12
Accepted implementation main: `6cd42c344b1e392148cda5b8402adcabc0678f27`
Accepted release: `31642257830` (#888)
Accepted product evidence: `31642398270` / artifact `9159385364`

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

### Microsoft 365 public status

Since the November 10, 2026 source review, the token-free public pipeline reads the JSON documents that Microsoft's own public status page (`https://status.cloud.microsoft/`) renders:

- `api/posts/mac`: the Microsoft 365 admin center. This is where Microsoft announces a broad incident when tenant administrators cannot reach Service health.
- `api/posts/ppac`: the Power Platform admin center (optional; its absence does not block a conclusion).
- `api/posts/m365Consumer`: each consumer workload (Outlook.com, OneDrive, Microsoft Teams Free, Microsoft 365 consumer, Copilot and others) with its own status.

Microsoft publishes four states: `Available`, `Operational`, `Service degradation` and `Service restored`. The provider is `operational` only when the admin center and every consumer workload are published as healthy. A `Service degradation` post becomes an incident carrying Microsoft's own title and message. A missing required document, an unrecognized state or a changed document shape leaves the provider `unknown`.

No tenant, token or sign-in is involved, and the documents are fetched by the collector, never by the browser.

It is not a tenant workload health API. An operational public status means Microsoft's public page reports no issue. It does not certify current health for Exchange Online, Teams, SharePoint Online, OneDrive for Business, Intune, Microsoft 365 Apps, Defender for Microsoft 365, Power Platform, or any tenant, and the workload facets continue to say so.

The canonical `microsoft365` public source is named `Microsoft 365 public status` and exposes only `Microsoft 365 public incident status` as its configured service. It does not alias individual workload names in the provider catalog or universal search.

Before that review the collector read only the public incident RSS feed and, because an empty feed proves nothing, left the provider `service_state=unknown`. The feed is no longer used: the JSON documents state each service's status explicitly, so an operational conclusion now rests on a positive statement from Microsoft rather than on the absence of an incident.

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
3. A readable empty Microsoft public incident feed cannot set `service_state=operational`.
4. Public Microsoft incidents cannot degrade every workload by default.
5. Individual workload warnings require explicit public incident scope or tenant health evidence.
6. All ten workload facets remain tenant-authoritative for current tenant health.
7. The public pipeline remains token-free and contains no tenant credentials.
8. Microsoft public source health and parser confidence remain evidence-quality signals, not service outages.
9. Deployed verification rejects any `is-positive` Microsoft public source card.
10. Pinned legacy Chromium and exact 458x291 Yodeck remain part of the production acceptance chain.

## Production proof

Accepted release `31642257830` on implementation main `6cd42c344b1e392148cda5b8402adcabc0678f27` passed fresh collection, Pages deployment, current Chrome, pinned pre-Cascade-Layers Chromium, exact 458x291 Yodeck, and deployed intelligence verification.

The accepted Pages payload reports `Microsoft 365 public status` as:

- blue;
- `service_state=unknown`;
- `source_state=available`;
- `truth_basis=observed-no-conclusion`;
- source health healthy;
- zero active incidents at collection time;
- services exactly `Microsoft 365 public incident status`.

Product-experience run `31642398270` passed the Microsoft gate and all other deployed product gates. Artifact `9159385364` recorded:

`MICROSOFT365_CRITICAL facets=10 tenant_authoritative=10`

`MICROSOFT365_PUBLIC_SIGNAL microsoft365=unknown/available/m365-source-card is-informational role=public-incident-fallback evidence=healthy entra=operational/available/m365-source-card is-informational role=azure-public-entra evidence=watch`

Desktop and mobile Microsoft screenshots were directly reviewed. Both show neutral public evidence, a separate tenant workload authority, 10 tenant-authoritative facets, and no green Microsoft 365 umbrella inheritance.

For the detailed implementation, rejected releases, verifier corrections, and acceptance chronology, see `docs/continuation/2026-08-12-microsoft-workload-truth-v2.md`.
