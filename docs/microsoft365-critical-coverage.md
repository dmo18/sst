# Microsoft 365 critical coverage

Status: implementation verification in progress
Started: 2026-08-11

Microsoft 365 is a critical dependency for the ServiceOps MSP operating model. It must not be represented as one generic cloud card with an implied level of visibility that the public Microsoft surface does not provide.

## Covered service estate

The product treats the following as explicit Microsoft 365 service facets:

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

The canonical Microsoft 365 provider remains high criticality. Microsoft Entra ID retains its dedicated first-party Azure public signal because authentication is an independent operational dependency.

## Evidence classes

### Public service signals

ServiceOps continues to collect only public first-party status in the public GitHub Pages pipeline. The public Microsoft service-health landing page is a broad-impact signal for Microsoft 365 Business/Enterprise. The dedicated Entra collector observes the official Azure public status surface.

These public observations must never be promoted into tenant-specific conclusions.

### Tenant service health

Detailed Microsoft 365 Business/Enterprise service health is tenant-scoped. Microsoft documents the Microsoft Graph service communications API for this purpose, including:

- `GET /admin/serviceAnnouncement/healthOverviews`
- `GET /admin/serviceAnnouncement/issues`
- least-privilege `ServiceHealth.Read.All`

A future tenant-health bridge must run in an authenticated private backend. Tokens, tenant identifiers, tenant-only incident detail, customer identity, and private service communications must never be exposed in the public browser bundle or public `status.json`.

The existing token-free public collection invariant therefore remains intact.

## Operator experience

The operator workspace exposes a dedicated Microsoft 365 critical-coverage surface with:

- current Microsoft 365 public source posture;
- current Entra public source posture;
- all critical Microsoft service facets;
- explicit public-vs-tenant evidence labels;
- direct jumps into Microsoft 365 and Entra provider focus;
- the private-backend Graph contract for future tenant-aware deployments;
- an operator rule to validate Microsoft service health before making local DNS, identity, mail, endpoint, or collaboration changes.

## Completion gate

This coverage phase is complete only when:

1. the replay evidence-boundary production defect is fixed without weakening the verifier;
2. Microsoft 365 critical service facets are regression-tested;
3. the public pipeline remains token-free and contains no Microsoft tenant credentials;
4. deterministic tests, strict TypeScript, production build, audit, and CodeQL pass;
5. current Chrome, pinned pre-Cascade-Layers Chromium, and exact 458x291 Yodeck remain green;
6. deployed product-depth verification passes Dependency Universe, universal search, live Incident Focus when available, desktop, and mobile;
7. the Microsoft 365 critical surface is visually inspected on the deployed product;
8. final documentation records the production and evidence runs.
