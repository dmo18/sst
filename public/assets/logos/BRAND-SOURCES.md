# Provider brand mark sources

The status workspace bundles provider marks locally so operator recognition never depends on a third-party CDN or runtime favicon request.

The following monochrome brand geometries are pinned from Simple Icons 16.27.1: GitHub, DigitalOcean, Okta, Dropbox, Box, 1Password, Auth0, Bitwarden, LastPass, Discord, Docker, Vercel, Stripe, PayPal, Shopify, HubSpot, Zendesk, Notion, Asana, Xero, GoDaddy, Fortinet, Malwarebytes, Cisco, QuickBooks, Vultr, Backblaze, Keeper, Ubiquiti, Lumen, Wasabi, Bitdefender, and Elastic.

Simple Icons project content is distributed under CC0-1.0. Brand names and trademarks remain the property of their respective owners and are used here only to identify monitored third-party services. Existing hand-built local marks remain in place for Microsoft 365, Entra ID, AWS, Cloudflare, Google Workspace, Google Cloud, OpenAI, Anthropic, Slack, and Zoom.

For the 35 canonical providers that previously used letter-based recognition tiles, verified application builds now require recognizable official artwork for every provider before Vite builds the release shell. `config/provider-favicon-sources.json` defines that exact provider set, requires `minimumResolved: 35`, and records explicit official artwork and vendor website overrides where ordinary status-page favicon discovery is insufficient.

The build-time source order is:

1. Existing committed exact vector or native local mark.
2. Explicit pinned artwork from an official vendor or official product documentation site.
3. Favicon discovered from an explicit official vendor website override.
4. Favicon discovered from the provider's configured official status-site origin.
5. The deterministic provider-specific letter tile only as a runtime decode or unexpected source failure fallback.

`scripts/sync-provider-favicons.mjs` validates fetched image media types and sizes, supports modern and legacy ICO files, and embeds the accepted bytes inside local `data:image/svg+xml` wrappers generated into `src/generated/providerFavicons.ts`. General discovered favicons remain capped at 64 KB. Explicitly pinned official assets use a separate 512 KB ceiling so a documented vendor logo can be accepted without relaxing the safety limit for arbitrary favicon discovery.

This process is build-time only. The deployed browser never contacts provider sites, Google favicon services, or a logo CDN for provider artwork. Each release also writes `public/assets/logos/provider-favicon-sources.json` with source kind, source page, resolved asset URL, media type, byte count, and SHA-256 digest for production traceability.

If any of the 35 required provider identities cannot be resolved during a verified application build, the build fails rather than silently shipping the ordinary letter-tile presentation again. The runtime letter tile remains only as a defensive last resort if an already embedded image cannot be decoded in a particular browser.
