# Provider brand mark sources

The status workspace bundles provider marks locally so operator recognition never depends on a third-party CDN or runtime favicon request.

The following monochrome brand geometries are pinned from Simple Icons 16.27.1: GitHub, DigitalOcean, Okta, Dropbox, Box, 1Password, Auth0, Bitwarden, LastPass, Discord, Docker, Vercel, Stripe, PayPal, Shopify, HubSpot, Zendesk, Notion, Asana, Xero, GoDaddy, Fortinet, Malwarebytes, Cisco, QuickBooks, Vultr, Backblaze, Keeper, Ubiquiti, Lumen, Wasabi, Bitdefender, and Elastic.

Simple Icons project content is distributed under CC0-1.0. Brand names and trademarks remain the property of their respective owners and are used here only to identify monitored third-party services. Existing hand-built local marks remain in place for Microsoft 365, Entra ID, AWS, Cloudflare, Google Workspace, Google Cloud, OpenAI, Anthropic, Slack, and Zoom.

For canonical providers that previously used letter-based recognition tiles, verified application builds resolve recognizable favicon artwork before Vite builds the release shell. `config/provider-favicon-sources.json` defines the providers covered by this process, the minimum acceptable resolution count, and explicit official vendor website overrides for providers whose hosted status page is missing a favicon or exposes a generic platform icon.

`scripts/sync-provider-favicons.mjs` tries an explicit official vendor website first when an override is configured, then falls back to the provider's configured official status-site origin. It discovers standard favicon links, validates the returned image type and size, and embeds the fetched bytes inside local `data:image/svg+xml` wrappers generated into `src/generated/providerFavicons.ts`.

This favicon process is build-time only. The deployed browser never contacts provider sites, Google favicon services, or a logo CDN for provider artwork. Each release also writes `public/assets/logos/provider-favicon-sources.json` with the page source, source kind, resolved icon URL, media type, byte count, and SHA-256 digest for production traceability.

If a provider favicon cannot be resolved during a build, its deterministic provider-specific recognition tile remains the final fallback. The verified build fails when favicon resolution drops below the configured minimum so a broad regression back to letter tiles cannot silently ship.
