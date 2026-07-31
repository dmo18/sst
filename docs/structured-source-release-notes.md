# Structured source adapter release

This working note records the implementation scope for the 2.4.0 release.

- Prefer official Statuspage JSON summaries for selected catalog providers.
- Parse incident lifecycle, current update, components, first detection, and latest update.
- Use the public Better Stack status-page JSON document for SuperOps.
- Parse public Status.io pages for ConnectWise and HaloPSA with component and location filtering.
- Keep scheduled maintenance, marketing, resolved records, and explicitly non-US-only incidents out of active incident output.
- Fail closed when a structured source is malformed or reports a non-operational summary without a usable incident record.

This file will be removed before merge after the release changelog is finalized.
