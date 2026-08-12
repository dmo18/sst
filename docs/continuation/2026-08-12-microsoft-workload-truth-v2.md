# Microsoft workload truth v2

Date: 2026-08-12
Status: implementation in progress
Baseline main: `a8161ba338189b9d128a036d38dfc56228301128`
Branch: `agent/microsoft-workload-truth-v2-2026-08-12`

## Reported defect

The Microsoft experience still presented Microsoft 365 as though a single Microsoft public/Admin Center status signal could describe the health of the entire Microsoft 365 estate. The clearest symptom was the Microsoft 365 public status card being green and visually parenting Exchange Online, Teams, SharePoint, OneDrive, Intune, Microsoft 365 Apps, Defender for Microsoft 365, and Power Platform.

That was not a cosmetic problem. Several model and catalog decisions reinforced the same incorrect evidence relationship.

## Root causes

### 1. Clear public incident evidence looked like workload health

The public Microsoft source can be useful for broadly published Microsoft incidents, but the Microsoft workspace rendered an operational public-source state as a positive green card. The source was visually labeled as a broad Microsoft 365 signal, so its green state implied broader health authority than the source actually has.

The corrected workspace treats a clear public source as informational. It can say no public incident is currently published. It cannot green-light workloads or tenants.

### 2. The generic Microsoft provider aliased every workload

`config/provider-consolidation.json` configured the generic `microsoft365` provider with all Microsoft workload names in its `services` list.

That created two kinds of leakage:

- generic incident fallback could describe an incident as affecting the entire configured Microsoft workload list;
- universal search could match Exchange, Teams, SharePoint, OneDrive, Entra, Intune, Apps, Defender, and Power Platform to the generic public-status provider even when no workload-specific evidence existed.

The generic source is now named `Microsoft 365 public status` and exposes only `Microsoft 365 public incident status` as its configured service.

### 3. Broad Microsoft incident tone propagated to every workload

The previous facet assessment used the generic `microsoft365` provider state for every Microsoft 365 workload. If that provider was degraded or major, every workload facet inherited the same warning or critical tone even when the incident did not name that workload.

The new incident-scope mapper always maps a Microsoft public incident to the suite umbrella, then maps it to individual workloads only when the incident title, notes, affected-service text, or normalized affected-service label explicitly matches that workload.

Unmatched workloads remain informational and direct the operator to tenant Service Health.

### 4. Entra was treated as less tenant-dependent than the rest of Microsoft

Entra retains a useful dedicated Azure public signal, but a clear Azure public table does not prove tenant-specific sign-in, MFA, Conditional Access, application, or policy health. All ten Microsoft facets now count as tenant-authoritative for current tenant health.

## New evidence model

The Microsoft workspace now separates three evidence roles:

1. `Public incident fallback`: unauthenticated Microsoft public incident evidence. Clear is informational, never workload-positive.
2. `Azure public Entra signal`: broad Entra evidence. Active degradation can warn the Entra facet; clear does not prove tenant health.
3. `Tenant workload authority`: Microsoft 365 Service Health and Graph service communications for current subscribed-service health.

Every workload card carries `data-health-authority="tenant-service-health"`. Public incident counts are exposed separately with `data-public-incident-count`.

## Tenant Graph boundary

The tenant contract remains private:

- `GET /admin/serviceAnnouncement/healthOverviews`
- `GET /admin/serviceAnnouncement/issues`
- permission `ServiceHealth.Read.All`

The public GitHub Pages build remains token-free. No tenant identifier, credential, private service communication, or tenant-only incident detail belongs in the public bundle or `status.json`.

## Regression requirements

- the generic Microsoft public provider must not list individual Microsoft workloads as configured services;
- a clear public Microsoft source must render informational, not positive, in the Microsoft workspace;
- a public Microsoft incident must not degrade every workload automatically;
- explicit workload terms must map incidents only to the appropriate workload cards;
- all ten workload cards must remain tenant-authoritative;
- deployed verification must reject old `Microsoft 365 broad public signal` and `operational service` umbrella presentation when the public source is merely clear;
- desktop and mobile Microsoft evidence must be visually inspected after deployment.

## Completion requirement

Do not close this record until pull-request tests, TypeScript, application build, audit, and CodeQL pass; the implementation is merged; the main production release and all compatibility gates pass; the downstream product-experience workflow passes; final production `status.json` confirms the generic Microsoft provider does not alias individual workloads through `services`; and direct screenshot review confirms the Microsoft surface no longer uses a clear public signal as health for all of Microsoft 365.

Append PR number, final head, merge SHA, CI runs, production release, CodeQL, product-experience artifact, final payload observations, and visual acceptance before closure.
